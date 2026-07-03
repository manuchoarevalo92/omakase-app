#!/usr/bin/env node
/**
 * Importa albaranes históricos de García de Pou a compras_historial.
 *
 * Uso:
 *   node scripts/importar-albaranes-garcia-de-pou.mjs --dry-run
 *   node scripts/importar-albaranes-garcia-de-pou.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROVEEDOR = "García de Pou";

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

/** Códigos García de Pou → nombre canónico y keywords para matchear Stock. */
const CODIGO_GDPOU = {
  "167.19": {
    nombre: "Bolsas SOS natural 90g grandes",
    unidad: "Caja",
    keywords: ["bolsas sos", "natural", "90", "167"],
  },
  "225.46": {
    nombre: "Guantes negros",
    unidad: "Caja",
    keywords: ["guantes negros", "guantes", "nitil"],
  },
  "256.62": {
    nombre: "Bolsas negras chicas",
    unidad: "Caja",
    keywords: ["bolsas negras chicas", "bolsas", "negr", "80", "256.62", "24"],
  },
  "256.63": {
    nombre: "Bolsas negras",
    unidad: "Caja",
    keywords: ["bolsas negras", "bolsas", "negr", "90", "256.63", "28"],
  },
  "268.80": {
    nombre: "Bandejas chicas",
    unidad: "Caja",
    keywords: ["bandejas chicas", "recipientes", "sushi", "14x8", "268.80"],
  },
  "268.88": {
    nombre: "Bandejas grandes",
    unidad: "Caja",
    keywords: ["bandejas grandes", "recipientes", "sushi", "18,5", "268.88"],
  },
  "268.90": {
    nombre: "Tapas bandejas chicas",
    unidad: "Caja",
    keywords: ["tapas bandejas chicas", "tapas", "268.80", "14x8"],
  },
  "268.94": {
    nombre: "Tapas bandejas grandes",
    unidad: "Caja",
    keywords: ["tapas bandejas grandes", "tapas", "268.88", "18,5"],
  },
  "274.30": {
    nombre: "Servilletas negro airlaid",
    unidad: "Caja",
    keywords: ["servilletas", "airlaid", "negro"],
  },
  "134.01": {
    nombre: "Film PVC rollo",
    unidad: "Caja",
    keywords: ["film pvc", "film", "estirable"],
  },
  "230.60": {
    nombre: "Recipientes areca semiesfera",
    unidad: "Caja",
    keywords: ["areca", "semiesfera"],
  },
  "141.45": {
    nombre: "Picks golf bambú",
    unidad: "Unidad",
    keywords: ["picks", "golf", "bamb"],
  },
};

function scoreMatch(nombre, keywords) {
  const k = clave(nombre);
  let score = 0;
  for (const kw of keywords.map(clave)) {
    if (k === kw) score += 10;
    else if (k.includes(kw)) score += 5;
  }
  return score;
}

function buscarStockItem(cod, stockItems) {
  const meta = CODIGO_GDPOU[cod];
  if (!meta) return null;
  let mejor = null;
  let mejorScore = 0;
  for (const item of stockItems) {
    const score = scoreMatch(item.nombre, meta.keywords);
    if (score > mejorScore) {
      mejorScore = score;
      mejor = item;
    }
  }
  return mejorScore > 0 ? mejor : null;
}

async function repararVinculosDuplicados(stockItems) {
  const reemplazos = [
    { de: "Recipientes sushi grandes", a: "Bandejas grandes" },
    { de: "Recipientes sushi chicos", a: "Bandejas chicas" },
  ];
  for (const { de, a } of reemplazos) {
    const mal = stockItems.find((it) => clave(it.nombre) === clave(de));
    const bien = stockItems.find((it) => clave(it.nombre) === clave(a));
    if (!bien) continue;

    const porNombre = await fetch(
      `${supabaseUrl}/rest/v1/compras_historial?proveedor=eq.${encodeURIComponent(PROVEEDOR)}&stock_item_nombre=eq.${encodeURIComponent(de)}`,
      { headers }
    );
    if (porNombre.ok) {
      const rows = await porNombre.json();
      if (rows.length > 0) {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/compras_historial?proveedor=eq.${encodeURIComponent(PROVEEDOR)}&stock_item_nombre=eq.${encodeURIComponent(de)}`,
          {
            method: "PATCH",
            headers: { ...headers, Prefer: "return=representation" },
            body: JSON.stringify({ stock_item_id: bien.id, stock_item_nombre: bien.nombre }),
          }
        );
        if (res.ok) {
          const patched = await res.json();
          console.log(`  Re-vinculadas ${patched.length} línea(s) por nombre: ${de} → ${a}`);
        }
      }
    }

    if (!mal || mal.id === bien.id) continue;
    const res = await fetch(
      `${supabaseUrl}/rest/v1/compras_historial?stock_item_id=eq.${mal.id}`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ stock_item_id: bien.id, stock_item_nombre: bien.nombre }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`PATCH compras_historial → ${res.status}: ${body}`);
    }
    const patched = await res.json();
    if (patched.length > 0) {
      console.log(`  Re-vinculadas ${patched.length} línea(s): ${de} → ${a}`);
    }
    const del = await fetch(`${supabaseUrl}/rest/v1/stock_items?id=eq.${mal.id}`, {
      method: "DELETE",
      headers,
    });
    if (!del.ok) {
      const body = await del.text();
      console.warn(`  No se pudo borrar duplicado ${de}: ${body}`);
    } else if (mal) {
      console.log(`  Eliminado duplicado en Stock: ${de}`);
    }
  }
}

async function main() {
  if (process.argv.includes("--reparar")) {
    const stockItems = await supaGet(
      "stock_items?select=id,nombre,unidad_compra,proveedor&order=nombre"
    );
    console.log("Reparando vínculos duplicados...");
    await repararVinculosDuplicados(stockItems);
    return;
  }

  const raw = readFileSync(path.join(__dirname, "data/garcia-de-pou-albaranes.json"), "utf8");
  const lineas = JSON.parse(raw);

  console.log(`Líneas en JSON: ${lineas.length}`);

  let stockItems = await supaGet("stock_items?select=id,nombre,unidad_compra,proveedor&order=nombre");
  const stockGdP = stockItems.filter((it) => it.proveedor === PROVEEDOR);
  console.log(`Ítems de Stock (${PROVEEDOR}): ${stockGdP.length}`);
  stockGdP.forEach((it) => console.log(`  · ${it.nombre}`));

  const codsFaltantes = new Set();
  for (const row of lineas) {
    if (!CODIGO_GDPOU[row.cod]) {
      codsFaltantes.add(row.cod);
      continue;
    }
    if (!buscarStockItem(row.cod, stockItems)) {
      codsFaltantes.add(row.cod);
    }
  }

  if (codsFaltantes.size > 0 && !dryRun) {
    const nombresNuevos = new Set();
    console.log(`\nCreando ítem(s) faltante(s) en Stock...`);
    for (const cod of codsFaltantes) {
      const meta = CODIGO_GDPOU[cod];
      if (!meta) continue;
      if (nombresNuevos.has(clave(meta.nombre))) continue;
      const yaExiste = stockItems.find((it) => clave(it.nombre) === clave(meta.nombre));
      if (yaExiste) {
        console.log(`  ≈ ${meta.nombre} (ya existe: ${yaExiste.nombre})`);
        continue;
      }
      nombresNuevos.add(clave(meta.nombre));
      const ejemplo = lineas.find((l) => l.cod === cod);
      const [insertado] = await supaInsert("stock_items", [
        {
          nombre: meta.nombre,
          rubro: "Despensa/Prep",
          proveedor: PROVEEDOR,
          unidad_compra: ejemplo?.unidad ?? meta.unidad,
          buffer_pct: 15,
          activo: true,
        },
      ]);
      stockItems.push(insertado);
      console.log(`  + ${insertado.nombre}`);
    }
  } else if (codsFaltantes.size > 0) {
    console.log(`\nFaltarían crear/matchear: ${[...codsFaltantes].join(", ")}`);
  }

  const existentes = await supaGet(
    `compras_historial?proveedor=eq.${encodeURIComponent(PROVEEDOR)}&select=id&limit=1`
  );
  if (existentes.length > 0 && !dryRun) {
    console.warn(`\n⚠ Ya hay compras de ${PROVEEDOR}. Borrá esas filas antes de reimportar.`);
    process.exit(1);
  }

  const payload = lineas.map((row) => {
    const meta = CODIGO_GDPOU[row.cod];
    const match = buscarStockItem(row.cod, stockItems);
    return {
      stock_item_id: match?.id ?? null,
      stock_item_nombre: match?.nombre ?? meta?.nombre ?? `Código ${row.cod}`,
      proveedor: PROVEEDOR,
      cantidad: row.cantidad,
      unidad: row.unidad ?? meta?.unidad ?? "Caja",
      fecha: row.fecha,
      origen: "import",
      precio_unitario: row.precio,
      importe_total: row.importe,
    };
  });

  const fechas = new Set(lineas.map((l) => l.fecha));
  const vinculados = payload.filter((p) => p.stock_item_id).length;
  const total = payload.reduce((a, p) => a + p.importe_total, 0);

  console.log(`\nFechas únicas: ${fechas.size}`);
  console.log(`Líneas a insertar: ${payload.length}`);
  console.log(`Vinculadas a Stock: ${vinculados}/${payload.length}`);
  console.log(`Importe total: ${total.toFixed(2)}€`);

  const sinMatch = payload.filter((p) => !p.stock_item_id);
  if (sinMatch.length > 0) {
    console.log("\nSin match en Stock:");
    sinMatch.forEach((p) => console.log(`  · ${p.stock_item_nombre}`));
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
