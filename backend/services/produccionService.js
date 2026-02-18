import { sql } from "../db/connection.js";

// --- Fórmulas ---

export async function listarFormulas(empresaId) {
  return await sql`
    SELECT f.*, pt.nombre AS producto_terminado_nombre 
    FROM formulas f
    LEFT JOIN productos_terminados pt ON pt.id = f.producto_terminado_id
    WHERE f.empresa_id = ${empresaId}
    ORDER BY f.nombre ASC
  `;
}

export async function crearFormula(empresaId, data) {
  const { nombre, descripcion, producto_terminado_id, merma_tolerable_pct, ingredientes } = data;

  const [formula] = await sql`
    INSERT INTO formulas (empresa_id, nombre, descripcion, producto_terminado_id, merma_tolerable_pct)
    VALUES (${empresaId}, ${nombre}, ${descripcion}, ${producto_terminado_id}, ${merma_tolerable_pct})
    RETURNING *
  `;

  if (ingredientes && ingredientes.length > 0) {
    for (const ing of ingredientes) {
      await sql`
        INSERT INTO formula_ingredientes (empresa_id, formula_id, producto_agricola_id, proporcion_kg_por_unidad)
        VALUES (${empresaId}, ${formula.id}, ${ing.producto_agricola_id}, ${ing.proporcion})
      `;
    }
  }

  return formula;
}

export async function obtenerFormula(empresaId, formulaId) {
  const [formula] = await sql`
    SELECT f.*, pt.nombre AS producto_terminado_nombre 
    FROM formulas f
    LEFT JOIN productos_terminados pt ON pt.id = f.producto_terminado_id
    WHERE f.id = ${formulaId} AND f.empresa_id = ${empresaId}
  `;

  if (!formula) return null;

  const ingredientes = await sql`
    SELECT fi.*, pa.nombre AS producto_agricola_nombre
    FROM formula_ingredientes fi
    JOIN productos_agricolas pa ON pa.id = fi.producto_agricola_id
    WHERE fi.formula_id = ${formulaId} AND fi.empresa_id = ${empresaId}
  `;

  formula.ingredientes = ingredientes;
  return formula;
}

export async function eliminarFormula(empresaId, formulaId) {
  // Primero eliminamos los ingredientes por la relación de integridad
  await sql`DELETE FROM formula_ingredientes WHERE formula_id = ${formulaId} AND empresa_id = ${empresaId}`;
  
  const result = await sql`DELETE FROM formulas WHERE id = ${formulaId} AND empresa_id = ${empresaId} RETURNING id`;
  
  return result.length > 0;
}

export async function listarProductosAgricolas(empresaId) {
  return await sql`SELECT id, nombre, codigo FROM productos_agricolas WHERE empresa_id = ${empresaId} ORDER BY nombre ASC`;
}

export async function listarProductosTerminados(empresaId) {
  return await sql`SELECT id, nombre, codigo_sku, tipo, stock_actual, created_at FROM productos_terminados WHERE empresa_id = ${empresaId} ORDER BY nombre ASC`;
}

export async function crearProductoTerminado(empresaId, data) {
  const { nombre, codigo_sku, tipo, descripcion } = data;
  const [row] = await sql`
    INSERT INTO productos_terminados (empresa_id, nombre, codigo_sku, tipo, descripcion, stock_actual)
    VALUES (${empresaId}, ${nombre}, ${codigo_sku}, ${tipo || 'Harina'}, ${descripcion || null}, 0)
    RETURNING id, nombre, codigo_sku, tipo, stock_actual, created_at
  `;
  return row;
}

// --- Órdenes de Producción ---

export async function listarOrdenesProduccion(empresaId, { sucursalId, estado } = {}) {
  const filtroSucursal = sucursalId ? sql`AND op.sucursal_id = ${sucursalId}` : sql``;
  const filtroEstado = estado ? sql`AND op.estado = ${estado}` : sql``;

  return await sql`
    SELECT 
      op.*, 
      f.nombre AS formula_nombre,
      f.merma_tolerable_pct,
      pt.nombre AS producto_nombre,
      s.nombre AS sucursal_nombre,
      u.nombres || ' ' || COALESCE(u.apellidos, '') AS responsable_nombre
    FROM ordenes_produccion op
    LEFT JOIN formulas f ON f.id = op.formula_id
    LEFT JOIN productos_terminados pt ON pt.id = op.producto_objetivo_id
    LEFT JOIN sucursales s ON s.id = op.sucursal_id
    LEFT JOIN usuarios u ON u.id = op.usuario_responsable_id
    WHERE op.empresa_id = ${empresaId}
    ${filtroSucursal}
    ${filtroEstado}
    ORDER BY op.created_at DESC
  `;
}

export async function crearOrdenProduccion(empresaId, usuarioId, data) {
  const { sucursal_id, formula_id, cantidad_objetivo, fecha_planificada } = data;

  // Obtener producto_terminado_id de la formula
  const [formula] = await sql`SELECT producto_terminado_id FROM formulas WHERE id = ${formula_id}`;
  if (!formula) throw new Error("Fórmula no encontrada");

  const numeroOP = `OP-${Date.now()}`;

  const [op] = await sql`
    INSERT INTO ordenes_produccion (
      empresa_id, sucursal_id, numero_op, producto_objetivo_id, 
      formula_id, cantidad_objetivo, fecha_planificada, 
      usuario_responsable_id, estado
    )
    VALUES (
      ${empresaId}, ${sucursal_id}, ${numeroOP}, ${formula.producto_terminado_id},
      ${formula_id}, ${cantidad_objetivo}, ${fecha_planificada}, 
      ${usuarioId}, 'abierta'
    )
    RETURNING *
  `;

  return op;
}

// --- Registro de Rendimiento (Yield) y Cierre ---

export async function registrarRendimiento(empresaId, usuarioId, data) {
  const { 
    orden_produccion_id, 
    trigo_molido_kg, 
    harina_total_kg, 
    lotes_insumos, // [{lote_id, cantidad_kg}]
    subproductos // [{nombre, cantidad_kg}]
  } = data;

  // 1. Validar OP
  const [op] = await sql`
    SELECT * FROM ordenes_produccion 
    WHERE id = ${orden_produccion_id} AND empresa_id = ${empresaId}
  `;
  if (!op) throw new Error("Orden de producción no encontrada");
  if (op.estado === 'finalizada') throw new Error("Esta orden ya ha sido finalizada");

  // 2. Registrar el rendimiento principal
  const [rendimiento] = await sql`
    INSERT INTO rendimientos (
      empresa_id, orden_produccion_id, trigo_molido_kg, harina_total_kg, 
      usuario_registro_id
    )
    VALUES (${empresaId}, ${orden_produccion_id}, ${trigo_molido_kg}, ${harina_total_kg}, ${usuarioId})
    RETURNING *
  `;

  // 3. Registrar subproductos adicionales
  let totalSubproductosKg = 0;
  if (subproductos && subproductos.length > 0) {
    for (const sp of subproductos) {
      await sql`
        INSERT INTO produccion_subproductos_obtenidos (rendimiento_id, nombre, cantidad_kg)
        VALUES (${rendimiento.id}, ${sp.nombre}, ${sp.cantidad_kg})
      `;
      totalSubproductosKg += Number(sp.cantidad_kg);
    }
  }

  // 4. Consumir Lotes de Materia Prima (Trigo)
  for (const insumo of lotes_insumos) {
    // Registrar en tabla de trazabilidad
    await sql`
      INSERT INTO orden_produccion_insumos (empresa_id, orden_produccion_id, lote_id, cantidad_utilizada_kg)
      VALUES (${empresaId}, ${orden_produccion_id}, ${insumo.lote_id}, ${insumo.cantidad_kg})
    `;

    // Descontar del stock del lote
    await sql`
      UPDATE lotes 
      SET cantidad_actual_kg = cantidad_actual_kg - ${insumo.cantidad_kg},
          estado = CASE WHEN cantidad_actual_kg - ${insumo.cantidad_kg} <= 0 THEN 'consumido' ELSE estado END
      WHERE id = ${insumo.id_lote || insumo.lote_id} AND empresa_id = ${empresaId}
    `;

    // También descontar del SILO asociado al lote
    await sql`
      UPDATE silos 
      SET nivel_actual_kg = nivel_actual_kg - ${insumo.cantidad_kg}
      WHERE id IN (
        SELECT COALESCE(silo_destino_id, silo_origen_id)
        FROM movimientos_inventario
        WHERE lote_id = ${insumo.id_lote || insumo.lote_id}
        ORDER BY fecha DESC, id DESC
        LIMIT 1
      )
    `;

    // Registrar movimiento de inventario (CONSUMO)
    await sql`
      INSERT INTO movimientos_inventario (
        empresa_id, sucursal_id, tipo_movimiento, lote_id, cantidad_kg, usuario_id, observacion
      )
      VALUES (
        ${empresaId}, ${op.sucursal_id}, 'CONSUMO_PRODUCCION', ${insumo.id_lote || insumo.lote_id}, ${insumo.cantidad_kg}, ${usuarioId}, 
        'Consumido en OP ' || ${op.numero_op}
      )
    `;
  }

  // 5. Incrementar stock de Harina (Producto Terminado)
  await sql`
    UPDATE productos_terminados
    SET stock_actual = stock_actual + ${harina_total_kg}
    WHERE id = ${op.producto_objetivo_id} AND empresa_id = ${empresaId}
  `;

  // 6. Cerrar la OP
  await sql`
    UPDATE ordenes_produccion
    SET estado = 'finalizada', fecha_fin_real = CURRENT_TIMESTAMP
    WHERE id = ${orden_produccion_id}
  `;

  return { success: true, rendimientoId: rendimiento.id };
}

export async function obtenerEstadisticasProduccion(empresaId, { sucursalId } = {}) {
  const filtroSucursal = sucursalId ? sql`AND op.sucursal_id = ${sucursalId}` : sql``;

  // Últimos rendimientos para los gauges
  const [ultRendimiento] = await sql`
    SELECT 
      r.*,
      f.merma_tolerable_pct
    FROM rendimientos r
    JOIN ordenes_produccion op ON op.id = r.orden_produccion_id
    JOIN formulas f ON f.id = op.formula_id
    WHERE r.empresa_id = ${empresaId}
    ${filtroSucursal}
    ORDER BY r.fecha_registro DESC
    LIMIT 1
  `;

  return {
    ultimo: ultRendimiento
  };
}
