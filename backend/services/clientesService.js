import { sql } from "../db/connection.js";

export async function listarClientes(empresaId) {
  return await sql`
    SELECT id, rut, razon_social, nombre_fantasia, telefono, email_facturacion, bloqueado, created_at
    FROM clientes
    WHERE empresa_id = ${empresaId}
    ORDER BY id DESC
  `;
}

export async function crearCliente(empresaId, data) {
  const {
    rut,
    razon_social,
    nombre_fantasia,
    telefono,
    email_facturacion,
    direccion_facturacion,
    direccion_despacho,
    comuna,
    ciudad
  } = data;

  const [row] = await sql`
    INSERT INTO clientes (
      empresa_id,
      rut,
      razon_social,
      nombre_fantasia,
      telefono,
      email_facturacion,
      direccion_facturacion,
      direccion_despacho,
      comuna,
      ciudad
    )
    VALUES (
      ${empresaId},
      ${rut},
      ${razon_social},
      ${nombre_fantasia || null},
      ${telefono || null},
      ${email_facturacion || null},
      ${direccion_facturacion || null},
      ${direccion_despacho || null},
      ${comuna || null},
      ${ciudad || null}
    )
    RETURNING id, rut, razon_social, nombre_fantasia, telefono, email_facturacion, bloqueado, created_at
  `;

  return row;
}
