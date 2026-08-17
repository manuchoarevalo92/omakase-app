import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

export type IngredienteReceta = {
  nombre: string;
  gramos: string | number;
};

export type RecetaContenido = {
  ingredientes: IngredienteReceta[];
  pasos: string;
  pax: number | null;
};

export type RecetaPlato = RecetaContenido & {
  platoId: string;
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

export function recetaTieneIngredientes(receta: RecetaContenido): boolean {
  return receta.ingredientes.some((ing) => ing.nombre.trim().length > 0);
}

export function recetaEstaCompleta(receta: RecetaContenido): boolean {
  return recetaTieneIngredientes(receta) && receta.pasos.length > 0;
}

export function recetaDesdeCampos(input: {
  ingredientes?: IngredienteReceta[] | null;
  pasos?: string | null;
  pax?: number | null;
}): RecetaContenido {
  return {
    ingredientes: Array.isArray(input.ingredientes) ? input.ingredientes : [],
    pasos: input.pasos?.trim() ?? "",
    pax: input.pax != null && input.pax > 0 ? input.pax : null,
  };
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

export type PlatoCartaReceta = {
  id: string;
  nombre: string;
};

export async function fetchPlatosCartaParaRecetas(): Promise<PlatoCartaReceta[]> {
  const { data, error } = await supabase
    .from("platos")
    .select("id, nombre")
    .eq("tipo", "carta")
    .order("nombre", { ascending: true });

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return ((data ?? []) as { id: string; nombre: string }[]).map((plato) => ({
    id: plato.id,
    nombre: plato.nombre,
  }));
}

export async function guardarRecetaPlato(input: {
  platoId: string;
  ingredientes: { nombre: string; gramos: number }[];
  pasos: string;
  pax: number | null;
}): Promise<void> {
  const { error } = await supabase.from("recetas").upsert(
    {
      plato_id: input.platoId,
      ingredientes: input.ingredientes,
      preparacion: input.pasos,
      pax: input.pax,
    },
    { onConflict: "plato_id" }
  );

  if (error) {
    throw new Error(formatPostgrestError(error));
  }
}
