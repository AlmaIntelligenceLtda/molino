#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { sql } from "../db/connection.js";

function escapeCsv(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(keys, rows) {
  const header = keys.join(",");
  const lines = rows.map(r => keys.map(k => escapeCsv(r[k])).join(","));
  return [header, ...lines].join("\n");
}

async function getPublicTables() {
  const res = await sql.query(`SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename`, ["public"]);
  return res.map(r => r.tablename);
}

async function getTableColumns(table) {
  const res = await sql.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
    ["public", table]
  );
  return res.map(r => r.column_name);
}

async function exportTable(table, outDir, timestamp) {
  console.log(`Exportando tabla: ${table}`);
  const keys = await getTableColumns(table);
  if (!keys || keys.length === 0) {
    console.log(` - Saltando ${table}: sin columnas detectadas`);
    return { table, rows: 0, path: null };
  }

  // Seleccionamos todas las columnas
  const q = `SELECT * FROM "${table}"`;
  const rows = await sql.query(q);

  const filename = path.join(outDir, `${table}_export_${timestamp}.csv`);
  const csv = rowsToCsv(keys, rows);
  await fs.promises.writeFile(filename, csv, "utf8");
  console.log(` - Escrito ${rows.length} filas -> ${filename}`);
  return { table, rows: rows.length, path: filename };
}

async function main() {
  try {
    console.log("Iniciando export de todas las tablas (schema public)...");
    const tables = await getPublicTables();
    if (!tables || tables.length === 0) {
      console.log("No se encontraron tablas en el esquema public.");
      return;
    }

    const outDir = path.resolve("backend", "exports");
    await fs.promises.mkdir(outDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    const results = [];
    for (const t of tables) {
      try {
        const r = await exportTable(t, outDir, timestamp);
        results.push(r);
      } catch (err) {
        console.error(`Error exportando tabla ${t}:`, err.message || err);
        results.push({ table: t, error: String(err) });
      }
    }

    console.log("Export completo. Resumen:");
    for (const r of results) {
      if (r.error) console.log(` - ${r.table}: ERROR -> ${r.error}`);
      else console.log(` - ${r.table}: ${r.rows} filas -> ${r.path}`);
    }
  } catch (err) {
    console.error("Error en export_all:", err);
    process.exit(1);
  }
}

main();
