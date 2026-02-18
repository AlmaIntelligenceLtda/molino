(function () {
  const getEl = (id) => document.getElementById(id);
  let companyData = null;

  function formatDate(val) {
    if (!val) return "—";
    try {
      const d = new Date(val);
      return isNaN(d.getTime()) ? val : d.toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return val;
    }
  }

  function setText(id, text) {
    const el = getEl(id);
    if (el) el.textContent = text != null && text !== "" ? String(text) : "—";
  }

  function setLogo(logoUrl) {
    const img = getEl("companyLogoImg");
    const placeholder = getEl("companyLogoPlaceholder");
    if (!img || !placeholder) return;
    if (logoUrl) {
      img.src = logoUrl + (logoUrl.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
      img.style.display = "";
      placeholder.style.display = "none";
    } else {
      img.src = "";
      img.style.display = "none";
      placeholder.style.display = "flex";
    }
  }

  function renderCompany(e) {
    companyData = e;
    setText("companyRut", e.rut);
    setText("companyRazonSocial", e.razon_social);
    setText("companyNombreFantasia", e.nombre_fantasia);
    setText("companyDireccion", e.direccion);
    setText("companyTelefono", e.telefono);
    setText("companyEmail", e.email_contacto);
    setText("companyEstado", e.estado ? String(e.estado) : "—");
    setText("companyPlan", e.plan_id != null ? "Plan #" + e.plan_id : "—");
    setText("companyCreatedAt", formatDate(e.created_at));
    setText("companyUpdatedAt", formatDate(e.updated_at));
    setLogo(e.logo_url || null);

    const configWrap = getEl("companyConfigWrap");
    const configEl = getEl("companyConfig");
    if (configWrap && configEl) {
      if (e.configuracion_global && typeof e.configuracion_global === "object" && Object.keys(e.configuracion_global).length > 0) {
        configEl.textContent = JSON.stringify(e.configuracion_global, null, 2);
        configWrap.classList.remove("d-none");
      } else {
        configWrap.classList.add("d-none");
      }
    }
  }

  async function loadCompany() {
    const loading = getEl("companyLoading");
    const error = getEl("companyError");
    const content = getEl("companyContent");

    if (loading) loading.classList.remove("d-none");
    if (error) { error.classList.add("d-none"); error.textContent = ""; }
    if (content) content.classList.add("d-none");

    try {
      const res = await fetch("/api/empresa", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (loading) loading.classList.add("d-none");

      if (!res.ok) {
        if (error) {
          error.textContent = data.error || data.message || "Error al cargar los datos de la empresa.";
          error.classList.remove("d-none");
        }
        return;
      }

      renderCompany(data);
      if (content) content.classList.remove("d-none");
      if (window.feather) requestAnimationFrame(() => feather.replace());
    } catch (err) {
      console.error("Error cargando empresa:", err);
      if (loading) loading.classList.add("d-none");
      if (error) {
        error.textContent = "Error de conexión al cargar los datos.";
        error.classList.remove("d-none");
      }
    }
  }

  function openEditModal() {
    if (!companyData) return;
    getEl("editRazonSocial").value = companyData.razon_social || "";
    getEl("editNombreFantasia").value = companyData.nombre_fantasia || "";
    getEl("editDireccion").value = companyData.direccion || "";
    getEl("editTelefono").value = companyData.telefono || "";
    getEl("editEmailContacto").value = companyData.email_contacto || "";
    const modal = document.getElementById("modalEditarCompany");
    if (modal && window.$ && window.$.fn && window.$.fn.modal) window.$(modal).modal("show");
    else if (modal) { modal.classList.add("show"); modal.style.display = "block"; }
    if (window.feather) requestAnimationFrame(() => feather.replace());
  }

  async function saveCompany(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }
    try {
      const res = await fetch("/api/empresa", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razon_social: getEl("editRazonSocial").value.trim(),
          nombre_fantasia: getEl("editNombreFantasia").value.trim() || null,
          direccion: getEl("editDireccion").value.trim() || null,
          telefono: getEl("editTelefono").value.trim() || null,
          email_contacto: getEl("editEmailContacto").value.trim() || null
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Error al guardar");
        return;
      }
      companyData = data;
      renderCompany(data);
      const modal = document.getElementById("modalEditarCompany");
      if (modal && window.$ && window.$.fn && window.$.fn.modal) window.$(modal).modal("hide");
      else if (modal) { modal.classList.remove("show"); modal.style.display = "none"; }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al guardar.");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Guardar cambios"; }
    }
  }

  async function uploadLogo(file) {
    if (!file || !file.type.startsWith("image/")) {
      alert("Seleccione una imagen (PNG, JPG, GIF o WEBP).");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      alert("La imagen no debe superar 3 MB.");
      return;
    }
    const fd = new FormData();
    fd.append("logo", file);
    try {
      const res = await fetch("/api/empresa/logo", {
        method: "POST",
        credentials: "include",
        body: fd
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Error al subir el logo.");
        return;
      }
      companyData = data;
      renderCompany(data);
      if (window.feather) requestAnimationFrame(() => feather.replace());
    } catch (err) {
      console.error(err);
      alert("Error de conexión al subir el logo.");
    }
  }

  function init() {
    loadCompany();
    const btnEditar = getEl("btnEditarCompany");
    if (btnEditar) btnEditar.addEventListener("click", openEditModal);
    const formEdit = getEl("formEditarCompany");
    if (formEdit) formEdit.addEventListener("submit", saveCompany);
    const inputLogo = getEl("inputLogoCompany");
    if (inputLogo) {
      inputLogo.addEventListener("change", function () {
        const file = this.files && this.files[0];
        if (file) uploadLogo(file);
        this.value = "";
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
