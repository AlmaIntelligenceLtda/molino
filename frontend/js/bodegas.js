(() => {
  const sucursalMapaSelect = document.getElementById("wmsSucursalMapa");
  const tablaMapa = document.getElementById("tablaMapaSilos");
  const filtroSiloLotes = document.getElementById("wmsFiltroSiloLotes");
  const tablaLotes = document.getElementById("tablaLotes");
  const filtroSiloMov = document.getElementById("wmsFiltroSiloMov");
  const filtroLoteMov = document.getElementById("wmsFiltroLoteMov");
  const tablaMov = document.getElementById("tablaMovimientos");

  const recepcionIdInput = document.getElementById("wmsRecepcionId");
  const siloDestinoSelect = document.getElementById("wmsSiloDestino");
  const cantidadLoteInput = document.getElementById("wmsCantidadLote");
  const codigoLoteInput = document.getElementById("wmsCodigoLote");
  const obsLoteInput = document.getElementById("wmsObsLote");
  const btnCrearLote = document.getElementById("btnCrearLote");

  const loteTrasiegoSelect = document.getElementById("wmsLoteTrasiego");
  const siloOrigenTrasiegoSelect = document.getElementById("wmsSiloOrigenTrasiego");
  const siloDestinoTrasiegoSelect = document.getElementById("wmsSiloDestinoTrasiego");
  const cantidadTrasiegoInput = document.getElementById("wmsCantidadTrasiego");
  const obsTrasiegoInput = document.getElementById("wmsObsTrasiego");
  const btnTrasiego = document.getElementById("btnTrasiego");

  const loteOrigenASelect = document.getElementById("wmsLoteOrigenA");
  const loteOrigenBSelect = document.getElementById("wmsLoteOrigenB");
  const cantidadAInput = document.getElementById("wmsCantidadA");
  const cantidadBInput = document.getElementById("wmsCantidadB");
  const siloDestinoMezclaSelect = document.getElementById("wmsSiloDestinoMezcla");
  const codigoMezclaInput = document.getElementById("wmsCodigoMezcla");
  const obsMezclaInput = document.getElementById("wmsObsMezcla");
  const btnMezcla = document.getElementById("btnMezcla");

  const visualSilosContainer = document.getElementById("visualSilosContainer");
  const badgePendientes = document.getElementById("badgePendientes");
  const tablaPendientes = document.getElementById("tablaPendientes");
  const btnRefrescarPendientes = document.getElementById("btnRefrescarPendientes");

  const modalDescargaSilo = $("#modalDescargaSilo"); // Usamos jQuery para bootstrap modal
  const modalDescargaRecId = document.getElementById("modalDescargaRecId");
  const modalDescargaProducto = document.getElementById("modalDescargaProducto");
  const modalDescargaInputRecId = document.getElementById("modalDescargaInputRecId");
  const modalDescargaInputCantidad = document.getElementById("modalDescargaInputCantidad");
  const modalDescargaSelectSilo = document.getElementById("modalDescargaSelectSilo");
  const modalDescargaObservacion = document.getElementById("modalDescargaObservacion");
  const btnConfirmarDescarga = document.getElementById("btnConfirmarDescarga");

  // Feedback visual para el escaneo de tickets
  const feedbackContainer = document.createElement("div");
  feedbackContainer.id = "wmsScanFeedback";
  feedbackContainer.className = "mt-2";
  if (recepcionIdInput) {
    recepcionIdInput.parentNode.appendChild(feedbackContainer);
  }

  let mapaSilos = [];
  let lotes = [];
  let movimientos = [];
  let pendientes = [];

  let dtLotes;
  let dtMovimientos;
  let dtPendientes;

  async function fetchJson(url, opts) {
    const res = await fetch(url, { credentials: "include", ...(opts || {}) });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `HTTP ${res.status}`);
    }
    return await res.json();
  }

  function fillSelect(selectEl, items, { placeholder = "", getLabel, getValue }) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    if (placeholder) {
      selectEl.appendChild(new Option(placeholder, ""));
    }
    items.forEach((item) => {
      selectEl.appendChild(new Option(getLabel(item), String(getValue(item))));
    });
  }

  function renderMapaSilos() {
    if (!tablaMapa) return;
    const tbody = tablaMapa.querySelector("tbody");
    if (!mapaSilos || mapaSilos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted">
            No hay silos configurados para esta empresa/sucursal.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = mapaSilos
      .map((s) => {
        const ocup = Number(s.porcentaje_ocupacion || 0);
        const badgeClass = ocup >= 100 ? "danger" : ocup >= 90 ? "warning" : "success";
        const alertaTexto = s.alerta_rebalse ? "¡Rebalse!" : "OK";
        return `
          <tr>
            <td>${s.sucursal_nombre || "-"}</td>
            <td>${s.bodega_nombre || "-"}</td>
            <td>${s.codigo || ""}</td>
            <td>${s.producto_actual_nombre || ""}</td>
            <td>${s.capacidad_max_kg ?? ""}</td>
            <td>${s.nivel_actual_kg ?? 0}</td>
            <td><span class="badge badge-${badgeClass}">${ocup}%</span></td>
            <td>${s.alerta_rebalse ? `<span class="text-danger font-weight-bold">${alertaTexto}</span>` : `<span class="text-success">${alertaTexto}</span>`}</td>
          </tr>`;
      })
      .join("");

    renderMapaVisual();
  }

  function renderMapaVisual() {
    if (!visualSilosContainer) return;
    if (!mapaSilos || mapaSilos.length === 0) {
      visualSilosContainer.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">No hay datos para mostrar visualmente.</p></div>';
      return;
    }

    visualSilosContainer.innerHTML = mapaSilos.map(s => {
      const ocup = Number(s.porcentaje_ocupacion || 0);
      const colorClass = ocup >= 100 ? "bg-danger" : ocup >= 90 ? "bg-warning" : "bg-success";
      const nivelKg = s.nivel_actual_kg ? (s.nivel_actual_kg / 1000).toFixed(1) + 't' : 'vacio';
      
      return `
        <div class="col-6 col-md-4 col-lg-3 mb-4">
          <div class="card h-100 border shadow-sm">
            <div class="card-body p-3 d-flex flex-column align-items-center">
              <h6 class="text-primary mb-1">${s.codigo}</h6>
              <small class="text-muted mb-2">${s.sucursal_nombre || ''} - ${s.bodega_nombre || ''}</small>
              
              <!-- Silo Visual -->
              <div class="silo-tank position-relative mb-3" style="width: 80px; height: 120px; border: 2px solid #ccc; border-radius: 4px 4px 10px 10px; overflow: hidden; background: #f8f9fa;">
                <div class="silo-fill position-absolute bottom-0 w-100 ${colorClass}" style="height: ${ocup}%; bottom: 0; transition: height 0.5s ease-in-out;"></div>
                <div class="position-absolute w-100 h-100 d-flex align-items-center justify-content-center" style="z-index: 1;">
                  <span class="font-weight-bold" style="font-size: 0.8rem; text-shadow: 0 0 2px white;">${ocup}%</span>
                </div>
              </div>
              
              <div class="text-center w-100">
                <div class="badge badge-light w-100 mb-1 border">${s.producto_actual_nombre || 'Sin producto'}</div>
                <div class="small"><b>${nivelKg}</b> de ${ (s.capacidad_max_kg / 1000).toFixed(0) }t</div>
              </div>
              
              ${s.alerta_rebalse ? '<div class="mt-2 text-danger small blink"><i class="fas fa-exclamation-triangle"></i> ¡REBALSE!</div>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function destroyDataTableIfExists(tableSelector) {
    if (!window.$ || !window.jQuery) return;
    if ($.fn.DataTable.isDataTable(tableSelector)) {
      $(tableSelector).DataTable().destroy();
    }
  }

  function initOrUpdateDataTable(tableSelector, existingDt) {
    if (!window.$ || !window.jQuery) return null;
    return $(tableSelector).DataTable({
      language: { url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json" },
      pageLength: 10,
      order: [[0, "desc"]]
    });
  }

  function renderLotes() {
    if (!tablaLotes) return;
    destroyDataTableIfExists("#tablaLotes");
    const tbody = tablaLotes.querySelector("tbody");
    if (!lotes || lotes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No hay lotes.</td></tr>';
      return;
    }
    tbody.innerHTML = lotes
      .map((l) => {
        const ubicacion = [l.sucursal_nombre, l.bodega_nombre, l.silo_codigo]
          .filter(Boolean)
          .join(" / ") || "Sin ubicación";
        const contraparte = l.tipo_recepcion === 'maquila' ? l.cliente_nombre : l.proveedor_nombre;
        const tipoBadge = l.tipo_recepcion === 'maquila' ? '<span class="badge badge-info">MAQUILA</span>' : '<span class="badge badge-success">COMPRA</span>';
        
        return `
          <tr>
            <td>${l.id}</td>
            <td>${l.codigo_lote}</td>
            <td>${l.recepcion_id || ""}</td>
            <td>${tipoBadge}<br>${contraparte || ""}</td>
            <td>${l.producto_nombre || ""}</td>
            <td>${ubicacion}</td>
            <td>${l.cantidad_inicial_kg ?? ""}</td>
            <td>${l.cantidad_actual_kg ?? ""}</td>
            <td>${l.estado}</td>
          </tr>`;
      })
      .join("");

    dtLotes = initOrUpdateDataTable("#tablaLotes", dtLotes);
  }

  function renderMovimientos() {
    if (!tablaMov) return;
    destroyDataTableIfExists("#tablaMovimientos");
    const tbody = tablaMov.querySelector("tbody");
    if (!movimientos || movimientos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay movimientos.</td></tr>';
      return;
    }
    tbody.innerHTML = movimientos
      .map((m) => {
        const fecha = m.fecha ? new Date(m.fecha).toLocaleString() : "";
        const siloOrigen = m.silo_origen_codigo || "";
        const siloDestino = m.silo_destino_codigo || "";
        return `
          <tr>
            <td>${fecha}</td>
            <td>${m.tipo_movimiento}</td>
            <td>${m.sucursal_nombre || ""}</td>
            <td>${siloOrigen}</td>
            <td>${siloDestino}</td>
            <td>${m.codigo_lote || ""}</td>
            <td>${m.cantidad_kg ?? ""}</td>
            <td>${m.observacion || ""}</td>
          </tr>`;
      })
      .join("");

    dtMovimientos = initOrUpdateDataTable("#tablaMovimientos", dtMovimientos);
  }

  function renderPendientes() {
    if (!tablaPendientes) return;
    destroyDataTableIfExists("#tablaPendientes");
    const tbody = tablaPendientes.querySelector("tbody");

    if (!pendientes || pendientes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay recepciones pendientes de almacenaje.</td></tr>';
      if (badgePendientes) {
        badgePendientes.classList.add("d-none");
        badgePendientes.textContent = "0";
      }
      return;
    }

    if (badgePendientes) {
      badgePendientes.classList.remove("d-none");
      badgePendientes.textContent = pendientes.length;
    }

    tbody.innerHTML = pendientes.map(r => {
      const fecha = r.fecha_entrada ? new Date(r.fecha_entrada).toLocaleDateString() : '-';
      const contraparte = r.tipo_recepcion === 'maquila' ? r.cliente_nombre : r.proveedor_nombre;
      const tipoIcon = r.tipo_recepcion === 'maquila' ? '<i class="fas fa-handshake text-info" title="Maquila"></i>' : '<i class="fas fa-shopping-cart text-success" title="Compra"></i>';
      
      return `
        <tr>
          <td>${r.id}</td>
          <td>${fecha}</td>
          <td>${tipoIcon} ${r.tipo_recepcion}</td>
          <td>${contraparte || '-'}</td>
          <td>${r.producto_nombre || '-'}</td>
          <td><b>${r.peso_neto_pagar_kg || 0}</b> kg</td>
          <td>
            <button class="btn btn-primary btn-sm btnDescargar" data-id="${r.id}">
              <i class="fas fa-arrow-down"></i> Almacenar
            </button>
          </td>
        </tr>
      `;
    }).join('');

    dtPendientes = initOrUpdateDataTable("#tablaPendientes", dtPendientes);

    // Eventos de botones descargar
    document.querySelectorAll(".btnDescargar").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        abrirModalDescarga(id);
      });
    });
  }

  async function abrirModalDescarga(recepcionId) {
    const r = pendientes.find(p => p.id === recepcionId);
    if (!r) return;

    modalDescargaRecId.textContent = r.id;
    modalDescargaProducto.textContent = r.producto_nombre || '-';
    modalDescargaInputRecId.value = r.id;
    modalDescargaInputCantidad.value = r.peso_neto_pagar_kg != null && r.peso_neto_pagar_kg !== '' ? Number(r.peso_neto_pagar_kg) : '';
    modalDescargaObservacion.value = "";

    // Llenar select de silos compatibles? Por ahora todos los silos
    const silosUnicos = [];
    const siloIdsVistos = new Set();
    mapaSilos.forEach((s) => {
      if (s.id && !siloIdsVistos.has(s.id)) {
        siloIdsVistos.add(s.id);
        silosUnicos.push({ id: s.id, label: `${s.sucursal_nombre || ""} / ${s.bodega_nombre || ""} / ${s.codigo}` });
      }
    });

    fillSelect(modalDescargaSelectSilo, silosUnicos, {
      placeholder: "Seleccione silo destino...",
      getLabel: (s) => s.label,
      getValue: (s) => s.id
    });

    modalDescargaSilo.modal("show");
  }

  function syncSelectsFromData() {
    const sucursalesUnicas = [];
    const sucursalIdsVistos = new Set();
    mapaSilos.forEach((s) => {
      if (s.sucursal_id && !sucursalIdsVistos.has(s.sucursal_id)) {
        sucursalIdsVistos.add(s.sucursal_id);
        sucursalesUnicas.push({ id: s.sucursal_id, nombre: s.sucursal_nombre });
      }
    });

    fillSelect(sucursalMapaSelect, sucursalesUnicas, {
      placeholder: "Todas",
      getLabel: (s) => s.nombre,
      getValue: (s) => s.id
    });

    const silosUnicos = [];
    const siloIdsVistos = new Set();
    mapaSilos.forEach((s) => {
      if (s.id && !siloIdsVistos.has(s.id)) {
        siloIdsVistos.add(s.id);
        silosUnicos.push({ id: s.id, label: `${s.sucursal_nombre || ""} / ${s.bodega_nombre || ""} / ${s.codigo}` });
      }
    });

    fillSelect(filtroSiloLotes, silosUnicos, {
      placeholder: "Todos",
      getLabel: (s) => s.label,
      getValue: (s) => s.id
    });

    fillSelect(filtroSiloMov, silosUnicos, {
      placeholder: "Silo (todos)",
      getLabel: (s) => s.label,
      getValue: (s) => s.id
    });

    fillSelect(siloDestinoSelect, silosUnicos, {
      placeholder: "Seleccione silo destino...",
      getLabel: (s) => s.label,
      getValue: (s) => s.id
    });

    fillSelect(siloOrigenTrasiegoSelect, silosUnicos, {
      placeholder: "Seleccione silo origen...",
      getLabel: (s) => s.label,
      getValue: (s) => s.id
    });

    fillSelect(siloDestinoTrasiegoSelect, silosUnicos, {
      placeholder: "Seleccione silo destino...",
      getLabel: (s) => s.label,
      getValue: (s) => s.id
    });

    fillSelect(siloDestinoMezclaSelect, silosUnicos, {
      placeholder: "Seleccione silo destino...",
      getLabel: (s) => s.label,
      getValue: (s) => s.id
    });

    const lotesActivos = lotes || [];
    const lotesOptions = lotesActivos.map((l) => ({
      id: l.id,
      label: `#${l.id} - ${l.codigo_lote}`
    }));

    fillSelect(filtroLoteMov, lotesOptions, {
      placeholder: "Lote (todos)",
      getLabel: (l) => l.label,
      getValue: (l) => l.id
    });

    fillSelect(loteTrasiegoSelect, lotesOptions, {
      placeholder: "Seleccione lote...",
      getLabel: (l) => l.label,
      getValue: (l) => l.id
    });

    fillSelect(loteOrigenASelect, lotesOptions, {
      placeholder: "Lote origen A...",
      getLabel: (l) => l.label,
      getValue: (l) => l.id
    });

    fillSelect(loteOrigenBSelect, lotesOptions, {
      placeholder: "Lote origen B...",
      getLabel: (l) => l.label,
      getValue: (l) => l.id
    });
  }

  async function cargarMapaSilos() {
    const sucursalId = sucursalMapaSelect?.value || "";
    const url = new URL("/api/wms/mapa-silos", window.location.origin);
    if (sucursalId) url.searchParams.set("sucursal_id", sucursalId);
    mapaSilos = await fetchJson(url.toString());
    renderMapaSilos();
    syncSelectsFromData();
  }

  async function cargarLotes() {
    const siloId = filtroSiloLotes?.value || "";
    const url = new URL("/api/wms/lotes", window.location.origin);
    if (siloId) url.searchParams.set("silo_id", siloId);
    lotes = await fetchJson(url.toString());
    renderLotes();
    syncSelectsFromData();
  }

  async function cargarMovimientos() {
    const siloId = filtroSiloMov?.value || "";
    const loteId = filtroLoteMov?.value || "";
    const url = new URL("/api/wms/movimientos", window.location.origin);
    if (siloId) url.searchParams.set("silo_id", siloId);
    if (loteId) url.searchParams.set("lote_id", loteId);
    movimientos = await fetchJson(url.toString());
    renderMovimientos();
  }

  async function cargarPendientes() {
    try {
      pendientes = await fetchJson("/api/wms/pendientes");
      renderPendientes();
    } catch (err) {
      console.error("Error cargando pendientes WMS:", err);
    }
  }

  btnConfirmarDescarga?.addEventListener("click", async () => {
    const recepcionId = Number(modalDescargaInputRecId.value);
    const siloId = Number(modalDescargaSelectSilo.value);
    const observacion = modalDescargaObservacion.value.trim();
    const cantidadKg = modalDescargaInputCantidad?.value ? Number(modalDescargaInputCantidad.value) : null;

    if (!siloId) {
      return Swal.fire("Silo requerido", "Debes seleccionar un silo de destino", "warning");
    }
    if (!cantidadKg || Number.isNaN(cantidadKg) || cantidadKg <= 0) {
      return Swal.fire("Cantidad requerida", "Ingrese la cantidad a descargar en kg (valor mayor a 0).", "warning");
    }

    try {
      btnConfirmarDescarga.disabled = true;
      const body = {
        recepcion_id: recepcionId,
        silo_destino_id: siloId,
        cantidad_kg: cantidadKg,
        observacion: observacion || null
      };
      await fetchJson("/api/wms/lotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      modalDescargaSilo.modal("hide");
      Swal.fire("✅ Descarga Exitosa", "El camión ha sido descargado al silo y el lote ha sido creado.", "success");
      
      await Promise.all([cargarMapaSilos(), cargarLotes(), cargarMovimientos(), cargarPendientes()]);
    } catch (err) {
      console.error(err);
      Swal.fire("❌ Error", err.message || "Error al registrar la descarga", "error");
    } finally {
      btnConfirmarDescarga.disabled = false;
    }
  });

  btnRefrescarPendientes?.addEventListener("click", () => {
    cargarPendientes().catch(err => console.error(err));
  });

  btnCrearLote?.addEventListener("click", async () => {
    const inputRecepcion = recepcionIdInput.value.trim();
    const siloDestinoId = siloDestinoSelect.value ? Number(siloDestinoSelect.value) : null;
    const cantidadKg = cantidadLoteInput.value ? Number(cantidadLoteInput.value) : null;

    if (!inputRecepcion) {
      return Swal.fire("Dato requerido", "Escanea el ticket o ingresa un ID válido", "warning");
    }
    if (!siloDestinoId) {
      return Swal.fire("Silo requerido", "Selecciona un silo destino", "warning");
    }

    try {
      btnCrearLote.disabled = true;
      const payload = {
        recepcion_id: inputRecepcion,
        silo_destino_id: siloDestinoId,
        cantidad_kg: cantidadKg,
        observacion: obsLoteInput.value.trim() || null
      };

      const res = await fetchJson("/api/wms/lotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      Swal.fire("✅ Lote creado", `Lote ${res.lote.codigo_lote} creado en el silo seleccionado`, "success");
      await Promise.all([cargarMapaSilos(), cargarLotes(), cargarMovimientos(), cargarPendientes()]);
    } catch (err) {
      console.error(err);
      Swal.fire("❌ Error", err.message || "Error al crear lote", "error");
    } finally {
      btnCrearLote.disabled = false;
    }
  });

  btnTrasiego?.addEventListener("click", async () => {
    const loteId = loteTrasiegoSelect.value ? Number(loteTrasiegoSelect.value) : null;
    const siloOrigenId = siloOrigenTrasiegoSelect.value ? Number(siloOrigenTrasiegoSelect.value) : null;
    const siloDestinoId = siloDestinoTrasiegoSelect.value ? Number(siloDestinoTrasiegoSelect.value) : null;
    const cantidadKg = cantidadTrasiegoInput.value ? Number(cantidadTrasiegoInput.value) : null;

    if (!loteId || !siloOrigenId || !siloDestinoId) {
      return Swal.fire("Datos incompletos", "Selecciona lote, silo origen y silo destino", "warning");
    }
    if (siloOrigenId === siloDestinoId) {
      return Swal.fire("Silos idénticos", "El silo de origen y destino no pueden ser el mismo", "warning");
    }
    if (!cantidadKg || cantidadKg <= 0) {
      return Swal.fire("Cantidad inválida", "Ingresa una cantidad válida en kg", "warning");
    }

    try {
      btnTrasiego.disabled = true;
      const payload = {
        lote_id: loteId,
        silo_origen_id: siloOrigenId,
        silo_destino_id: siloDestinoId,
        cantidad_kg: cantidadKg,
        observacion: obsTrasiegoInput.value.trim() || null
      };

      await fetchJson("/api/wms/movimientos/trasiego", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      Swal.fire("✅ Trasiego registrado", "El movimiento entre silos fue registrado.", "success");
      await Promise.all([cargarMapaSilos(), cargarLotes(), cargarMovimientos()]);
    } catch (err) {
      console.error(err);
      Swal.fire("❌ Error", err.message || "Error al registrar trasiego", "error");
    } finally {
      btnTrasiego.disabled = false;
    }
  });

  btnMezcla?.addEventListener("click", async () => {
    const loteAId = loteOrigenASelect.value ? Number(loteOrigenASelect.value) : null;
    const loteBId = loteOrigenBSelect.value ? Number(loteOrigenBSelect.value) : null;
    const cantidadAKg = cantidadAInput.value ? Number(cantidadAInput.value) : null;
    const cantidadBKg = cantidadBInput.value ? Number(cantidadBInput.value) : null;
    const siloDestinoId = siloDestinoMezclaSelect.value ? Number(siloDestinoMezclaSelect.value) : null;

    if (!loteAId || !loteBId || !siloDestinoId) {
      return Swal.fire("Datos incompletos", "Selecciona lotes de origen y silo destino", "warning");
    }

    if (loteAId === loteBId) {
      return Swal.fire("Lotes idénticos", "El lote de origen A y B deben ser diferentes para una mezcla", "warning");
    }

    // Verificar que el silo destino no sea el mismo que el de origen de los lotes
    const loteA = lotes.find(l => l.id === loteAId);
    const loteB = lotes.find(l => l.id === loteBId);

    if ((loteA && loteA.silo_id === siloDestinoId) || (loteB && loteB.silo_id === siloDestinoId)) {
      return Swal.fire("Silo de destino no válido", "El silo de destino no puede ser el mismo que el de origen de los lotes", "warning");
    }

    if (!cantidadAKg || !cantidadBKg || cantidadAKg <= 0 || cantidadBKg <= 0) {
      return Swal.fire("Cantidades inválidas", "Ingresa cantidades válidas para la mezcla", "warning");
    }

    try {
      btnMezcla.disabled = true;
      const payload = {
        silo_destino_id: siloDestinoId,
        lote_origen_a_id: loteAId,
        lote_origen_b_id: loteBId,
        cantidad_a_kg: cantidadAKg,
        cantidad_b_kg: cantidadBKg,
        codigo_lote: codigoMezclaInput.value.trim() || null,
        observacion: obsMezclaInput.value.trim() || null
      };

      const res = await fetchJson("/api/wms/movimientos/mezcla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      Swal.fire(
        "✅ Mezcla registrada",
        `Nuevo lote ${res.loteNuevo?.codigo_lote || ""} creado en el silo destino`,
        "success"
      );
      await Promise.all([cargarMapaSilos(), cargarLotes(), cargarMovimientos()]);
    } catch (err) {
      console.error(err);
      Swal.fire("❌ Error", err.message || "Error al registrar mezcla", "error");
    } finally {
      btnMezcla.disabled = false;
    }
  });

  sucursalMapaSelect?.addEventListener("change", () => {
    cargarMapaSilos().catch((err) => console.error(err));
  });

  filtroSiloLotes?.addEventListener("change", () => {
    cargarLotes().catch((err) => console.error(err));
  });

  filtroSiloMov?.addEventListener("change", () => {
    cargarMovimientos().catch((err) => console.error(err));
  });

  filtroLoteMov?.addEventListener("change", () => {
    cargarMovimientos().catch((err) => console.error(err));
  });

  // Listener para reconocer el código al escanear/escribir
  recepcionIdInput?.addEventListener("change", async () => {
    const valor = recepcionIdInput.value.trim();
    if (!valor) {
      if (feedbackContainer) feedbackContainer.innerHTML = "";
      return;
    }

    try {
      if (feedbackContainer) feedbackContainer.innerHTML = `<span class="text-muted"><i class="fas fa-spinner fa-spin"></i> Validando...</span>`;
      
      const res = await fetch(`/api/laboratorio/recepciones?search=${encodeURIComponent(valor)}`, { credentials: "include" });
      const data = await res.json();
      
      const r = data && data.length > 0 ? data[0] : null;
      
      if (r) {
        const netoKg = r.peso_neto_pagar_kg ?? r.peso_neto_fisico_kg;
        const sinLab = !r.laboratorio_id;
        feedbackContainer.innerHTML = `
          <div class="alert ${sinLab ? 'alert-info' : 'alert-success'} p-2 small mb-0">
            <i class="fas fa-${sinLab ? 'info-circle' : 'check-circle'}"></i>
            <strong>${sinLab ? 'Válido (sin laboratorio)' : 'Válido'}:</strong> ${r.producto_nombre} (${netoKg ?? 0} kg)
            ${sinLab ? '<br><span class="text-muted">Se usará el neto físico. El laboratorio es opcional en este molino.</span>' : ''}
            <br><small>${r.tipo_recepcion === 'maquila' ? r.cliente_nombre : r.proveedor_nombre}</small>
          </div>
        `;
        if (cantidadLoteInput && !cantidadLoteInput.value) {
           cantidadLoteInput.value = r.peso_neto_pagar_kg || r.peso_neto_fisico_kg;
        }
      } else {
        feedbackContainer.innerHTML = `
          <div class="alert alert-danger p-2 small mb-0">
            <i class="fas fa-times-circle"></i> No se encontró el ticket en el sistema.
          </div>
        `;
      }
    } catch (err) {
      if (feedbackContainer) feedbackContainer.innerHTML = `<span class="text-danger small">Error al validar código</span>`;
    }
  });

  Promise.all([
    cargarMapaSilos(),
    cargarLotes(),
    cargarMovimientos(),
    cargarPendientes()
  ]).catch((err) => {
    console.error("Error inicializando módulo WMS:", err);
    if (window.Swal) {
      Swal.fire("❌ Error", "No se pudo cargar el módulo de almacenamiento", "error");
    }
  });
})();
