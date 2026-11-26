import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

export const CATEGORIAS_GUIA = [
  { id: "sake", label: "Sake" },
  { id: "espumoso", label: "Espumosos" },
  { id: "blanco", label: "Blancos" },
  { id: "tinto", label: "Tintos" },
  { id: "whisky", label: "Whisky" },
  { id: "aperitivo", label: "Aperitivo y final" },
  { id: "sin-alcohol", label: "Sin alcohol" },
] as const;

export type CategoriaGuia = (typeof CATEGORIAS_GUIA)[number]["id"];

export function labelCategoria(id: string): string {
  return CATEGORIAS_GUIA.find((c) => c.id === id)?.label ?? id;
}

/** Ficha de una bebida. `datos` son párrafos con markdown simple (**negrita**, *cursiva*). */
export type GuiaBebida = {
  id: string;
  slug: string;
  categoria: CategoriaGuia;
  subgrupo: string | null;
  orden: number;
  nombre: string;
  precio: string | null;
  meta: string | null;
  datos: string[];
  enSala: string | null;
  minimaIntervencion: boolean;
  aConfirmar: boolean;
  fotoUrl: string | null;
  activa: boolean;
};

export type BloqueGuia =
  | { t: "h"; n: number; x: string }
  | { t: "p"; x: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "table"; head: string[]; rows: string[][] };

export type GuiaCapitulo = {
  id: string;
  slug: string;
  area: string;
  titulo: string;
  orden: number;
  bloques: BloqueGuia[];
};

export type GuiaTermino = { id: string; area: string; termino: string; definicion: string };
export type GuiaPregunta = { id: string; area: string; pregunta: string };

export type GuiaCompleta = {
  bebidas: GuiaBebida[];
  capitulos: GuiaCapitulo[];
  glosario: GuiaTermino[];
  preguntas: GuiaPregunta[];
};

type BebidaDbRow = {
  id: string;
  slug: string;
  categoria: string;
  subgrupo: string | null;
  orden: number;
  nombre: string;
  precio: string | null;
  meta: string | null;
  datos: unknown;
  en_sala: string | null;
  minima_intervencion: boolean;
  a_confirmar: boolean;
  foto_url: string | null;
  activa: boolean;
};

const BEBIDA_SELECT =
  "id, slug, categoria, subgrupo, orden, nombre, precio, meta, datos, en_sala, minima_intervencion, a_confirmar, foto_url, activa";

function bebidaDesdeFila(row: BebidaDbRow): GuiaBebida {
  return {
    id: row.id,
    slug: row.slug,
    categoria: row.categoria as CategoriaGuia,
    subgrupo: row.subgrupo,
    orden: row.orden,
    nombre: row.nombre,
    precio: row.precio,
    meta: row.meta,
    datos: Array.isArray(row.datos) ? row.datos.filter((d): d is string => typeof d === "string") : [],
    enSala: row.en_sala,
    minimaIntervencion: row.minima_intervencion,
    aConfirmar: row.a_confirmar,
    fotoUrl: row.foto_url,
    activa: row.activa,
  };
}

export async function fetchGuiaCompleta(): Promise<GuiaCompleta> {
  const [bebidas, capitulos, glosario, preguntas] = await Promise.all([
    supabase.from("guia_bebidas").select(BEBIDA_SELECT).order("orden", { ascending: true }),
    supabase
      .from("guia_capitulos")
      .select("id, slug, area, titulo, orden, bloques")
      .order("orden", { ascending: true }),
    supabase
      .from("guia_glosario")
      .select("id, area, termino, definicion")
      .order("orden", { ascending: true }),
    supabase.from("guia_preguntas").select("id, area, pregunta").order("orden", { ascending: true }),
  ]);

  const error = bebidas.error ?? capitulos.error ?? glosario.error ?? preguntas.error;
  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return {
    bebidas: ((bebidas.data ?? []) as BebidaDbRow[]).map(bebidaDesdeFila),
    capitulos: (capitulos.data ?? []) as GuiaCapitulo[],
    glosario: (glosario.data ?? []) as GuiaTermino[],
    preguntas: (preguntas.data ?? []) as GuiaPregunta[],
  };
}

/** Campos editables de una ficha desde la app. */
export type GuiaBebidaEdicion = {
  nombre: string;
  categoria: CategoriaGuia;
  subgrupo: string | null;
  precio: string | null;
  meta: string | null;
  datos: string[];
  enSala: string | null;
  minimaIntervencion: boolean;
  aConfirmar: boolean;
  activa: boolean;
};

function filaDesdeEdicion(e: GuiaBebidaEdicion) {
  return {
    nombre: e.nombre.trim(),
    categoria: e.categoria,
    subgrupo: e.subgrupo?.trim() || null,
    precio: e.precio?.trim() || null,
    meta: e.meta?.trim() || null,
    datos: e.datos.map((d) => d.trim()).filter(Boolean),
    en_sala: e.enSala?.trim() || null,
    minima_intervencion: e.minimaIntervencion,
    a_confirmar: e.aConfirmar,
    activa: e.activa,
    updated_at: new Date().toISOString(),
  };
}

export async function actualizarBebida(id: string, edicion: GuiaBebidaEdicion): Promise<GuiaBebida> {
  const { data, error } = await supabase
    .from("guia_bebidas")
    .update(filaDesdeEdicion(edicion))
    .eq("id", id)
    .select(BEBIDA_SELECT)
    .single();
  if (error) {
    throw new Error(formatPostgrestError(error));
  }
  return bebidaDesdeFila(data as BebidaDbRow);
}

function slugDesdeNombre(nombre: string): string {
  const base = nombre
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "bebida"}-${Date.now().toString(36)}`;
}

export async function crearBebida(edicion: GuiaBebidaEdicion, orden: number): Promise<GuiaBebida> {
  const { data, error } = await supabase
    .from("guia_bebidas")
    .insert({ ...filaDesdeEdicion(edicion), slug: slugDesdeNombre(edicion.nombre), orden })
    .select(BEBIDA_SELECT)
    .single();
  if (error) {
    throw new Error(formatPostgrestError(error));
  }
  return bebidaDesdeFila(data as BebidaDbRow);
}

const BUCKET_FOTOS = "guia-bebidas";
const FOTO_LADO_MAX = 1200;

/** Reduce la foto en el navegador (lado mayor 1200 px, JPEG sobre blanco) antes de subirla. */
async function reducirFoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, FOTO_LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No se pudo procesar la imagen.");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen."))),
      "image/jpeg",
      0.86
    );
  });
}

/** Sube la foto al bucket y guarda la URL pública en la ficha. Devuelve la URL nueva. */
export async function subirFotoBebida(bebida: GuiaBebida, file: File): Promise<string> {
  const blob = await reducirFoto(file);
  const path = `${bebida.slug}-${Date.now().toString(36)}.jpg`;
  const subida = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (subida.error) {
    throw new Error(subida.error.message);
  }
  const url = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(path).data.publicUrl;
  const { error } = await supabase
    .from("guia_bebidas")
    .update({ foto_url: url, updated_at: new Date().toISOString() })
    .eq("id", bebida.id);
  if (error) {
    throw new Error(formatPostgrestError(error));
  }
  return url;
}

/** Texto en minúsculas y sin acentos, para buscar. */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
