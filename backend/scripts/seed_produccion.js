import { sql } from "../db/connection.js";

async function seed() {
  console.log("🌱 Sembrando datos de prueba para Producción...");

  const [empresa] = await sql`SELECT id FROM empresas LIMIT 1`;
  if (!empresa) {
    console.log("❌ No hay empresas para sembrar.");
    process.exit(1);
  }

  // 1. Productos Agrícolas (Si no hay)
  const [trigo] = await sql`
     INSERT INTO productos_agricolas (empresa_id, nombre, codigo)
     VALUES (${empresa.id}, 'Trigo Panadero', 'TRG-P01')
     ON CONFLICT DO NOTHING
     RETURNING id
  `;
  const trigoId = trigo?.id || (await sql`SELECT id FROM productos_agricolas WHERE nombre = 'Trigo Panadero' LIMIT 1`)[0].id;

  // 2. Productos Terminados
  const [harina] = await sql`
    INSERT INTO productos_terminados (empresa_id, nombre, codigo_sku, tipo, stock_actual)
    VALUES (${empresa.id}, 'Harina de Trigo 000', 'HRN-000', 'Harina', 0)
    RETURNING id
  `;

  // 3. Fórmulas
  const [formula] = await sql`
    INSERT INTO formulas (empresa_id, producto_terminado_id, nombre, descripcion, merma_tolerable_pct)
    VALUES (${empresa.id}, ${harina.id}, 'Molienda Estándar 000', 'Proporción base 1.3:1', 2.0)
    RETURNING id
  `;

  // 4. Ingredientes de la fórmula
  await sql`
    INSERT INTO formula_ingredientes (empresa_id, formula_id, producto_agricola_id, proporcion_kg_por_unidad)
    VALUES (${empresa.id}, ${formula.id}, ${trigoId}, 1.3)
  `;

  console.log("✅ Datos de prueba sembrados correctamente.");
  process.exit(0);
}

seed();
