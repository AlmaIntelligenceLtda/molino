import express from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { verificarCredencialesEmail, registrarEmpresa } from "../services/authService.js";

const router = express.Router();
const SECRET = process.env.JWT_SECRET || "supersecreto";

router.use(cookieParser());

/* ===============================
   REGISTRO EMPRESA → POST /api/auth/register
================================= */
router.post("/register", async (req, res) => {
  try {
    const result = await registrarEmpresa(req.body);

    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message || "Error al registrar" });
    }

    // Opcional: Auto-login
    // const token = jwt.sign(result.user, SECRET, { expiresIn: "2h" });
    // res.cookie("token", token, { httpOnly: true, secure: false });

    return res.json({ success: true, message: "Registro exitoso", user: result.user });
  } catch (err) {
    console.error("❌ Error en /api/auth/register:", err);
    return res.status(500).json({
      success: false,
      code: "AUTH_INTERNAL_ERROR",
      message: "Error interno de registro"
    });
  }
});

/* ===============================
   LOGIN DASHBOARD (EMAIL) → POST /api/auth/login
================================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await verificarCredencialesEmail(email, password);

    if (!result.ok) return manejarErrores(result, res);

    const safeUser = result.user;
    const token = jwt.sign(safeUser, SECRET, { expiresIn: "2h" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // ⚠️ en producción => true con HTTPS
      sameSite: "lax"
    });
    return res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error("❌ Error en /api/auth/login:", err);
    return res.status(500).json({
      success: false,
      code: "AUTH_INTERNAL_ERROR",
      message: "Error interno de autenticación"
    });
  }
});

/* ===============================
   LOGIN POR QR FÍSICO → POST /api/auth/qr-login
   Body: { qr_id }
   - Usa identificador opaco del usuario
   - No expone rut ni password
================================= */
router.post("/qr-login", async (req, res) => {
  try {
    const { qr_id } = req.body || {};
    if (!qr_id || typeof qr_id !== "string") {
      return res.status(400).json({ success:false, message:"qr_id requerido" });
    }
    if (!usuario.activo) {
      return res.status(403).json({ success:false, message:"Usuario inactivo" });
    }

    // Generar JWT con los mismos datos seguros
    const token = jwt.sign(usuario, SECRET, { expiresIn: "2h" });
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax"
    });
    return res.json({ success:true, user: usuario });
  } catch (err) {
    console.error("❌ Error en /api/auth/qr-login:", err);
    return res.status(500).json({ success:false, message:"Error interno de autenticación QR" });
  }
});

/* ===============================
   PROFILE → GET /api/auth/me
================================= */
router.get("/me", (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ success: false, message: "No autenticado" });

  try {
    const decoded = jwt.verify(token, SECRET);
    res.json({ success: true, user: decoded });
  } catch (err) {
    res.status(403).json({ success: false, message: "Token inválido" });
  }
});

/* ===============================
   LOGOUT → POST /api/auth/logout
================================= */
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  console.log("🔒 Sesión cerrada");
  res.json({ success: true, message: "Sesión cerrada" });
});

/* ===============================
   Helper centralizado de errores
================================= */
function manejarErrores(result, res) {
  switch (result.reason) {
    case "missing_fields":
      return res.status(400).json({ success: false, code: "MISSING_FIELDS", message: "Debes ingresar correo y contraseña" });
    case "user_not_found":
      return res.status(404).json({ success: false, code: "USER_NOT_FOUND", message: "Usuario no encontrado" });
    case "inactive_user":
      return res.status(403).json({ success: false, code: "INACTIVE_USER", message: "Usuario no activado" });
    case "wrong_password":
      return res.status(401).json({ success: false, code: "WRONG_PASSWORD", message: "Contraseña incorrecta" });
    case "role_not_allowed":
      return res.status(403).json({
        success: false,
        code: "ROLE_NOT_ALLOWED",
        message: `Rol no admitido (${result.detail?.rol ?? "desconocido"})`
      });
    case "invalid_email_domain":
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message: "El correo debe ser institucional (@evoptica.cl)"
      });
    default:
      return res.status(401).json({ success: false, code: "INVALID_CREDENTIALS", message: "Credenciales inválidas" });
  }
}

export default router;















// import express from "express";
// import jwt from "jsonwebtoken";
// import cookieParser from "cookie-parser";
// import { verificarCredenciales } from "../services/authService.js";

// const router = express.Router();
// const SECRET = process.env.JWT_SECRET || "supersecreto";

// router.use(cookieParser());

// // LOGIN → POST /api/auth/login
// router.post("/login", async (req, res) => {
//   try {
//     const { rut, password } = req.body;

//     const result = await verificarCredenciales(rut, password);

//     if (!result.ok) {
//       switch (result.reason) {
//         case "missing_fields":
//           return res.status(400).json({ success: false, code: "MISSING_FIELDS", message: "Credenciales incompletas" });
//         case "user_not_found":
//           return res.status(404).json({ success: false, code: "USER_NOT_FOUND", message: "Usuario no encontrado" });
//         case "inactive_user":
//           return res.status(403).json({ success: false, code: "INACTIVE_USER", message: "Usuario no activado" });
//         case "wrong_password":
//           return res.status(401).json({ success: false, code: "WRONG_PASSWORD", message: "Contraseña incorrecta" });
//         case "role_not_allowed":
//           return res.status(403).json({
//             success: false,
//             code: "ROLE_NOT_ALLOWED",
//             message: `Rol no admitido (${result.detail?.rol ?? "desconocido"})`
//           });
//         default:
//           return res.status(401).json({ success: false, code: "INVALID_CREDENTIALS", message: "Credenciales inválidas" });
//       }
//     }

//     const safeUser = result.user;

//     // Generar JWT
//     const token = jwt.sign(safeUser, SECRET, { expiresIn: "2h" });

//     // Enviar cookie HttpOnly
//     res.cookie("token", token, {
//       httpOnly: true,
//       secure: false, // ⚠️ en producción => true con HTTPS
//       sameSite: "lax"
//     });

//     console.log("✅ Login exitoso:", safeUser.rut, "-", safeUser.rol);
//     return res.json({ success: true, user: safeUser });

//   } catch (err) {
//     console.error("❌ Error en /api/auth/login:", err);
//     return res.status(500).json({ success: false, code: "AUTH_INTERNAL_ERROR", message: "Error interno de autenticación" });
//   }
// });

// // PROFILE → GET /api/auth/me
// router.get("/me", (req, res) => {
//   const token = req.cookies.token;
//   if (!token) return res.status(401).json({ success: false, message: "No autenticado" });

//   try {
//     const decoded = jwt.verify(token, SECRET);
//     res.json({ success: true, user: decoded });
//   } catch (err) {
//     res.status(403).json({ success: false, message: "Token inválido" });
//   }
// });

// // LOGOUT → POST /api/auth/logout
// router.post("/logout", (req, res) => {
//   res.clearCookie("token");
//   console.log("🔒 Sesión cerrada");
//   res.json({ success: true, message: "Sesión cerrada" });
// });

// export default router;
