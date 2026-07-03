#!/usr/bin/env node
/**
 * Importa facturas históricas de Nishikidori a compras_historial.
 * Crea ítems en Stock (nombres en francés) y la solapa en pedidos_proveedores.
 *
 * Uso:
 *   node scripts/importar-albaranes-nishikidori.mjs --dry-run
 *   node scripts/importar-albaranes-nishikidori.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROVEEDOR = "Nishikidori";
const RUBRO = "Despensa japonesa";

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

async function supaUpsertPedido(proveedor, items) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/pedidos_proveedores?on_conflict=proveedor`,
    {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({ proveedor, items }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`UPSERT pedidos_proveedores → ${res.status}: ${body}`);
  }
  return res.json();
}

const clave = (s) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");

function buscarStockItem(nombre, stockItems) {
  const k = clave(nombre);
  return stockItems.find((it) => clave(it.nombre) === k) ?? null;
}

async function main() {
  const raw = readFileSync(path.join(__dirname, "data/nishikidori-albaranes.json"), "utf8");
  const lineas = JSON.parse(raw);

  console.log(`Líneas en JSON: ${lineas.length}`);

  let stockItems = await supaGet("stock_items?select=id,nombre,unidad_compra,proveedor&order=nombre");
  console.log(`Ítems en Stock (total): ${stockItems.length}`);

  const productosUnicos = [...new Set(lineas.map((l) => l.producto))];
  const faltantes = productosUnicos.filter((p) => !buscarStockItem(p, stockItems));

  if (faltantes.length > 0 && !dryRun) {
    console.log(`\nCreando ${faltantes.length} ítem(s) en Stock...`);
    for (const nombre of faltantes) {
      const ejemplo = lineas.find((l) => l.producto === nombre);
      const [insertado] = await supaInsert("stock_items", [
        {
          nombre,
          rubro: RUBRO,
          proveedor: PROVEEDOR,
          unidad_compra: ejemplo?.unidad ?? "Unidad",
          buffer_pct: 15,
          activo: true,
        },
      ]);
      stockItems.push(insertado);
      console.log(`  + ${insertado.nombre}`);
    }
  } else if (faltantes.length > 0) {
    console.log(`\nFaltarían crear en Stock: ${faltantes.length} productos`);
    faltantes.forEach((p) => console.log(`  - ${p}`));
  }

  const existentes = await supaGet(
    `compras_historial?proveedor=eq.${encodeURIComponent(PROVEEDOR)}&select=id&limit=1`
  );
  if (existentes.length > 0 && !dryRun) {
    console.warn("\n⚠ Ya hay compras de Nishikidori. Borrá esas filas antes de reimportar.");
    process.exit(1);
  }

  const payload = lineas.map((row) => {
    const match = buscarStockItem(row.producto, stockItems);
    return {
      stock_item_id: match?.id ?? null,
      stock_item_nombre: match?.nombre ?? row.producto,
      proveedor: PROVEEDOR,
      cantidad: row.cantidad,
      unidad: row.unidad,
      fecha: row.fecha,
      origen: "import",
      precio_unitario: row.precio,
      importe_total: row.importe,
    };
  });

  const fechas = new Set(lineas.map((l) => l.fecha));
  const vinculados = payload.filter((p) => p.stock_item_id).length;
  const total = payload.reduce((a, p) => a + (p.importe_total ?? 0), 0);

  console.log(`\nFechas únicas: ${fechas.size}`);
  console.log(`Líneas a insertar: ${payload.length}`);
  console.log(`Vinculadas a Stock: ${vinculados}/${payload.length}`);
  console.log(`Importe total: ${total.toFixed(2)}€`);

  if (dryRun) {
    console.log("\n--dry-run: no se insertó nada.");
    return;
  }

  const BATCH = 50;
  let insertados = 0;
  for (let i = 0; i < payload.length; i += BATCH) {
    const batch = payload.slice(i, i + BATCH);
    await supaInsert("compras_historial", batch);
    insertados += batch.length;
    console.log(`Insertados ${insertados}/${payload.length}...`);
  }

  const pedidoExistente = await supaGet(
    `pedidos_proveedores?proveedor=eq.${encodeURIComponent(PROVEEDOR)}&select=proveedor,items`
  );
  if (pedidoExistente.length === 0) {
    const itemsPedido = productosUnicos
      .sort((a, b) => a.localeCompare(b, "fr"))
      .map((nombre) => {
        const ejemplo = lineas.find((l) => l.producto === nombre);
        return {
          id: randomUUID(),
          item: nombre,
          cantidad: "",
          unidad: ejemplo?.unidad ?? "Unidad",
        };
      });
    await supaUpsertPedido(PROVEEDOR, itemsPedido);
    console.log(`\nPedidos: creada solapa "${PROVEEDOR}" con ${itemsPedido.length} ítems.`);
  } else {
    console.log(`\nPedidos: ya existía fila para "${PROVEEDOR}", no se tocó.`);
  }

  console.log("\nListo. Revisá /pedidos, /compras y /gasto.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
