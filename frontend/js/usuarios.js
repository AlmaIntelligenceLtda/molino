(() => {

  $(function () {
    $('#activo').bootstrapToggle();
  });

  const form = document.getElementById("formUsuario");
  const tabla = document.getElementById("tablaUsuarios");
  const formEditar = document.getElementById("formEditarUsuario");

  let tablaDT;
  let userRol = null; // 👈 rol del usuario logueado

  // ============================
  // 🚀 Obtener usuario actual
  // ============================
  async function obtenerUsuarioActual() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("No autenticado");
      const data = await res.json();
      if (data.success) {
        userRol = data.user.rol;
      }
    } catch (err) {
      console.error("❌ No se pudo obtener usuario actual:", err);
      userRol = null;
    }
  }

  const initTable = () => {
    if ($.fn.dataTable.isDataTable("#tablaUsuarios")) {
      $("#tablaUsuarios").DataTable().destroy();
    }
    tablaDT = $("#tablaUsuarios").DataTable({
      language: { url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json" },
      pageLength: 5
    });
  };

  async function cargarUsuarios() {
    try {
      const res = await fetch("/api/usuarios");
      const data = await res.json();

      if ($.fn.DataTable.isDataTable("#tablaUsuarios")) {
        $("#tablaUsuarios").DataTable().clear().destroy();
      }

      const tbody = tabla.querySelector("tbody");
      tbody.innerHTML = data
        .map(
          (u) => `
        <tr>
          <td>${u.id}</td>
          <td>${u.rut}</td>
          <td>${u.nombres}</td>
          <td>${u.apellidos}</td>
          <td>${u.email || ""}</td> <!-- 👈 email en la tabla -->
          <td>${u.rol}</td>
          <td>${u.activo ? "Activo" : "Inactivo"}</td>
          <td>
            <button class="btn btn-sm btn-secondary btnCredencial" data-id="${u.id}">
              <i class="fas fa-id-card"></i>
            </button>
            <button class="btn btn-sm btn-info btnEditar" data-id="${u.id}">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-danger btnEliminar" data-id="${u.id}">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>`
        )
        .join("");

      initTable();
    } catch (err) {
      console.error("❌ Error cargando usuarios:", err);
    }
  }

  // ============================
  // 🔎 Validadores rápidos
  // ============================
  const isValidEmail = (email) => {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
  };

  // ============================
  // 📌 Crear usuario
  // ============================
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const rut = document.getElementById("rut").value.trim();
    const nombres = document.getElementById("nombres").value.trim();
    const apellidos = document.getElementById("apellidos").value.trim();
    const email = (document.getElementById("email")?.value || "").trim().toLowerCase(); // 👈 email
    const password = document.getElementById("password").value.trim();
    const rol = document.getElementById("rol").value;
    const activo = document.getElementById("activo").checked;

    if (!rut || !nombres || !apellidos || !email || !password || !rol) {
      return Swal.fire("Campos requeridos", "Completa todos los campos", "warning");
    }
    if (!isValidEmail(email)) {
      return Swal.fire("Correo inválido", "Ingresa un email válido (ej: usuario@dominio.com)", "warning");
    }

    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rut, nombres, apellidos, email, password, rol, activo }) // 👈 incluye email
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Error al crear usuario");
      }

      Swal.fire("✅ Usuario creado", "", "success");
      form.reset();
      await cargarUsuarios();
    } catch (err) {
      Swal.fire("❌ Error", err.message, "error");
    }
  });

  // ============================
  // 📌 Delegación de eventos
  // ============================
  tabla.addEventListener("click", async (e) => {
    // Editar
    if (e.target.closest(".btnEditar")) {
      const id = e.target.closest(".btnEditar").dataset.id;
      const res = await fetch(`/api/usuarios/${id}`);
      const usuario = await res.json();

      document.getElementById("editId").value = usuario.id;
      document.getElementById("editRut").value = usuario.rut;
      document.getElementById("editNombres").value = usuario.nombres;
      document.getElementById("editApellidos").value = usuario.apellidos;
      document.getElementById("editRol").value = usuario.rol;
      // 👇 email al modal
      const editEmailInput = document.getElementById("editEmail");
      if (editEmailInput) editEmailInput.value = usuario.email || "";

      const editActivo = document.getElementById("editActivo");
      editActivo.checked = usuario.activo;
      $(editActivo).bootstrapToggle(usuario.activo ? "on" : "off");

      document.getElementById("editPassword").value = "";

      $("#modalEditarUsuario").modal("show");
    }

    // Eliminar
    if (e.target.closest(".btnEliminar")) {
      const id = e.target.closest(".btnEliminar").dataset.id;

      // Comprobación rápida de rol en cliente (mostrar mensaje si no es superusuario)
      if (userRol !== "superusuario") {
        return Swal.fire(
          "Acceso denegado",
          "Solo un superusuario puede eliminar usuarios",
          "error"
        );
      }

      // Pedir clave del superusuario antes de eliminar
      const { value: clave } = await Swal.fire({
        title: "Confirmar eliminación",
        input: "password",
        inputLabel: "Ingresa tu clave",
        inputPlaceholder: "Clave",
        showCancelButton: true
      });

      if (!clave) return; // si cancela o no ingresa clave

      try {
        const res = await fetch(`/api/usuarios/${id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ clave })
        });

        let data = null;
        try {
          data = await res.json();
        } catch (_) {
          data = null;
        }

        if (!res.ok || data?.success === false) {
          const mensaje = data?.error || data?.message || "Error al eliminar usuario";
          throw new Error(mensaje);
        }

        Swal.fire("✅ Usuario eliminado", "", "success");
        await cargarUsuarios();
      } catch (err) {
        Swal.fire("❌ Error", err.message || "Error al eliminar usuario", "error");
      }
    }

    // Credencial
    if (e.target.closest(".btnCredencial")) {
      const id = e.target.closest(".btnCredencial").dataset.id;
      const res = await fetch(`/api/usuarios/${id}`);
      const usuario = await res.json();

      async function addLogoToPDF(pdf) {
        try {
          const logoUrl = "/assets/images/logo.png";
          console.log("🟡 Intentando cargar logo desde:", logoUrl);

          const response = await fetch(logoUrl);
          if (!response.ok) throw new Error(`Error HTTP ${response.status}`);

          console.log("✅ Logo encontrado, status:", response.status);
          const blob = await response.blob();

          // Convertir el blob directamente a base64
          const base64Logo = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          // Crear imagen desde el Base64
          const img = new Image();
          img.src = base64Logo;

          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });

          // Dibujar en canvas y convertir a JPEG
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const jpegBase64 = canvas.toDataURL("image/jpeg", 0.8);

          console.log("📸 Logo convertido a JPEG correctamente (sin blob)");
          pdf.addImage(jpegBase64, "JPEG", 17, 3, 20, 20);
          console.log("✅ Logo agregado al PDF correctamente");

        } catch (err) {
          console.error("❌ Error cargando o agregando logo:", err);
        }
      }

      try {
        const { jsPDF } = window.jspdf;

        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [54, 85.6]
        });

        const negro = [0, 0, 0];
        const amarillo = [255, 197, 51];

        const steps = 10000;
        for (let i = 0; i < steps; i++) {
          const ratio = i / (steps - 1);
          let adjustedRatio;
          if (ratio < 0.375) adjustedRatio = 0;
          else if (ratio > 0.625) adjustedRatio = 1;
          else adjustedRatio = (ratio - 0.375) / 0.25;

          const r = Math.round(negro[0] * (1 - adjustedRatio) + amarillo[0] * adjustedRatio);
          const g = Math.round(negro[1] * (1 - adjustedRatio) + amarillo[1] * adjustedRatio);
          const b = Math.round(negro[2] * (1 - adjustedRatio) + amarillo[2] * adjustedRatio);

          pdf.setFillColor(r, g, b);
          pdf.rect(2, 2 + (i * 81.6) / steps, 50, 81.6 / steps, "F");
        }

        pdf.setDrawColor(0, 0, 0);
        pdf.roundedRect(2, 2, 50, 81.6, 3, 3);

        await addLogoToPDF(pdf);

        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 197, 51);
        pdf.text(usuario.rol.toUpperCase(), 27, 25, { align: "center" });

        // QR retirado: ya no se agrega el código QR en la credencial física.
        // Si en el futuro quieres restaurarlo, descomenta la lógica de obtención
        // de qr_id y la generación con QRCode.toCanvas.

        // Nombre completo (ajuste dinámico)
        const nombreCompleto = `${usuario.nombres} ${usuario.apellidos}`.trim();
        let fontSize = 9;
        if (nombreCompleto.length > 20) fontSize = 8;
        if (nombreCompleto.length > 28) fontSize = 7;
        if (nombreCompleto.length > 35) fontSize = 6;

        pdf.setFontSize(fontSize);
        pdf.setTextColor(0, 0, 0);
        pdf.text(nombreCompleto, 27, 68, { align: "center", maxWidth: 46 });
        pdf.text(usuario.rut, 27, 74, { align: "center" });

        const pdfDataUri = pdf.output("datauristring");
        Swal.fire({
          title: `Credencial de ${usuario.rol}`,
          width: "700px",
          html: `<iframe src="${pdfDataUri}" width="300px" height="500px" style="border:none;" allowfullscreen></iframe>`,
          showCloseButton: true,
          confirmButtonText: "Descargar"
        }).then((result) => {
          if (result.isConfirmed) {
            pdf.save(`credencial_${usuario.rut}.pdf`);
          }
        });

      } catch (err) {
        console.error("❌ Error generando credencial:", err);
        Swal.fire("❌ Error", "No se pudo generar la credencial", "error");
      }
    }
  });

  // ============================
  // 📌 Guardar cambios (editar)
  // ============================
  formEditar.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("editId").value;
    const rut = document.getElementById("editRut").value.trim();
    const nombres = document.getElementById("editNombres").value.trim();
    const apellidos = document.getElementById("editApellidos").value.trim();
    const email = (document.getElementById("editEmail")?.value || "").trim().toLowerCase(); // 👈 email
    const rol = document.getElementById("editRol").value;
    const activo = document.getElementById("editActivo").checked;
    const password = document.getElementById("editPassword").value.trim();

    if (!rut || !nombres || !apellidos || !email || !rol) {
      return Swal.fire("Campos requeridos", "Completa todos los campos obligatorios", "warning");
    }
    if (!isValidEmail(email)) {
      return Swal.fire("Correo inválido", "Ingresa un email válido (ej: usuario@dominio.com)", "warning");
    }

    try {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rut, nombres, apellidos, email, rol, activo, password: password || null }) // 👈 incluye email
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Error al actualizar usuario");
      }

      Swal.fire("✅ Usuario actualizado", "", "success");
      $("#modalEditarUsuario").modal("hide");
      await cargarUsuarios();
    } catch (err) {
      Swal.fire("❌ Error", err.message, "error");
    }
  });

  // 🚀 Iniciar
  (async () => {
    await obtenerUsuarioActual(); // obtener rol
    await cargarUsuarios();       // luego cargar usuarios
  })();
})();

// ============================
// 📌 FORMATEAR Y VALIDAR RUT (Usuarios: crear y editar)
// ============================
$(document).ready(function () {
  const camposRut = [
    { input: "#rut", error: "#rutError", form: "#formUsuario" },            // Crear usuario
    { input: "#editRut", error: "#editRutError", form: "#formEditarUsuario" } // Editar usuario
  ];

  camposRut.forEach(({ input, error, form }) => {
    // Validar en tiempo real
    $(input).on("input", function () {
      // 🔹 Permitir solo números, puntos, guion y K/k
      let limpio = $(this).val().replace(/[^0-9Kk.\-]/g, "").toUpperCase();

      // 🔹 Quitar puntos y guiones para trabajar con el valor "crudo"
      let sinFormato = limpio.replace(/[.\-]/g, "");

      // 👉 Si tiene al menos 2 caracteres, separa cuerpo y dígito verificador
      if (sinFormato.length > 1) {
        let cuerpo = sinFormato.slice(0, -1);
        let dv = sinFormato.slice(-1);
        $(this).val(cuerpo + "-" + dv);
      } else {
        $(this).val(sinFormato);
      }

      // Validar contra el valor sin formato
      if (validarRut(sinFormato)) {
        $(error).addClass("d-none");
        $(this).removeClass("is-invalid").addClass("is-valid");
      } else {
        $(error).removeClass("d-none");
        $(this).removeClass("is-valid").addClass("is-invalid");
      }
    });

    // Bloquear envío si el RUT no es válido
    $(form).on("submit", function (e) {
      let limpio = $(input).val().replace(/[^0-9Kk.\-]/g, "").toUpperCase();
      let sinFormato = limpio.replace(/[.\-]/g, "");
      if (!validarRut(sinFormato)) {
        e.preventDefault();
        $(error).removeClass("d-none");
        $(input).addClass("is-invalid");
        console.warn("❌ No se envió porque el RUT es inválido:", limpio);
      }
    });
  });
});

/**
 * ✅ Valida un RUT chileno
 */
function validarRut(valor) {
  if (!valor || valor.length < 2) return false;

  const cuerpo = valor.slice(0, -1);
  let dv = valor.slice(-1).toUpperCase();

  if (cuerpo.length < 7) return false;

  let suma = 0;
  let multiplo = 2;

  for (let i = 1; i <= cuerpo.length; i++) {
    const num = parseInt(cuerpo.charAt(cuerpo.length - i), 10);
    suma += num * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }

  let dvEsperado = 11 - (suma % 11);
  dvEsperado = dvEsperado === 11 ? "0" : dvEsperado === 10 ? "K" : dvEsperado.toString();

  return dv === dvEsperado;
}

// ============================
// 📌 Helpers
// ============================
function isValidEmail(email) {
  // email válido + dominio obligatorio @evoptica.cl
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.endsWith("@evoptica.cl");
}

// Validar RUT chileno (DV)
function validarRut(rut) {
  rut = rut.replace(/\./g, "").replace("-", "");
  if (rut.length < 8) return false;

  const cuerpo = rut.slice(0, -1);
  let dv = rut.slice(-1).toUpperCase();

  let suma = 0, multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }
  const dvEsperado = 11 - (suma % 11);
  let dvFinal = dvEsperado === 11 ? "0" : dvEsperado === 10 ? "K" : dvEsperado.toString();

  return dv === dvFinal;
}


// ============================
// 📌 FORMATEAR Y VALIDAR EMAIL CORPORATIVO (@evoptica.cl)
// ============================
$(document).ready(function () {
  const DOMAIN = "@evoptica.cl";

  const camposEmail = [
    { input: "#email", error: "#emailError", form: "#formUsuario" },            // Crear usuario
    { input: "#editEmail", error: "#editEmailError", form: "#formEditarUsuario" } // Editar usuario
  ];

  camposEmail.forEach(({ input, error, form }) => {
    const $input = $(input);

    // Inicializar siempre con dominio
    if (!$input.val().endsWith(DOMAIN)) {
      $input.val(DOMAIN);
    }

    // Validar en tiempo real
    $input.on("input", function () {
      let valor = $input.val().toLowerCase();

      // Quitar el dominio si el usuario lo tocó
      if (valor.includes("@")) {
        valor = valor.split("@")[0];
      }

      // Solo caracteres válidos
      valor = valor.replace(/[^a-z0-9._-]/g, "");

      // Reconstruir siempre con dominio fijo
      $input.val(valor + DOMAIN);

      // ✅ Validación
      if (valor.length > 0) {
        $(error).addClass("d-none");
        $input.removeClass("is-invalid").addClass("is-valid");
      } else {
        $(error).removeClass("d-none");
        $input.removeClass("is-valid").addClass("is-invalid");
      }
    });

    // Evitar que se pueda posicionar dentro del dominio
    $input.on("click focus", function () {
      const local = $input.val().split("@")[0];
      this.setSelectionRange(local.length, local.length); // cursor justo antes del dominio
    });

    // Bloquear envío si no hay parte local
    $(form).on("submit", function (e) {
      let local = $input.val().split("@")[0];
      if (local.length === 0) {
        e.preventDefault();
        $(error).removeClass("d-none");
        $input.addClass("is-invalid");
        console.warn("❌ No se envió porque falta la parte local del email");
      }
    });
  });
});
