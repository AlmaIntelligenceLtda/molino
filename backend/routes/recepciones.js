import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bwipjs from "bwip-js";

import { getEmpresaById } from "../services/empresaService.js";
import {
  listarProveedores,
  crearProveedor,
  listarProductosAgricolas,
  crearProductoAgricola,
  actualizarProductoAgricola,
  eliminarProductoAgricola,
  listarChoferes,
  crearChofer,
  listarCamiones,
  crearCamion,
  listarCarros,
  crearCarro,
  buscarChoferPorCodigo,
  buscarCamionPorCodigo,
  buscarCarroPorCodigo,
  crearRecepcion,
  obtenerRecepcionPorId,
  listarRecepciones,
  obtenerRecepcionPorTicket,
  obtenerRecepcionPorCodigo,
  obtenerRecepcionParaTicketIngresoInterno,
  registrarPesaje,
  realizarPesajeCompleto
} from "../services/recepcionesService.js";
import { generateTicketIngresoInternoPdf } from "../lib/ticketIngresoInternoPdf.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

// Listado simple de recepciones (para UI)
router.get("/", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const limit = Number(req.query.limit || 200);
    const data = await listarRecepciones(empresaId, { limit });
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando recepciones:", err);
    res.status(500).json({ error: "Error al listar recepciones" });
  }
});

// -------------------------------------------------------------------
// Catálogos (Mantenedores)
// -------------------------------------------------------------------
router.get("/catalogos/proveedores", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const data = await listarProveedores(empresaId);
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando proveedores:", err);
    res.status(500).json({ error: "Error al obtener proveedores" });
  }
});

router.post("/catalogos/proveedores", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const row = await crearProveedor(empresaId, req.body);
    res.json(row);
  } catch (err) {
    console.error("❌ Error creando proveedor:", err);
    res.status(500).json({ error: "Error al crear proveedor" });
  }
});

router.get("/catalogos/productos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const data = await listarProductosAgricolas(empresaId);
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando productos:", err);
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

router.post("/catalogos/productos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const row = await crearProductoAgricola(empresaId, req.body);
    res.json(row);
  } catch (err) {
    console.error("❌ Error creando producto:", err);
    res.status(500).json({ error: "Error al crear producto" });
  }
});

router.put("/catalogos/productos/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const row = await actualizarProductoAgricola(empresaId, req.params.id, req.body);
    if (!row) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(row);
  } catch (err) {
    console.error("❌ Error actualizando producto:", err);
    res.status(500).json({ error: "Error al actualizar producto" });
  }
});

router.delete("/catalogos/productos/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const success = await eliminarProductoAgricola(empresaId, req.params.id);
    if (!success) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ message: "Producto eliminado correctamente" });
  } catch (err) {
    console.error("❌ Error eliminando producto:", err);
    // Si es error de validación (tiene dependencias), enviamos 400
    res.status(400).json({ error: err.message });
  }
});

router.get("/catalogos/choferes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const data = await listarChoferes(empresaId);
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando choferes:", err);
    res.status(500).json({ error: "Error al obtener choferes" });
  }
});

router.post("/catalogos/choferes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const row = await crearChofer(empresaId, req.body);
    res.json(row);
  } catch (err) {
    console.error("❌ Error creando chofer:", err);
    res.status(500).json({ error: "Error al crear chofer" });
  }
});

router.get("/catalogos/camiones", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const data = await listarCamiones(empresaId);
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando camiones:", err);
    res.status(500).json({ error: "Error al obtener camiones" });
  }
});

router.post("/catalogos/camiones", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const row = await crearCamion(empresaId, req.body);
    res.json(row);
  } catch (err) {
    console.error("❌ Error creando camión:", err);
    res.status(500).json({ error: "Error al crear camión" });
  }
});

router.get("/catalogos/carros", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const data = await listarCarros(empresaId);
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando carros:", err);
    res.status(500).json({ error: "Error al obtener carros" });
  }
});

router.post("/catalogos/carros", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const row = await crearCarro(empresaId, req.body);
    res.json(row);
  } catch (err) {
    console.error("❌ Error creando carro:", err);
    res.status(500).json({ error: "Error al crear carro" });
  }
});

// Lookups por código (scanner)
router.get("/lookup/chofer/:codigo", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const row = await buscarChoferPorCodigo(empresaId, req.params.codigo);
    if (!row) return res.status(404).json({ error: "Chofer no encontrado" });
    res.json(row);
  } catch (err) {
    console.error("❌ Error lookup chofer:", err);
    res.status(500).json({ error: "Error al buscar chofer" });
  }
});

router.get("/lookup/camion/:codigo", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const row = await buscarCamionPorCodigo(empresaId, req.params.codigo);
    if (!row) return res.status(404).json({ error: "Camión no encontrado" });
    res.json(row);
  } catch (err) {
    console.error("❌ Error lookup camion:", err);
    res.status(500).json({ error: "Error al buscar camión" });
  }
});

router.get("/lookup/carro/:codigo", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const row = await buscarCarroPorCodigo(empresaId, req.params.codigo);
    if (!row) return res.status(404).json({ error: "Carro no encontrado" });
    res.json(row);
  } catch (err) {
    console.error("❌ Error lookup carro:", err);
    res.status(500).json({ error: "Error al buscar carro" });
  }
});

// -------------------------------------------------------------------
// Recepciones (proceso)
// -------------------------------------------------------------------
// Cargar por ticket (QR) — útil para retomar una recepción sin buscar ID
router.get("/ticket", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const { codigo, token } = req.query;

    if (!codigo || !token) {
      return res.status(400).json({ error: "codigo y token son requeridos" });
    }

    const row = await obtenerRecepcionPorTicket(empresaId, String(codigo), String(token));
    if (!row) return res.status(404).json({ error: "Ticket no encontrado" });
    res.json(row);
  } catch (err) {
    console.error("❌ Error cargando recepción por ticket:", err);
    res.status(500).json({ error: "Error al cargar ticket" });
  }
});

// GET /api/recepciones/ticket-by-codigo?codigo=ABC123
router.get("/ticket-by-codigo", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const codigo = String(req.query.codigo || "").trim();
    if (!codigo) return res.status(400).json({ error: "codigo requerido" });

    const row = await obtenerRecepcionPorCodigo(empresaId, codigo);
    if (!row) return res.status(404).json({ error: "Recepción no encontrada" });
    res.json(row);
  } catch (err) {
    console.error("❌ Error buscando recepción por codigo:", err);
    res.status(500).json({ error: "Error al buscar recepción" });
  }
});

router.post("/", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const usuarioId = getUsuarioId(req);
    const row = await crearRecepcion(empresaId, usuarioId, req.body);
    res.json(row);
  } catch (err) {
    console.error("❌ Error creando recepción:", err);
    res.status(500).json({ error: "Error al crear recepción" });
  }
});

// Ticket de Ingreso Interno en PDF (requisito SAG — impresión inmediata)
router.get("/:id/ticket-ingreso-interno.pdf", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const data = await obtenerRecepcionParaTicketIngresoInterno(
      empresaId,
      req.params.id
    );
    if (!data)
      return res.status(404).json({ error: "Recepción no encontrada" });

    let empresa = null;
    let logoBase64 = null;
    try {
      empresa = await getEmpresaById(empresaId);
      if (empresa && empresa.logo_url) {
        const logoPath = path.join(
          __dirname,
          "..",
          "..",
          "frontend",
          empresa.logo_url.replace(/^\//, "")
        );
        if (fs.existsSync(logoPath)) {
          const buf = fs.readFileSync(logoPath);
          const ext = path.extname(logoPath).toLowerCase();
          const mime =
            ext === ".png"
              ? "image/png"
              : ext === ".jpg" || ext === ".jpeg"
                ? "image/jpeg"
                : ext === ".gif"
                  ? "image/gif"
                  : "image/png";
          logoBase64 = `data:${mime};base64,${buf.toString("base64")}`;
        }
      }
    } catch (e) {
      console.warn("No se pudo cargar empresa/logo para ticket PDF:", e);
    }

    const pdfBuffer = generateTicketIngresoInternoPdf({
      ...data,
      empresa,
      logoBase64
    });
    const codigo = (data.recepcion.ticket_codigo || data.recepcion.id).toString();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="ticket-ingreso-interno-${codigo}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ Error generando PDF ticket ingreso interno:", err);
    res.status(500).json({ error: "Error al generar PDF" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const row = await obtenerRecepcionPorId(empresaId, req.params.id);
    if (!row) return res.status(404).json({ error: "Recepción no encontrada" });
    res.json(row);
  } catch (err) {
    console.error("❌ Error obteniendo recepción:", err);
    res.status(500).json({ error: "Error al obtener recepción" });
  }
});

router.post("/:id/pesaje/bruto", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const usuarioId = getUsuarioId(req);
    const { peso_kg, origen, motivo } = req.body;
    const row = await registrarPesaje(empresaId, usuarioId, req.params.id, "BRUTO", peso_kg, origen, motivo);
    res.json(row);
  } catch (err) {
    console.error("❌ Error registrando bruto:", err);
    res.status(400).json({ error: err.message || "Error al registrar bruto" });
  }
});

router.post("/:id/pesaje/tara", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const usuarioId = getUsuarioId(req);
    const { peso_kg, origen, motivo } = req.body;
    const row = await registrarPesaje(empresaId, usuarioId, req.params.id, "TARA", peso_kg, origen, motivo);
    res.json(row);
  } catch (err) {
    console.error("❌ Error registrando tara:", err);
    res.status(400).json({ error: err.message || "Error al registrar tara" });
  }
});

// Realizar pesaje completo (genera ticket de pesaje asociado)
router.post("/:id/pesaje/realizar", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const usuarioId = getUsuarioId(req);
    const payload = req.body || {};
    const result = await realizarPesajeCompleto(empresaId, usuarioId, req.params.id, payload);
    res.json(result);
  } catch (err) {
    console.error("❌ Error realizando pesaje completo:", err);
    res.status(500).json({ error: "Error al realizar pesaje" });
  }
});

// Nota: QR de tickets de pesaje removido — solo usamos ticket de recepción

// Ticket QR (imagen)
router.get("/:id/ticket/qr.png", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const row = await obtenerRecepcionPorId(empresaId, req.params.id);
    if (!row) return res.status(404).json({ error: "Recepción no encontrada" });

    if (!row.ticket_codigo || !row.ticket_token) {
      return res.status(400).json({ error: "Ticket no disponible hasta guardar Bruto y Tara" });
    }

    const qrText = JSON.stringify({
      empresa_id: empresaId,
      recepcion_id: row.id,
      ticket_codigo: row.ticket_codigo,
      ticket_token: row.ticket_token
    });

    const png = await bwipjs.toBuffer({
      bcid: "qrcode",
      text: qrText,
      scale: 4,
      includetext: false
    });

    res.type("png");
    res.send(png);
  } catch (err) {
    console.error("❌ Error generando QR:", err);
    res.status(500).json({ error: "Error al generar QR" });
  }
});

// Ticket Code128 (imagen) — útil para lectores 1D y para impresión 80mm
router.get("/:id/ticket/code128.png", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const row = await obtenerRecepcionPorId(empresaId, req.params.id);
    if (!row) return res.status(404).json({ error: "Recepción no encontrada" });

    const text = String(row.ticket_codigo || "").trim();
    if (!text) return res.status(400).json({ error: "Ticket sin código" });

    const png = await bwipjs.toBuffer({
      bcid: "code128",
      text,
      scale: 3,
      height: 12,
      includetext: true,
      textxalign: "center"
    });

    res.type("png");
    res.send(png);
  } catch (err) {
    console.error("❌ Error generando Code128:", err);
    res.status(500).json({ error: "Error al generar código de barras" });
  }
});

export default router;
