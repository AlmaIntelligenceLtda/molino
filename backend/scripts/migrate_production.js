import { up } from "../db/migrations/20260122_produccion.js";

async function run() {
  try {
    await up();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en la migración:", error);
    process.exit(1);
  }
}

run();
