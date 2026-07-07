import {
  ETIQUETA_AREA_PRODUCCION,
  esAreaProduccionValida,
  esUnidadCantidadValida,
  type AreaProduccion,
  type Preparacion,
  type UnidadCantidad,
} from "@/src/lib/preparaciones";
import {
  formatearDuracionLegible,
  type ProduccionResumenPreparacion,
} from "@/src/lib/produccion-sesiones";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

export type SessionUsuario = { id: string; name: string };

export type ProduccionBloque = {
  id: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  area: AreaProduccion;
  titulo: string;
  activo: boolean;
  orden: number;
  createdAt: string;
};

export type ProduccionBloqueDbRow = {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  area?: string | null;
  titulo: string;
  activo?: boolean | null;
  orden?: number | null;
  created_at: string;
};

export type ProduccionPlanEstado = "pendiente" | "completada" | "cancelada";

export type ProduccionPlanItem = {
  id: string;
  fecha: string;
  bloqueId: string | null;
  preparacionId: string | null;
  preparacionNombre: string;
  area: AreaProduccion;
  duracionEstimadaSegundos: number;
  cantidadPlanificada: number | null;
  unidadCantidad: UnidadCantidad | null;
  asignadoAId: string | null;
  asignadoANombre: string | null;
  notas: string | null;
  estado: ProduccionPlanEstado;
  orden: number;
  creadoPorId: string | null;
  creadoPorNombre: string | null;
  createdAt: string;
};

export type ProduccionPlanItemDbRow = {
  id: string;
  fecha: string;
  bloque_id?: string | null;
  preparacion_id?: string | null;
  preparacion_nombre: string;
  area?: string | null;
  duracion_estimada_segundos: number;
  cantidad_planificada?: number | null;
  unidad_cantidad?: string | null;
  asignado_a_id?: string | null;
  asignado_a_nombre?: string | null;
  notas?: string | null;
  estado?: string | null;
  orden?: number | null;
  creado_por_id?: string | null;
  creado_por_nombre?: string | null;
  created_at: string;
};

export const DIAS_SEMANA_ISO = [
  { valor: 1, corto: "Lun", largo: "Lunes" },
  { valor: 2, corto: "Mar", largo: "Martes" },
  { valor: 3, corto: "Mié", largo: "Miércoles" },
  { valor: 4, corto: "Jue", largo: "Jueves" },
  { valor: 5, corto: "Vie", largo: "Viernes" },
  { valor: 6, corto: "Sáb", largo: "Sábado" },
  { valor: 7, corto: "Dom", largo: "Domingo" },
] as const;

export const PRODUCCION_BLOQUE_SELECT =
  "id, dia_semana, hora_inicio, hora_fin, area, titulo, activo, orden, created_at";

export const PRODUCCION_PLAN_SELECT =
  "id, fecha, bloque_id, preparacion_id, preparacion_nombre, area, duracion_estimada_segundos, cantidad_planificada, unidad_cantidad, asignado_a_id, asignado_a_nombre, notas, estado, orden, creado_por_id, creado_por_nombre, created_at";

const DURACION_DEFECTO_SEGUNDOS = 60 * 60;

export function formatFechaLocalYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function parseFechaLocalISO(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/** 1=lunes … 7=domingo (ISO). */
export function diaSemanaIsoDesdeFecha(fecha: string): number {
  const d = parseFechaLocalISO(fecha).getDay();
  return d === 0 ? 7 : d;
}

export function lunesDeSemanaDe(fecha: string): string {
  const d = parseFechaLocalISO(fecha);
  const dia = diaSemanaIsoDesdeFecha(fecha);
  d.setDate(d.getDate() - (dia - 1));
  return formatFechaLocalYYYYMMDD(d);
}

export function fechasSemanaDesdeLunes(lunes: string): string[] {
  const base = parseFechaLocalISO(lunes);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return formatFechaLocalYYYYMMDD(d);
  });
}

export function etiquetaSemana(lunes: string): string {
  const fechas = fechasSemanaDesdeLunes(lunes);
  const ini = parseFechaLocalISO(fechas[0]!);
  const fin = parseFechaLocalISO(fechas[6]!);
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  return `${fmt(ini)} – ${fmt(fin)}`;
}

export function etiquetaDiaSemanaIso(dia: number): string {
  return DIAS_SEMANA_ISO.find((d) => d.valor === dia)?.largo ?? `Día ${dia}`;
}

export function etiquetaDiaSemanaCorto(dia: number): string {
  return DIAS_SEMANA_ISO.find((d) => d.valor === dia)?.corto ?? `D${dia}`;
}

export function minutosDesdeMedianoche(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function duracionBloqueSegundos(bloque: ProduccionBloque): number {
  const ini = minutosDesdeMedianoche(bloque.horaInicio);
  const fin = minutosDesdeMedianoche(bloque.horaFin);
  return Math.max(0, (fin - ini) * 60);
}

export function etiquetaHorarioBloque(bloque: ProduccionBloque): string {
  return `${bloque.horaInicio}–${bloque.horaFin}`;
}

export function bloqueDesdeFila(row: ProduccionBloqueDbRow): ProduccionBloque {
  return {
    id: row.id,
    diaSemana: row.dia_semana,
    horaInicio: row.hora_inicio,
    horaFin: row.hora_fin,
    area: esAreaProduccionValida(row.area) ? row.area : "delivery",
    titulo: row.titulo,
    activo: row.activo !== false,
    orden: row.orden ?? 0,
    createdAt: row.created_at,
  };
}

export function planItemDesdeFila(row: ProduccionPlanItemDbRow): ProduccionPlanItem {
  const estado = row.estado;
  const estadoValido: ProduccionPlanEstado =
    estado === "completada" || estado === "cancelada" ? estado : "pendiente";
  return {
    id: row.id,
    fecha: row.fecha,
    bloqueId: row.bloque_id ?? null,
    preparacionId: row.preparacion_id ?? null,
    preparacionNombre: row.preparacion_nombre,
    area: esAreaProduccionValida(row.area) ? row.area : "delivery",
    duracionEstimadaSegundos: row.duracion_estimada_segundos,
    cantidadPlanificada:
      row.cantidad_planificada != null && row.cantidad_planificada > 0
        ? row.cantidad_planificada
        : null,
    unidadCantidad: esUnidadCantidadValida(row.unidad_cantidad) ? row.unidad_cantidad : null,
    asignadoAId: row.asignado_a_id ?? null,
    asignadoANombre: row.asignado_a_nombre ?? null,
    notas: row.notas?.trim() || null,
    estado: estadoValido,
    orden: row.orden ?? 0,
    creadoPorId: row.creado_por_id ?? null,
    creadoPorNombre: row.creado_por_nombre ?? null,
    createdAt: row.created_at,
  };
}

export function estimarDuracionSegundos(
  preparacionId: string,
  resumenes: ProduccionResumenPreparacion[]
): number {
  const resumen = resumenes.find((r) => r.preparacionId === preparacionId);
  return resumen?.duracionMedianaSegundos ?? DURACION_DEFECTO_SEGUNDOS;
}

export function usoBloqueSegundos(items: ProduccionPlanItem[]): number {
  return items
    .filter((i) => i.estado !== "cancelada")
    .reduce((acc, i) => acc + i.duracionEstimadaSegundos, 0);
}

export function bloqueSobrecargado(
  bloque: ProduccionBloque,
  items: ProduccionPlanItem[]
): boolean {
  const capacidad = duracionBloqueSegundos(bloque);
  if (capacidad <= 0) {
    return false;
  }
  return usoBloqueSegundos(items) > capacidad;
}

export function etiquetaUsoBloque(bloque: ProduccionBloque, items: ProduccionPlanItem[]): string {
  const uso = usoBloqueSegundos(items);
  const cap = duracionBloqueSegundos(bloque);
  if (cap <= 0) {
    return formatearDuracionLegible(uso);
  }
  return `${formatearDuracionLegible(uso)} / ${formatearDuracionLegible(cap)}`;
}

export function etiquetaAreaPlan(area: AreaProduccion): string {
  return ETIQUETA_AREA_PRODUCCION[area];
}

export async function fetchProduccionBloques(): Promise<ProduccionBloque[]> {
  const { data, error } = await supabase
    .from("produccion_bloques")
    .select(PRODUCCION_BLOQUE_SELECT)
    .eq("activo", true)
    .order("dia_semana", { ascending: true })
    .order("orden", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return ((data ?? []) as ProduccionBloqueDbRow[]).map(bloqueDesdeFila);
}

export async function fetchProduccionBloquesTodos(): Promise<ProduccionBloque[]> {
  const { data, error } = await supabase
    .from("produccion_bloques")
    .select(PRODUCCION_BLOQUE_SELECT)
    .order("dia_semana", { ascending: true })
    .order("orden", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return ((data ?? []) as ProduccionBloqueDbRow[]).map(bloqueDesdeFila);
}

export async function fetchProduccionPlanSemana(
  lunes: string
): Promise<ProduccionPlanItem[]> {
  const fechas = fechasSemanaDesdeLunes(lunes);
  const { data, error } = await supabase
    .from("produccion_plan")
    .select(PRODUCCION_PLAN_SELECT)
    .gte("fecha", fechas[0])
    .lte("fecha", fechas[6])
    .neq("estado", "cancelada")
    .order("fecha", { ascending: true })
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return ((data ?? []) as ProduccionPlanItemDbRow[]).map(planItemDesdeFila);
}

type UsuarioPayload = {
  creado_por_id: string | null;
  creado_por_nombre: string | null;
};

function usuarioPayload(usuario: SessionUsuario | null): UsuarioPayload {
  if (!usuario) {
    return { creado_por_id: null, creado_por_nombre: null };
  }
  return { creado_por_id: usuario.id, creado_por_nombre: usuario.name };
}

export async function crearProduccionBloque(opts: {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  area: AreaProduccion;
  titulo: string;
}): Promise<ProduccionBloque> {
  const { data, error } = await supabase
    .from("produccion_bloques")
    .insert({
      dia_semana: opts.diaSemana,
      hora_inicio: opts.horaInicio,
      hora_fin: opts.horaFin,
      area: opts.area,
      titulo: opts.titulo.trim(),
    })
    .select(PRODUCCION_BLOQUE_SELECT)
    .single();

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return bloqueDesdeFila(data as ProduccionBloqueDbRow);
}

export async function actualizarProduccionBloque(
  id: string,
  patch: Partial<{
    dia_semana: number;
    hora_inicio: string;
    hora_fin: string;
    area: AreaProduccion;
    titulo: string;
    activo: boolean;
    orden: number;
  }>
): Promise<ProduccionBloque> {
  const { data, error } = await supabase
    .from("produccion_bloques")
    .update(patch)
    .eq("id", id)
    .select(PRODUCCION_BLOQUE_SELECT)
    .single();

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return bloqueDesdeFila(data as ProduccionBloqueDbRow);
}

export async function eliminarProduccionBloque(id: string): Promise<void> {
  const { error } = await supabase.from("produccion_bloques").delete().eq("id", id);

  if (error) {
    throw new Error(formatPostgrestError(error));
  }
}

export async function crearProduccionPlanItem(opts: {
  fecha: string;
  bloqueId: string;
  prep: Preparacion;
  duracionEstimadaSegundos: number;
  cantidadPlanificada?: number | null;
  notas?: string | null;
  asignado?: SessionUsuario | null;
  usuario: SessionUsuario | null;
}): Promise<ProduccionPlanItem> {
  const { data, error } = await supabase
    .from("produccion_plan")
    .insert({
      fecha: opts.fecha,
      bloque_id: opts.bloqueId,
      preparacion_id: opts.prep.id,
      preparacion_nombre: opts.prep.nombre,
      area: opts.prep.area,
      duracion_estimada_segundos: opts.duracionEstimadaSegundos,
      cantidad_planificada: opts.cantidadPlanificada ?? null,
      unidad_cantidad: opts.prep.unidadCantidad,
      asignado_a_id: opts.asignado?.id ?? null,
      asignado_a_nombre: opts.asignado?.name ?? null,
      notas: opts.notas?.trim() || null,
      ...usuarioPayload(opts.usuario),
    })
    .select(PRODUCCION_PLAN_SELECT)
    .single();

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return planItemDesdeFila(data as ProduccionPlanItemDbRow);
}

export async function actualizarProduccionPlanItem(
  id: string,
  patch: Partial<{
    duracion_estimada_segundos: number;
    cantidad_planificada: number | null;
    notas: string | null;
    estado: ProduccionPlanEstado;
    asignado_a_id: string | null;
    asignado_a_nombre: string | null;
  }>
): Promise<ProduccionPlanItem> {
  const { data, error } = await supabase
    .from("produccion_plan")
    .update(patch)
    .eq("id", id)
    .select(PRODUCCION_PLAN_SELECT)
    .single();

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return planItemDesdeFila(data as ProduccionPlanItemDbRow);
}

export async function eliminarProduccionPlanItem(id: string): Promise<void> {
  const { error } = await supabase.from("produccion_plan").delete().eq("id", id);

  if (error) {
    throw new Error(formatPostgrestError(error));
  }
}

export async function marcarPlanItemCompletado(id: string): Promise<ProduccionPlanItem> {
  return actualizarProduccionPlanItem(id, { estado: "completada" });
}

export async function marcarPlanItemPendiente(id: string): Promise<ProduccionPlanItem> {
  return actualizarProduccionPlanItem(id, { estado: "pendiente" });
}
