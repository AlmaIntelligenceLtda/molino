(() => {
  const tablaConfigs = {};

  function initTable(selector) {
    if (!window.$ || !$.fn.DataTable) return;
    if ($.fn.DataTable.isDataTable(selector)) {
      $(selector).DataTable().destroy();
    }
    tablaConfigs[selector] = $(selector).DataTable({
      language: { url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json" },
      pageLength: 10,
      order: [[0, "desc"]]
    });
  }

  async function cargarTabla(url, tableSelector, tbodySelector, rowBuilder) {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    let data = await res.json();
    
    // Si la respuesta viene envuelta en { success: true, data: [...] }
    if (data.success && Array.isArray(data.data)) {
        data = data.data;
    }

    const tbody = document.querySelector(tbodySelector);
    if (!tbody) return;
    tbody.innerHTML = data.map(rowBuilder).join("");
    initTable(tableSelector);
  }

  async function refrescarTodo() {
    await Promise.all([
      cargarProveedores(),
      cargarProductos(),
      cargarProdTerminados(),
      cargarChoferes(),
      cargarCamiones(),
      cargarCarros(),
      cargarClientes(),
      cargarSucursalesMant(),
      cargarBodegas(),
      cargarSilos(),
      cargarSucursalesParaBodegas(),
      cargarConfig()
    ]);
  }

  async function cargarConfig() {
    const cb = document.getElementById("configMaquilaRequiereAcreditar");
    if (!cb) return;
    try {
      const res = await fetch("/api/empresa/config", { credentials: "include" });
      if (!res.ok) {
        cb.checked = true;
        return;
      }
      const config = await res.json();
      cb.checked = config.maquila_requiere_acreditar !== false;
    } catch (err) {
      console.warn("No se pudo cargar configuración:", err);
      cb.checked = true;
    }
  }

  async function cargarProveedores() {
    await cargarTabla(
      "/api/recepciones/catalogos/proveedores",
      "#tablaProveedores",
      "#tablaProveedores tbody",
      (p) => `
        <tr>
          <td>${p.id}</td>
          <td>${p.rut || ""}</td>
          <td>${p.razon_social || ""}</td>
          <td>${p.alias || ""}</td>
          <td>${p.telefono || ""}</td>
          <td>${p.email || ""}</td>
        </tr>
      `
    );
  }

  async function cargarProductos() {
    await cargarTabla(
      "/api/recepciones/catalogos/productos",
      "#tablaProductos",
      "#tablaProductos tbody",
      (p) => `
        <tr>
          <td>${p.id}</td>
          <td>${p.nombre || ""}</td>
          <td>${p.codigo || ""}</td>
          <td>${p.descripcion || ""}</td>
        </tr>
      `
    );
  }

  async function cargarProdTerminados() {
    await cargarTabla(
      "/api/produccion/productos-terminados",
      "#tablaProdTerminados",
      "#tablaProdTerminados tbody",
      (p) => `
        <tr>
          <td><b>${p.codigo_sku || ""}</b></td>
          <td>${p.nombre || ""}</td>
          <td><span class="badge badge-outline-info">${p.tipo || "Harina"}</span></td>
          <td>${p.stock_actual} Kg</td>
        </tr>
      `,
      "data" // El API de producción devuelve {success: true, data: [...]}
    );
  }

  async function cargarChoferes() {
    await cargarTabla(
      "/api/recepciones/catalogos/choferes",
      "#tablaChoferes",
      "#tablaChoferes tbody",
      (c) => `
        <tr>
          <td>${c.id}</td>
          <td>${c.codigo_chofer || ""}</td>
          <td>${c.nombre || ""}</td>
          <td>${c.rut || ""}</td>
          <td>${c.telefono || ""}</td>
          <td>${c.email || ""}</td>
        </tr>
      `
    );
  }

  async function cargarCamiones() {
    await cargarTabla(
      "/api/recepciones/catalogos/camiones",
      "#tablaCamiones",
      "#tablaCamiones tbody",
      (c) => `
        <tr>
          <td>${c.id}</td>
          <td>${c.codigo_camion || ""}</td>
          <td>${c.patente || ""}</td>
          <td>${c.marca || ""}</td>
          <td>${c.modelo || ""}</td>
          <td>${c.capacidad_carga_kg ?? ""}</td>
        </tr>
      `
    );
  }

  async function cargarCarros() {
    await cargarTabla(
      "/api/recepciones/catalogos/carros",
      "#tablaCarros",
      "#tablaCarros tbody",
      (c) => `
        <tr>
          <td>${c.id}</td>
          <td>${c.codigo_carro || ""}</td>
          <td>${c.patente || ""}</td>
          <td>${c.marca || ""}</td>
          <td>${c.modelo || ""}</td>
          <td>${c.capacidad_carga_kg ?? ""}</td>
        </tr>
      `
    );
  }

  async function cargarClientes() {
    await cargarTabla(
      "/api/clientes",
      "#tablaClientesMant",
      "#tablaClientesMant tbody",
      (c) => `
        <tr>
          <td>${c.id}</td>
          <td>${c.rut || ""}</td>
          <td>${c.razon_social || ""}</td>
          <td>${c.nombre_fantasia || ""}</td>
          <td>${c.telefono || ""}</td>
          <td>${c.email_facturacion || ""}</td>
        </tr>
      `
    );
  }

  async function cargarSucursalesMant() {
    await cargarTabla(
      "/api/mantenedores/sucursales",
      "#tablaSucursalesMant",
      "#tablaSucursalesMant tbody",
      (s) => `
        <tr>
          <td>${s.id}</td>
          <td>${s.nombre || ""}</td>
          <td>${s.direccion || ""}</td>
          <td>${s.ciudad || ""}</td>
          <td>${s.telefono || ""}</td>
          <td>${s.es_matriz ? "Sí" : "No"}</td>
        </tr>
      `
    );
  }

  async function cargarBodegas() {
    await cargarTabla(
      "/api/mantenedores/bodegas",
      "#tablaBodegasMant",
      "#tablaBodegasMant tbody",
      (b) => `
        <tr>
          <td>${b.id}</td>
          <td>${b.sucursal_nombre || ""}</td>
          <td>${b.nombre || ""}</td>
          <td>${b.descripcion || ""}</td>
        </tr>
      `
    );
  }

  async function cargarSilos() {
    await cargarTabla(
      "/api/mantenedores/silos",
      "#tablaSilosMant",
      "#tablaSilosMant tbody",
      (s) => `
        <tr>
          <td>${s.id}</td>
          <td>${s.sucursal_nombre || ""}</td>
          <td>${s.bodega_nombre || ""}</td>
          <td>${s.codigo || ""}</td>
          <td>${s.capacidad_max_kg ?? ""}</td>
          <td>${s.nivel_actual_kg ?? 0}</td>
          <td>${s.estado || ""}</td>
        </tr>
      `
    );
  }

  async function cargarSucursalesParaBodegas() {
    const res = await fetch("/api/mantenedores/sucursales", { credentials: "include" }).catch(() => null);
    if (!res || !res.ok) return;
    const data = await res.json();
    const selectSucursal = document.getElementById("bodegaSucursalMant");
    if (!selectSucursal) return;
    selectSucursal.innerHTML = "";
    selectSucursal.appendChild(new Option("(Opcional) Asociar a sucursal", ""));
    data.forEach((s) => {
      selectSucursal.appendChild(new Option(s.nombre, String(s.id)));
    });

    // También rellenar el select de bodega para silos cuando existan bodegas
    const selectBodega = document.getElementById("siloBodegaMant");
    if (selectBodega) {
      const resB = await fetch("/api/mantenedores/bodegas", { credentials: "include" }).catch(() => null);
      if (!resB || !resB.ok) return;
      const bodegas = await resB.json();
      selectBodega.innerHTML = "";
      selectBodega.appendChild(new Option("Seleccione bodega...", ""));
      bodegas.forEach((b) => {
        const label = b.sucursal_nombre ? `${b.sucursal_nombre} / ${b.nombre}` : b.nombre;
        selectBodega.appendChild(new Option(label, String(b.id)));
      });
    }
  }

  async function postJson(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || "Error al guardar");
    }

    return await res.json();
  }

  document.getElementById("formProveedorMant")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      rut: document.getElementById("provRutMant").value.trim(),
      razon_social: document.getElementById("provRazonMant").value.trim(),
      alias: document.getElementById("provAliasMant").value.trim(),
      telefono: document.getElementById("provTelefonoMant").value.trim(),
      email: document.getElementById("provEmailMant").value.trim()
    };

    try {
      await postJson("/api/recepciones/catalogos/proveedores", payload);
      document.getElementById("formProveedorMant").reset();
      await cargarProveedores();
      Swal.fire("✅ Proveedor creado", "", "success");
    } catch (err) {
      Swal.fire("❌ Error", err.message, "error");
    }
  });

  document.getElementById("formProductoMant")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      nombre: document.getElementById("prodNombreMant").value.trim(),
      codigo: document.getElementById("prodCodigoMant").value.trim(),
      descripcion: document.getElementById("prodDescripcionMant").value.trim()
    };

    try {
      await postJson("/api/recepciones/catalogos/productos", payload);
      document.getElementById("formProductoMant").reset();
      await cargarProductos();
      Swal.fire("✅ Producto creado", "", "success");
    } catch (err) {
      Swal.fire("❌ Error", err.message, "error");
    }
  });

  document.getElementById("formChoferMant")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      nombre: document.getElementById("choferNombreMant").value.trim(),
      rut: document.getElementById("choferRutMant").value.trim(),
      telefono: document.getElementById("choferTelefonoMant").value.trim(),
      email: document.getElementById("choferEmailMant").value.trim()
    };

    try {
      await postJson("/api/recepciones/catalogos/choferes", payload);
      document.getElementById("formChoferMant").reset();
      await cargarChoferes();
      Swal.fire("✅ Chofer creado", "", "success");
    } catch (err) {
      Swal.fire("❌ Error", err.message, "error");
    }
  });

  document.getElementById("formCamionMant")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      patente: document.getElementById("camionPatenteMant").value.trim(),
      marca: document.getElementById("camionMarcaMant").value.trim(),
      modelo: document.getElementById("camionModeloMant").value.trim(),
      capacidad_carga_kg: Number(document.getElementById("camionCapacidadMant").value) || null
    };

    try {
      await postJson("/api/recepciones/catalogos/camiones", payload);
      document.getElementById("formCamionMant").reset();
      await cargarCamiones();
      Swal.fire("✅ Camión creado", "", "success");
    } catch (err) {
      Swal.fire("❌ Error", err.message, "error");
    }
  });

  document.getElementById("formCarroMant")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      patente: document.getElementById("carroPatenteMant").value.trim(),
      marca: document.getElementById("carroMarcaMant").value.trim(),
      modelo: document.getElementById("carroModeloMant").value.trim(),
      capacidad_carga_kg: Number(document.getElementById("carroCapacidadMant").value) || null
    };

    try {
      await postJson("/api/recepciones/catalogos/carros", payload);
      document.getElementById("formCarroMant").reset();
      await cargarCarros();
      Swal.fire("✅ Carro creado", "", "success");
    } catch (err) {
      Swal.fire("❌ Error", err.message, "error");
    }
  });

  document.getElementById("formClienteMant")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      rut: document.getElementById("cliRutMant").value.trim(),
      razon_social: document.getElementById("cliRazonMant").value.trim(),
      nombre_fantasia: document.getElementById("cliFantasiaMant").value.trim(),
      telefono: document.getElementById("cliTelefonoMant").value.trim(),
      email_facturacion: document.getElementById("cliEmailMant").value.trim()
    };

    try {
      await postJson("/api/clientes", payload);
      document.getElementById("formClienteMant").reset();
      await cargarClientes();
      Swal.fire("✅ Cliente creado", "", "success");
    } catch (err) {
      Swal.fire("❌ Error", err.message, "error");
    }
  });

  document.getElementById("formSucursalMant")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      nombre: document.getElementById("sucursalNombreMant").value.trim(),
      ciudad: document.getElementById("sucursalCiudadMant").value.trim(),
      telefono: document.getElementById("sucursalTelefonoMant").value.trim(),
      direccion: document.getElementById("sucursalDireccionMant").value.trim(),
      es_matriz: document.getElementById("sucursalMatrizMant").checked
    };

    try {
      await postJson("/api/mantenedores/sucursales", payload);
      document.getElementById("formSucursalMant").reset();
      await Promise.all([cargarSucursalesMant(), cargarSucursalesParaBodegas()]);
      Swal.fire("✅ Sucursal creada", "", "success");
    } catch (err) {
      Swal.fire("❌ Error", err.message, "error");
    }
  });

  document.getElementById("formProdTerminadoMant")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      nombre: document.getElementById("ptNombreMant").value.trim(),
      codigo_sku: document.getElementById("ptSkuMant").value.trim(),
      tipo: document.getElementById("ptTipoMant").value,
    };

    try {
      await postJson("/api/produccion/productos-terminados", payload);
      document.getElementById("formProdTerminadoMant").reset();
      await cargarProdTerminados();
      Swal.fire("✅ Producto terminado creado", "", "success");
    } catch (err) {
      Swal.fire("❌ Error", err.message, "error");
    }
  });

  document.getElementById("formBodegaMant")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      nombre: document.getElementById("bodegaNombreMant").value.trim(),
      sucursal_id: document.getElementById("bodegaSucursalMant").value
        ? Number(document.getElementById("bodegaSucursalMant").value)
        : null,
      descripcion: document.getElementById("bodegaDescripcionMant").value.trim()
    };

    try {
      await postJson("/api/mantenedores/bodegas", payload);
      document.getElementById("formBodegaMant").reset();
      await Promise.all([cargarBodegas(), cargarSucursalesParaBodegas()]);
      Swal.fire("✅ Bodega creada", "", "success");
    } catch (err) {
      Swal.fire("❌ Error", err.message, "error");
    }
  });

  document.getElementById("formSiloMant")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      codigo: document.getElementById("siloCodigoMant").value.trim(),
      bodega_id: document.getElementById("siloBodegaMant").value
        ? Number(document.getElementById("siloBodegaMant").value)
        : null,
      capacidad_max_kg: Number(document.getElementById("siloCapacidadMant").value) || null,
      descripcion: document.getElementById("siloDescripcionMant").value.trim()
    };

    try {
      await postJson("/api/mantenedores/silos", payload);
      document.getElementById("formSiloMant").reset();
      await cargarSilos();
      Swal.fire("✅ Silo creado", "", "success");
    } catch (err) {
      Swal.fire("❌ Error", err.message, "error");
    }
  });

  document.getElementById("tabConfigLink")?.addEventListener("click", () => {
    cargarConfig();
  });

  document.getElementById("btnGuardarConfig")?.addEventListener("click", async () => {
    const cb = document.getElementById("configMaquilaRequiereAcreditar");
    if (!cb) return;
    try {
      const res = await fetch("/api/empresa/config", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maquila_requiere_acreditar: cb.checked })
      });
      if (!res.ok) throw new Error(await res.text());
      if (window.Swal) Swal.fire("Guardado", "Configuración actualizada.", "success");
    } catch (err) {
      if (window.Swal) Swal.fire("Error", err.message || "No se pudo guardar", "error");
    }
  });

  refrescarTodo().catch((err) => {
    console.error("❌ Error cargando mantenedores:", err);
    Swal.fire("Error", "No se pudieron cargar los mantenedores", "error");
  });
})();
