#!/usr/bin/env node
/**
 * Guarda (o reemplaza) el token de Instagram en la tabla supabase `instagram_token`.
 *
 * Uso:
 *   node scripts/instagram-set-token.mjs "<TOKEN_DE_LARGA_DURACION>"
 *
 * El token se genera en Meta for Developers → tu app → Instagram → API setup
 * with Instagram login → "Generate token" junto a tu cuenta.
 * Lee NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY de .env.local o del entorno.
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
    // sin .env.local: se usan las variables del entorno
  }
}

const token = process.argv[2]?.trim();
if (!token) {
  console.error('Falta el token. Uso: node scripts/instagram-set-token.mjs "<TOKEN>"');
  process.exit(1);
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !anonKey) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY (en .env.local o el entorno)."
  );
  process.exit(1);
}

const res = await fetch(
  `${supabaseUrl}/rest/v1/instagram_token?on_conflict=id`,
  {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify([
      { id: 1, access_token: token, refreshed_at: new Date().toISOString() },
    ]),
  }
);

if (!res.ok) {
  console.error(`Error ${res.status}: ${await res.text()}`);
  console.error(
    "¿Ejecutaste supabase/instagram-token.sql en el SQL Editor de Supabase?"
  );
  process.exit(1);
}

console.log("Token guardado. El widget lo renovará solo cada vez que tenga más de 7 días.");
