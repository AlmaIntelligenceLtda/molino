import express from "express";
import jwt from "jsonwebtoken";
import {
  listarSucursales,
  crearSucursal,
  listarBodegas,
  crearBodega,
  listarSilos,
  crearSilo
} from "../services/mantenedoresService.js";

const router = express.Router();
const SECRET = process.env.JWT_SECRET || "supersecreto";

function requireUser(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: "No autenticado" });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    return next();
  } catch {
    return res.status(403).json({ error: "Token inválido" });
  }
}

function getEmpresaId(req) {
  return req.user?.empresa_id;
}

router.use(requireUser);

// GET /api/mantenedores/sucursales
router.get("/sucursales", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const data = await listarSucursales(empresaId);
    res.json(data);
  } catch (err) {
    console.error("❌ Error al obtener sucursales:", err);
    res.status(500).json({ error: "Error al obtener sucursales" });
  }
});

// POST /api/mantenedores/sucursales
router.post("/sucursales", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const item = await crearSucursal(empresaId, req.body || {});
    res.json(item);
  } catch (err) {
    console.error("❌ Error al crear sucursal:", err);
    res.status(500).json({ error: "Error al crear sucursal" });
  }
});

// GET /api/mantenedores/bodegas
router.get("/bodegas", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const data = await listarBodegas(empresaId);
    res.json(data);
  } catch (err) {
    console.error("❌ Error al obtener bodegas:", err);
    res.status(500).json({ error: "Error al obtener bodegas" });
  }
});

// POST /api/mantenedores/bodegas
router.post("/bodegas", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const item = await crearBodega(empresaId, req.body || {});
    res.json(item);
  } catch (err) {
    console.error("❌ Error al crear bodega:", err);
    res.status(500).json({ error: "Error al crear bodega" });
  }
});

// GET /api/mantenedores/silos
router.get("/silos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const data = await listarSilos(empresaId);
    res.json(data);
  } catch (err) {
    console.error("❌ Error al obtener silos:", err);
    res.status(500).json({ error: "Error al obtener silos" });
  }
});

// POST /api/mantenedores/silos
router.post("/silos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const item = await crearSilo(empresaId, req.body || {});
    res.json(item);
  } catch (err) {
    console.error("❌ Error al crear silo:", err);
    res.status(500).json({ error: "Error al crear silo" });
  }
});

export default router;
