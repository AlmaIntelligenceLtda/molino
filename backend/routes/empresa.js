import express from "express";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { fileURLToPath } from "url";
import {
  getEmpresaById,
  actualizarEmpresa,
  actualizarLogoUrl,
  getConfiguracion,
  actualizarConfiguracion
} from "../services/empresaService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const SECRET = process.env.JWT_SECRET || "supersecreto";

const uploadDir = path.join(__dirname, "../../frontend/uploads/empresa");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const empresaId = req.user?.empresa_id || 0;
    const ext = (file.originalname && path.extname(file.originalname)) || ".png";
    const safeExt = [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext.toLowerCase()) ? ext : ".png";
    cb(null, `logo_${empresaId}${safeExt}`);
  }
});
const uploadLogo = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(png|jpe?g|gif|webp)$/i.test(file.originalname || "");
    if (allowed) cb(null, true);
    else cb(new Error("Solo imágenes (PNG, JPG, GIF, WEBP)"), false);
  }
});

function getUserFromReq(req) {
  const token = req.cookies?.token;
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function requireUser(req, res, next) {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: "No autenticado" });
  req.user = user;
  next();
}

// GET /api/empresa - Datos de la empresa del usuario autenticado
router.get("/", async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ error: "No autenticado" });
    }
    const empresaId = user.empresa_id;
    if (!empresaId) {
      return res.status(404).json({ error: "Usuario sin empresa asignada" });
    }
    const empresa = await getEmpresaById(empresaId);
    if (!empresa) {
      return res.status(404).json({ error: "Empresa no encontrada" });
    }
    res.json(empresa);
  } catch (err) {
    console.error("❌ Error al obtener empresa:", err);
    res.status(500).json({ error: "Error al obtener empresa" });
  }
});

// PUT /api/empresa - Actualizar datos editables de la empresa
router.put("/", requireUser, express.json(), async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    if (!empresaId) {
      return res.status(404).json({ error: "Usuario sin empresa asignada" });
    }
    const empresa = await actualizarEmpresa(empresaId, req.body);
    if (!empresa) {
      return res.status(404).json({ error: "Empresa no encontrada" });
    }
    res.json(empresa);
  } catch (err) {
    console.error("❌ Error al actualizar empresa:", err);
    res.status(500).json({ error: "Error al actualizar empresa" });
  }
});

// GET /api/empresa/config - Configuración de la empresa (maquila, etc.)
router.get("/config", requireUser, async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    if (!empresaId) return res.status(404).json({ error: "Usuario sin empresa asignada" });
    const config = await getConfiguracion(empresaId);
    res.json(config);
  } catch (err) {
    console.error("❌ Error al obtener config empresa:", err);
    res.status(500).json({ error: "Error al obtener configuración" });
  }
});

// PATCH /api/empresa/config - Actualizar configuración (merge)
router.patch("/config", requireUser, express.json(), async (req, res) => {
  try {
    const empresaId = req.user.empresa_id;
    if (!empresaId) return res.status(404).json({ error: "Usuario sin empresa asignada" });
    const config = await actualizarConfiguracion(empresaId, req.body);
    res.json(config);
  } catch (err) {
    console.error("❌ Error al actualizar config empresa:", err);
    res.status(500).json({ error: "Error al actualizar configuración" });
  }
});

// POST /api/empresa/logo - Subir logo/foto de la compañía
router.post("/logo", requireUser, uploadLogo.single("logo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Debe enviar un archivo de imagen (campo 'logo')" });
    }
    const empresaId = req.user.empresa_id;
    const relativePath = `/uploads/empresa/${req.file.filename}`;
    await actualizarLogoUrl(empresaId, relativePath);
    const empresa = await getEmpresaById(empresaId);
    res.json(empresa);
  } catch (err) {
    console.error("❌ Error al subir logo:", err);
    res.status(500).json({ error: err.message || "Error al subir logo" });
  }
});

export default router;
