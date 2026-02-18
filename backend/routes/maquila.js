import express from "express";
import jwt from "jsonwebtoken";
import bwipjs from "bwip-js";

import {
  obtenerSaldoHarina,
  registrarMovimientoMaquila,
  getCuentaCorriente,
  listarCuentasCorrientesResumen,
  listarTiposTrabajoMaquila,
  crearTipoTrabajoMaquila,
  actualizarTipoTrabajoMaquila,
  eliminarTipoTrabajoMaquila,
  listarRecepcionesMaquilaPendientesAcreditar,
  registrarRecepcionDirecta
} from "../services/maquilaService.js";

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

function getSucursalId(req) {
  return req.user?.sucursal_id;
}

router.use(requireUser);

// GET /api/maquila/cuentas-corrientes — resumen de todas las cuentas (trigo/harina por cliente)
router.get("/cuentas-corrientes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const data = await listarCuentasCorrientesResumen(empresaId);
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando cuentas corrientes:", err);
    res.status(500).json({ error: "Error al obtener cuentas corrientes" });
  }
});

// GET /api/maquila/cuenta-corriente?cliente_id=123 — detalle cuenta corriente de un cliente
router.get("/cuenta-corriente", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const clienteId = Number(req.query.cliente_id);
    if (!clienteId) return res.status(400).json({ error: "cliente_id requerido" });

    const data = await getCuentaCorriente(empresaId, clienteId);
    if (!data) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(data);
  } catch (err) {
    console.error("❌ Error obteniendo cuenta corriente:", err);
    res.status(500).json({ error: "Error al obtener cuenta corriente" });
  }
});

// GET /api/maquila/config/porcentajes — listar tipos de trabajo (54%, 60%, 50%, etc.)
router.get("/config/porcentajes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const data = await listarTiposTrabajoMaquila(empresaId);
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando porcentajes maquila:", err);
    res.status(500).json({ error: "Error al obtener porcentajes" });
  }
});

// POST /api/maquila/config/porcentajes — crear tipo de trabajo
router.post("/config/porcentajes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const row = await crearTipoTrabajoMaquila(empresaId, req.body);
    res.status(201).json(row);
  } catch (err) {
    console.error("❌ Error creando porcentaje maquila:", err);
    res.status(400).json({ error: err.message || "Error al crear" });
  }
});

// PUT /api/maquila/config/porcentajes/:id
router.put("/config/porcentajes/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const id = Number(req.params.id);
    const row = await actualizarTipoTrabajoMaquila(empresaId, id, req.body);
    if (!row) return res.status(404).json({ error: "No encontrado" });
    res.json(row);
  } catch (err) {
    console.error("❌ Error actualizando porcentaje maquila:", err);
    res.status(400).json({ error: err.message || "Error al actualizar" });
  }
});

// DELETE /api/maquila/config/porcentajes/:id
router.delete("/config/porcentajes/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const id = Number(req.params.id);
    const row = await eliminarTipoTrabajoMaquila(empresaId, id);
    if (!row) return res.status(404).json({ error: "No encontrado" });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error eliminando porcentaje maquila:", err);
    res.status(500).json({ error: err.message || "Error al eliminar" });
  }
});

// GET /api/maquila/recepciones-pendientes — recepciones maquila sin acreditar harina
router.get("/recepciones-pendientes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const data = await listarRecepcionesMaquilaPendientesAcreditar(empresaId);
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando recepciones pendientes:", err);
    res.status(500).json({ error: "Error al obtener recepciones" });
  }
});

// POST /api/maquila/recepcion-directa
router.post("/recepcion-directa", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const usuarioId = getUsuarioId(req);
    const result = await registrarRecepcionDirecta(empresaId, usuarioId, req.body);
    res.json(result);
  } catch (err) {
    console.error("❌ Error en recepción directa:", err);
    res.status(400).json({ error: err.message || "Error al registrar recepción" });
  }
});

// GET /api/maquila/saldos?cliente_id=123
router.get("/saldos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const clienteId = Number(req.query.cliente_id);
    if (!clienteId) return res.status(400).json({ error: "cliente_id requerido" });

    const data = await obtenerSaldoHarina(empresaId, clienteId);
    res.json(data);
  } catch (err) {
    console.error("❌ Error obteniendo saldos maquila:", err);
    res.status(500).json({ error: "Error al obtener saldos" });
  }
});

// POST /api/maquila/movimientos
// Body: { cliente_id, producto_harina_id?, tipo_movimiento, kg, sacos_cantidad?, saco_peso_kg?, observacion? }
router.post("/movimientos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const usuarioId = getUsuarioId(req);
    const sucursalId = getSucursalId(req);

    const payload = { ...req.body };
    // Asignar sucursal del usuario si no viene
    if (!payload.sucursal_id && sucursalId) {
      payload.sucursal_id = sucursalId;
    }

    const tipo = String(payload.tipo_movimiento || "").toUpperCase();

    if (!payload.cliente_id) return res.status(400).json({ error: "cliente_id requerido" });
    if (!tipo) return res.status(400).json({ error: "tipo_movimiento requerido" });

    // Normalizar signo según tipo
    if (tipo === "RETIRO_HARINA_KG") {
      payload.kg = -Math.abs(Number(payload.kg || 0));
    }

    if (tipo === "CREDITO_HARINA_CONFIRMADO_KG") {
      payload.kg = Math.abs(Number(payload.kg || 0));
    }

    payload.tipo_movimiento = tipo;

    const row = await registrarMovimientoMaquila(empresaId, usuarioId, payload);
    res.json(row);
  } catch (err) {
    console.error("❌ Error registrando movimiento maquila:", err);
    res.status(400).json({ error: err.message || "Error al registrar movimiento" });
  }
});

// GET /api/maquila/movimientos/:id/barcode.png
router.get("/movimientos/:id/barcode.png", async (req, res) => {
  try {
    const id = req.params.id;
    const text = `MOV-${id}`;

    const png = await bwipjs.toBuffer({
      bcid: "code128",
      text,
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: "center",
    });

    res.type("png");
    res.send(png);
  } catch (err) {
    console.error("❌ Error generando barcode movimiento:", err);
    res.status(500).json({ error: "Error generando código" });
  }
});

export default router;
