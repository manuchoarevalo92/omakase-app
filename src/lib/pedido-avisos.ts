import { type Proveedor } from "@/src/lib/proveedores";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

export type EstadoAviso = "pendiente" | "resuelto";

/** Aviso manual de "hace falta pedir X", con el ítem de Stock ya resuelto. */
export type PedidoAviso = {
  id: string;
  stockItemId: string;
  nombre: string;
  proveedor: Proveedor | null;
  nota: string | null;
  estado: EstadoAviso;
  createdAt: string;
  resueltoAt: string | null;
};

type PedidoAvisoDbRow = {
  id: string;
  stock_item_id: string;
  nota: string | null;
  estado: string;
  created_at: string;
  resuelto_at: string | null;
  stock_items: {
    nombre: string;
    proveedor: string | null;
  } | null;
};

const PEDIDO_AVISO_SELECT =
  "id, stock_item_id, nota, estado, created_at, resuelto_at, stock_items(nombre, proveedor)";

function avisoDesdeFila(row: PedidoAvisoDbRow): PedidoAviso {
  return {
    id: row.id,
    stockItemId: row.stock_item_id,
    nombre: row.stock_items?.nombre ?? "(ítem borrado)",
    proveedor: (row.stock_items?.proveedor as Proveedor | null) ?? null,
    nota: row.nota?.trim() || null,
    estado: row.estado === "resuelto" ? "resuelto" : "pendiente",
    createdAt: row.created_at,
    resueltoAt: row.resuelto_at,
  };
}

export async function fetchAvisosPendientes(): Promise<PedidoAviso[]> {
  const { data, error } = await supabase
    .from("pedido_avisos")
    .select(PEDIDO_AVISO_SELECT)
    .eq("estado", "pendiente")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return ((data ?? []) as unknown as PedidoAvisoDbRow[]).map(avisoDesdeFila);
}

export async function crearAviso(
  stockItemId: string,
  nota: string
): Promise<PedidoAviso> {
  const { data, error } = await supabase
    .from("pedido_avisos")
    .insert({
      stock_item_id: stockItemId,
      nota: nota.trim() || null,
      estado: "pendiente",
    })
    .select(PEDIDO_AVISO_SELECT)
    .single();

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return avisoDesdeFila(data as unknown as PedidoAvisoDbRow);
}

export async function marcarAvisoResuelto(id: string): Promise<void> {
  const { error } = await supabase
    .from("pedido_avisos")
    .update({ estado: "resuelto", resuelto_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(formatPostgrestError(error));
  }
}

export async function reabrirAviso(id: string): Promise<void> {
  const { error } = await supabase
    .from("pedido_avisos")
    .update({ estado: "pendiente", resuelto_at: null })
    .eq("id", id);

  if (error) {
    throw new Error(formatPostgrestError(error));
  }
}
