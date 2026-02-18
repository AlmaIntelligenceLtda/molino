(() => {
  const formLaboratorio = document.getElementById("formLaboratorio");
  const selectRecepcion = document.getElementById("laboratorioRecepcionId");
  const btnCargar = document.getElementById("btnCargarRecepcion");
  const tabla = document.getElementById("tablaLaboratorioRecepciones");
  const labMsg = document.getElementById("labBloqueadoMsg");

  const labProveedor = document.getElementById("labProveedor");
  const labProducto = document.getElementById("labProducto");
  const labNetoFisico = document.getElementById("labNetoFisico");
  const labPrecioPactado = document.getElementById("labPrecioPactado");

  const humedadInput = document.getElementById("humedad");
  const impurezasInput = document.getElementById("impurezas");
  const descuentoHumedadInput = document.getElementById("descuentoHumedad");
  const descuentoImpurezasInput = document.getElementById("descuentoImpurezas");
  const pesoNetoPagarInput = document.getElementById("pesoNetoPagar");
  const totalPagarLabInput = document.getElementById("totalPagarLab");

  const grupoPrecioPactado = document.getElementById("grupoPrecioPactado");
  const grupoTotalAprox = document.getElementById("grupoTotalAprox");
  const labelNetoPagar = document.getElementById("labelNetoPagar");

  const HUMEDAD_ESTANDAR = 14;
  let tablaDT;
  let recepcionActual = null;

  function initTable() {
    if ($.fn.DataTable.isDataTable("#tablaLaboratorioRecepciones")) {
      $("#tablaLaboratorioRecepciones").DataTable().destroy();
    }

    tablaDT = $("#tablaLaboratorioRecepciones").DataTable({
      language: { url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json" },
      pageLength: 10,
      order: [[0, "desc"]]
    });
  }

  function setFormEnabled(enabled) {
    if (labMsg) labMsg.classList.toggle("d-none", enabled);
    formLaboratorio
      ?.querySelectorAll("input, select, textarea, button")
      .forEach((el) => {
        if (el.id === "btnGuardarLaboratorio") {
          el.disabled = !enabled;
          return;
        }
        el.disabled = !enabled;
      });
  }

  function limpiarLaboratorio() {
    formLaboratorio?.reset();
    descuentoHumedadInput.value = "";
    descuentoImpurezasInput.value = "";
    pesoNetoPagarInput.value = "";
    totalPagarLabInput.value = "";
  }

  function setResumenRecepcion(data) {
    recepcionActual = data || null;
    const isMaquila = data?.tipo_recepcion === "maquila";
    const contraparteNombre = isMaquila ? data?.cliente_nombre : data?.proveedor_nombre;
    const contraparteFallback = isMaquila
      ? (data?.cliente_id ? `Cliente #${data.cliente_id}` : "")
      : (data?.proveedor_id ? `Proveedor #${data.proveedor_id}` : "");
    labProveedor.value = contraparteNombre || contraparteFallback || "";
    labProducto.value = data?.producto_nombre || "";
    labNetoFisico.value = data?.peso_neto_fisico_kg ?? "";
    labPrecioPactado.value = data?.precio_pactado ?? "";

    // UI por tipo de recepción
    if (grupoPrecioPactado) grupoPrecioPactado.classList.toggle("d-none", isMaquila);
    if (grupoTotalAprox) grupoTotalAprox.classList.toggle("d-none", isMaquila);
    if (labelNetoPagar) {
      labelNetoPagar.textContent = isMaquila ? "Neto Aceptado (kg)" : "Neto a Pagar (kg)";
    }

    if (isMaquila) {
      // No aplica total monetario en maquila
      labPrecioPactado.value = "";
      totalPagarLabInput.value = "";
    }
  }

  function calcularDescuentos() {
    const neto = Number(labNetoFisico.value) || 0;
    const humedad = Number(humedadInput.value) || 0;
    const impurezas = Number(impurezasInput.value) || 0;

    const excesoHumedad = Math.max(humedad - HUMEDAD_ESTANDAR, 0);
    const descuentoHumedad = Math.round((neto * excesoHumedad) / 100);
    const descuentoImpurezas = Math.round((neto * impurezas) / 100);
    const netoPagar = Math.max(neto - descuentoHumedad - descuentoImpurezas, 0);

    descuentoHumedadInput.value = descuentoHumedad;
    descuentoImpurezasInput.value = descuentoImpurezas;
    pesoNetoPagarInput.value = netoPagar;

    // Total monetario solo para compra
    const isMaquila = recepcionActual?.tipo_recepcion === "maquila";
    if (isMaquila) {
      totalPagarLabInput.value = "";
      return;
    }

    const precio = Number(labPrecioPactado.value) || 0;
    totalPagarLabInput.value = Math.round(netoPagar * precio);
  }

  async function cargarRecepciones() {
    const res = await fetch("/api/laboratorio/recepciones", { credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
        // No population: scanner will lookup by ticket codigo
        await res.json(); // Keep the API call for permissions/session
  }

  async function cargarListadoLaboratorio() {
    const res = await fetch("/api/laboratorio/registros", { credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    if ($.fn.DataTable.isDataTable("#tablaLaboratorioRecepciones")) {
      $("#tablaLaboratorioRecepciones").DataTable().clear().destroy();
    }

    const tbody = tabla.querySelector("tbody");
    tbody.innerHTML = data
      .map(
        (r) => `
          <tr>
            <td>${r.laboratorio_id}</td>
            <td>${r.fecha_analisis ? new Date(r.fecha_analisis).toLocaleDateString() : (r.fecha_entrada ? new Date(r.fecha_entrada).toLocaleDateString() : '')}</td>
            <td>${r.tipo_recepcion === "maquila" ? (r.cliente_nombre || "") : (r.proveedor_nombre || "")}</td>
            <td>${r.producto_nombre || ""}</td>
            <td>${r.peso_neto_fisico_kg ?? 0}</td>
            <td>${r.aprobado_calidad ? 'Aprobado' : 'No aprobado'}</td>
            <td>${r.humedad_porcentaje ?? ''} / ${r.impurezas_porcentaje ?? ''}</td>
            <td>
              <button class="btn btn-sm btn-info btnCargarLab" data-id="${r.recepcion_id}" title="Editar">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-secondary btnImprimirLab ml-1" data-id="${r.recepcion_id}" title="Imprimir">
                <i class="fas fa-print"></i>
              </button>
            </td>
          </tr>`
      )
      .join("");

    initTable();
  }

  async function cargarRecepcion(id) {
    const res = await fetch(`/api/laboratorio/recepciones/${id}`, { credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }

  async function cargarRecepcionEnFormulario(id) {
    if (!id) return;
    const data = await cargarRecepcion(id);
    selectRecepcion.value = data.id;
    limpiarLaboratorio();
    setResumenRecepcion(data);

    if (data.laboratorio) {
      humedadInput.value = data.laboratorio.humedad_porcentaje || "";
      impurezasInput.value = data.laboratorio.impurezas_porcentaje || "";
      document.getElementById("pesoHectolitrico").value = data.laboratorio.peso_hectolitrico || "";
      document.getElementById("proteina").value = data.laboratorio.proteina_porcentaje || "";
      document.getElementById("gluten").value = data.laboratorio.gluten_wet || "";
      document.getElementById("indiceCaida").value = data.laboratorio.indice_caida || "";
      document.getElementById("granosChuzos").value = data.laboratorio.granos_chuzos || "";
      document.getElementById("puntaNegra").value = data.laboratorio.punta_negra || "";
      document.getElementById("labObservaciones").value = data.laboratorio.observaciones || "";
    }

    calcularDescuentos();
    setFormEnabled(true);
  }

  formLaboratorio?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = selectRecepcion.value;
    if (!id) return Swal.fire("Recepción requerida", "Selecciona una recepción", "warning");

    const payload = {
      humedad_porcentaje: Number(humedadInput.value) || null,
      impurezas_porcentaje: Number(impurezasInput.value) || null,
      peso_hectolitrico: Number(document.getElementById("pesoHectolitrico").value) || null,
      proteina_porcentaje: Number(document.getElementById("proteina").value) || null,
      gluten_wet: Number(document.getElementById("gluten").value) || null,
      indice_caida: Number(document.getElementById("indiceCaida").value) || null,
      granos_chuzos: Number(document.getElementById("granosChuzos").value) || null,
      punta_negra: Number(document.getElementById("puntaNegra").value) || null,
      observaciones: document.getElementById("labObservaciones").value.trim()
    };

    try {
      const res = await fetch(`/api/laboratorio/recepciones/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Error al guardar laboratorio");
      }

      Swal.fire("✅ Laboratorio guardado", "", "success");
      await cargarRecepciones();
      await cargarListadoLaboratorio();

      // Obtener la recepción actualizada con datos de laboratorio y abrir ticket 80mm
      try {
        const updated = await cargarRecepcion(id);
        const html = buildLabTicket80mmHtml(updated);
        const win = openPrintWindow80mm(html);
        if (win) {
          // focus handled in the print HTML onload
        }
      } catch (err) {
        console.error("Error generando ticket laboratorio:", err);
      }
    } catch (err) {
      Swal.fire("❌ Error", err.message, "error");
    }
  });

  function openPrintWindow80mm(html) {
    const w = window.open("", "PRINT_TICKET", "width=420,height=700");
    if (!w) {
      Swal.fire("Pop-up bloqueado", "Permite pop-ups para imprimir el ticket.", "warning");
      return null;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    return w;
  }

  function buildLabTicket80mmHtml(data) {
    const now = new Date();
    const fecha = now.toLocaleString();
    const r = data || {};
    const recep = r || {};
    const tipo = recep.tipo_recepcion || "";
    const contraparte = tipo === "maquila" ? (recep.cliente_nombre || (recep.cliente_id ? `Cliente #${recep.cliente_id}` : "")) : (recep.proveedor_nombre || (recep.proveedor_id ? `Proveedor #${recep.proveedor_id}` : ""));
    const producto = recep.producto_nombre || "";
    const humedad = recep.laboratorio?.humedad_porcentaje ?? "";
    const impurezas = recep.laboratorio?.impurezas_porcentaje ?? "";
    const ph = recep.laboratorio?.peso_hectolitrico ?? "";
    const proteina = recep.laboratorio?.proteina_porcentaje ?? "";
    const gluten = recep.laboratorio?.gluten_wet ?? "";
    const indice = recep.laboratorio?.indice_caida ?? "";
    const observ = recep.laboratorio?.observaciones || "";
    const codigo = recep.ticket_codigo || "";
    const descuentoHumedadKg = recep.descuento_humedad_kg ?? "";
    const descuentoImpurezasKg = recep.descuento_impurezas_kg ?? "";
    const netoAceptadoKg = recep.peso_neto_pagar_kg ?? "";
    const code128Url = codigo ? `${window.location.origin}/api/recepciones/${recep.id}/ticket/code128.png` : "";

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Ticket Laboratorio ${codigo || ""}</title>
    <style>
      @page { size: 80mm auto; margin: 3mm; }
      html, body { width: 80mm; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; }
      .center { text-align: center; }
      .muted { color: #333; }
      .title { font-size: 14px; font-weight: 700; }
      .hr { border-top: 1px dashed #000; margin: 6px 0; }
      .row { display: flex; justify-content: space-between; gap: 8px; }
      .k { font-weight: 700; }
      .v { text-align: right; }
      img { max-width: 100%; }
      .small { font-size: 10px; }
    </style>
  </head>
  <body>
    <div class="center title">LABORATORIO - RESULTADOS</div>
    <div class="center muted small">${fecha}</div>
    <div class="hr"></div>

    <div class="row"><div class="k">Recepción</div><div class="v">#${recep.id || ""}</div></div>
    <div class="row"><div class="k">Tipo</div><div class="v">${tipo}</div></div>
    <div class="hr"></div>

    ${contraparte ? `<div><span class="k">Contraparte:</span> ${contraparte}</div>` : ""}
    ${producto ? `<div><span class="k">Producto:</span> ${producto}</div>` : ""}
    <div class="hr"></div>

    <div class="row"><div class="k">Humedad (%)</div><div class="v">${humedad}</div></div>
    <div class="row"><div class="k">Desc. Humedad (kg)</div><div class="v">${descuentoHumedadKg}</div></div>
    <div class="row"><div class="k">Impurezas (%)</div><div class="v">${impurezas}</div></div>
    <div class="row"><div class="k">Desc. Impurezas (kg)</div><div class="v">${descuentoImpurezasKg}</div></div>
    <div class="row"><div class="k">PH</div><div class="v">${ph}</div></div>
    <div class="row"><div class="k">Proteína (%)</div><div class="v">${proteina}</div></div>
    <div class="row"><div class="k">Gluten</div><div class="v">${gluten}</div></div>
    <div class="row"><div class="k">Índice</div><div class="v">${indice}</div></div>

    <div class="row"><div class="k">Neto Aceptado (kg)</div><div class="v">${netoAceptadoKg}</div></div>
    <div class="hr"></div>
    ${observ ? `<div><span class="k">Observaciones:</span> ${observ}</div><div class="hr"></div>` : ""}

    ${code128Url ? `<div class="center"><div class="k">Código</div><img src="${code128Url}" alt="Code128"/></div><div class="hr"></div>` : ""}

    <div class="center small muted">Molino - Laboratorio</div>

    <script>
      window.onload = () => { 
        window.focus(); 
        window.print(); 
        // Cerrar ventana automáticamente tras imprimir (compatible con --kiosk-printing)
        setTimeout(() => { window.close(); }, 500);
      };
    </script>
  </body>
</html>`;
  }

  btnCargar?.addEventListener("click", async () => {
    const id = selectRecepcion?.value;
    if (!id) return Swal.fire("Recepción requerida", "Selecciona una recepción en el listado", "warning");

    try {
      await cargarRecepcionEnFormulario(id);
    } catch (err) {
      Swal.fire("❌ Error", err.message, "error");
    }
  });

  selectRecepcion?.addEventListener("change", () => {
    if (!selectRecepcion.value) {
      setFormEnabled(false);
      limpiarLaboratorio();
      setResumenRecepcion(null);
    }
  });

  tabla?.addEventListener("click", async (e) => {
    const btnEdit = e.target.closest(".btnCargarLab");
    if (btnEdit) {
      try {
        await cargarRecepcionEnFormulario(btnEdit.dataset.id);
      } catch (err) {
        Swal.fire("❌ Error", err.message, "error");
      }
      return;
    }

    const btnPrint = e.target.closest(".btnImprimirLab");
    if (btnPrint) {
      try {
        const data = await cargarRecepcion(btnPrint.dataset.id);
        const html = buildLabTicket80mmHtml(data);
        openPrintWindow80mm(html);
      } catch (err) {
        Swal.fire("❌ Error", err.message, "error");
      }
    }
  });

  [humedadInput, impurezasInput].forEach((el) => el?.addEventListener("input", calcularDescuentos));

  const preseleccion = sessionStorage.getItem("laboratorio_recepcion_id");
  if (preseleccion) sessionStorage.removeItem("laboratorio_recepcion_id");

  cargarRecepciones()
    .then(() => {
      if (preseleccion) {
        cargarRecepcionEnFormulario(preseleccion).catch(() => null);
      } else {
        setFormEnabled(false);
      }
      // focus visible input so pistol scans are captured
      try { selectRecepcion?.focus(); } catch {}
      return cargarListadoLaboratorio();
    })
    .catch((err) => {
      console.error("❌ Error cargando laboratorio:", err);
      Swal.fire("Error", "No se pudo cargar laboratorio", "error");
    });

  // When user switches to Registro tab, focus visible scanner input
  const registroTabLink = document.getElementById("registro-tab");
  registroTabLink?.addEventListener("shown.bs.tab", () => {
    try { selectRecepcion?.focus(); } catch {}
  });

  // Handle scanner input (pistol gun sends characters + Enter) on the visible input
  selectRecepcion?.addEventListener("keydown", async (ev) => {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    const raw = (selectRecepcion.value || "").trim();
    // clear visible input so operator can scan next
    selectRecepcion.value = "";
    if (!raw) return;

    let codigo = null;
    let token = null;

    // If scanner read a JSON (QR), try parse
    if (raw.startsWith("{") || raw.startsWith("%7B")) {
      try {
        const decoded = decodeURIComponent(raw);
        const parsed = JSON.parse(decoded);
        codigo = parsed.ticket_codigo || parsed.codigo || null;
        token = parsed.ticket_token || parsed.token || null;
      } catch {
        // ignore
      }
    }

    // If not JSON, maybe formatted 'codigo|token'
    if (!codigo && raw.includes("|")) {
      const parts = raw.split("|");
      codigo = parts[0] || null;
      token = parts[1] || null;
    }

    if (!codigo) codigo = raw;

    try {
      let row = null;
      if (token) {
        const q = new URLSearchParams({ codigo, token });
        const resp = await fetch(`/api/recepciones/ticket?${q.toString()}`, { credentials: "include" });
        if (resp.ok) row = await resp.json();
      } else {
        const q = new URLSearchParams({ codigo });
        const resp = await fetch(`/api/recepciones/ticket-by-codigo?${q.toString()}`, { credentials: "include" });
        if (resp.ok) row = await resp.json();
      }

      if (!row || !row.id) return Swal.fire("No encontrado", "Recepción no encontrada para ese ticket", "warning");

      // switch to Registro tab and load
      const registroTab = new bootstrap.Tab(document.querySelector('#registro-tab'));
      registroTab.show();
      await cargarRecepcionEnFormulario(row.id);
    } catch (err) {
      console.error("Error buscando recepción por ticket:", err);
      Swal.fire("Error", "No se pudo buscar la recepción por ticket", "error");
    }
  });
})();
