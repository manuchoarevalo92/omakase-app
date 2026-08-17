import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

export type IngredienteReceta = {
  nombre: string;
  gramos: string | number;
};

export type RecetaPlato = {
  platoId: string;
  ingredientes: IngredienteReceta[];
  pasos: string;
  pax: number | null;
};

export const TIPOS_PLATO = ["carta", "base"] as const;
export type TipoPlato = (typeof TIPOS_PLATO)[number];

/** Categoría técnica para filas tipo base (no se muestran en carta / omakase). */
export const CATEGORIA_RECETA_BASE = "Base";

export type PlatoVinculo = {
  id: string;
  nombre: string;
  tipo: TipoPlato;
  tieneReceta: boolean;
  recetaCompleta: boolean;
};

export type PlatoCatalogoReceta = {
  id: string;
  nombre: string;
  tipo: TipoPlato;
};

function normalizarTipoPlato(valor: string | null | undefined): TipoPlato {
  return valor === "base" ? "base" : "carta";
}

type RecetaDbRow = {
  plato_id: string;
  ingredientes: IngredienteReceta[] | null;
  preparacion: string | null;
  pax: number | null;
};

function recetaDesdeFila(row: RecetaDbRow): RecetaPlato {
  return {
    platoId: row.plato_id,
    ingredientes: Array.isArray(row.ingredientes) ? row.ingredientes : [],
    pasos: row.preparacion?.trim() ?? "",
    pax: row.pax != null && row.pax > 0 ? row.pax : null,
  };
}

export function recetaTieneIngredientes(receta: RecetaPlato): boolean {
  return receta.ingredientes.some((ing) => ing.nombre.trim().length > 0);
}

export function recetaEstaCompleta(receta: RecetaPlato): boolean {
  return recetaTieneIngredientes(receta) && receta.pasos.length > 0;
}

export function formatearGramosReceta(gramos: string | number): string {
  if (typeof gramos === "number") {
    if (!Number.isFinite(gramos) || gramos <= 0) return "—";
    return Number.isInteger(gramos) ? String(gramos) : String(gramos);
  }
  const t = gramos.trim();
  return t.length > 0 ? t : "—";
}

export async function fetchRecetaPorPlatoId(platoId: string): Promise<RecetaPlato | null> {
  const { data, error } = await supabase
    .from("recetas")
    .select("plato_id, ingredientes, preparacion, pax")
    .eq("plato_id", platoId)
    .maybeSingle();

  if (error) {
    throw new Error(formatPostgrestError(error));
  }
  if (!data) {
    return null;
  }
  return recetaDesdeFila(data as RecetaDbRow);
}

export async function fetchPlatosCatalogoRecetas(): Promise<PlatoCatalogoReceta[]> {
  const { data, error } = await supabase
    .from("platos")
    .select("id, nombre, tipo")
    .order("nombre", { ascending: true });

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return ((data ?? []) as { id: string; nombre: string; tipo: string | null }[]).map((plato) => ({
    id: plato.id,
    nombre: plato.nombre,
    tipo: normalizarTipoPlato(plato.tipo),
  }));
}

export async function crearPlatoRecetaBase(nombre: string): Promise<PlatoCatalogoReceta> {
  const limpio = nombre.trim();
  if (!limpio) {
    throw new Error("Indicá un nombre para la receta base.");
  }

  const { data, error } = await supabase
    .from("platos")
    .insert({
      nombre: limpio,
      categoria: CATEGORIA_RECETA_BASE,
      tipo: "base",
      ingredientes_requeridos: [],
    })
    .select("id, nombre, tipo")
    .single();

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return {
    id: (data as { id: string }).id,
    nombre: (data as { nombre: string }).nombre,
    tipo: "base",
  };
}

export async function borrarPlatoRecetaBase(id: string): Promise<void> {
  const { error } = await supabase.from("platos").delete().eq("id", id).eq("tipo", "base");
  if (error) {
    throw new Error(formatPostgrestError(error));
  }
}

export async function fetchPlatosParaVincular(): Promise<PlatoVinculo[]> {
  const [platosRes, recetasRes] = await Promise.all([
    supabase.from("platos").select("id, nombre, tipo").order("nombre", { ascending: true }),
    supabase.from("recetas").select("plato_id, ingredientes, preparacion"),
  ]);

  if (platosRes.error) {
    throw new Error(formatPostgrestError(platosRes.error));
  }
  if (recetasRes.error) {
    throw new Error(formatPostgrestError(recetasRes.error));
  }

  const recetaPorPlato = new Map<string, RecetaPlato>();
  for (const row of (recetasRes.data ?? []) as RecetaDbRow[]) {
    recetaPorPlato.set(row.plato_id, recetaDesdeFila(row));
  }

  const lista = (
    (platosRes.data ?? []) as { id: string; nombre: string; tipo: string | null }[]
  ).map((plato) => {
    const receta = recetaPorPlato.get(plato.id) ?? null;
    return {
      id: plato.id,
      nombre: plato.nombre,
      tipo: normalizarTipoPlato(plato.tipo),
      tieneReceta: receta != null,
      recetaCompleta: receta != null && recetaEstaCompleta(receta),
    };
  });

  return lista.sort((a, b) => {
    if (a.tipo !== b.tipo) {
      return a.tipo === "base" ? -1 : 1;
    }
    return a.nombre.localeCompare(b.nombre, "es");
  });
}
