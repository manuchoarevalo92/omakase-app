import {
  normalizarRubro,
  type RubroIngrediente,
} from "@/src/lib/ingredientes-rubro";
import { BUFFER_PCT_DEFECTO } from "@/src/lib/compras-prediccion";
import {
  UNIDADES,
  proveedorCanonico,
  type Proveedor,
  type UnidadMedida,
} from "@/src/lib/proveedores";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

/** Catálogo de materia prima que se compra a proveedores ("Stock"), separado
 * del catálogo de ingredientes de menú (disponibilidad de platos). */
export type StockItem = {
  id: string;
  nombre: string;
  rubro: RubroIngrediente;
  proveedor: Proveedor | null;
  unidadCompra: UnidadMedida;
  bufferPct: number;
  activo: boolean;
  /** Frecuencia estimada a mano (días) para poder calcular urgencia con una
   * sola compra registrada, cuando todavía no hay 2+ compras reales. */
  intervaloEstimadoDias: number | null;
};

export type StockItemDbRow = {
  id: string;
  nombre: string;
  rubro?: string | null;
  proveedor?: string | null;
  unidad_compra?: string | null;
  buffer_pct?: number | null;
  activo?: boolean | null;
  intervalo_estimado_dias?: number | null;
};

function normalizarUnidadCompra(valor: string | null | undefined): UnidadMedida {
  if (valor && (UNIDADES as readonly string[]).includes(valor)) {
    return valor as UnidadMedida;
  }
  return "Unidad";
}

export function stockItemDesdeFila(row: StockItemDbRow): StockItem {
  return {
    id: row.id,
    nombre: row.nombre,
    rubro: normalizarRubro(row.rubro),
    proveedor: proveedorCanonico(row.proveedor),
    unidadCompra: normalizarUnidadCompra(row.unidad_compra),
    bufferPct: row.buffer_pct != null ? row.buffer_pct : BUFFER_PCT_DEFECTO,
    activo: row.activo !== false,
    intervaloEstimadoDias:
      row.intervalo_estimado_dias != null && row.intervalo_estimado_dias > 0
        ? row.intervalo_estimado_dias
        : null,
  };
}

// No incluye intervalo_estimado_dias: la usan también los .select() después de
// insert/update en /stock y /compras, que no deben romperse si todavía no se
// corrió supabase/stock-items-intervalo-estimado.sql en ese proyecto.
export const STOCK_ITEM_SELECT =
  "id, nombre, rubro, proveedor, unidad_compra, buffer_pct, activo";

const STOCK_ITEM_SELECT_CON_INTERVALO = `${STOCK_ITEM_SELECT}, intervalo_estimado_dias`;

export async function crearStockItem(input: {
  nombre: string;
  rubro?: RubroIngrediente;
  proveedor?: string | null;
  unidadCompra?: UnidadMedida;
}): Promise<StockItem> {
  const nombre = input.nombre.trim().replace(/\s+/g, " ");
  if (!nombre) {
    throw new Error("El nombre del ítem es obligatorio.");
  }
  const { data, error } = await supabase
    .from("stock_items")
    .insert({
      nombre,
      rubro: input.rubro ?? "Despensa/Prep",
      proveedor: proveedorCanonico(input.proveedor),
      unidad_compra: input.unidadCompra ?? "Unidad",
      buffer_pct: BUFFER_PCT_DEFECTO,
      activo: true,
    })
    .select(STOCK_ITEM_SELECT)
    .single();

  if (error) {
    throw new Error(formatPostgrestError(error));
  }
  return stockItemDesdeFila(data as StockItemDbRow);
}

export async function fetchStockItems(): Promise<StockItem[]> {
  const { data, error } = await supabase
    .from("stock_items")
    .select(STOCK_ITEM_SELECT_CON_INTERVALO)
    .order("nombre", { ascending: true });

  if (error) {
    const msg = error.message.toLowerCase();
    // Fallback si todavía no se corrió la migración de intervalo_estimado_dias:
    // se sigue funcionando igual que antes, solo sin esa columna.
    if (msg.includes("intervalo_estimado_dias") && msg.includes("does not exist")) {
      const fallback = await supabase
        .from("stock_items")
        .select(STOCK_ITEM_SELECT)
        .order("nombre", { ascending: true });
      if (fallback.error) {
        throw new Error(formatPostgrestError(fallback.error));
      }
      return ((fallback.data ?? []) as StockItemDbRow[]).map(stockItemDesdeFila);
    }
    throw new Error(formatPostgrestError(error));
  }

  return ((data ?? []) as StockItemDbRow[]).map(stockItemDesdeFila);
}

/** Clave de comparación para matchear nombres pegados a mano contra el catálogo. */
export function normalizarNombreClave(nombre: string): string {
  return nombre.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buscarStockItemPorNombre(
  nombre: string,
  items: StockItem[]
): StockItem | null {
  const clave = normalizarNombreClave(nombre);
  if (!clave) {
    return null;
  }
  return items.find((it) => normalizarNombreClave(it.nombre) === clave) ?? null;
}
