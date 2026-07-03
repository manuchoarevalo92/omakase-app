#!/usr/bin/env node
/**
 * Siembra la tabla stock_items a partir de lo que ya está cargado en
 * pedidos_proveedores (ya viene agrupado por proveedor y con unidad definida).
 * No toca compras_historial: los ítems de un pedido en curso no son un
 * historial de compra confirmado, solo el catálogo (nombre + proveedor + unidad).
 *
 * Uso: node scripts/seed-stock-desde-pedidos.mjs [--dry-run]
 */
import { readFileSync } from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // sin .env.local
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const dryRun = process.argv.includes("--dry-run");

if (!supabaseUrl || !anonKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  "Content-Type": "application/json",
};

async function supaGet(pathAndQuery) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${pathAndQuery}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${pathAndQuery} → ${res.status}: ${body}`);
  }
  return res.json();
}

async function supaInsert(table, rows) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST ${table} → ${res.status}: ${body}`);
  }
  return res.json();
}

const clave = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Fallback por proveedor cuando no hay match de nombre contra ingredientes. */
const RUBRO_POR_PROVEEDOR = {
  Arrom: "Pescado/Marisco",
  Verdulería: "Fruta/Vegetal",
};

async function main() {
  console.log("Leyendo pedidos_proveedores, stock_items e ingredientes...");
  let pedidos;
  let stockActual;
  let ingredientes;
  try {
    [pedidos, stockActual, ingredientes] = await Promise.all([
      supaGet("pedidos_proveedores?select=proveedor,items"),
      supaGet("stock_items?select=nombre"),
      supaGet("ingredientes?select=nombre,rubro"),
    ]);
  } catch (err) {
    console.error(String(err.message ?? err));
    console.error(
      "\n¿Corriste ya supabase/stock-items.sql y supabase/stock-items-rls-anon.sql en el SQL Editor?"
    );
    process.exit(1);
  }

  const rubroPorNombre = new Map(
    ingredientes.map((i) => [clave(i.nombre), i.rubro || "Despensa/Prep"])
  );
  const yaExiste = new Set(stockActual.map((s) => clave(s.nombre)));

  const nuevos = [];
  const colisiones = [];
  const vistos = new Set();

  for (const fila of pedidos) {
    const items = Array.isArray(fila.items) ? fila.items : [];
    for (const it of items) {
      const nombre = (it.item ?? "").trim();
      if (!nombre) continue;
      const key = clave(nombre);
      if (yaExiste.has(key)) continue;
      if (vistos.has(key)) {
        colisiones.push({ nombre, proveedor: fila.proveedor });
        continue;
      }
      vistos.add(key);
      const unidad = ["Caja", "Kilo", "Unidad"].includes(it.unidad) ? it.unidad : "Unidad";
      const rubro =
        rubroPorNombre.get(key) ?? RUBRO_POR_PROVEEDOR[fila.proveedor] ?? "Despensa/Prep";
      nuevos.push({
        nombre,
        rubro,
        proveedor: fila.proveedor,
        unidad_compra: unidad,
        buffer_pct: 15,
        activo: true,
      });
    }
  }

  console.log(`\nÍtems nuevos a crear en Stock: ${nuevos.length}`);
  nuevos
    .sort((a, b) => a.proveedor.localeCompare(b.proveedor) || a.nombre.localeCompare(b.nombre))
    .forEach((n) => console.log(`  · [${n.proveedor}] ${n.nombre} (${n.unidad_compra}, ${n.rubro})`));

  if (colisiones.length > 0) {
    console.log(`\nOmitidos por nombre repetido en más de un proveedor (${colisiones.length}):`);
    colisiones.forEach((c) => console.log(`  · ${c.nombre} (también en ${c.proveedor})`));
  }

  if (nuevos.length === 0) {
    console.log("\nNada para insertar.");
    return;
  }

  if (dryRun) {
    console.log("\n--dry-run: no se insertó nada.");
    return;
  }

  console.log("\nInsertando...");
  const insertados = await supaInsert("stock_items", nuevos);
  console.log(`Listo: ${insertados.length} ítems creados en Stock.`);
}

main().catch((err) => {
  console.error(String(err.message ?? err));
  process.exit(1);
});
