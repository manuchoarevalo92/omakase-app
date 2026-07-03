/**
 * Lista única de proveedores y unidades de medida, compartida entre Pedidos,
 * Stock y Compras. Debe coincidir con los CHECK de proveedor en Supabase
 * (pedidos_proveedores, stock_items, compras_historial): si agregás uno acá,
 * corré también supabase/pedidos-proveedores-extend-proveedores.sql (o el
 * equivalente para las tablas nuevas) con el proveedor agregado.
 */
export const PROVEEDORES = [
  "Cominport",
  "Arrom",
  "Pescaderías Coruñesas",
  "García de Pou",
  "Nishikidori",
  "Verdulería",
  "Supermercado",
  "Vila Viniteca",
  "Vinalia",
] as const;

export type Proveedor = (typeof PROVEEDORES)[number];

export function esProveedorValido(valor: string | null | undefined): valor is Proveedor {
  if (!valor) {
    return false;
  }
  return (PROVEEDORES as readonly string[]).includes(valor);
}

export const UNIDADES: readonly UnidadMedida[] = ["Caja", "Kilo", "Unidad"] as const;

export type UnidadMedida = "Caja" | "Kilo" | "Unidad";

/** Reconoce texto suelto ("cajas", "kg", "uds"...) y lo normaliza a una unidad canónica. */
export function normalizarUnidadDesdeTexto(s: string): UnidadMedida | null {
  const t = s.trim();
  if ((UNIDADES as readonly string[]).includes(t)) {
    return t as UnidadMedida;
  }
  const lower = t.toLowerCase();
  if (lower === "caja" || lower === "cajas") return "Caja";
  if (lower === "kilo" || lower === "kg" || lower === "kilos") return "Kilo";
  if (lower === "unidad" || lower === "unidades" || lower === "ud" || lower === "uds" || lower === "u.")
    return "Unidad";
  return null;
}
