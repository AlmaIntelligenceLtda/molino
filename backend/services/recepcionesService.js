import { sql } from "../db/connection.js";

function normalizarCodigo(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function buildTicketCodigo(recepcionId) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `R-${y}${m}${d}-${recepcionId}`;
}

export async function listarProveedores(empresaId) {
  return await sql`
    SELECT id, rut, razon_social, alias, telefono, email, created_at
    FROM proveedores
    WHERE empresa_id = ${empresaId}
    ORDER BY id DESC
  `;
}

export async function crearProveedor(empresaId, data) {
  const { rut, razon_social, alias, telefono, email } = data;
  const [row] = await sql`
    INSERT INTO proveedores (empresa_id, rut, razon_social, alias, telefono, email)
    VALUES (${empresaId}, ${rut}, ${razon_social}, ${alias || null}, ${telefono || null}, ${email || null})
    RETURNING id, rut, razon_social, alias, telefono, email, created_at
  `;
  return row;
}

export async function listarProductosAgricolas(empresaId) {
  return await sql`
    SELECT id, nombre, codigo, descripcion, created_at
    FROM productos_agricolas
    WHERE empresa_id = ${empresaId}
    ORDER BY id DESC
  `;
}

export async function crearProductoAgricola(empresaId, data) {
  const { nombre, codigo, descripcion } = data;
  const [row] = await sql`
    INSERT INTO productos_agricolas (empresa_id, nombre, codigo, descripcion)
    VALUES (${empresaId}, ${nombre}, ${codigo || null}, ${descripcion || null})
    RETURNING id, nombre, codigo, descripcion, created_at
  `;
  return row;
}

export async function actualizarProductoAgricola(empresaId, id, data) {
  const { nombre, codigo, descripcion } = data;
  const [row] = await sql`
    UPDATE productos_agricolas
    SET nombre = ${nombre},
        codigo = ${codigo || null},
        descripcion = ${descripcion || null}
    WHERE id = ${id} AND empresa_id = ${empresaId}
    RETURNING id, nombre, codigo, descripcion, created_at
  `;
  return row;
}

export async function eliminarProductoAgricola(empresaId, id) {
  // 1. Verificar dependencias en Recepciones
  const [recepcion] = await sql`
    SELECT id FROM recepciones WHERE producto_agricola_id = ${id} AND empresa_id = ${empresaId} LIMIT 1
  `;
  if (recepcion) {
    throw new Error("No se puede eliminar porque tiene movimientos (Recepciones).");
  }

  // 2. Verificar dependencias en Silos
  const [silo] = await sql`
    SELECT id FROM silos WHERE producto_actual_id = ${id} AND empresa_id = ${empresaId} LIMIT 1
  `;
  if (silo) {
    throw new Error("No se puede eliminar porque hay silos configurados con este producto.");
  }

  // 3. Verificar dependencias en Fórmulas (Ingredientes)
  // Nota: La tabla formula_ingredientes fue creada en una migración posterior, verificar si existe antes o manejar error
  try {
    const [ingrediente] = await sql`
      SELECT id FROM formula_ingredientes WHERE producto_agricola_id = ${id} AND empresa_id = ${empresaId} LIMIT 1
    `;
    if (ingrediente) {
      throw new Error("No se puede eliminar porque es ingrediente en una fórmula de producción.");
    }
  } catch (err) {
    // Si la tabla no existe, ignoramos este chequeo
    if (err.code !== '42P01') throw err; 
  }

  // 4. Eliminar
  const result = await sql`
    DELETE FROM productos_agricolas WHERE id = ${id} AND empresa_id = ${empresaId}
    RETURNING id
  `;
  
  return result.length > 0;
}

export async function listarChoferes(empresaId) {
  return await sql`
    SELECT id, codigo_chofer, nombre, rut, telefono, email, activo, created_at
    FROM choferes
    WHERE empresa_id = ${empresaId}
    ORDER BY id DESC
  `;
}

export async function crearChofer(empresaId, data) {
  const { nombre, rut, telefono, email } = data;

  const inserted = await sql`
    INSERT INTO choferes (empresa_id, nombre, rut, telefono, email)
    VALUES (${empresaId}, ${nombre}, ${rut}, ${telefono || null}, ${email || null})
    RETURNING id, nombre, rut, telefono, email, codigo_chofer, activo, created_at
  `;

  const row = inserted[0];

  if (!row.codigo_chofer) {
    const codigo = `CH-${empresaId}-${row.id}`;
    const [updated] = await sql`
      UPDATE choferes
      SET codigo_chofer = ${codigo}
      WHERE id = ${row.id} AND empresa_id = ${empresaId}
      RETURNING id, codigo_chofer, nombre, rut, telefono, email, activo, created_at
    `;
    return updated;
  }

  return row;
}

export async function buscarChoferPorCodigo(empresaId, codigo) {
  const codigoNorm = normalizarCodigo(codigo);
  const [row] = await sql`
    SELECT id, codigo_chofer, nombre, rut, telefono, email, activo
    FROM choferes
    WHERE empresa_id = ${empresaId} AND UPPER(REPLACE(codigo_chofer, ' ', '')) = ${codigoNorm}
    LIMIT 1
  `;
  return row || null;
}

export async function listarCamiones(empresaId) {
  return await sql`
    SELECT id, codigo_camion, patente, marca, modelo, capacidad_carga_kg, estado, activo
    FROM camiones
    WHERE empresa_id = ${empresaId}
    ORDER BY id DESC
  `;
}

export async function crearCamion(empresaId, data) {
  const { patente, marca, modelo, capacidad_carga_kg } = data;

  const inserted = await sql`
    INSERT INTO camiones (empresa_id, patente, marca, modelo, capacidad_carga_kg)
    VALUES (${empresaId}, ${patente}, ${marca || null}, ${modelo || null}, ${capacidad_carga_kg || null})
    RETURNING id, codigo_camion, patente, marca, modelo, capacidad_carga_kg, estado, activo
  `;

  const row = inserted[0];

  if (!row.codigo_camion) {
    const codigo = `CA-${empresaId}-${row.id}`;
    const [updated] = await sql`
      UPDATE camiones
      SET codigo_camion = ${codigo}
      WHERE id = ${row.id} AND empresa_id = ${empresaId}
      RETURNING id, codigo_camion, patente, marca, modelo, capacidad_carga_kg, estado, activo
    `;
    return updated;
  }

  return row;
}

export async function buscarCamionPorCodigo(empresaId, codigo) {
  const codigoNorm = normalizarCodigo(codigo);
  const [row] = await sql`
    SELECT id, codigo_camion, patente, marca, modelo, capacidad_carga_kg, estado, activo
    FROM camiones
    WHERE empresa_id = ${empresaId} AND UPPER(REPLACE(codigo_camion, ' ', '')) = ${codigoNorm}
    LIMIT 1
  `;
  return row || null;
}

export async function listarCarros(empresaId) {
  return await sql`
    SELECT id, codigo_carro, patente, marca, modelo, capacidad_carga_kg, activo
    FROM carros
    WHERE empresa_id = ${empresaId}
    ORDER BY id DESC
  `;
}

export async function crearCarro(empresaId, data) {
  const { patente, marca, modelo, capacidad_carga_kg } = data;

  const inserted = await sql`
    INSERT INTO carros (empresa_id, patente, marca, modelo, capacidad_carga_kg)
    VALUES (${empresaId}, ${patente}, ${marca || null}, ${modelo || null}, ${capacidad_carga_kg || null})
    RETURNING id, codigo_carro, patente, marca, modelo, capacidad_carga_kg, activo
  `;

  const row = inserted[0];

  if (!row.codigo_carro) {
    const codigo = `CR-${empresaId}-${row.id}`;
    const [updated] = await sql`
      UPDATE carros
      SET codigo_carro = ${codigo}
      WHERE id = ${row.id} AND empresa_id = ${empresaId}
      RETURNING id, codigo_carro, patente, marca, modelo, capacidad_carga_kg, activo
    `;
    return updated;
  }

  return row;
}

export async function buscarCarroPorCodigo(empresaId, codigo) {
  const codigoNorm = normalizarCodigo(codigo);
  const [row] = await sql`
    SELECT id, codigo_carro, patente, marca, modelo, capacidad_carga_kg, activo
    FROM carros
    WHERE empresa_id = ${empresaId} AND UPPER(REPLACE(codigo_carro, ' ', '')) = ${codigoNorm}
    LIMIT 1
  `;
  return row || null;
}

export async function crearRecepcion(empresaId, usuarioId, data) {
  const {
    tipo_recepcion,
    sucursal_id,
    proveedor_id,
    cliente_id,
    producto_agricola_id,
    chofer_id,
    camion_id,
    carro_id,
    numero_guia_despacho,
    folio_romana,
    observaciones
  } = data;

  const inserted = await sql`
    INSERT INTO recepciones (
      empresa_id,
      sucursal_id,
      proveedor_id,
      cliente_id,
      producto_agricola_id,
      chofer_id,
      camion_id,
      carro_id,
      numero_guia_despacho,
      folio_romana,
      usuario_operador_id,
      tipo_recepcion,
      estado,
      observaciones
    )
    VALUES (
      ${empresaId},
      ${sucursal_id || null},
      ${proveedor_id || null},
      ${cliente_id || null},
      ${producto_agricola_id || null},
      ${chofer_id || null},
      ${camion_id || null},
      ${carro_id || null},
      ${numero_guia_despacho || null},
      ${folio_romana || null},
      ${usuarioId || null},
      ${tipo_recepcion || 'compra'},
      'en_proceso',
      ${observaciones || null}
    )
    RETURNING id, empresa_id, sucursal_id, proveedor_id, cliente_id, producto_agricola_id, chofer_id, camion_id, carro_id, tipo_recepcion, fecha_entrada, estado, observaciones
  `;

  const row = inserted[0];
  // No emitir ticket aquí — el ticket se emitirá cuando existan BRUTO y TARA
  return row;
}

export async function realizarPesajeCompleto(empresaId, usuarioId, recepcionId, data) {
  const { peso_bruto_kg, motivo_bruto, peso_tara_kg, motivo_tara } = data;

  // Insertar pesajes y actualizar recepcion (sin tickets_pesaje)
  if (peso_bruto_kg != null) {
    await sql`
      INSERT INTO pesajes (empresa_id, recepcion_id, tipo, peso_kg, origen, motivo, usuario_id)
      VALUES (${empresaId}, ${recepcionId}, 'BRUTO', ${Math.round(peso_bruto_kg)}, 'MANUAL', ${motivo_bruto || null}, ${usuarioId || null})
    `;

    await sql`
      UPDATE recepciones
      SET peso_bruto_kg = ${Math.round(peso_bruto_kg)}
      WHERE id = ${recepcionId} AND empresa_id = ${empresaId}
    `;
  }

  if (peso_tara_kg != null) {
    await sql`
      INSERT INTO pesajes (empresa_id, recepcion_id, tipo, peso_kg, origen, motivo, usuario_id)
      VALUES (${empresaId}, ${recepcionId}, 'TARA', ${Math.round(peso_tara_kg)}, 'MANUAL', ${motivo_tara || null}, ${usuarioId || null})
    `;

    await sql`
      UPDATE recepciones
      SET peso_tara_kg = ${Math.round(peso_tara_kg)}, fecha_salida = CURRENT_TIMESTAMP
      WHERE id = ${recepcionId} AND empresa_id = ${empresaId}
    `;
  }

  // Emitir ticket de recepcion si corresponde (BRUTO + TARA)
  await emitirTicketSiCorresponde(empresaId, recepcionId);

  // Retornar recepcion actualizada
  const [rec] = await sql`
    SELECT r.*
    FROM recepciones r
    WHERE r.empresa_id = ${empresaId} AND r.id = ${recepcionId}
    LIMIT 1
  `;

  return { recepcion: rec };
}

export async function obtenerRecepcionPorId(empresaId, id) {
  const [row] = await sql`
    SELECT r.*,
      p.razon_social AS proveedor_nombre,
      pa.nombre AS producto_nombre,
      ch.nombre AS chofer_nombre_ref,
      ch.rut AS chofer_rut_ref,
      ca.patente AS camion_patente_ref,
      cr.patente AS carro_patente_ref
    FROM recepciones r
    LEFT JOIN proveedores p ON p.id = r.proveedor_id
    LEFT JOIN productos_agricolas pa ON pa.id = r.producto_agricola_id
    LEFT JOIN choferes ch ON ch.id = r.chofer_id
    LEFT JOIN camiones ca ON ca.id = r.camion_id
    LEFT JOIN carros cr ON cr.id = r.carro_id
    WHERE r.empresa_id = ${empresaId} AND r.id = ${id}
    LIMIT 1
  `;
  return row || null;
}

/** Datos completos para el PDF Ticket de Ingreso Interno (requisito SAG) */
export async function obtenerRecepcionParaTicketIngresoInterno(empresaId, id) {
  const [row] = await sql`
    SELECT r.*,
      e.razon_social AS empresa_razon_social,
      e.rut AS empresa_rut,
      e.direccion AS empresa_direccion,
      p.razon_social AS proveedor_nombre,
      p.rut AS proveedor_rut,
      c.razon_social AS cliente_nombre,
      c.rut AS cliente_rut,
      pa.nombre AS producto_nombre
    FROM recepciones r
    JOIN empresas e ON e.id = r.empresa_id
    LEFT JOIN proveedores p ON p.id = r.proveedor_id
    LEFT JOIN clientes c ON c.id = r.cliente_id
    LEFT JOIN productos_agricolas pa ON pa.id = r.producto_agricola_id
    WHERE r.empresa_id = ${empresaId} AND r.id = ${id}
    LIMIT 1
  `;
  if (!row) return null;

  const pesajes = await sql`
    SELECT id, tipo, peso_kg, created_at
    FROM pesajes
    WHERE empresa_id = ${empresaId} AND recepcion_id = ${id}
    ORDER BY id ASC
  `;

  return { recepcion: row, pesajes: pesajes || [] };
}

export async function obtenerRecepcionPorTicket(empresaId, ticketCodigo, ticketToken) {
  const codigo = String(ticketCodigo || "").trim();
  const token = String(ticketToken || "").trim();

  const [row] = await sql`
    SELECT *
    FROM recepciones
    WHERE empresa_id = ${empresaId} AND ticket_codigo = ${codigo} AND ticket_token = ${token}
    LIMIT 1
  `;

  return row || null;
}

export async function obtenerRecepcionPorCodigo(empresaId, ticketCodigo) {
  const codigo = String(ticketCodigo || "").trim();

  const [row] = await sql`
    SELECT *
    FROM recepciones
    WHERE empresa_id = ${empresaId} AND ticket_codigo = ${codigo}
    LIMIT 1
  `;

  return row || null;
}

export async function listarRecepciones(empresaId, opts) {
  const limit = (opts && opts.limit) ? Number(opts.limit) : 200;
  return await sql`
    SELECT r.id, r.tipo_recepcion, r.proveedor_id, p.razon_social AS proveedor_nombre,
      r.cliente_id, c.razon_social AS cliente_nombre,
      r.producto_agricola_id, pa.nombre AS producto_nombre,
      r.estado, r.fecha_entrada, r.peso_neto_fisico_kg, r.ticket_codigo
    FROM recepciones r
    LEFT JOIN proveedores p ON p.id = r.proveedor_id
    LEFT JOIN clientes c ON c.id = r.cliente_id
    LEFT JOIN productos_agricolas pa ON pa.id = r.producto_agricola_id
    WHERE r.empresa_id = ${empresaId}
    ORDER BY r.id DESC
    LIMIT ${limit}
  `;
}

export async function registrarPesaje(empresaId, usuarioId, recepcionId, tipo, pesoKg, origen, motivo) {
  const tipoNorm = String(tipo || "").toUpperCase();
  if (!['BRUTO', 'TARA'].includes(tipoNorm)) {
    throw new Error("Tipo de pesaje inválido");
  }

  const peso = Number(pesoKg);
  if (!Number.isFinite(peso) || peso < 0) {
    throw new Error("Peso inválido");
  }

  // Persistir evento (si existe tabla pesajes; si no, igual actualizamos recepciones)
  try {
    await sql`
      INSERT INTO pesajes (empresa_id, recepcion_id, tipo, peso_kg, origen, usuario_id, motivo)
      VALUES (${empresaId}, ${recepcionId}, ${tipoNorm}, ${Math.round(peso)}, ${origen || 'MANUAL'}, ${usuarioId || null}, ${motivo || null})
    `;
  } catch {
    // Tabla pesajes no existe en el esquema actual: ignorar
  }

  if (tipoNorm === 'BRUTO') {
    const [row] = await sql`
      UPDATE recepciones
      SET peso_bruto_kg = ${Math.round(peso)}
      WHERE id = ${recepcionId} AND empresa_id = ${empresaId}
      RETURNING id, peso_bruto_kg, peso_tara_kg, peso_neto_fisico_kg
    `;

    // Emitir ticket solo si ya existe BRUTO y TARA
    await emitirTicketSiCorresponde(empresaId, recepcionId);
    return row;
  }

  const [row] = await sql`
    UPDATE recepciones
    SET peso_tara_kg = ${Math.round(peso)}, fecha_salida = CURRENT_TIMESTAMP
    WHERE id = ${recepcionId} AND empresa_id = ${empresaId}
    RETURNING id, peso_bruto_kg, peso_tara_kg, peso_neto_fisico_kg
  `;

  // Emitir ticket solo si ya existe BRUTO y TARA
  await emitirTicketSiCorresponde(empresaId, recepcionId);

  return row;
}

async function emitirTicketSiCorresponde(empresaId, recepcionId) {
  const [rec] = await sql`
    SELECT id, ticket_codigo, peso_bruto_kg, peso_tara_kg
    FROM recepciones
    WHERE empresa_id = ${empresaId} AND id = ${recepcionId}
    LIMIT 1
  `;

  if (!rec) return;
  if (rec.ticket_codigo) return;

  const bruto = Number(rec.peso_bruto_kg) || 0;
  const tara = Number(rec.peso_tara_kg) || 0;
  if (bruto <= 0 || tara <= 0) return;

  const ticketCodigo = buildTicketCodigo(rec.id);
  const token = `T-${empresaId}-${rec.id}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`.toUpperCase();

  await sql`
    UPDATE recepciones
    SET ticket_codigo = ${ticketCodigo}, ticket_token = ${token}
    WHERE id = ${rec.id} AND empresa_id = ${empresaId} AND ticket_codigo IS NULL
  `;

  // Si el molino no tiene laboratorio: usar neto físico como neto a pagar (sin castigos)
  await sql`
    UPDATE recepciones
    SET peso_neto_pagar_kg = peso_neto_fisico_kg
    WHERE id = ${rec.id} AND empresa_id = ${empresaId}
      AND NOT EXISTS (SELECT 1 FROM laboratorio WHERE recepcion_id = ${rec.id})
  `;
}
