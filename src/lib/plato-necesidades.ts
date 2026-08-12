import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

export type PlatoNecesidad = {
  id: string;
  platoId: string;
  item: string;
  orden: number;
};

type PlatoNecesidadDb = {
  id: string;
  plato_id: string;
  item: string;
  orden: number;
};

const SELECT = "id, plato_id, item, orden";

function parse(row: PlatoNecesidadDb): PlatoNecesidad {
  return {
    id: row.id,
    platoId: row.plato_id,
    item: row.item.trim(),
    orden: row.orden,
  };
}

export async function fetchNecesidadesPorPlatos(
  platoIds: string[]
): Promise<PlatoNecesidad[]> {
  const ids = [...new Set(platoIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("plato_necesidades")
    .select(SELECT)
    .in("plato_id", ids)
    .order("orden", { ascending: true });

  if (error) throw new Error(formatPostgrestError(error));
  return ((data ?? []) as PlatoNecesidadDb[]).map(parse);
}

/** Lista única de ítems (sin duplicar arroz/wasabi/etc.) a partir de platos del menú. */
export function consolidarNecesidades(necesidades: PlatoNecesidad[]): string[] {
  const map = new Map<string, string>();
  for (const n of necesidades) {
    const clave = n.item.trim().toLowerCase();
    if (!clave) continue;
    if (!map.has(clave)) {
      map.set(clave, n.item.trim());
    }
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, "es"));
}
