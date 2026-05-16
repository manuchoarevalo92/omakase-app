import { supabase } from "@/src/lib/supabase";

export type BebidaConsumo = {
  bebida: string;
  cantidad: string;
};

export type BebidaAsientoResumen = {
  asiento: number;
  lineas: BebidaConsumo[];
};

export const TOTAL_ASIENTOS_BEBIDAS = 8;

type BebidaAsientoRow = {
  historial_servicio_id: string;
  asiento: number;
  consumos: unknown;
};

export function lineasDesdeConsumosJson(consumos: unknown): BebidaConsumo[] {
  if (!Array.isArray(consumos)) {
    return [];
  }

  return consumos
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const raw = item as { bebida?: unknown; cantidad?: unknown };
      const bebida = typeof raw.bebida === "string" ? raw.bebida.trim() : "";
      const cantidad = typeof raw.cantidad === "string" ? raw.cantidad.trim() : "";
      if (!bebida && !cantidad) {
        return null;
      }
      return { bebida, cantidad };
    })
    .filter((linea): linea is BebidaConsumo => linea !== null);
}

export function resumenBebidasPorAsiento(
  rows: BebidaAsientoRow[],
  historialServicioId: string
): BebidaAsientoResumen[] {
  const porAsiento = new Map<number, BebidaConsumo[]>();

  rows
    .filter((row) => row.historial_servicio_id === historialServicioId)
    .forEach((row) => {
      const lineas = lineasDesdeConsumosJson(row.consumos);
      if (lineas.length > 0) {
        porAsiento.set(row.asiento, lineas);
      }
    });

  return [...porAsiento.entries()]
    .sort(([a], [b]) => a - b)
    .map(([asiento, lineas]) => ({ asiento, lineas }));
}

export function agruparBebidasPorHistorial(
  rows: BebidaAsientoRow[]
): Map<string, BebidaAsientoResumen[]> {
  const ids = [...new Set(rows.map((row) => row.historial_servicio_id))];
  const map = new Map<string, BebidaAsientoResumen[]>();

  ids.forEach((id) => {
    const resumen = resumenBebidasPorAsiento(rows, id);
    if (resumen.length > 0) {
      map.set(id, resumen);
    }
  });

  return map;
}

export async function fetchBebidasPorHistorial(): Promise<Map<string, BebidaAsientoResumen[]>> {
  const { data, error } = await supabase
    .from("bebidas_asientos")
    .select("historial_servicio_id, asiento, consumos")
    .order("historial_servicio_id", { ascending: false })
    .order("asiento", { ascending: true });

  if (error) {
    throw error;
  }

  return agruparBebidasPorHistorial((data ?? []) as BebidaAsientoRow[]);
}
