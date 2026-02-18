import express from "express";
import jwt from "jsonwebtoken";
import * as produccionService from "../services/produccionService.js";

const router = express.Router();

function requireUser(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: "No autorizado" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecreto");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

router.use(requireUser);

router.get("/formulas", async (req, res) => {
  try {
    const data = await produccionService.listarFormulas(req.user.empresa_id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/formulas/:id", async (req, res) => {
  try {
    const data = await produccionService.obtenerFormula(req.user.empresa_id, req.params.id);
    if (!data) return res.status(404).json({ success: false, message: "Fórmula no encontrada" });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/formulas/:id", async (req, res) => {
  try {
    const success = await produccionService.eliminarFormula(req.user.empresa_id, req.params.id);
    if (!success) return res.status(404).json({ success: false, message: "Fórmula no encontrada" });
    res.json({ success: true, message: "Fórmula eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/productos-agricolas", async (req, res) => {
  try {
    const data = await produccionService.listarProductosAgricolas(req.user.empresa_id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/productos-terminados", async (req, res) => {
  try {
    const data = await produccionService.listarProductosTerminados(req.user.empresa_id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/productos-terminados", async (req, res) => {
  try {
    const data = await produccionService.crearProductoTerminado(req.user.empresa_id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/formulas", async (req, res) => {
  try {
    const data = await produccionService.crearFormula(req.user.empresa_id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/ordenes", async (req, res) => {
  try {
    const { sucursal_id, estado } = req.query;
    const data = await produccionService.listarOrdenesProduccion(req.user.empresa_id, { sucursalId: sucursal_id, estado });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/ordenes", async (req, res) => {
  try {
    const data = await produccionService.crearOrdenProduccion(req.user.empresa_id, req.user.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/rendimientos", async (req, res) => {
  try {
    const data = await produccionService.registrarRendimiento(req.user.empresa_id, req.user.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const { sucursal_id } = req.query;
    const data = await produccionService.obtenerEstadisticasProduccion(req.user.empresa_id, { sucursalId: sucursal_id });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
