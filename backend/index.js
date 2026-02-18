import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

import usuariosRoutes from "./routes/usuarios.js";
import ablyRoutes from "./routes/ably.js";
import authRoutes from "./routes/auth.js";
import mantenedoresRoutes from "./routes/mantenedores.js";
import recepcionesRoutes from "./routes/recepciones.js";
import laboratorioRoutes from "./routes/laboratorio.js";
import clientesRoutes from "./routes/clientes.js";
import maquilaRoutes from "./routes/maquila.js";
import wmsRoutes from "./routes/wms.js";
import produccionRoutes from "./routes/produccion.js";
import empresaRoutes from "./routes/empresa.js";

dotenv.config();

// Inicializar Ably (realtime) si está disponible en env
import { initAbly } from "./lib/ably.js";
initAbly();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// 👉 Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// Middleware para proteger rutas
const SECRET = process.env.JWT_SECRET || "supersecreto";

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.redirect("/login.html");
  try {
    jwt.verify(token, SECRET);
    return next();
  } catch {
    return res.redirect("/login.html");
  }
}

// 👉 Rutas API
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/ably", ablyRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/mantenedores", mantenedoresRoutes);
app.use("/api/recepciones", recepcionesRoutes);
app.use("/api/laboratorio", laboratorioRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/maquila", maquilaRoutes);
app.use("/api/wms", wmsRoutes);
app.use("/api/produccion", produccionRoutes);
app.use("/api/empresa", empresaRoutes);

// 👉 Ruta principal → redirigir "/" a tu slug bonito
app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

// 👉 Home protegido en /dashboard
app.get("/dashboard", requireAuth, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// 👉 Si alguien entra a /index.html → redirigir al slug
app.get("/index.html", (req, res) => {
  res.redirect("/dashboard");
});

// 👉 Rutas desconocidas → también sirven index.html (SPA)
app.get("*", requireAuth, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend corriendo en http://localhost:${PORT}`);
});
