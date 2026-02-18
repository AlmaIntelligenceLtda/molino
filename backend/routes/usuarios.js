import express from "express";
import jwt from "jsonwebtoken";
import { 
  obtenerTodosLosUsuarios,
  obtenerUsuarioPorId,
  eliminarUsuario,
  crearUsuario,
  actualizarUsuario,
  crearUsuariosMasivo
} from "../services/usuariosService.js";
import { verificarCredencialesEmail } from "../services/authService.js";

const router = express.Router();
const SECRET = process.env.JWT_SECRET || "supersecreto";

function getUserFromReq(req) {
  const token = req.cookies?.token;
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

// GET /api/usuarios
router.get("/", async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const usuarios = await obtenerTodosLosUsuarios(user.empresa_id);
    res.json(usuarios);
  } catch (err) {
    console.error("❌ Error al obtener usuarios:", err);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

// GET /api/usuarios/:id
router.get("/:id", async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const usuario = await obtenerUsuarioPorId(req.params.id, user.empresa_id);
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json(usuario);
  } catch (err) {
    console.error("❌ Error al obtener usuario:", err);
    res.status(500).json({ error: "Error al obtener usuario" });
  }
});

// POST /api/usuarios
router.post("/", async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const nuevo = await crearUsuario(user.empresa_id, req.body);
    res.json(nuevo);
  } catch (err) {
    console.error("❌ Error al crear usuario:", err);
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

// PUT /api/usuarios/:id
router.put("/:id", async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const actualizado = await actualizarUsuario(req.params.id, user.empresa_id, req.body);
    if (!actualizado) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json(actualizado);
  } catch (err) {
    console.error("❌ Error al actualizar usuario:", err);
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

// DELETE /api/usuarios/:id
router.delete("/:id", async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: "No autenticado" });

    let decoded;
    try {
      decoded = jwt.verify(token, SECRET);
    } catch (e) {
      return res.status(403).json({ error: "Token inválido" });
    }

    const rol = String(decoded.rol || "").toLowerCase();
    if (rol !== "superusuario") {
      return res.status(403).json({ error: "Acceso denegado: se requiere rol superusuario" });
    }

    const { clave } = req.body || {};
    if (!clave) return res.status(400).json({ error: "Clave requerida" });

    const email = decoded.email;
    const verif = await verificarCredencialesEmail(email, clave);
    if (!verif.ok) {
      return res.status(401).json({ error: "Clave incorrecta" });
    }

    const deleted = await eliminarUsuario(req.params.id, decoded.empresa_id);
    if (!deleted) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error al eliminar usuario:", err);
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

// POST /api/usuarios/masivo
router.post("/masivo", async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, error: "No autenticado" });
    }

    const { usuarios } = req.body;
    if (!Array.isArray(usuarios) || usuarios.length === 0) {
      return res.status(400).json({ success: false, error: "El archivo está vacío o inválido" });
    }

    // Validaciones de negocio
    const rolesPermitidos = ["administrador", "superusuario"];

    for (let i = 0; i < usuarios.length; i++) {
      const u = usuarios[i];
      if (!u.rut || !u.nombres || !u.apellidos || !u.email || !u.password || !u.rol) {
        return res.status(400).json({ success: false, error: `Fila ${i + 1}: datos faltantes.` });
      }
      if (!rolesPermitidos.includes(u.rol.toLowerCase())) {
        return res.status(400).json({ success: false, error: `Fila ${i + 1}: rol inválido (${u.rol}). Solo se permiten administrador, supervisor u operador.` });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email)) {
        return res.status(400).json({ success: false, error: `Fila ${i + 1}: email inválido (${u.email}).` });
      }
    }

    const insertados = await crearUsuariosMasivo(usuarios, user.empresa_id);
    return res.json({ success: true, insertados });
  } catch (err) {
    console.error("❌ Error en carga masiva de usuarios:", err);

    let mensaje = "Error en carga masiva de usuarios";
    if (err.code === "23505") {
      mensaje = `Duplicado: ${err.detail}`;
    } else if (err.code === "23502") {
      mensaje = `Falta un valor obligatorio (${err.column}).`;
    } else if (err.message) {
      mensaje = err.message;
    }

    return res.status(500).json({ success: false, error: mensaje });
  }
});

export default router;
