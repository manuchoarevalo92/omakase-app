// Carga el contenido de la guía de bebidas (scripts/data/guia-bebidas.json) en Supabase.
// Idempotente: no pisa filas existentes (equivale a supabase/guia-bebidas-seed.sql).
// Uso: node --env-file=.env.local scripts/seed-guia-bebidas.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
const supabase = createClient(url, key);
const data = JSON.parse(
  readFileSync(new URL("./data/guia-bebidas.json", import.meta.url), "utf8")
);

async function cargar(tabla, filas, onConflict) {
  const { error } = await supabase
    .from(tabla)
    .upsert(filas, { onConflict, ignoreDuplicates: true });
  if (error) {
    throw new Error(`${tabla}: ${error.message}`);
  }
  const { count } = await supabase.from(tabla).select("*", { count: "exact", head: true });
  console.log(`${tabla}: ${count} filas`);
}

await cargar("guia_bebidas", data.bebidas, "slug");
await cargar("guia_capitulos", data.capitulos, "slug");
await cargar("guia_glosario", data.glosario, "area,termino");
await cargar("guia_preguntas", data.preguntas, "pregunta");
