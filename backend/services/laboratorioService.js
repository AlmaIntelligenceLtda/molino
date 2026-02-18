import { sql } from "../db/connection.js";

const HUMEDAD_ESTANDAR = 14;

export async function listarRecepcionesParaLaboratorio(empresaId) {
  return await sql`
    SELECT r.id,
      r.fecha_entrada,
      r.estado,
      r.tipo_recepcion,
      r.peso_neto_fisico_kg,
      p.razon_social AS proveedor_nombre,
      c.razon_social AS cliente_nombre,
      pa.nombre AS producto_nombre,
      l.id AS laboratorio_id
    FROM recepciones r
    LEFT JOIN proveedores p ON p.id = r.proveedor_id
    LEFT JOIN clientes c ON c.id = r.cliente_id
    LEFT JOIN productos_agricolas pa ON pa.id = r.producto_agricola_id
    LEFT JOIN laboratorio l ON l.recepcion_id = r.id
    WHERE r.empresa_id = ${empresaId}
    ORDER BY r.id DESC
  `;
}

export async function listarRegistrosLaboratorio(empresaId) {
  return await sql`
    SELECT l.id AS laboratorio_id,
      l.recepcion_id,
      l.humedad_porcentaje,
      l.impurezas_porcentaje,
      l.peso_hectolitrico,
      l.proteina_porcentaje,
      l.gluten_wet,
      l.indice_caida,
      l.granos_chuzos,
      l.punta_negra,
      l.aprobado_calidad,
      l.usuario_analista_id,
      l.observaciones,
      l.fecha_analisis,
      r.fecha_entrada,
      r.peso_neto_fisico_kg,
      r.tipo_recepcion,
      p.razon_social AS proveedor_nombre,
      c.razon_social AS cliente_nombre,
      pa.nombre AS producto_nombre
    FROM laboratorio l
    LEFT JOIN recepciones r ON r.id = l.recepcion_id
    LEFT JOIN proveedores p ON p.id = r.proveedor_id
    LEFT JOIN clientes c ON c.id = r.cliente_id
    LEFT JOIN productos_agricolas pa ON pa.id = r.producto_agricola_id
    WHERE l.empresa_id = ${empresaId}
    ORDER BY l.fecha_analisis DESC
  `;
}

export async function obtenerRecepcionLaboratorio(empresaId, recepcionId) {
  const rows = await sql`
    SELECT r.*,
      p.razon_social AS proveedor_nombre,
      c.razon_social AS cliente_nombre,
      pa.nombre AS producto_nombre,
      l.id AS laboratorio_id,
      l.humedad_porcentaje,
      l.impurezas_porcentaje,
      l.peso_hectolitrico,
      l.proteina_porcentaje,
      l.gluten_wet,
      l.indice_caida,
      l.granos_chuzos,
      l.punta_negra,
      l.observaciones AS lab_observaciones,
      l.fecha_analisis
    FROM recepciones r
    LEFT JOIN proveedores p ON p.id = r.proveedor_id
    LEFT JOIN clientes c ON c.id = r.cliente_id
    LEFT JOIN productos_agricolas pa ON pa.id = r.producto_agricola_id
    LEFT JOIN laboratorio l ON l.recepcion_id = r.id
    WHERE r.empresa_id = ${empresaId} AND r.id = ${recepcionId}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const r = rows[0];
  const laboratorio = r.laboratorio_id
    ? {
        id: r.laboratorio_id,
        humedad_porcentaje: r.humedad_porcentaje,
        impurezas_porcentaje: r.impurezas_porcentaje,
        peso_hectolitrico: r.peso_hectolitrico,
        proteina_porcentaje: r.proteina_porcentaje,
        gluten_wet: r.gluten_wet,
        indice_caida: r.indice_caida,
        granos_chuzos: r.granos_chuzos,
        punta_negra: r.punta_negra,
        observaciones: r.lab_observaciones,
        fecha_analisis: r.fecha_analisis
      }
    : null;

  // limpiar campos duplicados
  delete r.humedad_porcentaje;
  delete r.impurezas_porcentaje;
  delete r.peso_hectolitrico;
  delete r.proteina_porcentaje;
  delete r.gluten_wet;
  delete r.indice_caida;
  delete r.granos_chuzos;
  delete r.punta_negra;
  delete r.lab_observaciones;
  delete r.fecha_analisis;

  return { ...r, laboratorio };
}

function calcularDescuentos(pesoNetoFisicoKg, humedadPct, impurezasPct) {
  const neto = Number(pesoNetoFisicoKg) || 0;
  const humedad = Number(humedadPct) || 0;
  const impurezas = Number(impurezasPct) || 0;

  const excesoHumedad = Math.max(humedad - HUMEDAD_ESTANDAR, 0);
  const descuentoHumedad = Math.round((neto * excesoHumedad) / 100);
  const descuentoImpurezas = Math.round((neto * impurezas) / 100);
  const netoPagar = Math.max(neto - descuentoHumedad - descuentoImpurezas, 0);

  return { descuentoHumedad, descuentoImpurezas, netoPagar };
}

export async function upsertLaboratorio(empresaId, recepcionId, usuarioId, data) {
  const {
    humedad_porcentaje,
    impurezas_porcentaje,
    peso_hectolitrico,
    proteina_porcentaje,
    gluten_wet,
    indice_caida,
    granos_chuzos,
    punta_negra,
    observaciones
  } = data;

  // Traer neto físico para calcular castigos
  const [rec] = await sql`
    SELECT id, peso_neto_fisico_kg
    FROM recepciones
    WHERE empresa_id = ${empresaId} AND id = ${recepcionId}
    LIMIT 1
  `;

  if (!rec) return null;

  const { descuentoHumedad, descuentoImpurezas, netoPagar } = calcularDescuentos(
    rec.peso_neto_fisico_kg,
    humedad_porcentaje,
    impurezas_porcentaje
  );

  // Upsert laboratorio (1 a 1 con recepcion)
  const rows = await sql`
    INSERT INTO laboratorio (
      empresa_id,
      recepcion_id,
      humedad_porcentaje,
      impurezas_porcentaje,
      peso_hectolitrico,
      proteina_porcentaje,
      gluten_wet,
      indice_caida,
      granos_chuzos,
      punta_negra,
      usuario_analista_id,
      observaciones
    )
    VALUES (
      ${empresaId},
      ${recepcionId},
      ${humedad_porcentaje ?? null},
      ${impurezas_porcentaje ?? null},
      ${peso_hectolitrico ?? null},
      ${proteina_porcentaje ?? null},
      ${gluten_wet ?? null},
      ${indice_caida ?? null},
      ${granos_chuzos ?? null},
      ${punta_negra ?? null},
      ${usuarioId || null},
      ${observaciones || null}
    )
    ON CONFLICT (recepcion_id)
    DO UPDATE SET
      humedad_porcentaje = EXCLUDED.humedad_porcentaje,
      impurezas_porcentaje = EXCLUDED.impurezas_porcentaje,
      peso_hectolitrico = EXCLUDED.peso_hectolitrico,
      proteina_porcentaje = EXCLUDED.proteina_porcentaje,
      gluten_wet = EXCLUDED.gluten_wet,
      indice_caida = EXCLUDED.indice_caida,
      granos_chuzos = EXCLUDED.granos_chuzos,
      punta_negra = EXCLUDED.punta_negra,
      usuario_analista_id = EXCLUDED.usuario_analista_id,
      observaciones = EXCLUDED.observaciones,
      fecha_analisis = CURRENT_TIMESTAMP
    RETURNING id
  `;

  // Actualizar recepcion con descuentos (server-side fuente de verdad)
  await sql`
    UPDATE recepciones
    SET
      descuento_humedad_kg = ${descuentoHumedad},
      descuento_impurezas_kg = ${descuentoImpurezas},
      peso_neto_pagar_kg = ${netoPagar}
    WHERE empresa_id = ${empresaId} AND id = ${recepcionId}
  `;

  return { laboratorio_id: rows[0]?.id, descuento_humedad_kg: descuentoHumedad, descuento_impurezas_kg: descuentoImpurezas, peso_neto_pagar_kg: netoPagar };
}
