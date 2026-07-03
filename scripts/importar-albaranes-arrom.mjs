#!/usr/bin/env node
/**
 * Importa albaranes históricos de Arrom (extraídos de facturas PDF) a compras_historial.
 *
 * Uso:
 *   node scripts/importar-albaranes-arrom.mjs --dry-run
 *   node scripts/importar-albaranes-arrom.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const clave = (s) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");

/** Códigos de producto Arrom → nombre canónico + unidad de compra. */
const CODIGO_ARROM = {
  3522: { nombre: "Salmón", unidad: "Kilo", keywords: ["salmon", "salmon"] },
  3684: { nombre: "Hamachi", unidad: "Kilo", keywords: ["hamachi"] },
  3174: { nombre: "Dorada", unidad: "Kilo", keywords: ["dorada"] },
  3545: { nombre: "Sepia", unidad: "Kilo", keywords: ["sepia"] },
  4032: { nombre: "Uni", unidad: "Unidad", keywords: ["uni"] },
  3625: { nombre: "Atún ventresca", unidad: "Kilo", keywords: ["ventresca", "atun ventresca"] },
  3618: { nombre: "Atún lomo", unidad: "Kilo", keywords: ["lomo", "atun lomo"] },
  4038: { nombre: "Gamba alistada", unidad: "Kilo", keywords: ["alistad", "gamba alistad"] },
  4052: { nombre: "Gamba langostinera", unidad: "Unidad", keywords: ["langostinera"] },
  3088: { nombre: "Bonito", unidad: "Kilo", keywords: ["bonito"] },
  2252: { nombre: "Vieira", unidad: "Unidad", keywords: ["vieira"] },
  3102: { nombre: "Caballa", unidad: "Kilo", keywords: ["caballa"] },
  3123: { nombre: "Carabinero", unidad: "Unidad", keywords: ["carabinero"] },
  4986: { nombre: "Carabinero", unidad: "Unidad", keywords: ["carabinero"] },
  3212: { nombre: "Gamba roja", unidad: "Unidad", keywords: ["gamba roja"] },
};

function buscarStockItem(cod, stockItems) {
  const meta = CODIGO_ARROM[cod];
  if (!meta) {
    return null;
  }
  const keywords = meta.keywords.map(clave);
  let mejor = null;
  let mejorScore = 0;
  for (const item of stockItems) {
    const k = clave(item.nombre);
    let score = 0;
    for (const kw of keywords) {
      if (k === kw) score += 10;
      else if (k.includes(kw)) score += 5;
    }
    if (score > mejorScore) {
      mejorScore = score;
      mejor = item;
    }
  }
  return mejorScore > 0 ? mejor : null;
}

async function main() {
  const raw = readFileSync(path.join(__dirname, "data/arrom-albaranes.json"), "utf8");
  const lineas = JSON.parse(raw);

  console.log(`Líneas en JSON: ${lineas.length}`);

  const stockItems = await supaGet(
    "stock_items?select=id,nombre,unidad_compra,proveedor&order=nombre"
  );
  const stockArrom = stockItems.filter((it) => it.proveedor === "Arrom");
  console.log(`Ítems de Stock (Arrom): ${stockArrom.length}`);
  stockArrom.forEach((it) => console.log(`  · ${it.nombre}`));

  const itemsActuales = [...stockItems];
  const codsSinStock = new Set();
  for (const row of lineas) {
    if (!CODIGO_ARROM[row.cod]) continue;
    if (!buscarStockItem(row.cod, itemsActuales)) {
      codsSinStock.add(row.cod);
    }
  }

  if (codsSinStock.size > 0 && !dryRun) {
    const nombresNuevos = new Set();
    const nuevos = [...codsSinStock]
      .map((cod) => {
        const meta = CODIGO_ARROM[cod];
        return {
          nombre: meta.nombre,
          rubro: "Pescado/Marisco",
          proveedor: "Arrom",
          unidad_compra: meta.unidad,
          buffer_pct: 15,
          activo: true,
        };
      })
      .filter((it) => {
        if (nombresNuevos.has(clave(it.nombre))) return false;
        nombresNuevos.add(clave(it.nombre));
        return true;
      });
    console.log(`\nCreando ${nuevos.length} ítem(s) faltante(s) en Stock...`);
    for (const row of nuevos) {
      const yaExiste = itemsActuales.find((it) => clave(it.nombre) === clave(row.nombre));
      if (yaExiste) {
        console.log(`  ≈ ${row.nombre} (ya existe: ${yaExiste.nombre})`);
        continue;
      }
      const [insertado] = await supaInsert("stock_items", [row]);
      itemsActuales.push(insertado);
      console.log(`  + ${insertado.nombre}`);
    }
  } else if (codsSinStock.size > 0) {
    console.log(`\nFaltarían crear ${codsSinStock.size} ítem(s) en Stock (--dry-run).`);
  }

  const existentes = await supaGet(
    "compras_historial?proveedor=eq.Arrom&select=id,fecha,stock_item_nombre,importe_total&limit=1"
  );
  if (existentes.length > 0 && !dryRun) {
    console.warn(
      "\n⚠ Ya hay compras de Arrom en compras_historial. Si querés reimportar, borrá esas filas primero."
    );
    process.exit(1);
  }

  const payload = [];
  const sinMatch = new Set();
  const fechas = new Set();

  for (const row of lineas) {
    const meta = CODIGO_ARROM[row.cod];
    if (!meta) {
      sinMatch.add(`cod desconocido ${row.cod}`);
      continue;
    }
    const match = buscarStockItem(row.cod, itemsActuales);
    if (!match) {
      sinMatch.add(`${meta.nombre} (cod ${row.cod})`);
    }
    fechas.add(row.fecha);
    payload.push({
      stock_item_id: match?.id ?? null,
      stock_item_nombre: match?.nombre ?? meta.nombre,
      proveedor: "Arrom",
      cantidad: row.cantidad,
      unidad: meta.unidad,
      fecha: row.fecha,
      origen: "import",
      precio_unitario: row.precio,
      importe_total: row.importe,
    });
  }

  const vinculados = payload.filter((p) => p.stock_item_id).length;
  console.log(`\nFechas únicas: ${fechas.size} (${[...fechas].sort().join(", ")})`);
  console.log(`Líneas a insertar: ${payload.length}`);
  console.log(`Vinculadas a Stock: ${vinculados}/${payload.length}`);
  console.log(`Importe total: ${payload.reduce((a, p) => a + p.importe_total, 0).toFixed(2)}€`);

  if (sinMatch.size > 0) {
    console.log("\nSin match en Stock (se guardan igual con nombre canónico):");
    [...sinMatch].forEach((s) => console.log(`  · ${s}`));
  }

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

  console.log("\nListo. Revisá /compras y /gasto.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
