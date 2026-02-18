(() => {
  const tipoRecepcion = document.getElementById("tipoRecepcion");
  const proveedorId = document.getElementById("proveedorId");
  const clienteId = document.getElementById("clienteId");
  const productoAgricolaId = document.getElementById("productoAgricolaId");

  const scanChofer = document.getElementById("scanChofer");
  const scanCamion = document.getElementById("scanCamion");
  const scanCarro = document.getElementById("scanCarro");

  // Retomar ticket existente removido — no se requieren elementos de re-apertura

  const choferInfo = document.getElementById("choferInfo");
  const camionInfo = document.getElementById("camionInfo");
  const carroInfo = document.getElementById("carroInfo");

  const numeroGuia = document.getElementById("numeroGuia");
  const observacionesRecepcion = document.getElementById("observacionesRecepcion");

  const btnCrearRecepcion = document.getElementById("btnCrearRecepcion");
  const creacionMsg = document.getElementById("creacionMsg");

  const panelRecepcion = document.getElementById("panelRecepcion");
  const recId = document.getElementById("recId");
  const recEstado = document.getElementById("recEstado");

  const pesoBruto = document.getElementById("pesoBruto");
  const pesoTara = document.getElementById("pesoTara");
  const pesoNetoFisico = document.getElementById("pesoNetoFisico");

  const inputBruto = document.getElementById("inputBruto");
  const motivoBruto = document.getElementById("motivoBruto");

  const inputTara = document.getElementById("inputTara");
  const motivoTara = document.getElementById("motivoTara");
  const btnRealizarPeso = document.getElementById("btnRealizarPeso");
  const btnTicketSagPdf = document.getElementById("btnTicketSagPdf");

  const btnIrLaboratorio = document.getElementById("btnIrLaboratorio");

  let chofer = null;
  let camion = null;
  let carro = null;
  let recepcion = null;

  // ticket re-open helpers removed

  function setMsg(text, kind) {
    creacionMsg.textContent = text || "";
    creacionMsg.className = kind ? `text-${kind}` : "";
  }

  function fillSelect(selectEl, items, { placeholder = "Seleccione...", getLabel, getValue }) {
    selectEl.innerHTML = "";
    selectEl.appendChild(new Option(placeholder, ""));
    items.forEach((item) => {
      selectEl.appendChild(new Option(getLabel(item), String(getValue(item))));
    });
  }

  async function fetchJson(url, opts) {
    const res = await fetch(url, { credentials: "include", ...(opts || {}) });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `HTTP ${res.status}`);
    }
    return await res.json();
  }

  // tryParseTicketFromText removed (no longer used)

  // cargarTicketDesdeInput removed

  async function cargarCatalogos() {
    const [proveedores, productos, clientes] = await Promise.all([
      fetchJson("/api/recepciones/catalogos/proveedores"),
      fetchJson("/api/recepciones/catalogos/productos"),
      fetchJson("/api/clientes").catch(() => [])
    ]);

    fillSelect(proveedorId, proveedores, {
      placeholder: "Seleccione proveedor...",
      getLabel: (p) => `#${p.id} - ${p.razon_social}`,
      getValue: (p) => p.id
    });

    fillSelect(productoAgricolaId, productos, {
      placeholder: "Seleccione producto...",
      getLabel: (p) => `#${p.id} - ${p.nombre}`,
      getValue: (p) => p.id
    });

    fillSelect(clienteId, clientes, {
      placeholder: "Seleccione cliente...",
      getLabel: (c) => `#${c.id} - ${c.razon_social}`,
      getValue: (c) => c.id
    });
  }

  function applyTipoRecepcionUI() {
    const tipo = tipoRecepcion.value;
    proveedorId.disabled = tipo !== "compra";
    clienteId.disabled = tipo !== "maquila";
  }

  async function lookup(setter, infoEl, url, labelBuilder) {
    const codigo = (setter === "carro" ? scanCarro.value : setter === "camion" ? scanCamion.value : scanChofer.value)
      .trim();
    if (!codigo) return;

    try {
      const data = await fetchJson(url);
      if (setter === "chofer") chofer = data;
      if (setter === "camion") camion = data;
      if (setter === "carro") carro = data;
      infoEl.textContent = labelBuilder(data);
      infoEl.classList.remove("text-danger");
    } catch (err) {
      infoEl.textContent = "No encontrado";
      infoEl.classList.add("text-danger");
      if (setter === "chofer") chofer = null;
      if (setter === "camion") camion = null;
      if (setter === "carro") carro = null;
    }
  }

  function renderRecepcion(r) {
    recepcion = r;
    panelRecepcion.classList.remove("d-none");
    recId.textContent = String(r.id);
    recEstado.textContent = r.estado || "";

    if (btnTicketSagPdf) {
      btnTicketSagPdf.href = `${window.location.origin}/api/recepciones/${r.id}/ticket-ingreso-interno.pdf`;
    }

    pesoBruto.textContent = r.peso_bruto_kg ?? 0;
    pesoTara.textContent = r.peso_tara_kg ?? 0;
    pesoNetoFisico.textContent = r.peso_neto_fisico_kg ?? 0;
  }

  // Actualiza la vista previa de bruto/tara/neto mientras el usuario escribe
  function updatePreviewFromInputs() {
    const bruto = inputBruto && inputBruto.value !== "" ? Number(inputBruto.value) : null;
    const tara = inputTara && inputTara.value !== "" ? Number(inputTara.value) : null;

    if (bruto != null) pesoBruto.textContent = bruto;
    if (tara != null) pesoTara.textContent = tara;

    if (bruto != null && tara != null) {
      const neto = Math.max(0, bruto - tara);
      pesoNetoFisico.textContent = neto;
    } else if (bruto != null && (tara == null || tara === 0)) {
      pesoNetoFisico.textContent = bruto;
    }
  }

  inputBruto?.addEventListener("input", updatePreviewFromInputs);
  inputTara?.addEventListener("input", updatePreviewFromInputs);

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

  function buildTicket80mmHtml(r, empresa) {
    const now = new Date();
    const fecha = now.toLocaleString("es-CL");
    const tipo = r.tipo_recepcion || "";
    const proveedor = r.proveedor_nombre || (r.proveedor_id ? `Proveedor #${r.proveedor_id}` : "");
    const cliente = r.cliente_nombre || (r.cliente_id ? `Cliente #${r.cliente_id}` : "");
    const choferLabel = r.chofer_nombre_ref ? `${r.chofer_nombre_ref}${r.chofer_rut_ref ? ` (${r.chofer_rut_ref})` : ""}` : (r.chofer_id ? `Chofer #${r.chofer_id}` : "");
    const camionLabel = r.camion_patente_ref || (r.camion_id ? `Camión #${r.camion_id}` : "");
    const carroLabel = r.carro_patente_ref || "";
    const producto = r.producto_nombre || (r.producto_agricola_id ? `Producto #${r.producto_agricola_id}` : "");

    const code128Url = `${window.location.origin}/api/recepciones/${r.id}/ticket/code128.png`;

    const empresaBlock = empresa
      ? `
    <div class="empresa-block">
      <div class="empresa-line">${(empresa.razon_social || "").trim() || "—"}</div>
      ${empresa.rut ? `<div class="empresa-line">RUT: ${String(empresa.rut).trim()}</div>` : ""}
      ${empresa.direccion ? `<div class="empresa-line">${String(empresa.direccion).trim()}</div>` : ""}
      ${empresa.telefono ? `<div class="empresa-line">Tel: ${String(empresa.telefono).trim()}</div>` : ""}
      ${empresa.email_contacto ? `<div class="empresa-line">${String(empresa.email_contacto).trim()}</div>` : ""}
    </div>`
      : "";

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Ticket ${r.ticket_codigo || ""}</title>
    <style>
      @page { size: 80mm auto; margin: 0mm; }
      body {
        width: 100%;
        max-width: 80mm;
        margin: 0;
        padding: 2mm;
        box-sizing: border-box;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        color: #000;
      }
      .center { text-align: center; }
      .muted { color: #000; }
      .title { font-size: 16px; font-weight: 700; text-transform: uppercase; }
      .hr { border-top: 1px dashed #000; margin: 8px 0; }
      .row { display: flex; justify-content: space-between; gap: 4px; }
      .k { font-weight: 700; }
      .v { text-align: right; white-space: nowrap; }
      img { max-width: 90%; height: auto; display: block; margin: 0 auto; }
      .small { font-size: 10px; }
      .empresa-block { font-size: 8px; line-height: 1.25; color: #333; text-align: center; margin-bottom: 4px; }
      .empresa-line { margin: 0; }
    </style>
  </head>
  <body>${empresaBlock}
    <div class="center title">RECEPCIÓN - TICKET</div>
    <div class="center muted small">${fecha}</div>
    <div class="hr"></div>

    <div class="row"><div class="k">Ticket</div><div class="v">${r.ticket_codigo || ""}</div></div>
    <div class="row"><div class="k">Estado</div><div class="v">${r.estado || ""}</div></div>
    <div class="row"><div class="k">Tipo</div><div class="v">${tipo}</div></div>
    <div class="hr"></div>

    ${proveedor ? `<div><span class="k">Proveedor:</span> ${proveedor}</div>` : ""}
    ${cliente ? `<div><span class="k">Cliente:</span> ${cliente}</div>` : ""}
    ${producto ? `<div><span class="k">Producto:</span> ${producto}</div>` : ""}
    ${choferLabel ? `<div><span class="k">Chofer:</span> ${choferLabel}</div>` : ""}
    ${camionLabel ? `<div><span class="k">Camión:</span> ${camionLabel}</div>` : ""}
    ${carroLabel ? `<div><span class="k">Carro:</span> ${carroLabel}</div>` : ""}
    <div class="hr"></div>

    <div class="row"><div class="k">Bruto (kg)</div><div class="v">${(r.peso_bruto_kg ?? 0).toLocaleString("es-CL")}</div></div>
    <div class="row"><div class="k">Tara (kg)</div><div class="v">${(r.peso_tara_kg ?? 0).toLocaleString("es-CL")}</div></div>
    <div class="row"><div class="k">Neto físico (kg)</div><div class="v">${(r.peso_neto_fisico_kg ?? 0).toLocaleString("es-CL")}</div></div>

    <div class="hr"></div>
    <div class="center">
      <div class="k">Código de barras</div>
      <img src="${code128Url}" alt="Code128" />
    </div>
    <div class="hr"></div>

    <div class="hr"></div>
    <div class="center small muted">Molino - Control de recepción</div>

    <script>
      window.onload = () => { 
        window.focus(); 
        window.print(); 
        setTimeout(() => { window.close(); }, 500);
      };
    </script>
  </body>
</html>`;
  }

  async function refrescarRecepcion() {
    if (!recepcion?.id) return;
    const r = await fetchJson(`/api/recepciones/${recepcion.id}`);
    renderRecepcion(r);
  }

  // Ticket re-open event handlers removed

  btnCrearRecepcion?.addEventListener("click", async () => {
    setMsg("", "");
    applyTipoRecepcionUI();

    const tipo = tipoRecepcion.value;

    if (!chofer?.id) return Swal.fire("Chofer requerido", "Escanea un chofer válido", "warning");
    if (!camion?.id) return Swal.fire("Camión requerido", "Escanea un camión válido", "warning");

    if (tipo === "compra" && !proveedorId.value) {
      return Swal.fire("Proveedor requerido", "Selecciona un proveedor", "warning");
    }

    if (tipo === "maquila" && !clienteId.value) {
      return Swal.fire("Cliente requerido", "Selecciona un cliente", "warning");
    }

    if (!productoAgricolaId.value) {
      return Swal.fire("Producto requerido", "Selecciona el producto agrícola", "warning");
    }

    try {
      btnCrearRecepcion.disabled = true;
      setMsg("Creando...", "muted");

      const payload = {
        tipo_recepcion: tipo,
        proveedor_id: tipo === "compra" ? Number(proveedorId.value) : null,
        cliente_id: tipo === "maquila" ? Number(clienteId.value) : null,
        producto_agricola_id: Number(productoAgricolaId.value),
        chofer_id: chofer.id,
        camion_id: camion.id,
        carro_id: carro?.id || null,
        numero_guia_despacho: numeroGuia.value.trim() || null,
        observaciones: observacionesRecepcion.value.trim() || null
      };

      const r = await fetchJson("/api/recepciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      renderRecepcion(r);
      setMsg("✅ Recepción creada", "success");
      Swal.fire(
        "✅ Recepción creada",
        "Recepción creada. Ahora realiza el pesaje único (Bruto + Tara).",
        "success"
      );
    } catch (err) {
      console.error(err);
      setMsg("❌ Error al crear", "danger");
      Swal.fire("❌ Error", err.message, "error");
    } finally {
      btnCrearRecepcion.disabled = false;
    }
  });

  // Un solo flujo de pesaje: captura Bruto + Tara en una única acción
  btnRealizarPeso?.addEventListener("click", async () => {
    if (!recepcion?.id) return;
    try {
      btnRealizarPeso.disabled = true;
      setMsg("Guardando pesaje...", "muted");

      const payload = {
        peso_bruto_kg: inputBruto.value ? Number(inputBruto.value) : null,
        motivo_bruto: motivoBruto.value.trim() || null,
        peso_tara_kg: inputTara.value ? Number(inputTara.value) : null,
        motivo_tara: motivoTara.value.trim() || null
      };

      const result = await fetchJson(`/api/recepciones/${recepcion.id}/pesaje/realizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // El servicio retorna { recepcion, ticket }
      if (result.recepcion) renderRecepcion(result.recepcion);
      await refrescarRecepcion();

      // Imprimir ticket 80mm inmediatamente
      try {
        if (result.recepcion?.ticket_codigo) {
          const empresa = await fetchJson("/api/empresa").catch(() => null);
          const html = buildTicket80mmHtml(result.recepcion, empresa);
          openPrintWindow80mm(html);
        }
      } catch (e) {
        // ignore print errors
      }

      // Abrir PDF Ticket de Ingreso Interno (requisito SAG) para impresión inmediata
      try {
        if (result.recepcion?.id) {
          const pdfUrl = `${window.location.origin}/api/recepciones/${result.recepcion.id}/ticket-ingreso-interno.pdf`;
          window.open(pdfUrl, "_blank", "noopener");
        }
      } catch (e) {
        // ignore
      }

      setMsg("✅ Pesaje guardado", "success");

      // No se generan tickets de pesaje separados; todo usa el ticket de recepción

      Swal.fire("✅ Pesaje guardado", "Pesaje registrado y ticket generado.", "success");
    } catch (err) {
      Swal.fire("❌ Error", err.message, "error");
    } finally {
      btnRealizarPeso.disabled = false;
      setMsg("", "");
    }
  });

  // El botón de laboratorio se remueve del flujo (evento deshabilitado)
  if (btnIrLaboratorio) {
    btnIrLaboratorio.classList.add("d-none");
  }

  // Manual print button removed: printing happens on 'Realizar Peso'

  // Funcionalidad de maquila removida de esta vista

  // Scanner UX: Enter para resolver
  scanChofer?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookup("chofer", choferInfo, `/api/recepciones/lookup/chofer/${encodeURIComponent(scanChofer.value)}`, (d) => `${d.nombre} (${d.rut})`);
      scanCamion.focus();
    }
  });

  scanCamion?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookup("camion", camionInfo, `/api/recepciones/lookup/camion/${encodeURIComponent(scanCamion.value)}`, (d) => `${d.patente} ${d.marca || ""}`.trim());
      scanCarro.focus();
    }
  });

  scanCarro?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!scanCarro.value.trim()) {
        carro = null;
        carroInfo.textContent = "(Sin carro)";
        carroInfo.classList.remove("text-danger");
        return;
      }
      lookup("carro", carroInfo, `/api/recepciones/lookup/carro/${encodeURIComponent(scanCarro.value)}`, (d) => `${d.patente} ${d.marca || ""}`.trim());
    }
  });

  tipoRecepcion?.addEventListener("change", applyTipoRecepcionUI);

  cargarCatalogos()
    .then(() => {
      applyTipoRecepcionUI();
      scanChofer?.focus();
    })
    .catch((err) => {
      console.error("❌ Error cargando catálogos:", err);
      Swal.fire("Error", "No se pudieron cargar catálogos", "error");
    });

  // Cargar listado de recepciones y renderizar en la tabla
  async function cargarListadoRecepciones() {
    try {
      const rows = await fetchJson(`/api/recepciones?limit=200`);
      const tbody = document.querySelector('#recepcionesTable tbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      rows.forEach((r) => {
        const tr = document.createElement('tr');
        const provCli = r.proveedor_nombre || r.cliente_nombre || '';
        const fecha = r.fecha_entrada ? new Date(r.fecha_entrada).toLocaleString() : '';
        tr.innerHTML = `
          <td>${r.id}</td>
          <td>${r.tipo_recepcion || ''}</td>
          <td>${provCli}</td>
          <td>${r.producto_nombre || ''}</td>
          <td>${r.estado || ''}</td>
          <td>${fecha}</td>
          <td>
            <button class="btn btn-sm btn-secondary btn-imprimir" data-id="${r.id}" title="Imprimir ticket">
              <i class="fas fa-print"></i>
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Attach click handlers for print buttons
      document.querySelectorAll('#recepcionesTable .btn-imprimir').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          if (!id) return;
          try {
            const [rec, empresa] = await Promise.all([
              fetchJson(`/api/recepciones/${id}`),
              fetchJson("/api/empresa").catch(() => null)
            ]);
            if (!rec.ticket_codigo) {
              Swal.fire('Ticket no disponible', 'Esta recepción aún no tiene ticket (falta completar pesaje).', 'info');
              return;
            }
            const html = buildTicket80mmHtml(rec, empresa);
            openPrintWindow80mm(html);
          } catch (err) {
            console.error('Error imprimiendo ticket:', err);
            Swal.fire('Error', 'No se pudo imprimir el ticket de la recepción', 'error');
          }
        });
      });
    } catch (err) {
      console.error('Error cargando listado:', err);
    }
  }

  // Tabs Registro / Listado / Reportes
  function showTab(tab) {
    const panes = document.querySelectorAll('.tab-content .tab-pane');
    panes.forEach((p) => {
      p.classList.remove('active');
      p.classList.add('d-none');
    });

    const links = document.querySelectorAll('.nav-tabs [data-tab]');
    links.forEach((l) => l.classList.remove('active'));

    let targetId;
    if (tab === 'listado') targetId = 'tabListado';
    else if (tab === 'reportes') targetId = 'tabReportes';
    else targetId = 'tabRegistro';
    const pane = document.getElementById(targetId);
    if (pane) {
      pane.classList.remove('d-none');
      pane.classList.add('active');
    }

    const link = document.querySelector(`.nav-tabs [data-tab="${tab}"]`);
    if (link) link.classList.add('active');
  }

  document.querySelectorAll('.nav-tabs [data-tab]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.getAttribute('data-tab');
      showTab(tab);
      if (tab === 'listado') {
        cargarListadoRecepciones().catch(() => null);
      }
    });
  });

  // Mostrar Registro por defecto
  showTab('registro');
})();
