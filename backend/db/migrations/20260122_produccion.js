import { sql } from "../connection.js";

export async function up() {
  console.log("🚀 Aplicando migración de Producción...");

  // 1. Ampliar formulas para incluir ingredientes y proporciones
  // Usaremos un enfoque de tabla relacional para ingredientes para mayor flexibilidad futura
  await sql`
    CREATE TABLE IF NOT EXISTS formula_ingredientes (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
      formula_id INTEGER REFERENCES formulas(id) ON DELETE CASCADE,
      producto_agricola_id INTEGER REFERENCES productos_agricolas(id),
      proporcion_kg_por_unidad DECIMAL(12,4) NOT NULL, -- Ej: 1.3 kg de trigo por 1 kg de harina
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    ALTER TABLE formulas 
    ADD COLUMN IF NOT EXISTS merma_tolerable_pct DECIMAL(5,2) DEFAULT 2.0;
  `;

  // 2. Tabla para vincular Lotes consumidos con Órdenes de Producción (Trazabilidad)
  await sql`
    CREATE TABLE IF NOT EXISTS orden_produccion_insumos (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
      orden_produccion_id INTEGER REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
      lote_id INTEGER REFERENCES lotes(id),
      cantidad_utilizada_kg INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // 3. Tabla para subproductos obtenidos (Flexibilidad solicitada)
  await sql`
    CREATE TABLE IF NOT EXISTS produccion_subproductos_obtenidos (
      id SERIAL PRIMARY KEY,
      rendimiento_id INTEGER REFERENCES rendimientos(id) ON DELETE CASCADE,
      nombre VARCHAR(100) NOT NULL, -- 'Afrecho', 'Semita', etc.
      cantidad_kg INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // 4. Asegurar que las órdenes tengan los campos necesarios
  await sql`
    ALTER TABLE ordenes_produccion
    ADD COLUMN IF NOT EXISTS codigo_lote_final VARCHAR(50); -- El lote de harina resultante
  `;

  console.log("✅ Migración de Producción completada.");
}
