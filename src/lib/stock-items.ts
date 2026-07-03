import {
  normalizarRubro,
  type RubroIngrediente,
} from "@/src/lib/ingredientes-rubro";
import { BUFFER_PCT_DEFECTO } from "@/src/lib/compras-prediccion";
import {
  esProveedorValido,
  UNIDADES,
  type Proveedor,
  type UnidadMedida,
} from "@/src/lib/proveedores";
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
};

export type StockItemDbRow = {
  id: string;
  nombre: string;
  rubro?: string | null;
  proveedor?: string | null;
  unidad_compra?: string | null;
  buffer_pct?: number | null;
  activo?: boolean | null;
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
    proveedor: esProveedorValido(row.proveedor) ? row.proveedor : null,
    unidadCompra: normalizarUnidadCompra(row.unidad_compra),
    bufferPct: row.buffer_pct != null ? row.buffer_pct : BUFFER_PCT_DEFECTO,
    activo: row.activo !== false,
  };
}

export const STOCK_ITEM_SELECT =
  "id, nombre, rubro, proveedor, unidad_compra, buffer_pct, activo";

export async function fetchStockItems(): Promise<StockItem[]> {
  const { data, error } = await supabase
    .from("stock_items")
    .select(STOCK_ITEM_SELECT)
    .order("nombre", { ascending: true });

  if (error) {
    throw error;
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
