import { BUFFER_PCT_DEFECTO } from "@/src/lib/compras-prediccion";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

export const AREAS_PRODUCCION = ["delivery", "barra"] as const;

export type AreaProduccion = (typeof AREAS_PRODUCCION)[number];

export const ETIQUETA_AREA_PRODUCCION: Record<AreaProduccion, string> = {
  delivery: "Delivery",
  barra: "Barra",
};

export const UNIDADES_CANTIDAD = ["L", "ml", "kg", "g", "ud"] as const;

export type UnidadCantidad = (typeof UNIDADES_CANTIDAD)[number];

export function esAreaProduccionValida(valor: string | null | undefined): valor is AreaProduccion {
  if (!valor) {
    return false;
  }
  return (AREAS_PRODUCCION as readonly string[]).includes(valor);
}

export function esUnidadCantidadValida(valor: string | null | undefined): valor is UnidadCantidad {
  if (!valor) {
    return false;
  }
  return (UNIDADES_CANTIDAD as readonly string[]).includes(valor);
}

export type Preparacion = {
  id: string;
  nombre: string;
  area: AreaProduccion;
  duracionDias: number;
  bufferPct: number;
  seguimientoActivo: boolean;
  pendiente: boolean;
  fechaUltimaProduccion: string | null;
  cantidadReferencia: number;
  unidadCantidad: UnidadCantidad;
  ultimaCantidad: number | null;
  notas: string | null;
};

export type PreparacionDbRow = {
  id: string;
  nombre: string;
  area?: string | null;
  duracion_dias?: number | null;
  buffer_pct?: number | null;
  seguimiento_activo?: boolean | null;
  pendiente?: boolean | null;
  fecha_ultima_produccion?: string | null;
  cantidad_referencia?: number | null;
  unidad_cantidad?: string | null;
  ultima_cantidad?: number | null;
  notas?: string | null;
};

export const PREPARACION_SELECT =
  "id, nombre, area, duracion_dias, buffer_pct, seguimiento_activo, pendiente, fecha_ultima_produccion, cantidad_referencia, unidad_cantidad, ultima_cantidad, notas";

function parseCantidadDb(valor: number | null | undefined): number | null {
  if (valor == null || !Number.isFinite(valor) || valor <= 0) {
    return null;
  }
  return valor;
}

export function formatearCantidad(cantidad: number, unidad: UnidadCantidad): string {
  const n = cantidad.toLocaleString("es-ES", {
    maximumFractionDigits: 3,
    minimumFractionDigits: Number.isInteger(cantidad) ? 0 : undefined,
  });
  return `${n} ${unidad}`;
}

export function preparacionDesdeFila(row: PreparacionDbRow): Preparacion {
  const cantidadRef = parseCantidadDb(row.cantidad_referencia) ?? 1;
  return {
    id: row.id,
    nombre: row.nombre,
    area: esAreaProduccionValida(row.area) ? row.area : "delivery",
    duracionDias: row.duracion_dias != null && row.duracion_dias > 0 ? row.duracion_dias : 7,
    bufferPct: row.buffer_pct != null ? row.buffer_pct : BUFFER_PCT_DEFECTO,
    seguimientoActivo: row.seguimiento_activo !== false,
    pendiente: row.pendiente === true,
    fechaUltimaProduccion: row.fecha_ultima_produccion?.trim() || null,
    cantidadReferencia: cantidadRef,
    unidadCantidad: esUnidadCantidadValida(row.unidad_cantidad) ? row.unidad_cantidad : "ud",
    ultimaCantidad: parseCantidadDb(row.ultima_cantidad),
    notas: row.notas?.trim() || null,
  };
}

export function cantidadSugeridaAlMarcar(prep: Preparacion): number {
  return prep.ultimaCantidad ?? prep.cantidadReferencia;
}

export async function fetchPreparaciones(): Promise<Preparacion[]> {
  const { data, error } = await supabase
    .from("preparaciones")
    .select(PREPARACION_SELECT)
    .order("nombre", { ascending: true });

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return ((data ?? []) as PreparacionDbRow[]).map(preparacionDesdeFila);
}

export function hoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function parseCantidadInput(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) {
    return null;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}
