import { sql } from "../connection.js";

export async function up() {
  await sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)`;
}

export async function down() {
  await sql`ALTER TABLE empresas DROP COLUMN IF EXISTS logo_url`;
}
