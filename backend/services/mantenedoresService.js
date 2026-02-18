import { sql } from "../db/connection.js";

export async function listarBodegas(empresaId) {
  return await sql`
    SELECT b.id,
           b.nombre,
           b.descripcion,
           b.sucursal_id,
           s.nombre AS sucursal_nombre,
           b.created_at
    FROM bodegas b
    LEFT JOIN sucursales s ON s.id = b.sucursal_id
    WHERE b.empresa_id = ${empresaId}
    ORDER BY b.id DESC
  `;
}

export async function crearBodega(empresaId, data) {
  const { nombre, descripcion, sucursal_id } = data;

  const [row] = await sql`
    INSERT INTO bodegas (
      empresa_id,
      sucursal_id,
      nombre,
      descripcion
    )
    VALUES (
      ${empresaId},
      ${sucursal_id || null},
      ${nombre},
      ${descripcion || null}
    )
    RETURNING id, sucursal_id, nombre, descripcion, created_at
  `;

  return row;
}

export async function listarSilos(empresaId) {
  return await sql`
    SELECT s.id,
           s.codigo,
           s.descripcion,
           s.capacidad_max_kg,
           COALESCE(s.nivel_actual_kg, 0) AS nivel_actual_kg,
           s.estado,
           s.bodega_id,
           b.nombre AS bodega_nombre,
           b.sucursal_id,
           su.nombre AS sucursal_nombre,
           s.created_at
    FROM silos s
    LEFT JOIN bodegas b ON b.id = s.bodega_id
    LEFT JOIN sucursales su ON su.id = b.sucursal_id
    WHERE s.empresa_id = ${empresaId}
    ORDER BY s.id DESC
  `;
}

export async function crearSilo(empresaId, data) {
  const { codigo, descripcion, capacidad_max_kg, bodega_id } = data;

  const capacidad = capacidad_max_kg != null ? Number(capacidad_max_kg) : null;

  const [row] = await sql`
    INSERT INTO silos (
      empresa_id,
      bodega_id,
      codigo,
      descripcion,
      capacidad_max_kg
    )
    VALUES (
      ${empresaId},
      ${bodega_id || null},
      ${codigo},
      ${descripcion || null},
      ${capacidad}
    )
    RETURNING id, bodega_id, codigo, descripcion, capacidad_max_kg, nivel_actual_kg, estado, created_at
  `;

  return row;
}

export async function listarSucursales(empresaId) {
  return await sql`
    SELECT id,
           nombre,
           direccion,
           ciudad,
           telefono,
           es_matriz,
           created_at
    FROM sucursales
    WHERE empresa_id = ${empresaId}
    ORDER BY id DESC
  `;
}

export async function crearSucursal(empresaId, data) {
  const { nombre, direccion, ciudad, telefono, es_matriz } = data;

  const esMatriz = !!es_matriz;

  const [row] = await sql`
    INSERT INTO sucursales (
      empresa_id,
      nombre,
      direccion,
      ciudad,
      telefono,
      es_matriz
    )
    VALUES (
      ${empresaId},
      ${nombre},
      ${direccion || null},
      ${ciudad || null},
      ${telefono || null},
      ${esMatriz}
    )
    RETURNING id, empresa_id, nombre, direccion, ciudad, telefono, es_matriz, created_at
  `;

  return row;
}

