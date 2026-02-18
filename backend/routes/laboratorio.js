import express from "express";
import jwt from "jsonwebtoken";
import { sql } from "../db/connection.js";

import {
  listarRecepcionesParaLaboratorio,
  obtenerRecepcionLaboratorio,
  upsertLaboratorio
} from "../services/laboratorioService.js";
import { listarRegistrosLaboratorio } from "../services/laboratorioService.js";

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

// GET /api/laboratorio/recepciones
router.get("/recepciones", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);    const search = req.query.search;
    
    if (search) {
      // Búsqueda específica por ID o Código de Ticket
      const rows = await sql`
        SELECT r.id, r.ticket_codigo, r.tipo_recepcion, r.peso_neto_fisico_kg, r.peso_neto_pagar_kg,
               p.razon_social AS proveedor_nombre,
               c.razon_social AS cliente_nombre,
               pa.nombre AS producto_nombre,
               l.id AS laboratorio_id
        FROM recepciones r
        LEFT JOIN laboratorio l ON l.recepcion_id = r.id
        LEFT JOIN proveedores p ON p.id = r.proveedor_id
        LEFT JOIN clientes c ON c.id = r.cliente_id
        LEFT JOIN productos_agricolas pa ON pa.id = r.producto_agricola_id
        WHERE r.empresa_id = ${empresaId}
          AND (r.ticket_codigo = ${search} OR r.id::text = ${search})
        LIMIT 1
      `;
      return res.json(rows);
    }
    const data = await listarRecepcionesParaLaboratorio(empresaId);
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando recepciones laboratorio:", err);
    res.status(500).json({ error: "Error al obtener recepciones" });
  }
});

// GET /api/laboratorio/registros
router.get("/registros", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const data = await listarRegistrosLaboratorio(empresaId);
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando registros laboratorio:", err);
    res.status(500).json({ error: "Error al obtener registros" });
  }
});

// GET /api/laboratorio/recepciones/:id
router.get("/recepciones/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const row = await obtenerRecepcionLaboratorio(empresaId, req.params.id);
    if (!row) return res.status(404).json({ error: "Recepción no encontrada" });
    res.json(row);
  } catch (err) {
    console.error("❌ Error obteniendo recepción laboratorio:", err);
    res.status(500).json({ error: "Error al obtener recepción" });
  }
});

// POST /api/laboratorio/recepciones/:id
router.post("/recepciones/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const usuarioId = getUsuarioId(req);
    const result = await upsertLaboratorio(empresaId, req.params.id, usuarioId, req.body);
    if (!result) return res.status(404).json({ error: "Recepción no encontrada" });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ Error guardando laboratorio:", err);
    res.status(500).json({ error: "Error al guardar laboratorio" });
  }
});

export default router;
