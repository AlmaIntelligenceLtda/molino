(() => {
  async function fetchJson(url, opts) {
    const res = await fetch(url, { credentials: "include", ...(opts || {}) });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `HTTP ${res.status}`);
    }
    return await res.json();
  }

  let clientes = [];
  let productosTerminados = [];
  let tiposTrabajo = [];
  let recepcionesPendientes = [];
  let recepcionSeleccionada = null;
  /** true = requiere paso "Acreditar"; false = el trigo se suma solo al ingresar */
  let maquilaRequiereAcreditar = true;
  /** Al crear cliente desde modal: "recepcion" | "retiro" para saber en qué select dejar seleccionado el nuevo */
  let nuevoClienteTargetSelect = null;

  function fillSelect(selectEl, items, opts = {}) {
    const { placeholder = "Seleccione...", getLabel = (x) => x.nombre, getValue = (x) => x.id, valueKey = "" } = opts;
    if (!selectEl) return;
    selectEl.innerHTML = "";
    selectEl.appendChild(new Option(placeholder, valueKey));
    (items || []).forEach((item) => selectEl.appendChild(new Option(getLabel(item), String(getValue(item)))));
  }

  function getClienteSelectOpts() {
    return {
      placeholder: "Buscar por nombre o RUT...",
      getLabel: (c) => {
        const nombre = c.razon_social || c.nombre_fantasia || `Cliente #${c.id}`;
        const rut = c.rut ? ` — ${c.rut}` : "";
        return `${nombre}${rut}`;
      },
      getValue: (c) => c.id
    };
  }

  function refillClientesSelects() {
    fillSelect(document.getElementById("recepcionClienteId"), clientes, getClienteSelectOpts());
    fillSelect(document.getElementById("retiroClienteId"), clientes, getClienteSelectOpts());
  }

  function actualizarVisibilidadBotonNuevoCliente() {
    const recepcionVal = document.getElementById("recepcionClienteId")?.value;
    const btnRecepcion = document.getElementById("btnNuevoClienteRecepcion");
    const linkRecepcion = document.getElementById("linkCrearClienteRecepcion");
    const tieneRecepcion = recepcionVal != null && String(recepcionVal).trim() !== "";
    if (btnRecepcion) btnRecepcion.style.display = tieneRecepcion ? "none" : "";
    if (linkRecepcion) linkRecepcion.style.display = tieneRecepcion ? "none" : "";
  }

  function openModalNuevoCliente(target) {
    nuevoClienteTargetSelect = target;
    document.getElementById("formNuevoClienteMaquila").reset();
    document.getElementById("maquilaCliRutError").classList.add("d-none");
    $("#modalNuevoClienteMaquila").modal("show");
  }

  function validarRutMaquila(rut) {
    if (!rut || typeof rut !== "string") return false;
    const limpio = rut.replace(/[.\s\-]/g, "").toUpperCase();
    if (limpio.length < 2) return false;
    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    if (!/^\d+$/.test(cuerpo)) return false;
    let suma = 0;
    let mul = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) {
      suma += parseInt(cuerpo[i], 10) * mul;
      mul = mul === 7 ? 2 : mul + 1;
    }
    const dvEsperado = 11 - (suma % 11);
    const dvChar = dvEsperado === 11 ? "0" : dvEsperado === 10 ? "K" : String(dvEsperado);
    return dv === dvChar;
  }

  async function cargarDatos() {
    try {
      const [clientesRes, prodRes, tiposTrabajoRes, recepcionesPendientesRes, configRes] = await Promise.all([
        fetchJson("/api/clientes"),
        fetchJson("/api/produccion/productos-terminados").then((r) => (r && r.data) ? r.data : []).catch(() => []),
        fetchJson("/api/maquila/config/porcentajes"),
        fetchJson("/api/maquila/recepciones-pendientes"),
        fetchJson("/api/maquila/config").catch(() => ({ requiere_acreditar: true }))
      ]);
      clientes = Array.isArray(clientesRes) ? clientesRes : [];
      productosTerminados = Array.isArray(prodRes) ? prodRes : [];
      tiposTrabajo = Array.isArray(tiposTrabajoRes) ? tiposTrabajoRes : [];
      recepcionesPendientes = Array.isArray(recepcionesPendientesRes) ? recepcionesPendientesRes : [];
      maquilaRequiereAcreditar = configRes && configRes.requiere_acreditar !== false;
      aplicarVisibilidadAcreditar();
    } catch (err) {
      console.error("Error cargando datos maquila:", err);
      if (window.Swal) Swal.fire("Error", "No se pudieron cargar los datos", "error");
    }
  }

  function aplicarVisibilidadAcreditar() {
    const bloque = document.getElementById("bloqueAcreditar");
    const mensaje = document.getElementById("mensajeNoAcreditar");
    if (bloque) bloque.classList.toggle("d-none", !maquilaRequiereAcreditar);
    if (mensaje) mensaje.classList.toggle("d-none", maquilaRequiereAcreditar);
  }

  function renderRecepcionesPendientes() {
    const tbody = document.querySelector("#tablaRecepcionesPendientes tbody");
    if (!tbody) return;
    
    // Si ya existe DataTable, destruirla antes de actualizar
    if ($.fn.DataTable.isDataTable("#tablaRecepcionesPendientes")) {
      $("#tablaRecepcionesPendientes").DataTable().destroy();
    }
    
    tbody.innerHTML = "";
    recepcionesPendientes.forEach((r) => {
      const neto = Number(r.peso_neto_pagar_kg) || Number(r.peso_neto_fisico_kg) || 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.ticket_codigo || "-"}</td>
        <td>${r.cliente_nombre || "-"}</td>
        <td>${r.producto_nombre || "-"}</td>
        <td>${neto.toLocaleString("es-CL")}</td>
        <td>
          <button type="button" class="btn btn-sm btn-primary btn-acreditar" data-id="${r.id}">Acreditar</button>
          <button type="button" class="btn btn-sm btn-secondary btn-imprimir ml-1" data-id="${r.id}" title="Reimprimir Ticket">
            <i class="fas fa-print"></i>
          </button>
          <a href="${window.location.origin}/api/recepciones/${r.id}/ticket-ingreso-interno.pdf" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary ml-1" title="Documento SAG (PDF)">
            <i class="fas fa-file-pdf"></i>
          </a>
        </td>
      `;
      tbody.appendChild(tr);
    });
    document.querySelectorAll("#tablaRecepcionesPendientes .btn-acreditar").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        recepcionSeleccionada = recepcionesPendientes.find((r) => r.id === id) || null;
        abrirFormAcreditar();
      });
    });
    document.querySelectorAll("#tablaRecepcionesPendientes .btn-imprimir").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.getAttribute("data-id"));
        try {
          const [fullRec, empresa] = await Promise.all([
            fetchJson(`/api/recepciones/${id}`),
            fetchJson("/api/empresa").catch(() => null)
          ]);
          const html = buildTicketMaquilaHtml(fullRec, empresa);
          openPrintWindow80mm(html);
        } catch (err) {
          console.error("Error reimprimiendo ticket:", err);
          if (window.Swal) Swal.fire("Error", "No se pudo imprimir el ticket", "error");
        }
      });
    });

    // Re-inicializar DataTable
    $("#tablaRecepcionesPendientes").DataTable({
      language: { url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json" },
      pageLength: 10,
      order: [[0, "desc"]]
    });
  }

  function abrirFormAcreditar() {
    const form = document.getElementById("formAcreditar");
    const ticket = document.getElementById("acreditarTicket");
    const recepcionId = document.getElementById("acreditarRecepcionId");
    const clienteId = document.getElementById("acreditarClienteId");
    const tipoTrabajo = document.getElementById("acreditarTipoTrabajo");
    const productoHarina = document.getElementById("acreditarProductoHarina");
    const kg = document.getElementById("acreditarKg");
    if (!recepcionSeleccionada) {
      form.classList.add("d-none");
      return;
    }
    ticket.value = recepcionSeleccionada.ticket_codigo || "";
    recepcionId.value = recepcionSeleccionada.id;
    clienteId.value = recepcionSeleccionada.cliente_id;
    fillSelect(tipoTrabajo, tiposTrabajo, {
      placeholder: "Seleccione %",
      getLabel: (t) => `${t.nombre} (${t.porcentaje}%)`,
      getValue: (t) => t.id
    });
    fillSelect(productoHarina, productosTerminados, { placeholder: "Seleccione harina" });
    tipoTrabajo.value = "";
    productoHarina.value = "";
    kg.value = "";
    form.classList.remove("d-none");
  }

  function actualizarKgDesdeTipo() {
    const tipoId = document.getElementById("acreditarTipoTrabajo")?.value;
    const kg = document.getElementById("acreditarKg");
    if (!recepcionSeleccionada || !tipoId || !kg) return;
    const tipo = tiposTrabajo.find((t) => String(t.id) === tipoId);
    if (!tipo) return;
    const neto = Number(recepcionSeleccionada.peso_neto_pagar_kg) || Number(recepcionSeleccionada.peso_neto_fisico_kg) || 0;
    kg.value = Math.round((neto * Number(tipo.porcentaje)) / 100);
    const productoHarina = document.getElementById("acreditarProductoHarina");
    if (tipo.producto_harina_id && productoHarina) productoHarina.value = String(tipo.producto_harina_id);
  }

  async function acreditarHarina() {
    const clienteId = document.getElementById("acreditarClienteId")?.value;
    const recepcionId = document.getElementById("acreditarRecepcionId")?.value;
    const tipoTrabajoId = document.getElementById("acreditarTipoTrabajo")?.value;
    const productoHarinaId = document.getElementById("acreditarProductoHarina")?.value;
    const kg = document.getElementById("acreditarKg")?.value;
    if (!clienteId || !recepcionId) return Swal.fire("Falta recepción o cliente", "", "warning");
    if (!tipoTrabajoId) return Swal.fire("Seleccione el tipo de trabajo (porcentaje)", "", "warning");
    const kgNum = Number(kg);
    if (!Number.isFinite(kgNum) || kgNum <= 0) return Swal.fire("Ingrese kg válidos", "", "warning");
    try {
      await fetchJson("/api/maquila/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: Number(clienteId),
          recepcion_id: Number(recepcionId),
          producto_harina_id: productoHarinaId ? Number(productoHarinaId) : null,
          tipo_movimiento: "CREDITO_HARINA_CONFIRMADO_KG",
          kg: kgNum,
          observacion: "Acreditado desde módulo maquila"
        })
      });
      if (window.Swal) Swal.fire("Listo", "Harina acreditada al cliente.", "success");
      document.getElementById("formAcreditar").classList.add("d-none");
      recepcionSeleccionada = null;
      recepcionesPendientes = await fetchJson("/api/maquila/recepciones-pendientes");
      renderRecepcionesPendientes();
    } catch (err) {
      if (window.Swal) Swal.fire("Error", err.message || "No se pudo acreditar", "error");
    }
  }

  // --- Lógica de Saldos en Retiro ---
  let saldosClienteActual = [];
  let trigoPendienteClienteActual = 0;

  async function actualizarInfoSaldoRetiro() {
    // Función legacy, no usada directamente
  }

  async function alCambiarClienteRetiro() {
    const clienteId = document.getElementById("retiroClienteId")?.value;
    const infoDiv = document.getElementById("retiroSaldoInfo");
    
    if (!clienteId) {
      saldosClienteActual = [];
      trigoPendienteClienteActual = 0;
      if (infoDiv) infoDiv.classList.add("d-none");
      return;
    }

    try {
      const data = await fetchJson(`/api/maquila/saldos?cliente_id=${clienteId}`);
      // La API devuelve { harina: [], trigo_pendiente_kg: 123 }
      if (data && Array.isArray(data.harina)) {
        saldosClienteActual = data.harina;
        trigoPendienteClienteActual = Number(data.trigo_pendiente_kg) || 0;
      } else {
        // Fallback estructura antigua
        saldosClienteActual = Array.isArray(data) ? data : [];
        trigoPendienteClienteActual = 0;
      }
    } catch (e) {
      console.error("Error trayendo saldos", e);
      saldosClienteActual = [];
      trigoPendienteClienteActual = 0;
    }
    renderSaldoRetiro();
  }

  function renderSaldoRetiro() {
    const infoDiv = document.getElementById("retiroSaldoInfo");
    const productoId = document.getElementById("retiroProductoHarinaId")?.value;
    const kgInput = document.getElementById("retiroKg");
    
    if (!infoDiv) return;

    // Mensaje sobre trigo pendiente
    const msgTrigo = trigoPendienteClienteActual > 0
      ? `<div class="mb-2 text-primary"><i class="fas fa-seedling"></i> Trigo pendiente de acreditar: <strong>${trigoPendienteClienteActual.toLocaleString("es-CL")} kg</strong></div>`
      : `<div class="mb-2 text-muted"><small><i class="fas fa-ban"></i> Sin trigo pendiente de acreditar.</small></div>`;

    if (!productoId) {
      infoDiv.innerHTML = `
        ${msgTrigo}
        <i class="fas fa-info-circle"></i> Seleccione un producto de harina para ver disponibilidad.
      `;
      infoDiv.className = "alert alert-light border";
      infoDiv.classList.remove("d-none");
      return;
    }

    const saldoRow = saldosClienteActual.find(s => String(s.producto_harina_id) === String(productoId));
    const saldoActual = saldoRow ? Number(saldoRow.saldo_kg) : 0;
    const retiro = Number(kgInput?.value) || 0;
    const final = saldoActual - retiro;

    let colorClass = "alert-info";
    let icono = "info-circle";
    
    if (final < 0) {
      colorClass = "alert-danger";
      icono = "exclamation-triangle";
    } else if (retiro > 0) {
      colorClass = "alert-success";
      icono = "check-circle";
    }

    infoDiv.className = `alert ${colorClass}`;
    infoDiv.classList.remove("d-none");
    infoDiv.innerHTML = `
      ${msgTrigo}
      <hr class="my-2">
      <strong><i class="fas fa-${icono}"></i> Disponibilidad de Harina:</strong><br/>
      Saldo actual: <b>${saldoActual.toLocaleString("es-CL")} kg</b><br/>
      Menos retiro: <b>${retiro.toLocaleString("es-CL")} kg</b><br/>
      --------------------------------<br/>
      Saldo final: <b>${final.toLocaleString("es-CL")} kg</b>
    `;
  }

  function buildTicketRetiroHtml(movimiento, clienteNombre, productoNombre) {
    const now = new Date();
    const fecha = now.toLocaleString();
    const kg = Math.abs(Number(movimiento.kg)).toLocaleString("es-CL");
    const folio = movimiento.id;
    const code128Url = `${window.location.origin}/api/maquila/movimientos/${folio}/barcode.png`;
    
    const sucNombre = movimiento.sucursal_nombre || "MOLINO";
    const sucDir = movimiento.sucursal_direccion || "";
    const sucCiudad = movimiento.sucursal_ciudad || "";

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Retiro #${folio}</title>
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
      img { max-width: 90%; height: auto; display: block; margin: 0 auto; }
    </style>
  </head>
  <body>
    <div class="center title">${sucNombre}</div>
    <div class="center small">${sucDir} ${sucCiudad}</div>
    <div class="hr"></div>
    
    <div class="center title">RETIRO DE HARINA</div>
    <div class="center muted small">${fecha}</div>
    <div class="hr"></div>

    <div class="row"><div class="k">Folio</div><div class="v">#${folio}</div></div>
    <div class="hr"></div>

    <div><span class="k">Cliente:</span> ${clienteNombre}</div>
    <div><span class="k">Producto:</span> ${productoNombre}</div>
    <div class="hr"></div>

    <div class="row"><div class="k">Cant. Retirada</div><div class="v font-weight-bold">${kg} kg</div></div>
    <div class="row"><div class="k">Observación</div><div class="v small">${movimiento.observacion || "-"}</div></div>
    
    <div class="hr"></div>
    <div class="center">
      <img src="${code128Url}" alt="Code128" />
    </div>
    <div class="hr"></div>

    <div class="center small muted">Molino - Control Maquila</div>
    <br/><br/>
    <div class="center small">__________________________</div>
    <div class="center small">Firma Conforme</div>

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

  async function registrarRetiro() {
    const clienteId = document.getElementById("retiroClienteId")?.value;
    const productoHarinaId = document.getElementById("retiroProductoHarinaId")?.value;
    const kg = document.getElementById("retiroKg")?.value;
    const observacion = document.getElementById("retiroObservacion")?.value?.trim() || null;
    if (!clienteId) return Swal.fire("Seleccione un cliente", "", "warning");
    const kgNum = Number(kg);
    if (!Number.isFinite(kgNum) || kgNum <= 0) return Swal.fire("Ingrese kg válidos a retirar", "", "warning");
    
    try {
      const res = await fetchJson("/api/maquila/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: Number(clienteId),
          producto_harina_id: productoHarinaId ? Number(productoHarinaId) : null,
          tipo_movimiento: "RETIRO_HARINA_KG",
          kg: kgNum,
          observacion: observacion || "Retiro desde módulo maquila"
        })
      });
      
      if (window.Swal) Swal.fire("Listo", "Retiro registrado.", "success");
      
      // Imprimir Ticket Retiro
      const cliente = clientes.find(c => String(c.id) === String(clienteId));
      const producto = productosTerminados.find(p => String(p.id) === String(productoHarinaId));
      
      const html = buildTicketRetiroHtml(
        res, 
        cliente ? (cliente.razon_social || cliente.nombre_fantasia) : "Cliente",
        producto ? producto.nombre : "Harina"
      );
      openPrintWindow80mm(html);

      document.getElementById("retiroKg").value = "";
      document.getElementById("retiroObservacion").value = "";
      
      // Actualizar saldos en pantalla
      alCambiarClienteRetiro();

    } catch (err) {
      if (window.Swal) Swal.fire("Error", err.message || "No se pudo registrar el retiro", "error");
    }
  }

  function renderTablaPorcentajes() {
    const tbody = document.querySelector("#tablaPorcentajes tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    tiposTrabajo.forEach((t) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${t.nombre || "-"}</td>
        <td>${Number(t.porcentaje)}%</td>
        <td>${t.producto_harina_nombre || "-"}</td>
        <td>${t.activo ? "Sí" : "No"}</td>
        <td>
          <button type="button" class="btn btn-sm btn-primary btn-edit-porcentaje" data-id="${t.id}" title="Editar">
            <i class="fas fa-pencil-alt"></i>
          </button>
          <button type="button" class="btn btn-sm btn-danger btn-delete-porcentaje" data-id="${t.id}" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    document.querySelectorAll(".btn-edit-porcentaje").forEach((btn) => {
      btn.addEventListener("click", () => editarPorcentaje(Number(btn.getAttribute("data-id"))));
    });
    document.querySelectorAll(".btn-delete-porcentaje").forEach((btn) => {
      btn.addEventListener("click", () => eliminarPorcentaje(Number(btn.getAttribute("data-id"))));
    });
  }

  async function agregarPorcentaje() {
    const nombre = document.getElementById("configNombre")?.value?.trim() || "";
    const porcentaje = document.getElementById("configPorcentaje")?.value;
    const productoHarinaId = document.getElementById("configProductoHarinaId")?.value || null;
    const orden = document.getElementById("configOrden")?.value || 0;
    const pct = Number(porcentaje);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      return Swal.fire("Porcentaje inválido", "Use un valor entre 0.01 y 100", "warning");
    }
    try {
      await fetchJson("/api/maquila/config/porcentajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre || `Trabajo ${pct}%`,
          porcentaje: pct,
          producto_harina_id: productoHarinaId ? Number(productoHarinaId) : null,
          orden: Number(orden) || 0
        })
      });
      if (window.Swal) Swal.fire("Listo", "Tipo de trabajo agregado.", "success");
      document.getElementById("configNombre").value = "";
      document.getElementById("configPorcentaje").value = "";
      document.getElementById("configProductoHarinaId").value = "";
      tiposTrabajo = await fetchJson("/api/maquila/config/porcentajes");
      renderTablaPorcentajes();
      fillSelect(document.getElementById("acreditarTipoTrabajo"), tiposTrabajo, {
        getLabel: (t) => `${t.nombre} (${t.porcentaje}%)`,
        getValue: (t) => t.id
      });
    } catch (err) {
      if (window.Swal) Swal.fire("Error", err.message || "No se pudo agregar", "error");
    }
  }

  function editarPorcentaje(id) {
    const t = tiposTrabajo.find((x) => x.id === id);
    if (!t) return;
    Swal.fire({
      title: "Editar tipo de trabajo",
      html: `
        <input id="swal-nombre" class="swal2-input" value="${(t.nombre || "").replace(/"/g, "&quot;")}" placeholder="Nombre" />
        <input id="swal-porcentaje" type="number" class="swal2-input" value="${t.porcentaje}" min="0.01" max="100" step="0.01" placeholder="Porcentaje" />
      `,
      showCancelButton: true,
      confirmButtonText: "Guardar",
      preConfirm: () => {
        const nombre = document.getElementById("swal-nombre").value.trim() || t.nombre;
        const pct = Number(document.getElementById("swal-porcentaje").value);
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
          Swal.showValidationMessage("Porcentaje entre 0.01 y 100");
          return false;
        }
        return { nombre, porcentaje: pct };
      }
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        await fetchJson(`/api/maquila/config/porcentajes/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.value)
        });
        if (window.Swal) Swal.fire("Listo", "Actualizado.", "success");
        tiposTrabajo = await fetchJson("/api/maquila/config/porcentajes");
        renderTablaPorcentajes();
      } catch (err) {
        if (window.Swal) Swal.fire("Error", err.message, "error");
      }
    });
  }

  async function eliminarPorcentaje(id) {
    const ok = await Swal.fire({ title: "¿Eliminar?", text: "Se quitará este tipo de trabajo.", icon: "warning", showCancelButton: true, confirmButtonText: "Eliminar" });
    if (!ok.isConfirmed) return;
    try {
      await fetchJson(`/api/maquila/config/porcentajes/${id}`, { method: "DELETE" });
      if (window.Swal) Swal.fire("Listo", "Eliminado.", "success");
      tiposTrabajo = await fetchJson("/api/maquila/config/porcentajes");
      renderTablaPorcentajes();
    } catch (err) {
      if (window.Swal) Swal.fire("Error", err.message, "error");
    }
  }

  function calcNetoExpress() {
    const bruto = Number(document.getElementById("recepcionBruto")?.value) || 0;
    const tara = Number(document.getElementById("recepcionTara")?.value) || 0;
    const netoInput = document.getElementById("recepcionNeto");
    if (netoInput && bruto > 0 && bruto > tara) {
      netoInput.value = bruto - tara;
    }
  }

  async function registrarRecepcionExpress() {
    const clienteId = document.getElementById("recepcionClienteId")?.value;
    const chofer = document.getElementById("recepcionChofer")?.value;
    const bruto = document.getElementById("recepcionBruto")?.value;
    const tara = document.getElementById("recepcionTara")?.value;
    const neto = document.getElementById("recepcionNeto")?.value;

    if (!clienteId) return Swal.fire("Seleccione un cliente", "", "warning");
    const netoNum = Number(neto);
    if (!Number.isFinite(netoNum) || netoNum <= 0) return Swal.fire("Peso neto inválido", "", "warning");

    try {
      const res = await fetchJson("/api/maquila/recepcion-directa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: Number(clienteId),
          chofer_vehiculo: chofer,
          peso_bruto: bruto ? Number(bruto) : null,
          peso_tara: tara ? Number(tara) : null,
          peso_neto: netoNum
        })
      });

      if (window.Swal) Swal.fire("Recepción registrada", "El trigo ha sido ingresado correctamente.", "success");
      
      // Auto-imprimir ticket 80mm y abrir documento PDF (Ticket de Ingreso Interno — SAG)
      try {
        if (res && res.id) {
          const [fullRec, empresa] = await Promise.all([
            fetchJson(`/api/recepciones/${res.id}`),
            fetchJson("/api/empresa").catch(() => null)
          ]);
          const html = buildTicketMaquilaHtml(fullRec, empresa);
          openPrintWindow80mm(html);
          // Documento PDF para SAG (impresión inmediata)
          window.open(
            `${window.location.origin}/api/recepciones/${res.id}/ticket-ingreso-interno.pdf`,
            "_blank",
            "noopener"
          );
        }
      } catch (e) {
        console.error("Error imprimiendo ticket express:", e);
      }
      
      // Limpiar form
      document.getElementById("recepcionBruto").value = "";
      document.getElementById("recepcionTara").value = "";
      document.getElementById("recepcionNeto").value = "";
      document.getElementById("recepcionChofer").value = "";
      $("#recepcionClienteId").val(null).trigger("change");

      // Refrescar pendientes
      recepcionesPendientes = await fetchJson("/api/maquila/recepciones-pendientes");
      renderRecepcionesPendientes();
      
      // Ir a la pestaña de operación
      $('#maquilaTabs a[href="#maquilaOperacion"]').tab('show');

    } catch (err) {
      if (window.Swal) Swal.fire("Error", err.message || "No se pudo registrar", "error");
    }
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

  function buildTicketMaquilaHtml(r, empresa) {
    const now = new Date();
    const fecha = now.toLocaleString();
    const tipo = "MAQUILA EXPRESS";
    const cliente = r.cliente_nombre || (r.cliente_id ? `Cliente #${r.cliente_id}` : "Particular");
    const choferLabel = r.chofer_nombre || r.chofer_vehiculo || "-";
    const producto = r.producto_nombre || "Trigo";

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
        font-family: 'Courier New', monospace; /* Fuente monoespaciada va mejor en térmicas */
        font-size: 12px; 
        color: #000; 
      }
      .center { text-align: center; }
      .muted { color: #000; } /* Negro puro para térmica */
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
    <div class="center title">RECEPCIÓN MAQUILA</div>
    <div class="center muted small">${fecha}</div>
    <div class="hr"></div>

    <div class="row"><div class="k">Ticket</div><div class="v">${r.ticket_codigo || ""}</div></div>
    <div class="row"><div class="k">ID</div><div class="v">#${r.id}</div></div>
    <div class="hr"></div>

    <div><span class="k">Cliente:</span> ${cliente}</div>
    <div><span class="k">Producto:</span> ${producto}</div>
    <div><span class="k">Chofer/Vehículo:</span> ${choferLabel}</div>
    <div class="hr"></div>

    <div class="row"><div class="k">Bruto (kg)</div><div class="v">${r.peso_bruto_kg ?? 0}</div></div>
    <div class="row"><div class="k">Tara (kg)</div><div class="v">${r.peso_tara_kg ?? 0}</div></div>
    <div class="row"><div class="k">Neto (kg)</div><div class="v font-weight-bold">${r.peso_neto_pagar_kg ?? r.peso_neto_fisico_kg ?? 0}</div></div>

    <div class="hr"></div>
    <div class="center">
      <div class="k">Código de barras</div>
      <img src="${code128Url}" alt="Code128" />
    </div>
    <div class="hr"></div>
    <div class="center small muted">Molino - Control Maquila</div>

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

  async function guardarNuevoClienteMaquila(nuevoId) {
    clientes = await fetchJson("/api/clientes");
    refillClientesSelects();
    // Re-aplicar Select2 si existe (los options cambiaron)
    if (typeof $ !== "undefined" && $.fn.select2) {
      const $r = $("#recepcionClienteId");
      const $t = $("#retiroClienteId");
      if ($r.data("select2")) $r.select2("destroy");
      if ($t.data("select2")) $t.select2("destroy");
      $r.select2({ theme: "bootstrap-5", placeholder: "Buscar por nombre o RUT...", allowClear: true, width: "100%" });
      $t.select2({ theme: "bootstrap-5", placeholder: "Buscar por nombre o RUT...", allowClear: true, width: "100%" });
    }
    const selectId = nuevoClienteTargetSelect === "recepcion" ? "recepcionClienteId" : "retiroClienteId";
    const sel = document.getElementById(selectId);
    if (sel) {
      sel.value = String(nuevoId);
      if (typeof $ !== "undefined" && $(sel).data("select2")) $(sel).trigger("change");
    }
    actualizarVisibilidadBotonNuevoCliente();
    $("#modalNuevoClienteMaquila").modal("hide");
    nuevoClienteTargetSelect = null;
    if (window.Swal) Swal.fire("Cliente creado", "Se ha creado el cliente y quedó seleccionado.", "success");
  }

  async function init() {
    await cargarDatos();

    // -- Selects de cliente (recepción y retiro) --
    refillClientesSelects();
    
    if (typeof $ !== "undefined" && $.fn.select2) {
      const $retiroCliente = $("#retiroClienteId");
      if ($retiroCliente.length) {
        $retiroCliente.select2({
          theme: "bootstrap-5",
          placeholder: "Buscar por nombre o RUT...",
          allowClear: true,
          width: "100%"
        });
      }
      const $recepCliente = $("#recepcionClienteId");
      if ($recepCliente.length) {
        $recepCliente.select2({
          theme: "bootstrap-5",
          placeholder: "Buscar por nombre o RUT...",
          allowClear: true,
          width: "100%"
        });
        $recepCliente.on("select2:select select2:clear", actualizarVisibilidadBotonNuevoCliente);
      }
    }
    document.getElementById("recepcionClienteId")?.addEventListener("change", actualizarVisibilidadBotonNuevoCliente);
    actualizarVisibilidadBotonNuevoCliente();
    fillSelect(document.getElementById("retiroProductoHarinaId"), productosTerminados, { placeholder: "Seleccione harina" });
    fillSelect(document.getElementById("configProductoHarinaId"), productosTerminados, { placeholder: "— Sin asociar —", valueKey: "" });

    const configHint = document.getElementById("configProductoHarinaHint");
    if (configHint) configHint.classList.toggle("d-none", productosTerminados.length > 0);

    renderRecepcionesPendientes();
    renderTablaPorcentajes();

    document.getElementById("recepcionBruto")?.addEventListener("input", calcNetoExpress);
    document.getElementById("recepcionTara")?.addEventListener("input", calcNetoExpress);
    document.getElementById("btnRegistrarRecepcion")?.addEventListener("click", registrarRecepcionExpress);

    document.getElementById("acreditarTipoTrabajo")?.addEventListener("change", actualizarKgDesdeTipo);
    document.getElementById("btnAcreditar")?.addEventListener("click", acreditarHarina);
    document.getElementById("btnRetiro")?.addEventListener("click", registrarRetiro);
    
    // Listeners saldo retiro
    const selCliente = document.getElementById("retiroClienteId");
    const selProd = document.getElementById("retiroProductoHarinaId");
    const inpKg = document.getElementById("retiroKg");

    if (selCliente) {
      if (typeof $ !== "undefined" && $(selCliente).data('select2')) {
        $(selCliente).on('select2:select', alCambiarClienteRetiro);
        $(selCliente).on('select2:clear', alCambiarClienteRetiro);
      } else {
        selCliente.addEventListener("change", alCambiarClienteRetiro);
      }
    }
    if (selProd) selProd.addEventListener("change", renderSaldoRetiro);
    if (inpKg) inpKg.addEventListener("input", renderSaldoRetiro);

    document.getElementById("btnAgregarPorcentaje")?.addEventListener("click", agregarPorcentaje);

    // -- Modal Crear Cliente (solo en Recepción, si no encuentra el cliente) --
    document.getElementById("btnNuevoClienteRecepcion")?.addEventListener("click", (e) => { e.preventDefault(); openModalNuevoCliente("recepcion"); });
    document.getElementById("linkCrearClienteRecepcion")?.addEventListener("click", (e) => { e.preventDefault(); openModalNuevoCliente("recepcion"); });

    document.getElementById("formNuevoClienteMaquila")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const rut = document.getElementById("maquilaCliRut").value.trim();
      const razon_social = document.getElementById("maquilaCliRazon").value.trim();
      const nombre_fantasia = document.getElementById("maquilaCliFantasia").value.trim();
      const telefono = document.getElementById("maquilaCliTelefono").value.trim();
      const email_facturacion = document.getElementById("maquilaCliEmail").value.trim();

      if (!validarRutMaquila(rut)) {
        document.getElementById("maquilaCliRutError").classList.remove("d-none");
        document.getElementById("maquilaCliRutError").textContent = "RUT inválido";
        return;
      }
      document.getElementById("maquilaCliRutError").classList.add("d-none");

      try {
        const row = await fetchJson("/api/clientes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rut, razon_social, nombre_fantasia, telefono, email_facturacion })
        });
        await guardarNuevoClienteMaquila(row.id);
      } catch (err) {
        if (window.Swal) Swal.fire("Error", err.message || "No se pudo crear el cliente", "error");
      }
    });
  }

  init();
})();
