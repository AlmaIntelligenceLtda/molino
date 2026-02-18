# Módulo 1 — Recepción (Báscula/Romana) + Laboratorio + Liquidación

Fecha: 2026-01-15

## 1) Objetivo
Diseñar un flujo **profesional, controlado por escaneo y por etapas**, que reduzca errores de tipeo y fraude, y que soporte operación real:
- Llega de todo: camión 3/4, camión con rampla/carro, sin carro.
- Clientes nuevos y clientes antiguos que llegan en distintos vehículos.
- Choferes que se turnan camiones/carros.

Principio: **no amarrar chofer↔camión↔carro como relaciones fijas**; cada recepción registra la combinación usada en ese evento.

## 2) Entidades (Mantenedores) y datos mínimos
### 2.1 Chofer
- `id`, `company_id`
- `codigo_chofer` (único por empresa) — imprimible (QR + Code128)
- `rut` (si aplica), `nombres`, `telefono`
- `activo` (bool)
- (opcional) `transportista_id` o `proveedor_id` (si se quiere control por tercero)

### 2.2 Camión
- `id`, `company_id`
- `codigo_camion` (único por empresa) — imprimible (QR + Code128)
- `patente` (única por empresa)
- `tipo` (ej. 3/4, tolva, etc.)
- `activo`

### 2.3 Carro/Rampla (opcional por recepción)
- `id`, `company_id`
- `codigo_carro` (único por empresa) — imprimible (QR + Code128)
- `patente` (única por empresa)
- `tipo`
- `activo`

### 2.4 Proveedor / Cliente
- Existente (ya en el sistema) o mantenedor a crear.
- **Nota operativa:** proveedor/cliente puede llegar con distintos vehículos; eso NO cambia el mantenedor del proveedor.

## 3) Entidad de proceso: Recepción (Ticket)
Cada camión que entra genera (o abre) una **Recepción**.

### 3.1 Modo de operación: Compra vs. Maquila (rendimiento de harina)
En la operación puede existir más de un objetivo para la recepción:

- **Compra de trigo (clásico):** se define `peso_neto_pagable_kg` y un precio; se paga dinero por kilos (ajustados por castigos).
- **Maquila / Cliente deja trigo y retira harina:** el laboratorio define un **rendimiento** (ej. 54%, 60%, etc.) y el sistema calcula cuánta **harina equivalente** se le acredita al cliente por los kilos ingresados.

Para soportar ambos sin romper el flujo, la recepción debería tener un campo:
- `tipo_recepcion`: `COMPRA` | `MAQUILA` | `INTERNA` (opcional)

Y, cuando aplique (típicamente en `MAQUILA`):
- `rendimiento_harina_pct` (ej. 54)
- `harina_equivalente_kg` (derivado)
- (opcional) `subproductos_pct` o desglose (afrecho/semita/merma) si se quiere transparentar qué pasa con el resto.

**Base de cálculo recomendada:** aplicar el rendimiento sobre el peso "limpio/seco" (después de castigos), es decir:
$$\text{harina\_equivalente\_kg} = \text{peso\_neto\_pagable\_kg} \times \frac{\text{rendimiento\_harina\_pct}}{100}$$

Ejemplo: si un cliente entrega 100 kg y queda `peso_neto_pagable_kg = 100`, con rendimiento 54% ⇒ `harina_equivalente_kg = 54`.

> Nota: si la planta aplica el rendimiento sobre neto físico (antes de castigos) o usa una tabla propia, se parametriza (ver sección 10).

### 3.2 Maquila real: cuenta corriente de harina y retiros parciales
Si el cliente **deja trigo** y luego **retira harina en sacos de a poco**, el sistema debe manejar una **cuenta corriente (saldo)** por cliente.

Concepto: la recepción (trigo) es el **depósito**; el laboratorio define un rendimiento (pactado); cuando la harina está lista se **acredita** harina al saldo del cliente; cada retiro **descuenta** del saldo.

#### 3.2.1 Saldos
Se recomienda llevar saldos como un libro contable (ledger) en vez de “actualizar un número” sin trazabilidad.

- Saldo principal: **kilos de harina** disponibles para retiro.
- Opcional: saldo de **trigo depositado** (si se quiere trazabilidad completa depósito→producción).

Dimensiones recomendadas del saldo:
- `company_id`
- `cliente_id`
- `producto_id` (tipo de harina: 000/0000/etc.)
- `sucursal_id` / `bodega_id` (si el retiro depende de dónde quedó físicamente la harina)

#### 3.2.2 Movimientos (ledger)
Tabla sugerida: `maquila_movimientos`.

Campos sugeridos:
- `company_id`, `cliente_id`
- `tipo_movimiento`
- `kg` (positivo/negativo según tipo)
- referencias: `recepcion_id` (depósito), `produccion_id` (cuando exista), `despacho_id`/`venta_id` (retiro)
- `observacion`, `creado_por`, `creado_en`

Tipos recomendados:
- `DEPOSITO_TRIGO_KG` (opcional)
- `CREDITO_HARINA_ESTIMADO_KG` (opcional; si se quiere “reservar” antes de producir)
- `CREDITO_HARINA_CONFIRMADO_KG` (cuando la harina está lista)
- `RETIRO_HARINA_KG` (negativo)
- `AJUSTE_KG` (con motivo y rol supervisor)

#### 3.2.3 Cuándo se acredita la harina
Para que sea fiel a la operación (“cuando la harina está lista”), el crédito recomendado es:
- Se registra la recepción como `MAQUILA`.
- Se calcula `harina_equivalente_kg` según rendimiento.
- La recepción queda **pendiente de producción**.
- Cuando producción confirme que la harina está lista (lote/OP), se crea `CREDITO_HARINA_CONFIRMADO_KG` al saldo del cliente.

Si aún no existe módulo de producción, se puede partir con una aproximación:
- Crédito manual confirmado por un rol autorizado (“Harina lista”), dejando auditoría.

#### 3.2.4 Retiros en sacos
El retiro debería registrarse como una operación que descuenta del saldo:
- Entrada por escaneo/selección de cliente.
- Selección de producto (tipo de harina) y bodega.
- Ingreso por **sacos** (ej. 25 kg / 50 kg) y cantidad → convierte a kg.
- Genera un comprobante/vale y (si aplica) un movimiento de inventario.

Regla: no permitir retiros que dejen saldo negativo (salvo override con motivo).

Campos recomendados:
- Identidad: `company_id`, `sucursal_id`, `bodega_id` (si aplica)
- Referencias: `proveedor_id` (si corresponde), `chofer_id`, `camion_id`, `carro_id` (nullable)
- Ticket: `ticket_codigo` (corto humano) y `ticket_token` (para QR seguro)
- Estado: ver sección 4
- Pesos: `peso_bruto_kg`, `peso_tara_kg`, `peso_neto_fisico_kg`
- Lab: `humedad_pct`, `impurezas_pct`, `ph`, `proteina` (opcional)
- Cálculos: descuentos y `peso_neto_pagable_kg`
- Auditoría: `creado_por`, `pesado_por`, `lab_por`, `liquidado_por`, timestamps

Además, se recomienda una tabla de eventos:
- `pesajes` (tipo BRUTO/TARA, peso, origen BASCULA/MANUAL, raw, device_id, usuario, timestamp)

## 4) Estados y control (máquina de estados)
Estados propuestos:
- `CREADA` → se identificó chofer/vehículo(s)
- `BRUTO_CAPTURADO`
- `EN_LAB` (opcional si lab ocurre entre pesos)
- `TARA_CAPTURADA`
- `CALCULADA` (netos + descuentos calculados)
- `LIQUIDADA` (congelada)
- `ANULADA`

Regla: una vez `LIQUIDADA`, no se edita; sólo ajuste por mecanismo controlado (reliquidación o nota), a definir.

## 5) Flujo UX por etapas (Wizard)
### 5.1 Entrada (Bruto)
**Etapa 1 — Identificación**
- Escanear `codigo_chofer`.
- Si no existe: opción **Alta Rápida** (sección 6).

**Etapa 2 — Vehículo(s)**
- Escanear `codigo_camion`.
- Escanear `codigo_carro` si aplica (opción “Sin carro”).
- Si camión/carro no existe: **Alta Rápida**.

**Etapa 3 — Contexto comercial (según operación)**
- Seleccionar proveedor/cliente desde mantenedor.
- (Opcional) escanear orden/guía si existe QR.

**Etapa 4 — Confirmación**
- Mostrar resumen: Chofer + Camión + Carro + Proveedor.
- Botón “Siguiente” habilitado sólo si lo mínimo está OK.

**Etapa 5 — Captura Bruto**
- Peso en vivo si hay integración.
- Botón “Capturar Bruto”.
- Si manual: exige motivo + registra auditoría.

**Etapa 6 — Emisión Ticket**
- Generar ticket con:
  - Texto corto (ej. `R-20260115-0831`)
  - QR con `recepcion_id` + `ticket_token`
- Recomendación: imprimir ticket si hay impresora; si no, mostrar QR en pantalla.

### 5.2 Laboratorio
- Abrir recepción por escaneo del **ticket**.
- Registrar humedad/impurezas/PH/proteína (opcional).
- Validaciones de rango (ej. humedad 0–40, impurezas 0–20, etc. a definir).
- Botón “Calcular castigos” (server-side).

### 5.3 Salida (Tara + Cierre)
**Etapa 1 — Abrir por ticket (obligatorio)**
- Escanear ticket.
- **Respaldo:** buscar por patente/chofer/fecha si ticket dañado, con motivo obligatorio.

**Etapa 2 — Capturar Tara**
- Botón “Capturar Tara” (báscula o manual auditado).
- Calcular neto físico: `bruto - tara`.

**Etapa 3 — Cálculo final y Liquidación**
- Si lab está listo: calcular neto pagable y liquidar.
- Si lab no está: dejar en estado pendiente (política a definir).

### 5.4 (Si aplica) Maquila: acreditar harina y permitir retiros
Esto no siempre ocurre el mismo día que la recepción.

**Acreditación (cuando harina está lista)**
- Acción “Marcar harina lista / Acreditar” (rol autorizado).
- Crea movimiento `CREDITO_HARINA_CONFIRMADO_KG` para el cliente.
- (Opcional) liga a lote/OP de producción.

**Retiros parciales**
- Pantalla “Retiros de harina (maquila)”.
- Seleccionar/escaneo cliente → muestra saldo por tipo de harina.
- Registrar retiro por sacos → descuenta saldo (`RETIRO_HARINA_KG`).

## 6) Alta Rápida (para clientes/vehículos nuevos sin frenar operación)
Esto es clave para “llega de todo”.

### 6.1 Alta rápida de chofer
Campos mínimos:
- `rut` (si se usa), `nombres`, `telefono`.
- Generar `codigo_chofer` automáticamente.

Política recomendada:
- Crear con estado `pendiente_validacion` (o `activo=true` pero con flag de revisión).
- Registrar quién lo creó y desde qué recepción.
- Permitir imprimir/mostrar el código inmediatamente.

### 6.2 Alta rápida de camión/carro
Campos mínimos:
- `patente`, `tipo`.
- Generar `codigo_camion` / `codigo_carro` automáticamente.

Regla:
- Si existe patente en la empresa, no crear duplicado (abrir el existente).

## 7) Respaldo (cuando el escaneo falla)
En cualquier escaneo:
- Botón “No puedo escanear” → buscador.
- Al seleccionar manualmente: exige motivo.
- Auditoría obligatoria.

Esto permite operar sin parar, pero conserva control.

## 8) Seguridad y antifraude
- Todo peso manual requiere motivo (y opcionalmente rol supervisor).
- Toda apertura por búsqueda (no ticket) requiere motivo.
- Guardar `raw_payload` de báscula cuando exista integración.
- Alertas de rango: pesos negativos, netos improbables, humedad/impurezas fuera de rango.

## 9) Integración de báscula (enfoque SaaS)
Recomendación: **Gateway local** en PC de báscula (Windows) que lea puerto serial/USB y publique peso al backend.
- El frontend muestra “peso en vivo”.
- El botón “Capturar” fija el valor estable.

Alternativa: backend local por sucursal (más simple, más caro de mantener).

## 10) Pendientes por definir (para cerrar antes de programar)
1) ¿Ticket impreso siempre, o QR en pantalla como mínimo? (ideal: ambos)
2) Reglas exactas de castigos:
   - Humedad: fórmula vs tabla por rangos
   - Impurezas: proporcional directo vs tabla
   - PH: sólo clasificación o ajuste de precio
3) Política si no hay laboratorio al momento de tara:
   - ¿Se permite cerrar neto físico y dejar liquidación pendiente?
4) Rendimiento (maquila):
   - ¿El módulo 1 debe soportar `MAQUILA` desde el MVP, o se deja para V2?
   - ¿El rendimiento se calcula por tabla (según humedad/impurezas/PH/proteína) o lo ingresa el laboratorista?
   - ¿La base del rendimiento es `peso_neto_pagable_kg` (recomendado) o `peso_neto_fisico_kg`?
   - ¿Se acredita “saldo de harina” al cliente (cuenta corriente), o sólo se informa el %?
4) Roles/Permisos:
   - ¿Quién puede crear alta rápida?
   - ¿Quién puede capturar manual?
   - ¿Quién puede anular/liquidar?
