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

export type PlatoVinculo = {
  id: string;
  nombre: string;
  tieneReceta: boolean;
  recetaCompleta: boolean;
};

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

export async function fetchPlatosParaVincular(): Promise<PlatoVinculo[]> {
  const [platosRes, recetasRes] = await Promise.all([
    supabase.from("platos").select("id, nombre").order("nombre", { ascending: true }),
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

  return ((platosRes.data ?? []) as { id: string; nombre: string }[]).map((plato) => {
    const receta = recetaPorPlato.get(plato.id) ?? null;
    return {
      id: plato.id,
      nombre: plato.nombre,
      tieneReceta: receta != null,
      recetaCompleta: receta != null && recetaEstaCompleta(receta),
    };
  });
}
