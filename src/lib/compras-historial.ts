import { proveedorCanonico, UNIDADES, type Proveedor, type UnidadMedida } from "@/src/lib/proveedores";
import { supabase } from "@/src/lib/supabase";

export type OrigenCompra = "import" | "manual" | "pedido_enviado";

export type CompraHistorialRow = {
  id: string;
  stockItemId: string | null;
  stockItemNombre: string;
  proveedor: Proveedor | null;
  cantidad: number | null;
  unidad: UnidadMedida;
  fecha: string;
  origen: OrigenCompra;
  precioUnitario: number | null;
  importeTotal: number | null;
};

type CompraHistorialDbRow = {
  id: string;
  stock_item_id: string | null;
  stock_item_nombre: string;
  proveedor?: string | null;
  cantidad: number | null;
  unidad?: string | null;
  fecha: string;
  origen?: string | null;
  precio_unitario?: number | null;
  importe_total?: number | null;
};

function normalizarUnidad(valor: string | null | undefined): UnidadMedida {
  if (valor && (UNIDADES as readonly string[]).includes(valor)) {
    return valor as UnidadMedida;
  }
  return "Unidad";
}

function normalizarOrigen(valor: string | null | undefined): OrigenCompra {
  return valor === "manual" || valor === "pedido_enviado" ? valor : "import";
}

function compraDesdeFila(row: CompraHistorialDbRow): CompraHistorialRow {
  return {
    id: row.id,
    stockItemId: row.stock_item_id,
    stockItemNombre: row.stock_item_nombre,
    proveedor: proveedorCanonico(row.proveedor),
    cantidad: row.cantidad,
    unidad: normalizarUnidad(row.unidad),
    fecha: row.fecha,
    origen: normalizarOrigen(row.origen),
    precioUnitario: row.precio_unitario ?? null,
    importeTotal: row.importe_total ?? null,
  };
}

const COMPRA_HISTORIAL_SELECT =
  "id, stock_item_id, stock_item_nombre, proveedor, cantidad, unidad, fecha, origen, precio_unitario, importe_total";

export async function fetchComprasHistorial(): Promise<CompraHistorialRow[]> {
  const { data, error } = await supabase
    .from("compras_historial")
    .select(COMPRA_HISTORIAL_SELECT)
    .order("fecha", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as CompraHistorialDbRow[]).map(compraDesdeFila);
}

export type NuevaCompraHistorialInput = {
  stockItemId: string | null;
  stockItemNombre: string;
  proveedor: Proveedor | null;
  cantidad: number | null;
  unidad: UnidadMedida;
  fecha: string;
  origen?: OrigenCompra;
  precioUnitario?: number | null;
  importeTotal?: number | null;
};

/** Completa el precio unitario/importe total faltante cuando se conoce el otro y la cantidad. */
export function completarPrecio(
  cantidad: number | null,
  precioUnitario: number | null | undefined,
  importeTotal: number | null | undefined
): { precioUnitario: number | null; importeTotal: number | null } {
  if (importeTotal != null && importeTotal > 0) {
    const unitario =
      precioUnitario ?? (cantidad != null && cantidad > 0 ? importeTotal / cantidad : null);
    return { precioUnitario: unitario, importeTotal };
  }
  if (precioUnitario != null && precioUnitario > 0 && cantidad != null && cantidad > 0) {
    return { precioUnitario, importeTotal: precioUnitario * cantidad };
  }
  return { precioUnitario: precioUnitario ?? null, importeTotal: null };
}

export async function insertarComprasHistorial(
  items: NuevaCompraHistorialInput[]
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const payload = items.map((it) => {
    const { precioUnitario, importeTotal } = completarPrecio(
      it.cantidad,
      it.precioUnitario,
      it.importeTotal
    );
    return {
      stock_item_id: it.stockItemId,
      stock_item_nombre: it.stockItemNombre,
      proveedor: it.proveedor,
      cantidad: it.cantidad,
      unidad: it.unidad,
      fecha: it.fecha,
      origen: it.origen ?? "import",
      precio_unitario: precioUnitario,
      importe_total: importeTotal,
    };
  });
  const { error } = await supabase.from("compras_historial").insert(payload);
  if (error) {
    throw error;
  }
}

/** Último precio unitario conocido (compra más reciente con precio) por ítem de Stock. */
export function ultimoPrecioUnitarioPorStockItem(
  rows: CompraHistorialRow[]
): Map<string, number> {
  const map = new Map<string, { fecha: string; precio: number }>();
  rows.forEach((row) => {
    if (!row.stockItemId || row.precioUnitario == null || row.precioUnitario <= 0) {
      return;
    }
    const actual = map.get(row.stockItemId);
    if (!actual || row.fecha >= actual.fecha) {
      map.set(row.stockItemId, { fecha: row.fecha, precio: row.precioUnitario });
    }
  });
  const result = new Map<string, number>();
  map.forEach((v, k) => result.set(k, v.precio));
  return result;
}

/** Agrupa el historial por ítem de Stock vinculado (ignora líneas sin vincular). */
export function agruparComprasPorStockItem(
  rows: CompraHistorialRow[]
): Map<string, CompraHistorialRow[]> {
  const map = new Map<string, CompraHistorialRow[]>();
  rows.forEach((row) => {
    if (!row.stockItemId) {
      return;
    }
    const lista = map.get(row.stockItemId) ?? [];
    lista.push(row);
    map.set(row.stockItemId, lista);
  });
  return map;
}
