(() => {
  const selectCliente = document.getElementById("selectClienteCuenta");
  const btnCargar = document.getElementById("btnCargarCuenta");
  const btnVerEstado = document.getElementById("btnVerEstadoCuenta");
  const panelCuenta = document.getElementById("panelCuentaCorriente");
  const mensajeSinCliente = document.getElementById("mensajeSinCliente");
  
  let currentData = null; // Para almacenar datos cargados y usarlos en el PDF

  async function fetchJson(url, opts) {
    const res = await fetch(url, { credentials: "include", ...(opts || {}) });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `HTTP ${res.status}`);
    }
    return await res.json();
  }

  function fillSelectClientes(items) {
    if (!selectCliente) return;

    // Si ya existe instancia de Select2, destruirla antes de reconstruir
    if ($(selectCliente).hasClass("select2-hidden-accessible")) {
      $(selectCliente).select2("destroy");
    }

    selectCliente.innerHTML = '<option value="">-- Seleccione un cliente --</option>';
    (items || []).forEach((c) => {
      // Construir label con RUT y nombres para búsqueda
      const partes = [];
      if (c.rut) partes.push(c.rut);
      if (c.razon_social) partes.push(c.razon_social);
      if (c.nombre_fantasia && c.nombre_fantasia !== c.razon_social) {
        partes.push(`(${c.nombre_fantasia})`);
      }
      
      const label = partes.join(" - ") || `#${c.id}`;
      selectCliente.appendChild(new Option(label, String(c.id)));
    });

    // Inicializar Select2
    $(selectCliente).select2({
      theme: "bootstrap-5",
      width: "100%",
      placeholder: "Busque por nombre o RUT",
      allowClear: true
    });
  }

  function formatFecha(d) {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleDateString("es-CL", { dateStyle: "short" }) + " " + dt.toLocaleTimeString("es-CL", { timeStyle: "short" });
  }

  function openPrintWindow80mm(html) {
    const w = window.open("", "PRINT_TICKET", "width=420,height=700");
    if (!w) {
      if (window.Swal) Swal.fire("Pop-up bloqueado", "Permite pop-ups para imprimir el ticket.", "warning");
      return null;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    return w;
  }

  function buildRecepcionTicketHtml(r, empresa) {
    const now = new Date();
    const fecha = now.toLocaleString("es-CL");
    const tipo = r.tipo_recepcion || "";
    const proveedor = r.proveedor_nombre || (r.proveedor_id ? `Proveedor #${r.proveedor_id}` : "");
    const cliente = r.cliente_nombre || (r.cliente_id ? `Cliente #${r.cliente_id}` : "");
    const choferLabel = r.chofer_nombre ? `${r.chofer_nombre}` : (r.chofer_nombre_ref || "");
    const camionLabel = r.camion_patente_ref || "";
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
    <div class="hr"></div>

    <div class="row"><div class="k">Bruto (kg)</div><div class="v">${(r.peso_bruto_kg ?? 0).toLocaleString("es-CL")}</div></div>
    <div class="row"><div class="k">Tara (kg)</div><div class="v">${(r.peso_tara_kg ?? 0).toLocaleString("es-CL")}</div></div>
    <div class="row"><div class="k">Neto físico (kg)</div><div class="v">${(r.peso_neto_fisico_kg ?? 0).toLocaleString("es-CL")}</div></div>
    <div class="row"><div class="k">Neto pagar (kg)</div><div class="v">${(r.peso_neto_pagar_kg ?? 0).toLocaleString("es-CL")}</div></div>

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

  function buildMovimientoTicketHtml(m, clienteNombre, empresa) {
    const now = new Date();
    const fechaImpresion = now.toLocaleString("es-CL");
    const fechaMov = new Date(m.created_at).toLocaleString("es-CL");

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
    <title>Movimiento ${m.id}</title>
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
      .small { font-size: 10px; }
      .empresa-block { font-size: 8px; line-height: 1.25; color: #333; text-align: center; margin-bottom: 4px; }
      .empresa-line { margin: 0; }
    </style>
  </head>
  <body>${empresaBlock}
    <div class="center title">COMPROBANTE MOVIMIENTO</div>
    <div class="center muted small">${fechaImpresion}</div>
    <div class="hr"></div>

    <div class="row"><div class="k">ID Movimiento</div><div class="v">#${m.id}</div></div>
    <div class="row"><div class="k">Fecha Mov.</div><div class="v">${fechaMov}</div></div>
    <div class="hr"></div>

    <div><span class="k">Cliente:</span> ${clienteNombre || ""}</div>
    <div><span class="k">Tipo:</span> ${m.tipo_movimiento || ""}</div>
    <div><span class="k">Producto:</span> ${m.producto_nombre || ""}</div>
    ${m.recepcion_ticket ? `<div><span class="k">Ref. Ticket:</span> ${m.recepcion_ticket}</div>` : ""}
    <div class="hr"></div>

    <div class="row"><div class="k">Cantidad (kg)</div><div class="v" style="font-size:14px; font-weight:bold;">${Number(m.kg).toLocaleString("es-CL")}</div></div>
    
    ${m.observacion ? `<div class="hr"></div><div><span class="k">Obs:</span> ${m.observacion}</div>` : ""}

    <div class="hr"></div>
    <div class="center small muted">Molino - Cuenta Corriente</div>

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

  function renderCuentaCorriente(data) {
    currentData = data; // Guardar datos para PDF
    const titulo = document.getElementById("tituloClienteCuenta");
    titulo.textContent = data.cliente?.nombre_fantasia || data.cliente?.razon_social || "Cuenta corriente";

    // Mostrar botón de PDF
    if (btnVerEstado) btnVerEstado.classList.remove('d-none');

    document.getElementById("resumenTrigoKg").textContent = (data.trigo?.total_kg ?? 0).toLocaleString("es-CL");

    const harinaSaldosEl = document.getElementById("resumenHarinaSaldos");
    if (data.harina_saldos && data.harina_saldos.length > 0) {
      harinaSaldosEl.innerHTML = data.harina_saldos
        .map((h) => `<span class="badge badge-primary p-2">${h.producto_nombre}: <strong>${Number(h.saldo_kg).toLocaleString("es-CL")} kg</strong></span>`)
        .join("");
    } else {
      harinaSaldosEl.innerHTML = '<span class="text-muted">Sin saldo de harina</span>';
    }

    const tbodyTrigo = document.querySelector("#tablaRecepcionesTrigo tbody");
    
    // Si ya existe instancia de DataTable, destruirla antes de actualizar datos
    if ($.fn.DataTable.isDataTable('#tablaRecepcionesTrigo')) {
      $('#tablaRecepcionesTrigo').DataTable().destroy();
    }

    tbodyTrigo.innerHTML = "";
    (data.trigo?.recepciones || []).forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.ticket_codigo || "-"}</td>
        <td>${formatFecha(r.fecha_entrada)}</td>
        <td>${r.producto_nombre || "-"}</td>
        <td>${(r.peso_neto_fisico_kg ?? 0).toLocaleString("es-CL")}</td>
        <td>${(r.peso_neto_pagar_kg ?? 0).toLocaleString("es-CL")}</td>
        <td>${r.rendimiento_harina_pct ?? "-"}</td>
        <td>${(r.harina_equivalente_kg ?? 0).toLocaleString("es-CL")}</td>
        <td>
          <button class="btn btn-sm btn-info btn-print-recepcion" data-id="${r.id}" title="Imprimir Ticket">
            <i class="fas fa-print"></i>
          </button>
          <a href="${window.location.origin}/api/recepciones/${r.id}/ticket-ingreso-interno.pdf" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary ml-1" title="Documento SAG (PDF)">
            <i class="fas fa-file-pdf"></i>
          </a>
        </td>
      `;
      tbodyTrigo.appendChild(tr);
    });

    // Event listener for print recepcion
    tbodyTrigo.onclick = async (e) => {
      const btn = e.target.closest('.btn-print-recepcion');
      if (!btn) return;
      e.stopPropagation();
      const id = btn.dataset.id;
      try {
        const [r, empresa] = await Promise.all([
          fetchJson(`/api/recepciones/${id}`),
          fetchJson("/api/empresa").catch(() => null)
        ]);
        const html = buildRecepcionTicketHtml(r, empresa);
        openPrintWindow80mm(html);
      } catch(err) {
        console.error(err);
        if(window.Swal) Swal.fire("Error", "No se pudo cargar el ticket", "error");
      }
    };

    // Inicializar DataTable con idioma español y configuración básica
    $('#tablaRecepcionesTrigo').DataTable({
      language: {
        url: "//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json"
      },
      destroy: true, // Asegura reinicialización limpia
      pageLength: 10,
      order: [[1, "desc"]], // Ordenar por fecha descendente
      autoWidth: false
    });

    const tbodyMov = document.querySelector("#tablaMovimientosCuenta tbody");

    // Si ya existe instancia de DataTable, destruirla antes de actualizar datos
    if ($.fn.DataTable.isDataTable('#tablaMovimientosCuenta')) {
      $('#tablaMovimientosCuenta').DataTable().destroy();
    }

    tbodyMov.innerHTML = "";
    (data.movimientos || []).forEach((m) => {
      const tr = document.createElement("tr");
      const kgClass = m.kg < 0 ? "text-danger" : "text-success";
      tr.innerHTML = `
        <td>${formatFecha(m.created_at)}</td>
        <td>${m.tipo_movimiento || "-"}</td>
        <td>${m.producto_nombre || "-"}</td>
        <td class="${kgClass}">${Number(m.kg).toLocaleString("es-CL")}</td>
        <td>${m.recepcion_ticket || "-"}</td>
        <td>${m.observacion || "-"}</td>
        <td>
          <button class="btn btn-sm btn-info btn-print-movimiento" data-id="${m.id}" title="Imprimir Comprobante">
            <i class="fas fa-print"></i>
          </button>
        </td>
      `;
      tbodyMov.appendChild(tr);
    });

    // Event listener for print movimiento
    tbodyMov.onclick = async (e) => {
      const btn = e.target.closest('.btn-print-movimiento');
      if (!btn) return;
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      const m = data.movimientos.find(x => x.id === id);
      if (m) {
        const clienteNombre = data.cliente?.razon_social || data.cliente?.nombre_fantasia || "";
        const empresa = await fetchJson("/api/empresa").catch(() => null);
        const html = buildMovimientoTicketHtml(m, clienteNombre, empresa);
        openPrintWindow80mm(html);
      }
    };

    // Inicializar DataTable para movimientos
    $('#tablaMovimientosCuenta').DataTable({
      language: {
        url: "//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json"
      },
      destroy: true,
      pageLength: 10,
      order: [[0, "desc"]], // Ordenar por fecha descendente
      autoWidth: false
    });

    panelCuenta.classList.remove("d-none");
    mensajeSinCliente.classList.add("d-none");
  }

  async function cargarClientes() {
    try {
      const list = await fetchJson("/api/clientes");
      fillSelectClientes(list);
    } catch (err) {
      console.error("Error cargando clientes:", err);
      if (window.Swal) Swal.fire("Error", "No se pudieron cargar los clientes", "error");
    }
  }

  btnCargar?.addEventListener("click", async () => {
    const clienteId = selectCliente?.value;
    if (!clienteId) {
      if (window.Swal) Swal.fire("Seleccione un cliente", "Elija un cliente de la lista", "info");
      return;
    }
    try {
      btnCargar.disabled = true;
      const data = await fetchJson(`/api/maquila/cuenta-corriente?cliente_id=${encodeURIComponent(clienteId)}`);
      renderCuentaCorriente(data);
    } catch (err) {
      console.error("Error cargando cuenta corriente:", err);
      if (window.Swal) Swal.fire("Error", err.message || "No se pudo cargar la cuenta corriente", "error");
    } finally {
      btnCargar.disabled = false;
    }
  });

  /** Convierte una URL de imagen a base64 (data URL) para jsPDF */
  function imageUrlToDataUrl(url) {
    return fetch(url, { credentials: "include" })
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      );
  }

  async function generarPDF() {
    if (!currentData || !window.jspdf) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const c = currentData.cliente;

    const margenIzquierdo = 14;
    const anchoPagina = 210;
    let y = 18;

    // --- Obtener datos de la empresa ---
    let empresa = null;
    let logoDataUrl = null;
    try {
      empresa = await fetchJson("/api/empresa");
      if (empresa && empresa.logo_url) {
        const fullLogoUrl = window.location.origin + empresa.logo_url;
        logoDataUrl = await imageUrlToDataUrl(fullLogoUrl).catch(() => null);
      }
    } catch (e) {
      console.warn("No se pudo cargar empresa o logo para el PDF:", e);
    }

    // --- Bloque izquierdo: Logo + Datos de la compañía ---
    const xDatosEmpresa = margenIzquierdo;
    const logoAncho = 22;
    const logoAlto = 22;

    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, "PNG", xDatosEmpresa, y - 2, logoAncho, logoAlto);
      } catch (err) {
        console.warn("Error al dibujar logo en PDF:", err);
      }
    }

    const xTextoEmpresa = xDatosEmpresa + logoAncho + 4;
    const lineaAltura = 5;
    let yEmpresa = y;

    if (empresa) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30);
      doc.text(empresa.razon_social || "Empresa", xTextoEmpresa, yEmpresa);
      yEmpresa += lineaAltura;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60);
      if (empresa.nombre_fantasia) {
        doc.text(empresa.nombre_fantasia, xTextoEmpresa, yEmpresa);
        yEmpresa += lineaAltura;
      }
      doc.text(`RUT: ${empresa.rut || "-"}`, xTextoEmpresa, yEmpresa);
      yEmpresa += lineaAltura;
      if (empresa.direccion) {
        doc.text(`Dirección: ${empresa.direccion}`, xTextoEmpresa, yEmpresa);
        yEmpresa += lineaAltura;
      }
      if (empresa.telefono) {
        doc.text(`Tel: ${empresa.telefono}`, xTextoEmpresa, yEmpresa);
        yEmpresa += lineaAltura;
      }
      if (empresa.email_contacto) {
        doc.text(`Email: ${empresa.email_contacto}`, xTextoEmpresa, yEmpresa);
        yEmpresa += lineaAltura;
      }
    } else {
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text("Datos de la empresa no disponibles", xTextoEmpresa, yEmpresa + 2);
      yEmpresa += lineaAltura * 2;
    }

    // Ajustar Y al máximo entre fin logo y fin datos empresa
    const yDespuesEncabezado = Math.max(y + logoAlto - 2, yEmpresa + 2);
    y = yDespuesEncabezado;

    // --- Título del documento y fecha (centrado o izquierda) ---
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Estado de Cuenta Corriente Maquila", margenIzquierdo, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })}`, margenIzquierdo, y + 5);
    y += 12;

    // --- Datos del Cliente (lado derecho del encabezado) ---
    const xCliente = 105;
    let yCliente = 18;
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("Cliente", xCliente, yCliente);
    doc.setFont("helvetica", "normal");
    yCliente += 5;
    doc.text(c.razon_social || "Sin Razón Social", xCliente, yCliente);
    yCliente += 5;
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(`RUT: ${c.rut || "-"}`, xCliente, yCliente);
    yCliente += 5;
    if (c.email_facturacion) {
      doc.text(`Email: ${c.email_facturacion}`, xCliente, yCliente);
      yCliente += 5;
    }
    if (c.telefono) doc.text(`Tel: ${c.telefono}`, xCliente, yCliente);

    // Línea separadora bajo encabezado
    y = Math.max(y, yCliente + 4);
    doc.setDrawColor(200);
    doc.line(margenIzquierdo, y, anchoPagina - margenIzquierdo, y);
    y += 8;

    // --- Resumen de Saldos ---
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen de Saldos", margenIzquierdo, y);
    y += 8;

    // Tabla manual simple para saldos
    const saldos = [];
    // Trigo
    if (currentData.trigo?.total_kg) {
      saldos.push(["Trigo depositado (total)", `${currentData.trigo.total_kg.toLocaleString("es-CL")} kg`]);
    }
    // Harinas
    if (currentData.harina_saldos && currentData.harina_saldos.length > 0) {
      currentData.harina_saldos.forEach(h => {
        saldos.push([h.producto_nombre, `${Number(h.saldo_kg).toLocaleString("es-CL")} kg`]);
      });
    } else {
        saldos.push(["Harina", "Sin saldo"]);
    }

    doc.autoTable({
      startY: y,
      head: [['Producto', 'Saldo']],
      body: saldos,
      theme: 'striped',
      headStyles: { fillColor: [50, 50, 50] },
      margin: { left: margenIzquierdo },
      tableWidth: 100
    });

    y = doc.lastAutoTable.finalY + 15;

    // --- Movimientos (Detalle) ---
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Últimos Movimientos (Harina)", margenIzquierdo, y);
    y += 5;

    const filasMovimientos = (currentData.movimientos || []).map(m => [
      formatFecha(m.created_at),
      m.tipo_movimiento,
      m.producto_nombre || "-",
      Number(m.kg).toLocaleString("es-CL"),
      m.recepcion_ticket || "-",
      m.observacion || "-"
    ]);

    doc.autoTable({
      startY: y,
      head: [['Fecha', 'Tipo', 'Producto', 'Kg', 'Ticket Rec.', 'Obs.']],
      body: filasMovimientos,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 8 },
      margin: { left: margenIzquierdo },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        3: { halign: 'right' }
      }
    });

    // --- Pie de página ---
    const nombreSistema = empresa && empresa.razon_social ? empresa.razon_social : "Sistema Molino CDM";
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount} - ${nombreSistema}`, margenIzquierdo, 285);
    }

    // Mostrar en modal (Blob URL)
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    
    const iframe = document.getElementById('iframePdf');
    if (iframe) {
      iframe.src = blobUrl;
    }
    
    // Abrir modal
    $('#modalPdfViewer').modal('show');
  }

  btnVerEstado?.addEventListener("click", generarPDF);

  cargarClientes();
})();
