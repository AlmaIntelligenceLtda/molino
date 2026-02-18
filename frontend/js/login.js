let error = document.querySelector('#text-error');
let email = document.querySelector('#txtEmail');
let password = document.querySelector('#txtPassword');
let btnLogin = document.querySelector('#btnLogin');

btnLogin.addEventListener('click', (e) => {
  e.preventDefault();
  validateInputs();
  login();
});

const formSubmit = (event) => {
  event.preventDefault();
  login();
  return false;
};

const login = async () => {
  const mail = email?.value.trim();
  const pass = password?.value.trim();

  if (!mail || !pass) return;

  // Validar formato de correo simple
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    return errorLogin("Debes ingresar un correo válido");
  }

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: mail, password: pass }),
    });

    const result = await res.json();

    if (!res.ok) {
      const map = {
        MISSING_FIELDS: "Debes ingresar correo y contraseña.",
        USER_NOT_FOUND: "Usuario no encontrado.",
        INACTIVE_USER: "Usuario no activado.",
        WRONG_PASSWORD: "Contraseña incorrecta.",
        ROLE_NOT_ALLOWED: result?.message || "Rol no admitido.",
        INVALID_CREDENTIALS: "Credenciales inválidas.",
        AUTH_INTERNAL_ERROR: "Error interno. Intenta nuevamente."
      };
      const msg = map[result.code] || result.message || "No se pudo iniciar sesión.";
      return errorLogin(msg);
    }

    if (result.success) {
      location.href = "/dashboard";
    } else {
      errorLogin(result.message || "No se pudo iniciar sesión.");
    }
  } catch (err) {
    console.error("❌ Error en login:", err);
    errorLogin("Error de red. Intenta nuevamente.");
  }
};

const errorLogin = (msg) => {
  error.innerHTML = msg || 'Correo o contraseña incorrecta.';
  error.classList.remove('text-muted');
  error.classList.add('text-danger');

  email.value = '';
  password.value = '';
  email.focus();
};

// Validaciones básicas
const validateInputs = () => {
  if (!email.value) {
    error.innerHTML = 'Ingresa tu correo @evoptica.cl';
    error.classList.remove('text-muted');
    error.classList.add('text-danger');
  } else if (!password.value) {
    error.innerHTML = 'Ingresa tu contraseña.';
    error.classList.remove('text-muted');
    error.classList.add('text-danger');
  }
};

// Mostrar/ocultar contraseña
const showPassword1 = document.querySelector('.show-pass1');
const password1 = document.querySelector('.password1');

showPassword1?.addEventListener('click', () => {
  if (password1.type === "text") {
    password1.type = "password";
    showPassword1.classList.remove('fa-eye-slash');
  } else {
    password1.type = "text";
    showPassword1.classList.toggle("fa-eye-slash");
  }
});































// let error = document.querySelector('#text-error');
// let usuario = document.querySelector('#txtUsuario');
// let password = document.querySelector('#txtPassword');
// let btnLogin = document.querySelector('#btnLogin');

// btnLogin.addEventListener('click', () => {
//   validateInputs();
// });

// const formSubmit = (event) => {
//   event.preventDefault();
//   login();
//   return false;
// };

// const login = async () => {
//   const rut = usuario?.value.trim();
//   const pass = password?.value.trim();

//   if (!rut || !pass) return;

//   try {
//     const res = await fetch("/api/auth/login", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       credentials: "include",
//       body: JSON.stringify({ rut, password: pass }),
//     });

//     const result = await res.json();

//     if (!res.ok) {
//       const map = {
//         MISSING_FIELDS: "Debes ingresar RUT y contraseña.",
//         USER_NOT_FOUND: "Usuario no encontrado.",
//         INACTIVE_USER: "Usuario no activado.",
//         WRONG_PASSWORD: "Contraseña incorrecta.",
//         ROLE_NOT_ALLOWED: result?.message || "Rol no admitido.",
//         INVALID_CREDENTIALS: "Credenciales inválidas.",
//         AUTH_INTERNAL_ERROR: "Error interno. Intenta nuevamente."
//       };
//       const msg = map[result.code] || result.message || "No se pudo iniciar sesión.";
//       return errorLogin(msg);
//     }

//     if (result.success) {
//       location.href = "/dashboard";
//     } else {
//       errorLogin(result.message || "No se pudo iniciar sesión.");
//     }
//   } catch (err) {
//     console.error("❌ Error en login:", err);
//     errorLogin("Error de red. Intenta nuevamente.");
//   }
// };

// const errorLogin = (msg) => {
//   error.innerHTML = msg || 'Usuario no activado o contraseña equivocada.';
//   error.classList.remove('text-muted');
//   error.classList.add('text-danger');

//   usuario.value = '';
//   password.value = '';
//   usuario.focus();
// };


// // Validaciones básicas
// const validateInputs = () => {
//   if (!usuario.value) {
//     error.innerHTML = 'Ingresa tu usuario.';
//     error.classList.remove('text-muted');
//     error.classList.add('text-danger');
//   } else if (!password.value) {
//     error.innerHTML = 'Ingresa tu contraseña.';
//     error.classList.remove('text-muted');
//     error.classList.add('text-danger');
//   }
// };

// const showPassword1 = document.querySelector('.show-pass1');
// const password1 = document.querySelector('.password1');

// showPassword1?.addEventListener('click', () => {
//   if (password1.type === "text") {
//     password1.type = "password";
//     showPassword1.classList.remove('fa-eye-slash');
//   } else {
//     password1.type = "text";
//     showPassword1.classList.toggle("fa-eye-slash");
//   }
// });

// $(document).ready(function () {
//   const input = "#txtUsuario";
//   const error = "#rutLoginError";
//   const form = "#formLogin";

//   // Validar en tiempo real
//   $(input).on("input", function () {
//     // 🔹 Solo permitir números, puntos, guiones y K/k
//     let limpio = $(this).val().replace(/[^0-9Kk.\-]/g, "").toUpperCase();

//     // 🔹 Quitamos puntos y guiones para trabajar con el valor "crudo"
//     let sinFormato = limpio.replace(/[.\-]/g, "");

//     // 🔹 Re-armar con guion si tiene más de un caracter
//     if (sinFormato.length > 1) {
//       let cuerpo = sinFormato.slice(0, -1);
//       let dv = sinFormato.slice(-1);
//       $(this).val(cuerpo + "-" + dv);
//     } else {
//       $(this).val(sinFormato);
//     }

//     // 🔹 Validar
//     if (validarRut(sinFormato)) {
//       $(error).addClass("d-none");
//       $(this).removeClass("is-invalid").addClass("is-valid");
//     } else {
//       $(error).removeClass("d-none");
//       $(this).removeClass("is-valid").addClass("is-invalid");
//     }
//   });

//   // Bloquear envío si es inválido
//   $(form).on("submit", function (e) {
//     let limpio = $(input).val().replace(/[^0-9Kk.\-]/g, "").toUpperCase();
//     let sinFormato = limpio.replace(/[.\-]/g, "");

//     if (!validarRut(sinFormato)) {
//       e.preventDefault();
//       $(error).removeClass("d-none");
//       $(input).addClass("is-invalid");
//       console.warn("❌ No se envió porque el RUT es inválido:", limpio);
//     }
//   });
// });

// function validarRut(valor) {
//   if (!valor || valor.length < 2) return false;

//   const cuerpo = valor.slice(0, -1);
//   let dv = valor.slice(-1).toUpperCase();

//   if (cuerpo.length < 7) return false;

//   let suma = 0;
//   let multiplo = 2;

//   for (let i = 1; i <= cuerpo.length; i++) {
//     const num = parseInt(cuerpo.charAt(cuerpo.length - i), 10);
//     suma += num * multiplo;
//     multiplo = multiplo < 7 ? multiplo + 1 : 2;
//   }

//   let dvEsperado = 11 - (suma % 11);
//   dvEsperado = dvEsperado === 11 ? "0" : dvEsperado === 10 ? "K" : dvEsperado.toString();

//   return dv === dvEsperado;
// }
