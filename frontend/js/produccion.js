(function() {
    let extractionChart, mermaChart;

    async function init() {
        console.log("🏭 Inicializando Módulo de Producción...");
        
        // 1. Cargar Catálogos
        await cargarSucursales();
        await cargarFormulas();
        
        // 2. Inicializar Gráficos (Gauges)
        initGauges();
        
        // 3. Cargar Dashboard y Listados
        actualizarDashboard();
        listarOPs();

        // Eventos
        $("#btnNuevaOP").on("click", () => {
            $("#modalNuevaOP").modal("show");
            $("#previewFormulaNuevaOP").hide();
            $("#formNuevaOP")[0].reset();
            currentFormula = null;
        });
        
        $("#selOpFormula").on("change", function() {
            const id = $(this).val();
            if (id) mostrarPreviewFormula(id);
            else {
                currentFormula = null;
                $("#previewFormulaNuevaOP").hide();
            }
        });

        $("#formNuevaOP [name='cantidad_objetivo']").on("input", renderizarPreviewFormula);

        // Click en sugerencias de producción
        $(document).on("click", ".btn-sugerencia-meta", function() {
            const val = $(this).data("value");
            $("#inputMetaOP").val(val);
            renderizarPreviewFormula();
        });

        $("#formNuevaOP").on("submit", guardarNuevaOP);
        $("#formFinalizarOP").on("submit", finalizarOP);
        $("#btnAddLoteInsumo").on("click", agregarFilaLote);
        $("#btnAddSubproducto").on("click", agregarFilaSubproducto);

        // Eventos Fórmulas
        $("#btnNuevaFormula").on("click", abrirModalFormula);
        $("#btnAddIngrediente").on("click", agregarFilaIngrediente);
        $("#formNuevaFormula").on("submit", guardarNuevaFormula);

        // Ver Detalles Fórmula (Delegado)
        $(document).on("click", ".btn-ver-formula", function() {
            const id = $(this).data("id");
            verDetallesFormula(id);
        });

        // Ver Detalles OP (Delegado)
        $(document).on("click", ".btn-ver-op", function() {
            const id = $(this).data("id");
            verDetallesOrden(id);
        });

        // Eliminar Fórmula (Delegado)
        $(document).on("click", ".btn-eliminar-formula", function() {
            const id = $(this).data("id");
            const nombre = $(this).data("nombre");
            confirmarEliminarFormula(id, nombre);
        });

        // Cálculos en tiempo real en el modal de cierre
        $("#inputTrigoMolido, #inputHarinaObtenida").on("input", calcularYieldPreview);
    }

    function initGauges() {
        const commonOptions = {
            rotation: 1 * Math.PI,
            circumference: 1 * Math.PI,
            cutoutPercentage: 80,
            tooltips: { enabled: false },
            hover: { mode: null },
            animation: { animateRotate: true, animateScale: false }
        };

        // Gauge Extracción
        const ctxExt = document.getElementById('gaugeExtraction').getContext('2d');
        extractionChart = new Chart(ctxExt, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [0, 100],
                    backgroundColor: ['#4169E1', '#e9ecef'],
                    borderWidth: 0
                }]
            },
            options: commonOptions
        });

        // Gauge Merma
        const ctxMerma = document.getElementById('gaugeMerma').getContext('2d');
        mermaChart = new Chart(ctxMerma, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [0, 100],
                    backgroundColor: ['#ffc107', '#e9ecef'],
                    borderWidth: 0
                }]
            },
            options: commonOptions
        });
    }

    function updateGauge(chart, value, color, elementVal) {
        chart.data.datasets[0].data = [value, 100 - value];
        chart.data.datasets[0].backgroundColor[0] = color;
        chart.update();
        $(elementVal).text(value.toFixed(1) + '%');
    }

    async function cargarSucursales() {
        try {
            const res = await fetch("/api/mantenedores/sucursales");
            const data = await res.json();
            const $sel = $("#selOpSucursal");
            $sel.empty().append('<option value="">Seleccione...</option>');
            data.forEach(s => $sel.append(`<option value="${s.id}">${s.nombre}</option>`));
        } catch (e) { console.error(e); }
    }

    async function cargarFormulas() {
        try {
            const res = await fetch("/api/produccion/formulas");
            const json = await res.json();
            const $sel = $("#selOpFormula");
            const $container = $("#formulasContainer");
            
            $sel.empty().append('<option value="">Seleccione...</option>');
            $container.empty();

            if (json.success) {
                json.data.forEach(f => {
                    $sel.append(`<option value="${f.id}">${f.nombre}</option>`);
                    
                    $container.append(`
                        <div class="col-md-4 mb-4" id="formula-card-${f.id}">
                            <div class="card op-card h-100">
                                <div class="card-body position-relative">
                                    <button class="btn btn-link text-danger position-absolute btn-eliminar-formula" 
                                            style="top: 10px; right: 10px; z-index: 10;" 
                                            data-id="${f.id}" data-nombre="${f.nombre}">
                                        <i class="fas fa-times"></i>
                                    </button>
                                    <h5 class="text-primary pr-4">${f.nombre}</h5>
                                    <p class="small text-muted">${f.descripcion || 'Sin descripción'}</p>
                                    <div class="d-flex justify-content-between border-top pt-2 mt-2">
                                        <span>Merma Tol: <b>${f.merma_tolerable_pct}%</b></span>
                                        <button class="btn btn-xs btn-outline-info btn-ver-formula" data-id="${f.id}">Ver Detalles</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `);
                });
            }
        } catch (e) { console.error(e); }
    }

    let currentFormula = null;

    async function mostrarPreviewFormula(id) {
        try {
            const res = await fetch(`/api/produccion/formulas/${id}`);
            const json = await res.json();
            if (json.success) {
                currentFormula = json.data;
                
                // Sugerir 10,000 por defecto si está vacío
                const $inputMeta = $("#inputMetaOP");
                if (!$inputMeta.val()) {
                    $inputMeta.val(10000);
                }

                renderizarPreviewFormula();
                $("#previewFormulaNuevaOP").fadeIn();
            }
        } catch (e) { console.error(e); }
    }

    function renderizarPreviewFormula() {
        if (!currentFormula) return;
        
        const meta = parseFloat($("#formNuevaOP [name='cantidad_objetivo']").val()) || 0;
        const $lista = $("#listaPreviewFormula");
        $lista.empty();
        
        currentFormula.ingredientes.forEach(ing => {
            const totalEstimado = (meta * ing.proporcion_kg_por_unidad).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            
            $lista.append(`
                <li class="list-group-item d-flex justify-content-between align-items-center py-2 bg-light border-0 mb-1">
                    <div>
                        <i class="fas fa-seedling text-success mr-2"></i> 
                        <span class="font-weight-bold">${ing.producto_agricola_nombre}</span>
                        ${meta > 0 ? `<br><small class="text-primary"><i class="fas fa-calculator mr-1"></i> Carga necesaria: <b>${totalEstimado} Kg</b></small>` : ''}
                    </div>
                    <span class="badge badge-dark badge-pill">${ing.proporcion_kg_por_unidad} Kg / Kg Harina</span>
                </li>
            `);
        });
    }

    async function actualizarDashboard() {
        try {
            const res = await fetch("/api/produccion/stats");
            const json = await res.json();
            if (json.success && json.data.ultimo) {
                const u = json.data.ultimo;
                
                // Calcular % extracción
                const extraccion = (u.harina_total_kg / u.trigo_molido_kg) * 100;
                const merma = (u.merma_kg / u.trigo_molido_kg) * 100;

                updateGauge(extractionChart, extraccion, '#4169E1', '#valExtraction');
                
                let mermaColor = '#ffc107';
                if (merma > (u.merma_tolerable_pct || 2.0)) mermaColor = '#dc3545';
                updateGauge(mermaChart, merma, mermaColor, '#valMerma');

                $("#valHarinaActual").text(u.harina_total_kg + " Kg");
                $("#valTrigoActual").text(u.trigo_molido_kg + " Kg");
                $("#valMermaLimite").text(u.merma_tolerable_pct || "2.0");
            }
        } catch (e) { console.error(e); }
    }

    async function listarOPs() {
        try {
            const res = await fetch("/api/produccion/ordenes");
            const json = await res.json();
            if (!json.success) return;

            const $tabBody = $("#tablaOrdenesProduccion tbody");
            const $activasContainer = $("#opActivasContainer");
            
            $tabBody.empty();
            $activasContainer.empty();

            let activasCount = 0;

            json.data.forEach(op => {
                const badgeClass = op.estado === 'finalizada' ? 'badge-success' : 'badge-warning';
                
                // Llenar tabla general
                $tabBody.append(`
                    <tr>
                        <td><b>${op.numero_op}</b></td>
                        <td>${new Date(op.created_at).toLocaleDateString()}</td>
                        <td>${op.producto_nombre}</td>
                        <td>${op.formula_nombre}</td>
                        <td>${op.cantidad_objetivo}</td>
                        <td><span class="badge ${badgeClass}">${op.estado.toUpperCase()}</span></td>
                        <td>
                            <div class="btn-group">
                                ${op.estado === 'abierta' ? `<button class="btn btn-xs btn-success btn-finalizar" data-id="${op.id}" data-numero="${op.numero_op}" data-merma="${op.merma_tolerable_pct}">Cerrar Turno</button>` : `<button class="btn btn-xs btn-outline-info btn-ver-op" data-id="${op.id}">Ver Detalles</button>`}
                            </div>
                        </td>
                    </tr>
                `);

                // Llenar tarjetas de activas
                if (op.estado === 'abierta') {
                    activasCount++;
                    $activasContainer.append(`
                        <div class="col-md-4 mb-4">
                            <div class="card op-card">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-center mb-3">
                                        <span class="badge badge-outline-primary">${op.numero_op}</span>
                                        <small class="text-muted"><i class="fas fa-clock"></i> ${new Date(op.created_at).toLocaleTimeString()}</small>
                                    </div>
                                    <h5 class="card-title">${op.producto_nombre}</h5>
                                    <h6 class="card-subtitle mb-2 text-muted">${op.formula_nombre}</h6>
                                    
                                    <div class="progress progress-sm my-3" style="height: 6px;">
                                        <div class="progress-bar bg-primary progress-bar-animated progress-bar-striped" style="width: 65%"></div>
                                    </div>
                                    
                                    <div class="d-flex justify-content-between small mb-3">
                                        <span>Meta: <b>${op.cantidad_objetivo} Kg</b></span>
                                        <span>Resp: ${op.responsable_nombre.split(' ')[0]}</span>
                                    </div>
                                    <button class="btn btn-block btn-primary btn-sm btn-finalizar" data-id="${op.id}" data-numero="${op.numero_op}" data-merma="${op.merma_tolerable_pct}">
                                        <i class="fas fa-file-signature"></i> DECLARAR PRODUCCIÓN
                                    </button>
                                </div>
                            </div>
                        </div>
                    `);
                }
            });

            if (activasCount === 0) {
                $activasContainer.html('<div class="col-md-12 text-center text-muted py-5"><i class="fas fa-info-circle"></i> No hay órdenes de producción abiertas en este momento.</div>');
            }

            // Bind de botones finalizar
            $(".btn-finalizar").on("click", function() {
                const id = $(this).data("id");
                const num = $(this).data("numero");
                const mermaTol = $(this).data("merma");
                
                $("#hiddenOpId").val(id);
                $("#hiddenMermaTol").val(mermaTol);
                $("#modalFinalizarOP").modal("show");
                
                prepararModalCierre(id);
            });

        } catch (e) { console.error(e); }
    }

    async function guardarNuevaOP(e) {
        e.preventDefault();
        const data = {
            sucursal_id: $("#selOpSucursal").val(),
            formula_id: $("#selOpFormula").val(),
            cantidad_objetivo: $("#formNuevaOP [name='cantidad_objetivo']").val(),
            fecha_planificada: $("#formNuevaOP [name='fecha_planificada']").val()
        };

        try {
            const res = await fetch("/api/produccion/ordenes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            const json = await res.json();
            if (json.success) {
                Swal.fire("Éxito", "Orden de producción abierta exitosamente", "success");
                $("#modalNuevaOP").modal("hide");
                listarOPs();
            } else {
                Swal.fire("Error", json.message, "error");
            }
        } catch (e) { console.error(e); }
    }

    async function finalizarOP(e) {
        e.preventDefault();
        
        // Recoger lotes de insumos
        const lotes = [];
        $("#lotesProduccionContainer .fila-lote").each(function() {
            const id = $(this).find(".sel-lote").val();
            const cant = $(this).find(".input-cant").val();
            if (id && cant) lotes.push({ lote_id: id, cantidad_kg: Number(cant) });
        });

        // Recoger subproductos
        const subs = [];
        const spNombres = $("#formFinalizarOP [name='sp_nombre[]']").map((i, el) => $(el).val()).get();
        const spCants = $("#formFinalizarOP [name='sp_cantidad[]']").map((i, el) => $(el).val()).get();
        spNombres.forEach((n, i) => {
            if (n && spCants[i] > 0) subs.push({ nombre: n, cantidad_kg: Number(spCants[i]) });
        });

        const data = {
            orden_produccion_id: $("#hiddenOpId").val(),
            trigo_molido_kg: $("#inputTrigoMolido").val(),
            harina_total_kg: $("#inputHarinaObtenida").val(),
            lotes_insumos: lotes,
            subproductos: subs
        };

        try {
            const res = await fetch("/api/produccion/rendimientos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            const json = await res.json();
            if (json.success) {
                Swal.fire("¡Molienda Registrada!", "Los stocks han sido actualizados.", "success");
                $("#modalFinalizarOP").modal("hide");
                listarOPs();
                actualizarDashboard();
            } else {
                Swal.fire("Error", json.message, "error");
            }
        } catch (e) { console.error(e); }
    }

    function agregarFilaLote() {
        const idUnico = Date.now();
        $("#lotesProduccionContainer").append(`
            <div class="d-flex mb-2 fila-lote" id="fila-${idUnico}">
                <select class="form-control mr-2 sel-lote" required>
                    <option value="">Cargando lotes...</option>
                </select>
                <input type="number" class="form-control input-cant" placeholder="Kg" required style="width: 120px;">
                <button type="button" class="btn btn-link text-danger p-0 ml-2" onclick="$('#fila-${idUnico}').remove()"><i class="fas fa-trash"></i></button>
            </div>
        `);
        // Cargar lotes activos del WMS
        cargarLotesDisponibles($(`#fila-${idUnico} .sel-lote`));
    }

    async function cargarLotesDisponibles($select) {
        try {
            const res = await fetch("/api/wms/lotes?estado=activo");
            const data = await res.json();
            $select.empty().append('<option value="">Seleccione Lote...</option>');
            data.forEach(l => {
                $select.append(`<option value="${l.id}">${l.codigo_lote} (${l.cantidad_actual_kg} Kg - ${l.producto_nombre})</option>`);
            });
        } catch (e) { $select.html('<option>Error al cargar</option>'); }
    }

    function agregarFilaSubproducto() {
        const idUnico = Date.now();
        $("#subproductosContainer").append(`
            <div class="d-flex mb-2" id="sp-${idUnico}">
                <input type="text" class="form-control mr-2" placeholder="Nombre" name="sp_nombre[]">
                <input type="number" class="form-control" placeholder="Kg" name="sp_cantidad[]" style="width: 120px;">
                <button type="button" class="btn btn-link text-danger p-0 ml-2" onclick="$('#sp-${idUnico}').remove()"><i class="fas fa-trash"></i></button>
            </div>
        `);
    }

    function calcularYieldPreview() {
        const trigo = Number($("#inputTrigoMolido").val()) || 0;
        const harina = Number($("#inputHarinaObtenida").val()) || 0;
        const mermaLimite = Number($("#hiddenMermaTol").val()) || 2.0;
        
        // Sumar subproductos para merma
        let subtotal = harina;
        $("#formFinalizarOP [name='sp_cantidad[]']").each(function() {
            subtotal += Number($(this).val()) || 0;
        });

        if (trigo > 0) {
            const extraccion = (harina / trigo) * 100;
            const merma = ((trigo - subtotal) / trigo) * 100;

            $("#prevExtraccion").text(extraccion.toFixed(1) + "%");
            $("#prevMerma").text(merma.toFixed(1) + "%");

            if (merma > mermaLimite) {
                $("#prevMerma").addClass("text-danger").removeClass("text-warning");
                $("#prevStatus").text("EXCESO MERMA").removeClass("badge-success").addClass("badge-danger");
            } else {
                $("#prevMerma").removeClass("text-danger").addClass("text-warning");
                $("#prevStatus").text("EFICIENTE").addClass("badge-success").removeClass("badge-danger");
            }
        }
    }

    async function abrirModalFormula() {
        $("#modalNuevaFormula").modal("show");
        $("#ingredientesFormulaContainer").empty();
        agregarFilaIngrediente();
        
        // Cargar productos terminados
        try {
            const res = await fetch("/api/produccion/productos-terminados");
            const json = await res.json();
            const $sel = $("#selFormulaProducto");
            $sel.empty().append('<option value="">Seleccione...</option>');
            if (json.success) {
                json.data.forEach(p => $sel.append(`<option value="${p.id}">${p.nombre}</option>`));
            }
        } catch (e) { console.error(e); }
    }

    function agregarFilaIngrediente() {
        const id = Date.now();
        $("#ingredientesFormulaContainer").append(`
            <div class="d-flex mb-2 fila-ingrediente" id="ing-${id}">
                <select class="form-control mr-2 sel-prod-agricola" required>
                    <option value="">Cargando trigos...</option>
                </select>
                <input type="number" step="0.01" class="form-control" name="proporcion[]" placeholder="Kg x Kg Harina" required style="width: 150px;">
                <button type="button" class="btn btn-link text-danger p-0 ml-2" onclick="$('#ing-${id}').remove()"><i class="fas fa-trash"></i></button>
            </div>
        `);
        cargarProductosAgricolas($(`#ing-${id} .sel-prod-agricola`));
    }

    async function cargarProductosAgricolas($select) {
        try {
            const res = await fetch("/api/produccion/productos-agricolas");
            const json = await res.json();
            $select.empty().append('<option value="">Seleccione Insumo...</option>');
            if (json.success) {
                json.data.forEach(p => $select.append(`<option value="${p.id}">${p.nombre}</option>`));
            }
        } catch (e) { console.error(e); }
    }

    async function guardarNuevaFormula(e) {
        e.preventDefault();
        
        const ingredientes = [];
        $("#ingredientesFormulaContainer .fila-ingrediente").each(function() {
            const prodId = $(this).find(".sel-prod-agricola").val();
            const prop = $(this).find("[name='proporcion[]']").val();
            if (prodId && prop) {
                ingredientes.push({ producto_agricola_id: prodId, proporcion: Number(prop) });
            }
        });

        const formData = {
            nombre: $("#formNuevaFormula [name='nombre']").val(),
            producto_terminado_id: $("#formNuevaFormula [name='producto_terminado_id']").val(),
            descripcion: $("#formNuevaFormula [name='descripcion']").val(),
            merma_tolerable_pct: $("#formNuevaFormula [name='merma_tolerable_pct']").val(),
            ingredientes: ingredientes
        };

        try {
            const res = await fetch("/api/produccion/formulas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            const json = await res.json();
            if (json.success) {
                Swal.fire("Éxito", "Fórmula guardada correctamente", "success");
                $("#modalNuevaFormula").modal("hide");
                cargarFormulas(); // Recargar tarjetas
            } else {
                Swal.fire("Error", json.message, "error");
            }
        } catch (e) { console.error(e); }
    }

    async function verDetallesFormula(id) {
        try {
            const res = await fetch(`/api/produccion/formulas/${id}`);
            const json = await res.json();
            if (json.success) {
                const f = json.data;
                $("#detallesFormulaTitulo").text(f.nombre);
                $("#detallesFormulaDesc").text(f.descripcion || 'Sin descripción adicional.');
                $("#detallesFormulaMerma").text(f.merma_tolerable_pct);
                
                const $lista = $("#listaIngredientesFormula");
                $lista.empty();
                if (f.ingredientes && f.ingredientes.length > 0) {
                    f.ingredientes.forEach(ing => {
                        $lista.append(`
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                ${ing.producto_agricola_nombre}
                                <span class="badge badge-primary badge-pill">${ing.proporcion_kg_por_unidad} Kg / Ton producida</span>
                            </li>
                        `);
                    });
                } else {
                    $lista.append('<li class="list-group-item text-muted">No hay ingredientes definidos</li>');
                }
                
                $("#modalDetallesFormula").modal("show");
            }
        } catch (e) {
            console.error(e);
            Swal.fire("Error", "No se pudieron cargar los detalles", "error");
        }
    }

    async function verDetallesOrden(id) {
        // Por ahora un simple alert, o podríamos cargar un modal con el yield real
        Swal.fire("Resumen de Molienda", "Función para ver el yield histórico detallado estará disponible en la próxima actualización de reportes.", "info");
    }

    async function confirmarEliminarFormula(id, nombre) {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: `Vas a eliminar la fórmula "${nombre}". Esta acción no se puede deshacer.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, borrar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                const res = await fetch(`/api/produccion/formulas/${id}`, { method: "DELETE" });
                const json = await res.json();
                if (json.success) {
                    $(`#formula-card-${id}`).fadeOut(300, function() { $(this).remove(); });
                    cargarFormulas(); // Para actualizar el select de Nueva OP
                    Swal.fire("Eliminado", "La fórmula ha sido borrada.", "success");
                } else {
                    Swal.fire("Error", json.message, "error");
                }
            } catch (e) {
                console.error(e);
                Swal.fire("Error", "No se pudo eliminar la fórmula", "error");
            }
        }
    }

    function prepararModalCierre(opId) {
        $("#lotesProduccionContainer").empty();
        agregarFilaLote();
        calcularYieldPreview();
    }

    // Iniciar
    init();

})();
