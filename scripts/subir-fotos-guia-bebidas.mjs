// Sube fotos de botellas a la guía de bebidas.
// Cada archivo de la carpeta debe llamarse <slug>.<jpg|png|webp> (el slug de guia_bebidas).
// Reduce a 900x1200 máx. sobre fondo blanco, sube al bucket "guia-bebidas" y guarda foto_url.
// Uso: node --env-file=.env.local scripts/subir-fotos-guia-bebidas.mjs <carpeta> [--pisar]
import { readdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const carpeta = process.argv[2];
const pisar = process.argv.includes("--pisar");
if (!carpeta) {
  throw new Error("Falta la carpeta con las fotos.");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
const supabase = createClient(url, key);

const { data: bebidas, error } = await supabase.from("guia_bebidas").select("id, slug, foto_url");
if (error) {
  throw new Error(error.message);
}
const porSlug = new Map(bebidas.map((b) => [b.slug, b]));

let subidas = 0;
for (const archivo of readdirSync(carpeta).sort()) {
  const ext = path.extname(archivo).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(ext)) {
    continue;
  }
  const slug = path.basename(archivo, ext);
  const bebida = porSlug.get(slug);
  if (!bebida) {
    console.log(`?? ${archivo}: no hay ficha con ese slug`);
    continue;
  }
  if (bebida.foto_url && !pisar) {
    console.log(`-- ${slug}: ya tiene foto (usar --pisar para reemplazar)`);
    continue;
  }
  try {
    const buffer = await sharp(path.join(carpeta, archivo))
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({ width: 900, height: 1200, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const destino = `${slug}.jpg`;
    const subida = await supabase.storage
      .from("guia-bebidas")
      .upload(destino, buffer, { contentType: "image/jpeg", upsert: true, cacheControl: "31536000" });
    if (subida.error) {
      throw new Error(subida.error.message);
    }
    const publica = supabase.storage.from("guia-bebidas").getPublicUrl(destino).data.publicUrl;
    const fotoUrl = `${publica}?v=${Date.now().toString(36)}`;
    const update = await supabase
      .from("guia_bebidas")
      .update({ foto_url: fotoUrl, updated_at: new Date().toISOString() })
      .eq("id", bebida.id);
    if (update.error) {
      throw new Error(update.error.message);
    }
    subidas += 1;
    console.log(`ok ${slug}`);
  } catch (e) {
    console.log(`!! ${slug}: ${e instanceof Error ? e.message : e}`);
  }
}
console.log(`\n${subidas} fotos subidas`);
