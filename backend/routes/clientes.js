import express from "express";
import jwt from "jsonwebtoken";

import { listarClientes, crearCliente } from "../services/clientesService.js";

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

router.get("/", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const data = await listarClientes(empresaId);
    res.json(data);
  } catch (err) {
    console.error("❌ Error listando clientes:", err);
    res.status(500).json({ error: "Error al obtener clientes" });
  }
});

router.post("/", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const row = await crearCliente(empresaId, req.body);
    res.json(row);
  } catch (err) {
    console.error("❌ Error creando cliente:", err);
    res.status(500).json({ error: "Error al crear cliente" });
  }
});

export default router;
