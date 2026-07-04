import { type Proveedor, type UnidadMedida } from "@/src/lib/proveedores";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

export type PedidoLogItem = {
  item: string;
  cantidad: string;
  unidad: UnidadMedida;
};

export type PedidoLog = {
  id: string;
  proveedor: Proveedor;
  enviadoAt: string;
  items: PedidoLogItem[];
  totalItems: number;
};

type PedidoLogDbRow = {
  id: string;
  proveedor: string;
  enviado_at: string;
  items: PedidoLogItem[] | null;
  total_items: number | null;
};

const PEDIDO_LOG_SELECT = "id, proveedor, enviado_at, items, total_items";

function logDesdeFila(row: PedidoLogDbRow): PedidoLog {
  return {
    id: row.id,
    proveedor: row.proveedor as Proveedor,
    enviadoAt: row.enviado_at,
    items: Array.isArray(row.items) ? row.items : [],
    totalItems: row.total_items ?? 0,
  };
}

/** Guarda un snapshot del pedido enviado a un proveedor. No lanza: registrar el
 * historial no debe bloquear la acción principal de copiar el pedido. */
export async function registrarPedidoEnviado(
  proveedor: Proveedor,
  items: PedidoLogItem[]
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const { error } = await supabase.from("pedidos_log").insert({
    proveedor,
    items,
    total_items: items.length,
  });
  if (error) {
    // Log silencioso: no interrumpir el flujo de copiar el pedido.
    console.warn("No se pudo registrar el pedido en el historial:", error.message);
  }
}

export async function fetchPedidosLog(): Promise<PedidoLog[]> {
  const { data, error } = await supabase
    .from("pedidos_log")
    .select(PEDIDO_LOG_SELECT)
    .order("enviado_at", { ascending: false });

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return ((data ?? []) as PedidoLogDbRow[]).map(logDesdeFila);
}
