import { sql } from "../db/connection.js";
import bcrypt from "bcrypt";

// ============================
// 📦 CRUD: usuarios (multi-tenant)
// ============================

// 🔹 Obtener todos los usuarios de una empresa
export async function obtenerTodosLosUsuarios(empresaId) {
  return await sql`
    SELECT 
      id,
      rut,
      nombres,
      apellidos,
      email,
      rol,
      (estado = 'activo') AS activo
    FROM usuarios
    WHERE empresa_id = ${empresaId}
    ORDER BY id DESC
  `;
}

// 🔹 Obtener usuario por ID (aislado por empresa)
export async function obtenerUsuarioPorId(id, empresaId) {
  const [row] = await sql`
    SELECT 
      id,
      rut,
      nombres,
      apellidos,
      email,
      rol,
      (estado = 'activo') AS activo
    FROM usuarios
    WHERE id = ${id} AND empresa_id = ${empresaId}
    LIMIT 1
  `;
  return row || null;
}

// 🔹 Crear usuario (hash bcrypt + estado)
export async function crearUsuario(empresaId, { rut, nombres, apellidos, email, rol, password, activo = true }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const estado = activo ? "activo" : "inactivo";

  const [row] = await sql`
    INSERT INTO usuarios (empresa_id, rut, nombres, apellidos, email, password_hash, rol, estado)
    VALUES (${empresaId}, ${rut}, ${nombres}, ${apellidos}, ${email}, ${passwordHash}, ${rol}, ${estado})
    RETURNING id, rut, nombres, apellidos, email, rol, (estado = 'activo') AS activo
  `;
  return row;
}

// 🔹 Actualizar usuario
export async function actualizarUsuario(id, empresaId, { rut, nombres, apellidos, email, rol, password, activo }) {
  const estado = activo ? "activo" : "inactivo";
  let row;

  if (password) {
    const passwordHash = await bcrypt.hash(password, 10);
    [row] = await sql`
      UPDATE usuarios
      SET 
        rut = ${rut},
        nombres = ${nombres},
        apellidos = ${apellidos},
        email = ${email},
        rol = ${rol},
        estado = ${estado},
        password_hash = ${passwordHash}
      WHERE id = ${id} AND empresa_id = ${empresaId}
      RETURNING id, rut, nombres, apellidos, email, rol, (estado = 'activo') AS activo
    `;
  } else {
    [row] = await sql`
      UPDATE usuarios
      SET 
        rut = ${rut},
        nombres = ${nombres},
        apellidos = ${apellidos},
        email = ${email},
        rol = ${rol},
        estado = ${estado}
      WHERE id = ${id} AND empresa_id = ${empresaId}
      RETURNING id, rut, nombres, apellidos, email, rol, (estado = 'activo') AS activo
    `;
  }
  return row || null;
}

// 🔹 Eliminar usuario (scoped por empresa)
export async function eliminarUsuario(id, empresaId) {
  const [row] = await sql`
    DELETE FROM usuarios
    WHERE id = ${id} AND empresa_id = ${empresaId}
    RETURNING id
  `;
  return row || null;
}

// 🔹 Carga masiva de usuarios
export async function crearUsuariosMasivo(lista, empresaId) {
  if (!Array.isArray(lista) || lista.length === 0) return 0;

  let insertados = 0;

  for (const u of lista) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const estado = u.activo === false ? "inactivo" : "activo";

    await sql`
      INSERT INTO usuarios (empresa_id, rut, nombres, apellidos, email, password_hash, rol, estado)
      VALUES (${empresaId}, ${u.rut}, ${u.nombres}, ${u.apellidos}, ${u.email}, ${passwordHash}, ${u.rol}, ${estado})
    `;

    insertados++;
  }

  return insertados;
}
