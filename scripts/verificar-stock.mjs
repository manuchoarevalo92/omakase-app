#!/usr/bin/env node
/** Verificación rápida: cuántos ítems de stock_items hay por proveedor y por rubro. */
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

const res = await fetch(`${supabaseUrl}/rest/v1/stock_items?select=proveedor,rubro`, {
  headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
});
const rows = await res.json();

const porProveedor = {};
const porRubro = {};
rows.forEach((r) => {
  porProveedor[r.proveedor ?? "Sin proveedor"] = (porProveedor[r.proveedor ?? "Sin proveedor"] ?? 0) + 1;
  porRubro[r.rubro ?? "Sin rubro"] = (porRubro[r.rubro ?? "Sin rubro"] ?? 0) + 1;
});

console.log("Total en stock_items:", rows.length);
console.log("Por proveedor:", porProveedor);
console.log("Por rubro:", porRubro);
