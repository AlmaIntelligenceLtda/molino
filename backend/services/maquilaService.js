import { sql } from "../db/connection.js";

export async function obtenerSaldoHarina(empresaId, clienteId) {
  // Ledger: suma de kg por producto_harina_id
  const harina = await sql`
    SELECT
      producto_harina_id,
      COALESCE(SUM(kg), 0) AS saldo_kg
    FROM maquila_movimientos
    WHERE empresa_id = ${empresaId} AND cliente_id = ${clienteId}
    GROUP BY producto_harina_id
    ORDER BY producto_harina_id
  `;

  // Trigo pendiente de acreditar (recepciones maquila sin procesar)
  const [trigo] = await sql`
    SELECT COALESCE(SUM(
      COALESCE(r.peso_neto_pagar_kg, r.peso_neto_fisico_kg, 0)
    ), 0) AS pendiente_kg
    FROM recepciones r
    WHERE r.empresa_id = ${empresaId} AND r.cliente_id = ${clienteId}
      AND r.tipo_recepcion = 'maquila'
      AND (r.peso_neto_pagar_kg > 0 OR r.peso_neto_fisico_kg > 0)
      AND NOT EXISTS (
        SELECT 1 FROM maquila_movimientos m
        WHERE m.recepcion_id = r.id AND m.tipo_movimiento = 'CREDITO_HARINA_CONFIRMADO_KG'
      )
  `;

  return {
    harina,
    trigo_pendiente_kg: Number(trigo?.pendiente_kg || 0)
  };
}

/**
 * Cuenta corriente del cliente: trigo depositado (recepciones maquila), saldos de harina y movimientos.
 */
export async function getCuentaCorriente(empresaId, clienteId) {
  const [cliente] = await sql`
    SELECT id, rut, razon_social, nombre_fantasia, telefono, email_facturacion
    FROM clientes
    WHERE empresa_id = ${empresaId} AND id = ${clienteId}
    LIMIT 1
  `;
  if (!cliente) return null;

  // Trigo: recepciones tipo maquila del cliente (depósitos de trigo)
  const recepcionesTrigo = await sql`
    SELECT r.id, r.ticket_codigo, r.fecha_entrada, r.peso_neto_fisico_kg, r.peso_neto_pagar_kg,
           r.rendimiento_harina_pct, r.harina_equivalente_kg, pa.nombre AS producto_nombre
    FROM recepciones r
    LEFT JOIN productos_agricolas pa ON pa.id = r.producto_agricola_id
    WHERE r.empresa_id = ${empresaId} AND r.cliente_id = ${clienteId} AND r.tipo_recepcion = 'maquila'
    ORDER BY r.fecha_entrada DESC
    LIMIT 500
  `;

  const totalTrigoKg = recepcionesTrigo.reduce(
    (sum, r) => sum + (Number(r.peso_neto_pagar_kg) || Number(r.peso_neto_fisico_kg) || 0),
    0
  );

  // Saldos de harina por producto (con nombre)
  const harinaSaldos = await sql`
    SELECT m.producto_harina_id,
           pt.nombre AS producto_nombre,
           COALESCE(SUM(m.kg), 0) AS saldo_kg
    FROM maquila_movimientos m
    LEFT JOIN productos_terminados pt ON pt.id = m.producto_harina_id
    WHERE m.empresa_id = ${empresaId} AND m.cliente_id = ${clienteId}
    GROUP BY m.producto_harina_id, pt.nombre
    HAVING COALESCE(SUM(m.kg), 0) <> 0
    ORDER BY pt.nombre
  `;

  // Movimientos (ledger) del cliente
  const movimientos = await sql`
    SELECT m.id, m.tipo_movimiento, m.kg, m.sacos_cantidad, m.saco_peso_kg, m.observacion, m.created_at,
           pt.nombre AS producto_nombre,
           r.ticket_codigo AS recepcion_ticket
    FROM maquila_movimientos m
    LEFT JOIN productos_terminados pt ON pt.id = m.producto_harina_id
    LEFT JOIN recepciones r ON r.id = m.recepcion_id
    WHERE m.empresa_id = ${empresaId} AND m.cliente_id = ${clienteId}
    ORDER BY m.created_at DESC
    LIMIT 300
  `;

  return {
    cliente,
    trigo: {
      total_kg: Math.round(totalTrigoKg),
      recepciones: recepcionesTrigo
    },
    harina_saldos: harinaSaldos.map((r) => ({
      producto_harina_id: r.producto_harina_id,
      producto_nombre: r.producto_nombre || `Producto #${r.producto_harina_id}`,
      saldo_kg: Number(r.saldo_kg)
    })),
    movimientos: movimientos.map((m) => ({
      id: m.id,
      tipo_movimiento: m.tipo_movimiento,
      kg: Number(m.kg),
      producto_nombre: m.producto_nombre,
      recepcion_ticket: m.recepcion_ticket,
      observacion: m.observacion,
      created_at: m.created_at
    }))
  };
}

/**
 * Lista resumen de cuenta corriente de todos los clientes (trigo total y harina total por cliente).
 */
export async function listarCuentasCorrientesResumen(empresaId) {
  const clientes = await sql`
    SELECT c.id, c.rut, c.razon_social, c.nombre_fantasia
    FROM clientes c
    WHERE c.empresa_id = ${empresaId}
    ORDER BY c.razon_social
  `;

  const resumen = await Promise.all(
    clientes.map(async (c) => {
      const [trigoRow] = await sql`
        SELECT COALESCE(SUM(r.peso_neto_pagar_kg), 0) + 0 AS total
        FROM recepciones r
        WHERE r.empresa_id = ${empresaId} AND r.cliente_id = ${c.id} AND r.tipo_recepcion = 'maquila'
      `;
      const harinaRows = await sql`
        SELECT COALESCE(SUM(m.kg), 0) AS total
        FROM maquila_movimientos m
        WHERE m.empresa_id = ${empresaId} AND m.cliente_id = ${c.id}
      `;
      const totalHarina = harinaRows.length ? Number(harinaRows[0].total) : 0;
      const totalTrigo = trigoRow ? Number(trigoRow.total) : 0;
      return {
        cliente_id: c.id,
        razon_social: c.razon_social,
        nombre_fantasia: c.nombre_fantasia,
        total_trigo_kg: Math.round(totalTrigo),
        total_harina_kg: Math.round(totalHarina)
      };
    })
  );

  return resumen.filter((r) => r.total_trigo_kg > 0 || r.total_harina_kg !== 0);
}

// --- Configuración: porcentajes de trabajo (54%, 60%, 50%, etc.) ---

export async function listarTiposTrabajoMaquila(empresaId) {
  return await sql`
    SELECT t.id, t.nombre, t.porcentaje, t.producto_harina_id, t.activo, t.orden, t.created_at,
           pt.nombre AS producto_harina_nombre
    FROM maquila_tipos_trabajo t
    LEFT JOIN productos_terminados pt ON pt.id = t.producto_harina_id
    WHERE t.empresa_id = ${empresaId}
    ORDER BY t.orden ASC, t.porcentaje DESC
  `;
}

export async function crearTipoTrabajoMaquila(empresaId, data) {
  const { nombre, porcentaje, producto_harina_id, activo, orden } = data;
  const pct = Number(porcentaje);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
    throw new Error("Porcentaje debe ser un número entre 0 y 100");
  }
  const [row] = await sql`
    INSERT INTO maquila_tipos_trabajo (empresa_id, nombre, porcentaje, producto_harina_id, activo, orden)
    VALUES (${empresaId}, ${nombre || `Trabajo ${pct}%`}, ${pct}, ${producto_harina_id || null}, ${activo !== false}, ${orden ?? 0})
    RETURNING id, nombre, porcentaje, producto_harina_id, activo, orden, created_at
  `;
  return row;
}

export async function actualizarTipoTrabajoMaquila(empresaId, id, data) {
  const [actual] = await sql`
    SELECT id, nombre, porcentaje, producto_harina_id, activo, orden
    FROM maquila_tipos_trabajo WHERE empresa_id = ${empresaId} AND id = ${id} LIMIT 1
  `;
  if (!actual) return null;

  const nombre = data.nombre !== undefined ? data.nombre : actual.nombre;
  let porcentaje = actual.porcentaje;
  if (data.porcentaje !== undefined) {
    porcentaje = Number(data.porcentaje);
    if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
      throw new Error("Porcentaje debe ser entre 0 y 100");
    }
  }
  const producto_harina_id = data.producto_harina_id !== undefined ? data.producto_harina_id : actual.producto_harina_id;
  const activo = data.activo !== undefined ? data.activo : actual.activo;
  const orden = data.orden !== undefined ? data.orden : actual.orden;

  const [row] = await sql`
    UPDATE maquila_tipos_trabajo
    SET nombre = ${nombre}, porcentaje = ${porcentaje}, producto_harina_id = ${producto_harina_id || null},
        activo = ${activo}, orden = ${orden}
    WHERE empresa_id = ${empresaId} AND id = ${id}
    RETURNING id, nombre, porcentaje, producto_harina_id, activo, orden, created_at
  `;
  return row || null;
}

export async function eliminarTipoTrabajoMaquila(empresaId, id) {
  const [row] = await sql`
    DELETE FROM maquila_tipos_trabajo WHERE empresa_id = ${empresaId} AND id = ${id}
    RETURNING id
  `;
  return row || null;
}

/** Recepciones tipo maquila con peso listo (para acreditar harina). Excluye las que ya tienen crédito. */
export async function listarRecepcionesMaquilaPendientesAcreditar(empresaId) {
  const rows = await sql`
    SELECT r.id, r.ticket_codigo, r.cliente_id, r.peso_neto_pagar_kg, r.peso_neto_fisico_kg,
           r.rendimiento_harina_pct, r.harina_equivalente_kg, r.producto_harina_id,
           r.fecha_entrada,
           c.razon_social AS cliente_nombre,
           pa.nombre AS producto_nombre
    FROM recepciones r
    LEFT JOIN clientes c ON c.id = r.cliente_id
    LEFT JOIN productos_agricolas pa ON pa.id = r.producto_agricola_id
    WHERE r.empresa_id = ${empresaId} AND r.tipo_recepcion = 'maquila'
      AND (r.peso_neto_pagar_kg > 0 OR r.peso_neto_fisico_kg > 0)
      AND NOT EXISTS (
        SELECT 1 FROM maquila_movimientos m
        WHERE m.recepcion_id = r.id AND m.tipo_movimiento = 'CREDITO_HARINA_CONFIRMADO_KG'
      )
    ORDER BY r.fecha_entrada DESC
    LIMIT 200
  `;
  return rows;
}

export async function registrarMovimientoMaquila(empresaId, usuarioId, data) {
  const {
    sucursal_id,
    bodega_id,
    cliente_id,
    producto_harina_id,
    recepcion_id,
    tipo_movimiento,
    kg,
    sacos_cantidad,
    saco_peso_kg,
    observacion
  } = data;

  const kgNum = Number(kg);
  if (!Number.isFinite(kgNum) || kgNum === 0) {
    throw new Error("kg inválido");
  }

  const [row] = await sql`
    INSERT INTO maquila_movimientos (
      empresa_id,
      sucursal_id,
      bodega_id,
      cliente_id,
      producto_harina_id,
      recepcion_id,
      tipo_movimiento,
      kg,
      sacos_cantidad,
      saco_peso_kg,
      observacion,
      usuario_id
    )
    VALUES (
      ${empresaId},
      ${sucursal_id || null},
      ${bodega_id || null},
      ${cliente_id || null},
      ${producto_harina_id || null},
      ${recepcion_id || null},
      ${tipo_movimiento},
      ${kgNum},
      ${sacos_cantidad || null},
      ${saco_peso_kg || null},
      ${observacion || null},
      ${usuarioId || null}
    )
    RETURNING id, tipo_movimiento, kg, created_at, sucursal_id
  `;

  let sucursal = null;
  if (row.sucursal_id) {
    [sucursal] = await sql`
      SELECT nombre, direccion, ciudad, telefono 
      FROM sucursales 
      WHERE id = ${row.sucursal_id} AND empresa_id = ${empresaId}
    `;
  }

  return {
    ...row,
    sucursal_nombre: sucursal?.nombre,
    sucursal_direccion: sucursal?.direccion,
    sucursal_ciudad: sucursal?.ciudad
  };
}

function buildTicketCodigo(recepcionId) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `R-${y}${m}${d}-${recepcionId}`;
}

export async function registrarRecepcionDirecta(empresaId, usuarioId, data) {
  const { cliente_id, chofer_vehiculo, peso_bruto, peso_tara, peso_neto } = data;

  if (!cliente_id) throw new Error("Cliente requerido");
  
  // Calcular neto final
  let neto = Number(peso_neto);
  const bruto = Number(peso_bruto) || 0;
  const tara = Number(peso_tara) || 0;
  
  if (!neto || neto <= 0) {
    if (bruto > 0) {
      neto = bruto - tara;
    }
  }
  
  if (!neto || neto <= 0) {
    throw new Error("Peso neto inválido. Ingrese peso neto directo o bruto/tara.");
  }

  // Buscar producto "Trigo" por defecto o el primero que haya
  const [prod] = await sql`
    SELECT id FROM productos_agricolas 
    WHERE empresa_id = ${empresaId} 
    AND (nombre ILIKE '%trigo%' OR codigo ILIKE '%trigo%') 
    LIMIT 1
  `;
  const productoAgricolaId = prod ? prod.id : (await sql`SELECT id FROM productos_agricolas WHERE empresa_id = ${empresaId} LIMIT 1`)[0]?.id;

  // Insertar recepción finalizada
  const [rec] = await sql`
    INSERT INTO recepciones (
      empresa_id,
      cliente_id,
      producto_agricola_id,
      tipo_recepcion,
      estado,
      peso_bruto_kg,
      peso_tara_kg,
      peso_neto_pagar_kg,
      fecha_entrada,
      fecha_salida,
      usuario_operador_id,
      observaciones,
      chofer_nombre
    ) VALUES (
      ${empresaId},
      ${cliente_id},
      ${productoAgricolaId},
      'maquila',
      'finalizado',
      ${bruto > 0 ? bruto : null},
      ${tara > 0 ? tara : null},
      ${neto},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      ${usuarioId},
      'Ingreso directo Maquila',
      ${chofer_vehiculo || null}
    )
    RETURNING id
  `;

  // Generar ticket
  const ticketCodigo = buildTicketCodigo(rec.id);
  const token = `T-${empresaId}-${rec.id}-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();

  await sql`
    UPDATE recepciones 
    SET ticket_codigo = ${ticketCodigo}, 
        ticket_token = ${token}
    WHERE id = ${rec.id}
  `;

  // Insertar registros en tabla pesajes si hubo bruto/tara
  if (bruto > 0) {
    await sql`INSERT INTO pesajes (empresa_id, recepcion_id, tipo, peso_kg, origen, usuario_id) VALUES (${empresaId}, ${rec.id}, 'BRUTO', ${bruto}, 'MANUAL', ${usuarioId})`;
  }
  if (tara > 0) {
    await sql`INSERT INTO pesajes (empresa_id, recepcion_id, tipo, peso_kg, origen, usuario_id) VALUES (${empresaId}, ${rec.id}, 'TARA', ${tara}, 'MANUAL', ${usuarioId})`;
  }

  return { id: rec.id, ticket_codigo: ticketCodigo, neto };
}
