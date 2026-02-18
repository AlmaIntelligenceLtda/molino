import { up } from "../db/migrations/20260130_maquila_tipos_trabajo.js";

async function run() {
  try {
    await up();
    console.log("✅ Migración maquila_tipos_trabajo aplicada correctamente.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en la migración:", error);
    process.exit(1);
  }
}

run();
