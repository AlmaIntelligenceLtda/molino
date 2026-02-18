import { sql } from "../db/connection.js";
import bcrypt from "bcrypt";

const ALLOWED_ROLES = new Set(["administrador", "superusuario", "operador", "analista", "vendedor"]);

export async function verificarCredencialesEmail(email, password) {
  if (!email || !password) {
    console.log("❌ Faltan datos de login:", { email });
    return { ok: false, reason: "missing_fields" };
  }

  const emailSanitizado = email.trim().toLowerCase();

  const rows = await sql`
    SELECT id, empresa_id, email, password_hash, rol, estado, nombres, apellidos
    FROM usuarios
    WHERE email = ${emailSanitizado}
    LIMIT 1
  `;

  if (rows.length === 0) {
    console.warn("❌ Usuario no encontrado:", emailSanitizado);
    return { ok: false, reason: "user_not_found" };
  }

  const user = rows[0];

  if (user.estado !== 'activo') {
    console.warn("❌ Usuario inactivo:", user.email);
    return { ok: false, reason: "inactive_user" };
  }

  // Verifica con bcrypt
  const match = await bcrypt.compare(password, user.password_hash);

  if (!match) {
    console.warn("❌ Contraseña incorrecta para:", user.email);
    return { ok: false, reason: "wrong_password" };
  }

  const rolNorm = String(user.rol || "").toLowerCase();
  // if (!ALLOWED_ROLES.has(rolNorm)) ... (Opcional: validar rol)

  const { password_hash: _, ...safeUser } = user;
  return { ok: true, user: { ...safeUser, rol: rolNorm } };
}

export async function registrarEmpresa(datos) {
  const { 
    rutEmpresa, razonSocial, 
    nombresAdmin, apellidosAdmin, emailAdmin, password 
  } = datos;

  if (!rutEmpresa || !razonSocial || !emailAdmin || !password) {
    return { ok: false, message: "Faltan datos obligatorios" };
  }

  // 1. Validaciones previas
  const existingUser = await sql`SELECT id FROM usuarios WHERE email = ${emailAdmin}`;
  if (existingUser.length > 0) return { ok: false, message: "El email ya está registrado" };

  const existingEmpresa = await sql`SELECT id FROM empresas WHERE rut = ${rutEmpresa}`;
  if (existingEmpresa.length > 0) return { ok: false, message: "El RUT de empresa ya está registrado" };

  // 2. Hash Password
  const hash = await bcrypt.hash(password, 10);

  try {
    // 3. CTE para insertar Empresa + Usuario Admin
    const result = await sql`
      WITH nueva_empresa AS (
        INSERT INTO empresas (rut, razon_social, estado)
        VALUES (${rutEmpresa}, ${razonSocial}, 'activo')
        RETURNING id
      )
      INSERT INTO usuarios (empresa_id, nombres, apellidos, email, password_hash, rol, estado)
      SELECT id, ${nombresAdmin}, ${apellidosAdmin}, ${emailAdmin}, ${hash}, 'administrador', 'activo'
      FROM nueva_empresa
      RETURNING id, email, rol, empresa_id
    `;
    
    if (result.length === 0) throw new Error("No se pudo crear el usuario/empresa");
    
    return { ok: true, user: result[0] };

  } catch (error) {
    console.error("Error en registrarEmpresa:", error);
    return { ok: false, message: "Error interno al registrar." };
  }
}
