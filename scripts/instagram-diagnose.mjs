#!/usr/bin/env node
/**
 * Diagnóstico del feed de Instagram (sin imprimir el token).
 * Uso: node scripts/instagram-diagnose.mjs
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

if (!supabaseUrl || !anonKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const tokenRes = await fetch(
  `${supabaseUrl}/rest/v1/instagram_token?id=eq.1&select=refreshed_at`,
  {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  }
);

if (!tokenRes.ok) {
  console.error("Supabase token read failed:", tokenRes.status, await tokenRes.text());
  process.exit(1);
}

const rows = await tokenRes.json();
if (!rows.length) {
  console.error("No hay fila en instagram_token (id=1)");
  process.exit(1);
}

const tokenRowRes = await fetch(
  `${supabaseUrl}/rest/v1/instagram_token?id=eq.1&select=access_token,refreshed_at`,
  {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  }
);
const [row] = await tokenRowRes.json();
const refreshedAt = row.refreshed_at;
const ageDays = (Date.now() - new Date(refreshedAt).getTime()) / (1000 * 60 * 60 * 24);
console.log(`Token en Supabase: sí (refreshed_at=${refreshedAt}, hace ${ageDays.toFixed(1)} días)`);

const profileUrl = new URL("https://graph.instagram.com/me");
profileUrl.searchParams.set("fields", "username");
profileUrl.searchParams.set("access_token", row.access_token);

const mediaUrl = new URL("https://graph.instagram.com/me/media");
mediaUrl.searchParams.set("fields", "id,media_type");
mediaUrl.searchParams.set("limit", "3");
mediaUrl.searchParams.set("access_token", row.access_token);

const [profileRes, mediaRes] = await Promise.all([
  fetch(profileUrl),
  fetch(mediaUrl),
]);

if (profileRes.ok) {
  const profile = await profileRes.json();
  console.log(`Perfil API: OK (@${profile.username ?? "?"})`);
} else {
  console.error("Perfil API:", profileRes.status, await profileRes.text());
}

if (mediaRes.ok) {
  const media = await mediaRes.json();
  console.log(`Media API: OK (${media.data?.length ?? 0} items en muestra)`);
} else {
  console.error("Media API:", mediaRes.status, await mediaRes.text());
}

const refreshUrl = new URL("https://graph.instagram.com/refresh_access_token");
refreshUrl.searchParams.set("grant_type", "ig_refresh_token");
refreshUrl.searchParams.set("access_token", row.access_token);
const refreshRes = await fetch(refreshUrl);
if (refreshRes.ok) {
  console.log("Refresh token: OK (se puede renovar)");
} else {
  console.error("Refresh token:", refreshRes.status, await refreshRes.text());
}
