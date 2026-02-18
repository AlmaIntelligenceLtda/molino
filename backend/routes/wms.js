import express from "express";
import jwt from "jsonwebtoken";

import {
  obtenerMapaSilos,
  listarLotes,
  listarMovimientos,
  crearLoteDesdeRecepcion,
  registrarTrasiego,
  registrarMezcla,
  listarRecepcionesPendientes
} from "../services/wmsService.js";

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

function getUsuarioId(req) {
  return req.user?.id;
}

router.use(requireUser);

router.get("/mapa-silos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const sucursalId = req.query.sucursal_id ? Number(req.query.sucursal_id) : null;
    const data = await obtenerMapaSilos(empresaId, { sucursalId });
    res.json(data);
  } catch (err) {
    console.error("❌ Error obteniendo mapa de silos:", err);
    res.status(500).json({ error: "Error al obtener mapa de silos" });
  }
});

router.get("/pendientes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const data = await listarRecepcionesPendientes(empresaId);
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando recepciones pendientes de WMS:", err);
    res.status(500).json({ error: "Error al listar pendientes" });
  }
});

router.get("/lotes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const estado = req.query.estado || "activo";
    const siloId = req.query.silo_id ? Number(req.query.silo_id) : null;
    const data = await listarLotes(empresaId, { estado, siloId });
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando lotes:", err);
    res.status(500).json({ error: "Error al listar lotes" });
  }
});

router.get("/movimientos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const siloId = req.query.silo_id ? Number(req.query.silo_id) : null;
    const loteId = req.query.lote_id ? Number(req.query.lote_id) : null;
    const data = await listarMovimientos(empresaId, { siloId, loteId });
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando movimientos WMS:", err);
    res.status(500).json({ error: "Error al listar movimientos" });
  }
});

router.post("/lotes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const usuarioId = getUsuarioId(req);
    const result = await crearLoteDesdeRecepcion(empresaId, usuarioId, req.body || {});
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ Error creando lote desde recepción:", err);
    res.status(400).json({ error: err.message || "Error al crear lote" });
  }
});

router.post("/movimientos/trasiego", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const usuarioId = getUsuarioId(req);
    const result = await registrarTrasiego(empresaId, usuarioId, req.body || {});
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ Error registrando trasiego:", err);
    res.status(400).json({ error: err.message || "Error al registrar trasiego" });
  }
});

router.post("/movimientos/mezcla", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const usuarioId = getUsuarioId(req);
    const result = await registrarMezcla(empresaId, usuarioId, req.body || {});
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ Error registrando mezcla:", err);
    res.status(400).json({ error: err.message || "Error al registrar mezcla" });
  }
});

export default router;
