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

export const CATEGORIAS_PLAN = [
  "prep_barra",
  "servicio_barra",
  "servicio_delivery",
] as const;

export type CategoriaPlan = (typeof CATEGORIAS_PLAN)[number];

export const ETIQUETA_CATEGORIA_PLAN: Record<CategoriaPlan, string> = {
  prep_barra: "Prep Barra",
  servicio_barra: "Servicio Barra",
  servicio_delivery: "Servicio delivery",
};

export function esCategoriaPlanValida(valor: string | null | undefined): valor is CategoriaPlan {
  if (!valor) {
    return false;
  }
  return (CATEGORIAS_PLAN as readonly string[]).includes(valor);
}

export function categoriaPlanEsServicio(categoria: CategoriaPlan): boolean {
  return categoria === "servicio_barra" || categoria === "servicio_delivery";
}

export function categoriaPlanEsManual(categoria: CategoriaPlan): boolean {
  return categoria === "prep_barra";
}

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
  categoriaPlan: CategoriaPlan;
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
  categoria_plan?: string | null;
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
  "id, nombre, area, categoria_plan, duracion_dias, buffer_pct, seguimiento_activo, pendiente, fecha_ultima_produccion, cantidad_referencia, unidad_cantidad, ultima_cantidad, notas";

const PREPARACION_SELECT_SIN_CATEGORIA_PLAN =
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
    categoriaPlan: esCategoriaPlanValida(row.categoria_plan) ? row.categoria_plan : "prep_barra",
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

  if (!error) {
    return ((data ?? []) as PreparacionDbRow[]).map(preparacionDesdeFila);
  }

  const msg = error.message.toLowerCase();
  if (msg.includes("column") && msg.includes("categoria_plan")) {
    const legacy = await supabase
      .from("preparaciones")
      .select(PREPARACION_SELECT_SIN_CATEGORIA_PLAN)
      .order("nombre", { ascending: true });
    if (legacy.error) {
      throw new Error(formatPostgrestError(legacy.error));
    }
    return ((legacy.data ?? []) as PreparacionDbRow[]).map(preparacionDesdeFila);
  }

  throw new Error(formatPostgrestError(error));
}

export type CrearPreparacionInput = {
  nombre: string;
  area: AreaProduccion;
  categoriaPlan?: CategoriaPlan;
  duracionDias?: number;
  cantidadReferencia?: number;
  unidadCantidad?: UnidadCantidad;
  notas?: string | null;
  seguimientoActivo?: boolean;
  pendiente?: boolean;
};

export async function crearPreparacion(input: CrearPreparacionInput): Promise<Preparacion> {
  const nombre = input.nombre.trim();
  if (!nombre) {
    throw new Error("El nombre es obligatorio.");
  }
  const duracionDias = input.duracionDias ?? 7;
  if (!Number.isFinite(duracionDias) || duracionDias < 1) {
    throw new Error("La duración debe ser al menos 1 día.");
  }
  const cantidadReferencia = input.cantidadReferencia ?? 1;
  if (cantidadReferencia <= 0) {
    throw new Error("El lote típico debe ser mayor que 0.");
  }
  const unidadCantidad = input.unidadCantidad ?? "ud";

  const { data, error } = await supabase
    .from("preparaciones")
    .insert({
      nombre,
      area: input.area,
      categoria_plan: input.categoriaPlan ?? "prep_barra",
      duracion_dias: duracionDias,
      cantidad_referencia: cantidadReferencia,
      unidad_cantidad: unidadCantidad,
      notas: input.notas?.trim() || null,
      seguimiento_activo: input.seguimientoActivo ?? true,
      pendiente: input.pendiente ?? false,
    })
    .select(PREPARACION_SELECT)
    .single();

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return preparacionDesdeFila(data as PreparacionDbRow);
}

export type ActualizarCategoriaPlanResult = {
  preparacion: Preparacion;
  planItemsActualizados: number;
};

/** Cambia la categoría de plan de una preparación y propaga a todos sus bloques en produccion_plan. */
export async function actualizarCategoriaPlanPreparacion(
  preparacionId: string,
  categoriaPlan: CategoriaPlan
): Promise<ActualizarCategoriaPlanResult> {
  const { data, error } = await supabase
    .from("preparaciones")
    .update({ categoria_plan: categoriaPlan })
    .eq("id", preparacionId)
    .select(PREPARACION_SELECT)
    .single();

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  const { data: planRows, error: planError } = await supabase
    .from("produccion_plan")
    .update({ categoria: categoriaPlan })
    .eq("preparacion_id", preparacionId)
    .neq("estado", "cancelada")
    .select("id");

  if (planError) {
    throw new Error(formatPostgrestError(planError));
  }

  return {
    preparacion: preparacionDesdeFila(data as PreparacionDbRow),
    planItemsActualizados: planRows?.length ?? 0,
  };
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
