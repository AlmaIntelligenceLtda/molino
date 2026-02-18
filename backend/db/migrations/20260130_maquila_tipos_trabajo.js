import { sql } from "../connection.js";

export async function up() {
  console.log("🚀 Aplicando migración Maquila tipos de trabajo...");

  await sql`
    CREATE TABLE IF NOT EXISTS maquila_tipos_trabajo (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
      nombre VARCHAR(80) NOT NULL,
      porcentaje DECIMAL(5,2) NOT NULL,
      producto_harina_id INTEGER REFERENCES productos_terminados(id),
      activo BOOLEAN DEFAULT TRUE,
      orden INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
}

export async function down() {
  await sql`DROP TABLE IF EXISTS maquila_tipos_trabajo CASCADE;`;
}
