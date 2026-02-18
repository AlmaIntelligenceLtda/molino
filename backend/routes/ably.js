import express from "express";
import jwt from "jsonwebtoken";
import { createTokenRequest } from "../lib/ably.js";

const router = express.Router();
const SECRET = process.env.JWT_SECRET || "supersecreto";

/**
 * Genera un TokenRequest de Ably autenticado vía cookie JWT.
 */
router.get("/token", async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      console.warn("[/api/ably/token] Petición sin cookie de token");
      return res.status(401).json({ error: "No autenticado" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, SECRET);
    } catch (err) {
      console.warn("[/api/ably/token] Token inválido:", err?.message);
      return res.status(401).json({ error: "Token inválido" });
    }

    const userId = decoded.id || decoded.user_id || decoded.sub || null;
    const rol = String(decoded.rol || "").toLowerCase();
    if (!userId) return res.status(400).json({ error: "Usuario no identificado en token" });

    const clientId = `user-${userId}`;
    const tokenRequest = await createTokenRequest(clientId);

    return res.json({ tokenRequest, rol });
  } catch (err) {
    console.error("❌ Error generando token Ably:", err?.message || err);
    res.status(500).json({ error: "Error generando token Ably", details: err?.message });
  }
});

export default router;
