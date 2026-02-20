import { sql } from "../db/connection.js";

/**
 * Obtiene los datos de una empresa por ID (solo si existe).
 */
export async function getEmpresaById(empresaId) {
  if (!empresaId) return null;
  const rows = await sql`
    SELECT id, rut, razon_social, nombre_fantasia, direccion, telefono,
           email_contacto, plan_id, estado, configuracion_global, logo_url,
           created_at, updated_at
    FROM empresas
    WHERE id = ${empresaId}
    LIMIT 1
  `;
  return rows.length ? rows[0] : null;
}

/**
 * Actualiza datos editables de la empresa (sin RUT ni estado desde aquí).
 */
export async function actualizarEmpresa(empresaId, data) {
  if (!empresaId) return null;
  const {
    razon_social,
    nombre_fantasia,
    direccion,
    telefono,
    email_contacto
  } = data || {};
  await sql`
    UPDATE empresas
    SET
      razon_social = COALESCE(${razon_social ?? null}, razon_social),
      nombre_fantasia = ${nombre_fantasia ?? null},
      direccion = ${direccion ?? null},
      telefono = ${telefono ?? null},
      email_contacto = ${email_contacto ?? null},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${empresaId}
  `;
  return getEmpresaById(empresaId);
}

/**
 * Actualiza la URL del logo de la empresa.
 */
export async function actualizarLogoUrl(empresaId, logoUrl) {
  if (!empresaId) return null;
  await sql`
    UPDATE empresas
    SET logo_url = ${logoUrl ?? null}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${empresaId}
  `;
  return getEmpresaById(empresaId);
}

/**
 * Obtiene la configuración global (JSON). Devuelve objeto; si no hay, {}.
 */
export async function getConfiguracion(empresaId) {
  if (!empresaId) return {};
  const [row] = await sql`
    SELECT configuracion_global FROM empresas WHERE id = ${empresaId} LIMIT 1
  `;
  const raw = row?.configuracion_global;
  if (raw === null || raw === undefined) return {};
  if (typeof raw === "object") return raw;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Actualiza solo la configuración global (merge con lo existente).
 * data: { maquila_requiere_acreditar?: boolean, ... }
 */
export async function actualizarConfiguracion(empresaId, data) {
  if (!empresaId || !data || typeof data !== "object") return getConfiguracion(empresaId);
  const current = await getConfiguracion(empresaId);
  const merged = { ...current, ...data };
  await sql`
    UPDATE empresas
    SET configuracion_global = ${JSON.stringify(merged)}::jsonb, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${empresaId}
  `;
  return merged;
}
