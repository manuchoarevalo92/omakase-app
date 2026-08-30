/**
 * Lista de proveedores y unidades de medida, compartida entre Pedidos,
 * Stock, Compras y Avisos. La fuente de verdad es public.proveedores;
 * PROVEEDORES es semilla + fallback si falla el fetch.
 */
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

export const PROVEEDORES = [
  "Cominport",
  "Arrom",
  "Pescaderías Coruñesas",
  "García de Pou",
  "Nishikidori",
  "Isse Japan",
  "Amazon",
  "Frutas Eloy",
  "MAKRO",
  "BBQ FLAVOUR",
  "Vila Viniteca",
  "Vinalia",
  "Salvioni y Alomar",
] as const;

export type Proveedor = string;

const SEMILLA = new Set<string>(PROVEEDORES);

/** Nombres viejos que pueden quedar en localStorage o datos legacy. */
export const ALIAS_PROVEEDOR: Record<string, Proveedor> = {
  Supermercado: "MAKRO",
  Macro: "MAKRO",
  Verdulería: "Frutas Eloy",
  Verdurería: "Frutas Eloy",
  "ISSÉ JAPAN": "Isse Japan",
  "ISSE JAPAN": "Isse Japan",
  Isse: "Isse Japan",
};

export function esProveedorValido(valor: string | null | undefined): valor is Proveedor {
  return Boolean(valor?.trim());
}

export function proveedorCanonico(valor: string | null | undefined): Proveedor | null {
  if (!valor?.trim()) return null;
  const t = valor.trim();
  return ALIAS_PROVEEDOR[t] ?? t;
}

export function ordenarProveedores(lista: Iterable<string>): Proveedor[] {
  const set = new Set<string>();
  for (const raw of lista) {
    const n = proveedorCanonico(raw);
    if (n) set.add(n);
  }
  const cabeza = PROVEEDORES.filter((p) => set.has(p));
  const cola = [...set]
    .filter((p) => !SEMILLA.has(p))
    .sort((a, b) => a.localeCompare(b, "es"));
  return [...cabeza, ...cola];
}

export async function fetchProveedores(): Promise<Proveedor[]> {
  const { data, error } = await supabase
    .from("proveedores")
    .select("nombre")
    .order("nombre", { ascending: true });

  if (error) {
    throw new Error(formatPostgrestError(error));
  }
  const nombres = ((data ?? []) as { nombre: string }[])
    .map((r) => r.nombre)
    .filter(Boolean);
  return ordenarProveedores(nombres.length > 0 ? nombres : PROVEEDORES);
}

export async function crearProveedor(nombre: string): Promise<Proveedor> {
  const limpio = nombre.trim().replace(/\s+/g, " ");
  if (!limpio) {
    throw new Error("El nombre del proveedor es obligatorio.");
  }
  const alias = ALIAS_PROVEEDOR[limpio];
  const canonico = alias ?? limpio;

  const { error } = await supabase.from("proveedores").insert({ nombre: canonico });
  if (error) {
    const msg = error.message.toLowerCase();
    const duplicado =
      msg.includes("duplicate") ||
      msg.includes("unique") ||
      msg.includes("proveedores_nombre");
    if (!duplicado) {
      throw new Error(formatPostgrestError(error));
    }
    const { data: existente } = await supabase
      .from("proveedores")
      .select("nombre")
      .ilike("nombre", limpio)
      .maybeSingle();
    if (existente?.nombre) {
      return existente.nombre;
    }
  }

  const { error: pedidoError } = await supabase
    .from("pedidos_proveedores")
    .insert({ proveedor: canonico, items: [] });
  if (pedidoError) {
    const msg = pedidoError.message.toLowerCase();
    const duplicado = msg.includes("duplicate") || msg.includes("unique");
    if (!duplicado) {
      throw new Error(formatPostgrestError(pedidoError));
    }
  }

  return canonico;
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
