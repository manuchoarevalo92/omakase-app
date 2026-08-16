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
  "Amazon",
  "Frutas Eloy",
  "Macro",
  "Vila Viniteca",
  "Vinalia",
] as const;

export type Proveedor = (typeof PROVEEDORES)[number];

/** Nombres viejos que pueden quedar en localStorage o datos legacy. */
export const ALIAS_PROVEEDOR: Record<string, Proveedor> = {
  Supermercado: "Macro",
  Verdulería: "Frutas Eloy",
  Verdurería: "Frutas Eloy",
};

export function esProveedorValido(valor: string | null | undefined): valor is Proveedor {
  if (!valor) {
    return false;
  }
  return (PROVEEDORES as readonly string[]).includes(valor);
}

export function proveedorCanonico(valor: string | null | undefined): Proveedor | null {
  if (!valor) return null;
  if (esProveedorValido(valor)) return valor;
  const alias = ALIAS_PROVEEDOR[valor];
  return alias ?? null;
}

/** Lee un mapa keyed por proveedor (localStorage) resolviendo nombres viejos. */
export function datoLegacyPorProveedor<T>(
  parsed: Partial<Record<string, T>> | null | undefined,
  proveedor: Proveedor
): T | undefined {
  if (!parsed) return undefined;
  if (parsed[proveedor] !== undefined) return parsed[proveedor];
  for (const [viejo, actual] of Object.entries(ALIAS_PROVEEDOR)) {
    if (actual === proveedor && parsed[viejo] !== undefined) {
      return parsed[viejo];
    }
  }
  return undefined;
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
