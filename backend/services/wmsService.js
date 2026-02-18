import { sql } from "../db/connection.js";

export async function obtenerMapaSilos(empresaId, { sucursalId } = {}) {
  const filtroSucursal = sucursalId
    ? sql`AND b.sucursal_id = ${sucursalId}`
    : sql``;

  const rows = await sql`
    SELECT
      s.id,
      s.codigo,
      s.descripcion,
      s.capacidad_max_kg,
      COALESCE(s.nivel_actual_kg, 0) AS nivel_actual_kg,
      s.estado,
      s.producto_actual_id,
      pa.nombre AS producto_actual_nombre,
      b.id AS bodega_id,
      b.nombre AS bodega_nombre,
      b.descripcion AS bodega_descripcion,
      suc.id AS sucursal_id,
      suc.nombre AS sucursal_nombre,
      CASE
        WHEN s.capacidad_max_kg > 0
        THEN ROUND((COALESCE(s.nivel_actual_kg, 0)::DECIMAL * 100) / s.capacidad_max_kg)
        ELSE 0
      END AS porcentaje_ocupacion,
      CASE
        WHEN s.capacidad_max_kg > 0
         AND COALESCE(s.nivel_actual_kg, 0) >= s.capacidad_max_kg * 0.9
        THEN TRUE
        ELSE FALSE
      END AS alerta_rebalse
    FROM silos s
    LEFT JOIN bodegas b ON b.id = s.bodega_id
    LEFT JOIN sucursales suc ON suc.id = b.sucursal_id
    LEFT JOIN productos_agricolas pa ON pa.id = s.producto_actual_id
    WHERE s.empresa_id = ${empresaId}
    ${filtroSucursal}
    ORDER BY suc.nombre NULLS LAST, b.nombre NULLS LAST, s.codigo
  `;

  return rows;
}

export async function listarLotes(empresaId, { estado, siloId } = {}) {
  const estadoFiltro = estado || "activo";

  const filtroEstado = estadoFiltro
    ? sql`AND l.estado = ${estadoFiltro}`
    : sql``;

  const filtroSilo = siloId
    ? sql`AND (um.silo_destino_id = ${siloId} OR um.silo_origen_id = ${siloId})`
    : sql``;

  const rows = await sql`
    WITH ult_mov AS (
      SELECT DISTINCT ON (m.lote_id)
        m.lote_id,
        m.silo_origen_id,
        m.silo_destino_id,
        m.tipo_movimiento,
        m.fecha
      FROM movimientos_inventario m
      WHERE m.empresa_id = ${empresaId}
      ORDER BY m.lote_id, m.fecha DESC, m.id DESC
    )
    SELECT
      l.id,
      l.codigo_lote,
      l.estado,
      l.cantidad_inicial_kg,
      l.cantidad_actual_kg,
      l.fecha_creacion,
      r.id AS recepcion_id,
      r.fecha_entrada,
      r.tipo_recepcion,
      p.razon_social AS proveedor_nombre,
      c.razon_social AS cliente_nombre,
      pa.nombre AS producto_nombre,
      s.id AS silo_id,
      s.codigo AS silo_codigo,
      b.id AS bodega_id,
      b.nombre AS bodega_nombre,
      suc.id AS sucursal_id,
      suc.nombre AS sucursal_nombre
    FROM lotes l
    LEFT JOIN recepciones r ON r.id = l.recepcion_id
    LEFT JOIN proveedores p ON p.id = r.proveedor_id
    LEFT JOIN clientes c ON c.id = r.cliente_id
    LEFT JOIN productos_agricolas pa ON pa.id = r.producto_agricola_id
    LEFT JOIN ult_mov um ON um.lote_id = l.id
    LEFT JOIN silos s ON s.id = COALESCE(um.silo_destino_id, um.silo_origen_id)
    LEFT JOIN bodegas b ON b.id = s.bodega_id
    LEFT JOIN sucursales suc ON suc.id = b.sucursal_id
    WHERE l.empresa_id = ${empresaId}
    ${filtroEstado}
    ${filtroSilo}
    ORDER BY l.fecha_creacion DESC, l.id DESC
  `;

  return rows;
}

export async function listarRecepcionesPendientes(empresaId) {
  return await sql`
    SELECT r.id, r.fecha_entrada, r.tipo_recepcion, r.peso_neto_pagar_kg,
           p.razon_social AS proveedor_nombre,
           c.razon_social AS cliente_nombre,
           pa.nombre AS producto_nombre
    FROM recepciones r
    JOIN laboratorio l ON l.recepcion_id = r.id
    LEFT JOIN proveedores p ON p.id = r.proveedor_id
    LEFT JOIN clientes c ON c.id = r.cliente_id
    LEFT JOIN productos_agricolas pa ON pa.id = r.producto_agricola_id
    LEFT JOIN lotes lot ON lot.recepcion_id = r.id
    WHERE r.empresa_id = ${empresaId}
      AND lot.id IS NULL
    ORDER BY r.fecha_entrada DESC
  `;
}

export async function listarMovimientos(empresaId, { siloId, loteId } = {}) {
  const filtroSilo = siloId
    ? sql`AND (m.silo_origen_id = ${siloId} OR m.silo_destino_id = ${siloId})`
    : sql``;

  const filtroLote = loteId
    ? sql`AND m.lote_id = ${loteId}`
    : sql``;

  const rows = await sql`
    SELECT
      m.id,
      m.tipo_movimiento,
      m.cantidad_kg,
      m.fecha,
      m.observacion,
      m.sucursal_id,
      suc.nombre AS sucursal_nombre,
      so.id AS silo_origen_id,
      so.codigo AS silo_origen_codigo,
      sd.id AS silo_destino_id,
      sd.codigo AS silo_destino_codigo,
      l.id AS lote_id,
      l.codigo_lote
    FROM movimientos_inventario m
    LEFT JOIN sucursales suc ON suc.id = m.sucursal_id
    LEFT JOIN silos so ON so.id = m.silo_origen_id
    LEFT JOIN silos sd ON sd.id = m.silo_destino_id
    LEFT JOIN lotes l ON l.id = m.lote_id
    WHERE m.empresa_id = ${empresaId}
    ${filtroSilo}
    ${filtroLote}
    ORDER BY m.fecha DESC, m.id DESC
  `;

  return rows;
}

export async function crearLoteDesdeRecepcion(empresa_id, usuario_id, data) {
  const inputRecepcion = String(data.recepcion_id || "").trim();
  const siloDestinoId = Number(data.silo_destino_id);
  const cantidadReq = data.cantidad_kg != null ? Number(data.cantidad_kg) : null;
  const observacion = data.observacion || null;

  if (!inputRecepcion || !siloDestinoId) {
    throw new Error("ID/Código de recepción y silo_destino_id son requeridos");
  }

  // Determinar si el input es un ID numérico o un código de ticket (alfanumérico)
  let recepcion;
  if (/^\d+$/.test(inputRecepcion)) {
    // Es un ID numérico
    [recepcion] = await sql`
      SELECT r.id, r.empresa_id, r.sucursal_id, r.peso_neto_pagar_kg, r.peso_neto_fisico_kg,
             r.producto_agricola_id, r.ticket_codigo, l.id AS laboratorio_id
      FROM recepciones r
      LEFT JOIN laboratorio l ON l.recepcion_id = r.id
      WHERE r.empresa_id = ${empresa_id} AND r.id = ${Number(inputRecepcion)}
      LIMIT 1
    `;
  } else {
    // Es un código de ticket
    [recepcion] = await sql`
      SELECT r.id, r.empresa_id, r.sucursal_id, r.peso_neto_pagar_kg, r.peso_neto_fisico_kg,
             r.producto_agricola_id, r.ticket_codigo, l.id AS laboratorio_id
      FROM recepciones r
      LEFT JOIN laboratorio l ON l.recepcion_id = r.id
      WHERE r.empresa_id = ${empresa_id} AND r.ticket_codigo = ${inputRecepcion}
      LIMIT 1
    `;
  }

  if (!recepcion) {
    throw new Error("Recepción no encontrada para la empresa o código inválido");
  }

  // Laboratorio es opcional: si el molino no tiene lab, se usa peso_neto_fisico_kg como base
  const recepcionId = recepcion.id;
  const [silo] = await sql`
    SELECT s.*, b.sucursal_id
    FROM silos s
    LEFT JOIN bodegas b ON b.id = s.bodega_id
    WHERE s.empresa_id = ${empresa_id} AND s.id = ${siloDestinoId}
    LIMIT 1
  `;

  if (!silo) {
    throw new Error("Silo destino no encontrado para la empresa");
  }

  const pesoPagar = Number(recepcion.peso_neto_pagar_kg);
  const pesoFisico = Number(recepcion.peso_neto_fisico_kg);
  const cantidadBase =
    cantidadReq != null && Number.isFinite(Number(cantidadReq)) && Number(cantidadReq) > 0
      ? Number(cantidadReq)
      : (Number.isFinite(pesoPagar) && pesoPagar > 0 ? pesoPagar : Number.isFinite(pesoFisico) && pesoFisico > 0 ? pesoFisico : 0);

  if (!Number.isFinite(cantidadBase) || cantidadBase <= 0) {
    throw new Error(
      "Cantidad en kg inválida para crear el lote. La recepción no tiene peso neto registrado; indique la cantidad en kg manualmente."
    );
  }

  // El código del lote DEBE ser el código del ticket (código de barras) para trazabilidad total.
  // Esto asegura que el papel físico en mano del chofer sea la identidad del lote en el silo.
  if (!recepcion.ticket_codigo) {
    throw new Error("La recepción aún no tiene un código de ticket (código de barras) generado.");
  }

  const codigoLote = recepcion.ticket_codigo;

  const [lote] = await sql`
    INSERT INTO lotes (
      empresa_id,
      codigo_lote,
      recepcion_id,
      cantidad_inicial_kg,
      cantidad_actual_kg,
      estado
    )
    VALUES (
      ${empresa_id},
      ${codigoLote},
      ${recepcionId},
      ${Math.round(cantidadBase)},
      ${Math.round(cantidadBase)},
      'activo'
    )
    RETURNING *
  `;

  const [siloActualizado] = await sql`
    UPDATE silos
    SET
      nivel_actual_kg = COALESCE(nivel_actual_kg, 0) + ${Math.round(cantidadBase)},
      producto_actual_id = COALESCE(producto_actual_id, ${recepcion.producto_agricola_id || null})
    WHERE id = ${siloDestinoId} AND empresa_id = ${empresa_id}
    RETURNING *
  `;

  const sucursalMovimientoId = silo.sucursal_id || recepcion.sucursal_id || null;

  const [mov] = await sql`
    INSERT INTO movimientos_inventario (
      empresa_id,
      sucursal_id,
      tipo_movimiento,
      silo_origen_id,
      silo_destino_id,
      lote_id,
      cantidad_kg,
      usuario_id,
      observacion
    )
    VALUES (
      ${empresa_id},
      ${sucursalMovimientoId},
      'INGRESO_SILO',
      NULL,
      ${siloDestinoId},
      ${lote.id},
      ${Math.round(cantidadBase)},
      ${usuario_id || null},
      ${observacion || `Ingreso desde recepción #${recepcionId}`}
    )
    RETURNING *
  `;

  return { lote, silo: siloActualizado, movimiento: mov };
}

export async function registrarTrasiego(empresaId, usuarioId, data) {
  const loteId = Number(data.lote_id);
  const siloOrigenId = Number(data.silo_origen_id);
  const siloDestinoId = Number(data.silo_destino_id);
  const cantidad = Number(data.cantidad_kg);
  const observacion = data.observacion || null;

  if (!loteId || !siloOrigenId || !siloDestinoId) {
    throw new Error("lote_id, silo_origen_id y silo_destino_id son requeridos");
  }

  if (siloOrigenId === siloDestinoId) {
    throw new Error("El silo de origen y destino no pueden ser el mismo para un trasiego");
  }

  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new Error("cantidad_kg debe ser un número positivo");
  }

  const [lote] = await sql`
    SELECT *
    FROM lotes
    WHERE empresa_id = ${empresaId} AND id = ${loteId}
    LIMIT 1
  `;

  if (!lote) {
    throw new Error("Lote no encontrado para la empresa");
  }

  if ((lote.cantidad_actual_kg || 0) < cantidad) {
    throw new Error("El lote no tiene saldo suficiente para el trasiego");
  }

  const [siloOrigen] = await sql`
    SELECT s.*, b.sucursal_id
    FROM silos s
    LEFT JOIN bodegas b ON b.id = s.bodega_id
    WHERE s.empresa_id = ${empresaId} AND s.id = ${siloOrigenId}
    LIMIT 1
  `;

  if (!siloOrigen) {
    throw new Error("Silo origen no encontrado para la empresa");
  }

  const [siloDestino] = await sql`
    SELECT s.*, b.sucursal_id
    FROM silos s
    LEFT JOIN bodegas b ON b.id = s.bodega_id
    WHERE s.empresa_id = ${empresaId} AND s.id = ${siloDestinoId}
    LIMIT 1
  `;

  if (!siloDestino) {
    throw new Error("Silo destino no encontrado para la empresa");
  }

  if ((siloOrigen.nivel_actual_kg || 0) < cantidad) {
    throw new Error("El silo origen no tiene stock suficiente para el trasiego");
  }

  const [siloOrigenActualizado] = await sql`
    UPDATE silos
    SET nivel_actual_kg = COALESCE(nivel_actual_kg, 0) - ${Math.round(cantidad)}
    WHERE id = ${siloOrigenId} AND empresa_id = ${empresaId}
    RETURNING *
  `;

  const [siloDestinoActualizado] = await sql`
    UPDATE silos
    SET nivel_actual_kg = COALESCE(nivel_actual_kg, 0) + ${Math.round(cantidad)}
    WHERE id = ${siloDestinoId} AND empresa_id = ${empresaId}
    RETURNING *
  `;

  const sucursalMovimientoId = siloDestino.sucursal_id || siloOrigen.sucursal_id || null;

  const [movimiento] = await sql`
    INSERT INTO movimientos_inventario (
      empresa_id,
      sucursal_id,
      tipo_movimiento,
      silo_origen_id,
      silo_destino_id,
      lote_id,
      cantidad_kg,
      usuario_id,
      observacion
    )
    VALUES (
      ${empresaId},
      ${sucursalMovimientoId},
      'TRASIEGO',
      ${siloOrigenId},
      ${siloDestinoId},
      ${loteId},
      ${Math.round(cantidad)},
      ${usuarioId || null},
      ${observacion || `Trasiego de lote #${loteId}`}
    )
    RETURNING *
  `;

  return {
    lote: { ...lote, cantidad_actual_kg: (lote.cantidad_actual_kg || 0) - Math.round(cantidad) },
    siloOrigen: siloOrigenActualizado,
    siloDestino: siloDestinoActualizado,
    movimiento
  };
}

export async function registrarMezcla(empresaId, usuarioId, data) {
  const siloDestinoId = Number(data.silo_destino_id);
  const loteOrigenAId = Number(data.lote_origen_a_id);
  const loteOrigenBId = Number(data.lote_origen_b_id);
  const cantidadAKg = Number(data.cantidad_a_kg);
  const cantidadBKg = Number(data.cantidad_b_kg);
  const codigoLote = data.codigo_lote || null;
  const observacion = data.observacion || null;

  if (!siloDestinoId || !loteOrigenAId || !loteOrigenBId) {
    throw new Error("silo_destino_id, lote_origen_a_id y lote_origen_b_id son requeridos");
  }

  if (loteOrigenAId === loteOrigenBId) {
    throw new Error("El lote de origen A y el lote de origen B deben ser diferentes para una mezcla");
  }

  if (!Number.isFinite(cantidadAKg) || cantidadAKg <= 0 || !Number.isFinite(cantidadBKg) || cantidadBKg <= 0) {
    throw new Error("Las cantidades de mezcla deben ser números positivos");
  }

  const totalKg = Math.round(cantidadAKg + cantidadBKg);

  const [loteA] = await sql`
    SELECT * FROM lotes WHERE empresa_id = ${empresaId} AND id = ${loteOrigenAId} LIMIT 1
  `;
  const [loteB] = await sql`
    SELECT * FROM lotes WHERE empresa_id = ${empresaId} AND id = ${loteOrigenBId} LIMIT 1
  `;

  if (!loteA || !loteB) {
    throw new Error("Lotes de origen no encontrados para la empresa");
  }

  // Validar que el silo destino no sea el mismo que los silos de origen de los lotes
  if (loteA.silo_id === siloDestinoId || loteB.silo_id === siloDestinoId) {
    throw new Error("El silo de destino de la mezcla no puede ser el mismo que los silos de origen de los lotes");
  }

  if ((loteA.cantidad_actual_kg || 0) < cantidadAKg || (loteB.cantidad_actual_kg || 0) < cantidadBKg) {
    throw new Error("Saldo insuficiente en alguno de los lotes de origen");
  }

  const [siloDestino] = await sql`
    SELECT s.*, b.sucursal_id
    FROM silos s
    LEFT JOIN bodegas b ON b.id = s.bodega_id
    WHERE s.empresa_id = ${empresaId} AND s.id = ${siloDestinoId}
    LIMIT 1
  `;

  if (!siloDestino) {
    throw new Error("Silo destino no encontrado para la empresa");
  }

  const [siloOrigenA] = await sql`
    SELECT s.*
    FROM silos s
    WHERE s.empresa_id = ${empresaId}
      AND s.id IN (
        SELECT COALESCE(m.silo_destino_id, m.silo_origen_id)
        FROM movimientos_inventario m
        WHERE m.empresa_id = ${empresaId} AND m.lote_id = ${loteOrigenAId}
        ORDER BY m.fecha DESC, m.id DESC
        LIMIT 1
      )
    LIMIT 1
  `;

  const [siloOrigenB] = await sql`
    SELECT s.*
    FROM silos s
    WHERE s.empresa_id = ${empresaId}
      AND s.id IN (
        SELECT COALESCE(m.silo_destino_id, m.silo_origen_id)
        FROM movimientos_inventario m
        WHERE m.empresa_id = ${empresaId} AND m.lote_id = ${loteOrigenBId}
        ORDER BY m.fecha DESC, m.id DESC
        LIMIT 1
      )
    LIMIT 1
  `;

  if (!siloOrigenA || !siloOrigenB) {
    throw new Error("No se pudo determinar el silo origen de alguno de los lotes");
  }

  if ((siloOrigenA.nivel_actual_kg || 0) < cantidadAKg || (siloOrigenB.nivel_actual_kg || 0) < cantidadBKg) {
    throw new Error("Stock insuficiente en alguno de los silos de origen");
  }

  const codigoNuevoLote =
    codigoLote ||
    (() => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      return `MIX-${y}${m}${d}-${loteOrigenAId}-${loteOrigenBId}`;
    })();

  const [nuevoLote] = await sql`
    INSERT INTO lotes (
      empresa_id,
      codigo_lote,
      recepcion_id,
      cantidad_inicial_kg,
      cantidad_actual_kg,
      estado
    )
    VALUES (
      ${empresaId},
      ${codigoNuevoLote},
      NULL,
      ${totalKg},
      ${totalKg},
      'activo'
    )
    RETURNING *
  `;

  const [siloOrigenAActualizado] = await sql`
    UPDATE silos
    SET nivel_actual_kg = COALESCE(nivel_actual_kg, 0) - ${Math.round(cantidadAKg)}
    WHERE id = ${siloOrigenA.id} AND empresa_id = ${empresaId}
    RETURNING *
  `;

  const [siloOrigenBActualizado] = await sql`
    UPDATE silos
    SET nivel_actual_kg = COALESCE(nivel_actual_kg, 0) - ${Math.round(cantidadBKg)}
    WHERE id = ${siloOrigenB.id} AND empresa_id = ${empresaId}
    RETURNING *
  `;

  const [siloDestinoActualizado] = await sql`
    UPDATE silos
    SET nivel_actual_kg = COALESCE(nivel_actual_kg, 0) + ${totalKg}
    WHERE id = ${siloDestinoId} AND empresa_id = ${empresaId}
    RETURNING *
  `;

  const sucursalMovimientoId = siloDestino.sucursal_id || null;

  const [movA] = await sql`
    INSERT INTO movimientos_inventario (
      empresa_id,
      sucursal_id,
      tipo_movimiento,
      silo_origen_id,
      silo_destino_id,
      lote_id,
      cantidad_kg,
      usuario_id,
      observacion
    )
    VALUES (
      ${empresaId},
      ${sucursalMovimientoId},
      'MEZCLA_SALIDA',
      ${siloOrigenA.id},
      ${siloDestinoId},
      ${loteOrigenAId},
      ${Math.round(cantidadAKg)},
      ${usuarioId || null},
      ${observacion || `Mezcla origen lote #${loteOrigenAId}`}
    )
    RETURNING *
  `;

  const [movB] = await sql`
    INSERT INTO movimientos_inventario (
      empresa_id,
      sucursal_id,
      tipo_movimiento,
      silo_origen_id,
      silo_destino_id,
      lote_id,
      cantidad_kg,
      usuario_id,
      observacion
    )
    VALUES (
      ${empresaId},
      ${sucursalMovimientoId},
      'MEZCLA_SALIDA',
      ${siloOrigenB.id},
      ${siloDestinoId},
      ${loteOrigenBId},
      ${Math.round(cantidadBKg)},
      ${usuarioId || null},
      ${observacion || `Mezcla origen lote #${loteOrigenBId}`}
    )
    RETURNING *
  `;

  const [movDestino] = await sql`
    INSERT INTO movimientos_inventario (
      empresa_id,
      sucursal_id,
      tipo_movimiento,
      silo_origen_id,
      silo_destino_id,
      lote_id,
      cantidad_kg,
      usuario_id,
      observacion
    )
    VALUES (
      ${empresaId},
      ${sucursalMovimientoId},
      'MEZCLA_ENTRADA',
      NULL,
      ${siloDestinoId},
      ${nuevoLote.id},
      ${totalKg},
      ${usuarioId || null},
      ${observacion || 'Mezcla de lotes'}
    )
    RETURNING *
  `;

  const [loteAActualizado] = await sql`
    UPDATE lotes
    SET cantidad_actual_kg = COALESCE(cantidad_actual_kg, 0) - ${Math.round(cantidadAKg)}
    WHERE id = ${loteOrigenAId} AND empresa_id = ${empresaId}
    RETURNING *
  `;

  const [loteBActualizado] = await sql`
    UPDATE lotes
    SET cantidad_actual_kg = COALESCE(cantidad_actual_kg, 0) - ${Math.round(cantidadBKg)}
    WHERE id = ${loteOrigenBId} AND empresa_id = ${empresaId}
    RETURNING *
  `;

  return {
    loteNuevo: nuevoLote,
    loteA: loteAActualizado,
    loteB: loteBActualizado,
    siloDestino: siloDestinoActualizado,
    siloOrigenA: siloOrigenAActualizado,
    siloOrigenB: siloOrigenBActualizado,
    movimientos: { movA, movB, movDestino }
  };
}
