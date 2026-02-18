# Copilot Instructions for Molino Migration Project

## 🏗 Architecture Overview

This project is a **hybrid Node.js/Express app** serving a custom **Vanilla JS Single Page Application (SPA)**. 
**Crucially, this is a SaaS (Software as a Service) platform.** It supports **Multi-Tenancy (Multi-Company)**, Multi-Branch (Sucursales), and Multi-Warehouse.

### Backend (`backend/`)
- **Server:** Express.js (`index.js`) serves both the JSON API (`/api/`) and static frontend files.
- **Database:** Neon (Serverless Postgres) accessed via raw SQL using `@neondatabase/serverless` (`db/connection.js`).
- **Auth:** JWT-based authentication stored in HTTP-only cookies. Middleware `requireAuth` protects routes.
- **Service Layer:** Business logic lives in `services/*.js` which directly execute SQL queries.
- **Realtime:** Ably is used for real-time functionality (`lib/ably.js`).

### Frontend (`frontend/`)
- **Framework:** Vanilla JavaScript (ES6+), jQuery (for legacy plugins), and Bootstrap.
- **Routing:** A custom "artisanal" router (`js/router.js`) intercepts clicks on elements with `[data-page]` and injects HTML into `.page-content` without page reloads.
- **Components:** Shared layouts (header, sidebar) are loaded via `js/include-html.js` using `data-include`.
- **Dynamic Loading:** View-specific logic (e.g., `js/usuarios.js`) is dynamically fetched and executed when loading the corresponding view (`views/usuarios.html`).

## 🛠 Critical Developer Workflows

- **Start Dev Server:** `npm run dev` (Runs backend with nodemon).
- **Frontend Build:** `npm run build:frontend` (Obfuscates JS files to `dist/js`).
- **Database Access:**
  - Connection is defined in `backend/db/connection.js`.
  - Use raw SQL template literals: `sql\`SELECT * FROM table\``.
  - **Migration:** No ORM. Schema changes should be manually managed or scripted in `backend/db/migrations/` (if widely used).
- **Data Export:** Standalone scripts in `backend/scripts/` (e.g., `export_users.js`) are used for maintenance tasks. Run via `node backend/scripts/filename.js`.

## 🧩 Project Patterns & Conventions

### 1. Navigation (Frontend)
**DO NOT** use standard `href` links for internal navigation.
*   ✅ **Correct:** `<a href="#" data-page="usuarios">Usuarios</a>`
*   ❌ **Incorrect:** `<a href="usuarios.html">Usuarios</a>`

The `router.js` handles loading: `views/{page}.html` + `js/{page}.js`.

### 2. Backend Service Pattern
Business logic functions should be exported from `services/` and return data directly from the DB driver.
```javascript
// backend/services/ejemploService.js
import { sql } from "../db/connection.js";

export async function obtenerDatos(user) {
  // ALWAYS filter by company_id
  return await sql`SELECT id, nombre FROM tabla WHERE company_id = ${user.company_id}`;
}
```

### 3. Multi-Tenancy (SaaS) Rules
**Strict Data Isolation:**
- All tables (except system-wide config) MUST have a `company_id` column.
- **Every SQL query** MUST interpret the `user` context and filter by `company_id`.
- Hierarchy: `Company` -> `Sucursal` (Branch) -> `Bodega` (Warehouse).
- Users belong to a Company. They may see data from all branches or specific ones depending on roles, but NEVER data from another Company.

### 4. Naming Conventions
- **Language:** Codebase uses **Spanish** for domain concepts (e.g., `usuarios`, `rut`, `nombres`, `historia`). Keep text strings and database columns in Spanish.
- **Files:** kebab-case or snake_case for files, camelCase for JS variables.

### 5. Integration Points
- **Ably:** Realtime events handled via `backend/lib/ably.js`.
- **Neon DB:** Direct connection string required in `.env` (`DATABASE_URL`).
- **External Scripts:** Many vendor scripts (DataTables, Select2) are in `assets/vendors/`. Check `index.html` headers before adding new CDN links.

### 6. Frontend & Plugins (DataTables/jQuery)
- **Initialization:** Since views are loaded dynamically, plugins like DataTables must be initialized **inside the specific view's JS file** (e.g., `js/usuarios.js`), NOT in `index.html`.
- **Cleanup:** Always destroy existing DataTable instances before re-initializing to avoid duplicates when navigating back and forth.
```javascript
if ($.fn.DataTable.isDataTable("#miTabla")) {
  $("#miTabla").DataTable().destroy();
}
// Init new table...
```

### 7. Authentication Flow
- **Check on Load:** `js/load-user.js` calls `/api/auth/me` on startup.
- **Redirect:** If the API returns `401` or `{ success: false }`, redirect to `login.html`.
- **User Object:** The logged-in user's role and info are available globally or passed to views via the auth response.

### 8. Control de Acceso por Rol (Frontend)
Siempre que agregues un módulo nuevo, debes configurar `mostrarElementosPorRol` en `page.js` para habilitar su visibilidad según el rol. Agrega los selectores de menú y tarjeta correspondientes.
Ejemplo:
rol_1: [
                ['#menuUsuarios', '#cardUsuarios'],
            ],
            rol_2: [
                // 👑 acceso a todo
                ['#menuUsuarios', '#cardUsuarios'],
            ],
            rol_3: [
            ]

## 🚨 Common Pitfalls
- **View JS Context:** Variables declared in view-specific scripts (`js/usuarios.js`) are in the global scope when loaded. Be careful with variable collisions or cleanup.
- **Routing:** The backend redirects root access (`/`) to `/dashboard`, which serves `index.html`. 
- **DOM Dependencies:** Since content is loaded dynamically, bind events using delegation (`document.body.addEventListener`) or initialize plugins *after* content injection (inside the script loaded by the router).

## 🎯 Objetivos del Software (Business Logic)

### 1. Módulo de Recepción y Laboratorio (La Entrada Crítica)
Este es el módulo más importante para controlar los costos. Si compras agua (humedad) o piedras (impurezas) a precio de trigo, pierdes dinero.

*   **Gestión de Báscula (Romana):**
    *   **Conexión:** Idealmente integración con el indicador digital de la balanza (vía puerto serial/USB) para evitar que el operador escriba el peso a mano (evita fraudes).
    *   **Pesaje Bruto:** Peso del camión cargado al entrar.
    *   **Pesaje Tara:** Peso del camión vacío al salir.
    *   **Peso Neto Físico:** La resta simple (Bruto - Tara).
*   **Laboratorio de Calidad (El "Castigo"):**
    *   Antes de liquidar, se registran los parámetros de la muestra:
        *   **Humedad (%):** Si el estándar es 14% y trae 16%, el software debe calcular automáticamente el descuento de kilos (el "secado").
        *   **Impurezas/Basura (%):** Pajas, piedras, tierra. Se descuenta directamente del peso.
        *   **Peso Hectolítrico (PH):** Densidad del grano. Define si el trigo es "Premium", "Estándar" o "Forrajero" (cambia el precio de compra).
        *   **Proteína/Gluten:** Opcional, pero vital si vendes a panaderías industriales.
*   **Liquidación Automática:**
    *   El sistema genera el documento de recepción: "Trajo 30.000 Kg brutos, pero aplicamos 1.200 Kg de castigo por humedad y 500 Kg por impurezas. Pagaremos por 28.300 Kg."

### 2. Módulo de Almacenamiento Inteligente (WMS)
El trigo no es igual en todos lados. Este módulo gestiona dónde está qué cosa.

*   **Mapa de Silos y Bodegas:**
    *   Visualización de cada silo por Sucursal.
    *   **Capacidad Máxima vs. Actual:** Alerta si un silo está por rebalsar.
*   **Gestión de Lotes (Trazabilidad):**
    *   Cuando el camión descarga en el "Silo 1", el sistema sabe que en el Silo 1 ahora hay "Trigo del Proveedor X recibido el día Y".
    *   Si sale harina mala, puedes rastrear qué trigo se usó.
*   **Movimientos / Kardex:**
    *   **Trasiego:** Mover trigo del Silo 1 (Sucio) al Silo 2 (Limpio/Acondicionado).
    *   **Mezcla (Blending):** Sacar 50% del Silo A (Trigo Duro) y 50% del Silo B (Trigo Blando) para crear una mezcla para molienda.

### 3. Módulo de Producción (El Corazón Industrial)
Aquí ocurre la transformación. Dejas de tener inventario de "Trigo" y pasas a tener "Harina".

*   **Órdenes de Producción (OP):**
    *   El Jefe de Molino abre una OP: "Hoy produciremos 10 toneladas de Harina 000".
    *   Esto bloquea preventivamente el trigo necesario.
*   **Fórmulas / Recetas:**
    *   Configuración previa: Para hacer 100kg de Harina, necesito 130kg de Trigo Sucio.
*   **Registro de Rendimiento (Yield):**
    *   Al finalizar el turno, se declara:
        *   Trigo Molido: 10.000 Kg.
        *   Harina Obtenida: 7.200 Kg (72%).
        *   Semita/Aflecho: 2.100 Kg (21%).
        *   Pérdida/Merma: 700 Kg (7%).
*   **Alertas de Eficiencia:**
    *   El sistema debe gritar si la Merma supera el umbral configurado (ej: 2%). Si hay mucha merma, o se están robando harina, o la maquinaria tiene fugas, o el trigo tenía mucha basura no detectada.

### 4. Módulo Comercial Multisucursal (Ventas)
Para vender lo que produces.

*   **Listas de Precios Dinámicas:**
    *   Precio Base.
    *   Precio Mayorista (compra > 100 sacos).
    *   Precio Sucursal Norte vs. Sucursal Sur (por costo de flete).
*   **Gestión de Crédito:**
    *   Bloqueo automático de venta si el cliente tiene facturas vencidas o superó su cupo de crédito (consolidado entre todas las sucursales).
*   **Preventa vs. Venta Mostrador:**
    *   **Preventa:** Vendedor toma pedido en la calle -> Bodega prepara -> Camión entrega -> Se factura.
    *   **Mostrador:** Cliente viene -> Paga -> Se lleva el saco.

### 5. Módulo Logístico y Despacho
Coordinar los camiones que llevan la harina a los clientes o entre sucursales.

*   **Hoja de Ruta:**
    *   Asignar facturas a un camión específico.
    *   Control de Carga: Asegurar que el camión no salga con más peso del legal.
*   **Transferencia entre Sucursales:**
    *   Estado "En Tránsito". La mercadería sale del inventario de la Matriz, pero no entra al inventario la Sucursal B hasta que allá le den "Aceptar Recepción". Esto evita robos en el camino.

### 6. Módulo de Mantenimiento y Maquinaria
Los molinos son máquinas caras que requieren cuidado.

*   **Contadores de Horas:** Registro de horas trabajadas por cada banco de molienda.
*   **Plan de Mantenimiento:**
    *   Alerta: "Tocar cambio de filtros en 50 horas".
    *   Alerta: "Rectificación de rodillos requerida".
*   **Paradas de Planta:** Registro de por qué se detuvo el molino (Falta de luz, falta de trigo, rotura). Esto calcula la Eficiencia General de los Equipos (OEE).

### 7. Módulo Administrativo y Tesorería
*   **Caja Blindada:**
    *   Cada vendedor tiene su caja.
    *   **Arqueo ciego:** El vendedor pone cuánto dinero cree tener, el sistema dice cuánto debería haber y calcula la diferencia.
*   **Reportes de Inteligencia:**
    *   Rentabilidad por Lote de Trigo.
    *   Rentabilidad por Sucursal.
    *   Ranking de mejores clientes.

### 8. Gestión de Suscripciones SaaS (Super Admin)
Control centralizado para el dueño del software (Tú).

*   **Gestión de Planes:**
    *   Definición de niveles (Bronze, Silver, Gold).
    *   **Límites por Plan:** Cantidad máxima de usuarios, sucursales o kilos procesados por mes. 
*   **Ciclo de Vida del Tenant:**
    *   Alta de nueva empresa -> Creación automática de usuario admin.
    *   Suspensión automática por falta de pago (Bloqueo de acceso al login).
*   **Facturación Recurrente:**
    *   Control de fechas de vencimiento.
    *   Historial de pagos de la suscripción.
