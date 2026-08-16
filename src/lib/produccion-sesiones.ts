import {
  ETIQUETA_AREA_PRODUCCION,
  esAreaProduccionValida,
  esUnidadCantidadValida,
  type AreaProduccion,
  type Preparacion,
  type UnidadCantidad,
} from "@/src/lib/preparaciones";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

export type SessionUsuario = { id: string; name: string; role: "admin" | "staff" };

export type ProduccionSesion = {
  id: string;
  preparacionId: string | null;
  preparacionNombre: string;
  area: AreaProduccion;
  startedAt: string;
  endedAt: string | null;
  pausadoAt: string | null;
  pausaTotalSegundos: number;
  duracionSegundos: number | null;
  cantidadProducida: number | null;
  unidadCantidad: UnidadCantidad | null;
  hechoPorId: string | null;
  hechoPorNombre: string | null;
  notas: string | null;
  esManual: boolean;
  createdAt: string;
};

export type ProduccionSesionDbRow = {
  id: string;
  preparacion_id?: string | null;
  preparacion_nombre: string;
  area?: string | null;
  started_at: string;
  ended_at?: string | null;
  pausado_at?: string | null;
  pausa_total_segundos?: number | null;
  duracion_segundos?: number | null;
  cantidad_producida?: number | null;
  unidad_cantidad?: string | null;
  hecho_por_id?: string | null;
  hecho_por_nombre?: string | null;
  notas?: string | null;
  es_manual?: boolean | null;
  created_at: string;
};

export type ProduccionResumenPreparacion = {
  preparacionId: string | null;
  preparacionNombre: string;
  area: AreaProduccion;
  unidadCantidad: UnidadCantidad | null;
  cantidadMediana: number | null;
  duracionMedianaSegundos: number | null;
  /** Mediana de segundos por unidad (solo sesiones con cantidad). */
  segundosPorUnidadMediana: number | null;
  duracionMinSegundos: number | null;
  duracionMaxSegundos: number | null;
  totalSesiones: number;
  sesionesConCantidad: number;
};

export const PRODUCCION_SESION_SELECT =
  "id, preparacion_id, preparacion_nombre, area, started_at, ended_at, pausado_at, pausa_total_segundos, duracion_segundos, cantidad_producida, unidad_cantidad, hecho_por_id, hecho_por_nombre, notas, es_manual, created_at";

export async function fetchSessionUsuario(): Promise<SessionUsuario | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const data = (await res.json()) as {
      session: { id: string; name: string; role?: "admin" | "staff" } | null;
    };
    if (data.session?.id && data.session?.name) {
      return {
        id: data.session.id,
        name: data.session.name,
        role: data.session.role === "admin" ? "admin" : "staff",
      };
    }
  } catch {
    // sin sesión
  }
  return null;
}

function parseCantidadDb(valor: number | null | undefined): number | null {
  if (valor == null || !Number.isFinite(valor) || valor <= 0) {
    return null;
  }
  return valor;
}

export function sesionDesdeFila(row: ProduccionSesionDbRow): ProduccionSesion {
  return {
    id: row.id,
    preparacionId: row.preparacion_id ?? null,
    preparacionNombre: row.preparacion_nombre,
    area: esAreaProduccionValida(row.area) ? row.area : "delivery",
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
    pausadoAt: row.pausado_at ?? null,
    pausaTotalSegundos: row.pausa_total_segundos ?? 0,
    duracionSegundos: row.duracion_segundos ?? null,
    cantidadProducida: parseCantidadDb(row.cantidad_producida),
    unidadCantidad: esUnidadCantidadValida(row.unidad_cantidad) ? row.unidad_cantidad : null,
    hechoPorId: row.hecho_por_id ?? null,
    hechoPorNombre: row.hecho_por_nombre ?? null,
    notas: row.notas?.trim() || null,
    esManual: row.es_manual === true,
    createdAt: row.created_at,
  };
}

export function sesionEstaActiva(sesion: ProduccionSesion): boolean {
  return sesion.endedAt === null;
}

export function sesionEstaPausada(sesion: ProduccionSesion): boolean {
  return sesionEstaActiva(sesion) && sesion.pausadoAt !== null;
}

export function segundosTranscurridosSesion(
  sesion: ProduccionSesion,
  ahora = Date.now()
): number {
  const inicio = new Date(sesion.startedAt).getTime();
  let pausaExtra = sesion.pausaTotalSegundos;
  if (sesion.pausadoAt) {
    pausaExtra += Math.max(0, Math.floor((ahora - new Date(sesion.pausadoAt).getTime()) / 1000));
  }
  const bruto = Math.max(0, Math.floor((ahora - inicio) / 1000) - pausaExtra);
  if (sesion.duracionSegundos != null && sesion.endedAt) {
    return sesion.duracionSegundos;
  }
  return bruto;
}

export function formatearDuracionSegundos(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatearDuracionLegible(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0 && m > 0) {
    return `${h} h ${m} min`;
  }
  if (h > 0) {
    return `${h} h`;
  }
  if (m > 0) {
    return `${m} min`;
  }
  return `${total} s`;
}

export function etiquetaSesionProduccion(sesion: ProduccionSesion): string {
  const fecha = sesion.startedAt.slice(0, 10);
  const duracion =
    sesion.duracionSegundos != null
      ? formatearDuracionLegible(sesion.duracionSegundos)
      : "en curso";
  return `${fecha} · ${sesion.preparacionNombre} · ${duracion}`;
}

function mediana(nums: number[]): number | null {
  if (!nums.length) {
    return null;
  }
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return sorted[mid]!;
}

export function calcularResumenesPorPreparacion(
  sesiones: ProduccionSesion[]
): ProduccionResumenPreparacion[] {
  const completadas = sesiones.filter(
    (s) => s.endedAt && s.duracionSegundos != null && s.duracionSegundos > 0
  );
  const porClave = new Map<string, ProduccionSesion[]>();

  for (const s of completadas) {
    const clave = s.preparacionId ?? `nombre:${s.preparacionNombre.toLowerCase()}`;
    const lista = porClave.get(clave) ?? [];
    lista.push(s);
    porClave.set(clave, lista);
  }

  const resumenes: ProduccionResumenPreparacion[] = [];
  for (const lista of porClave.values()) {
    const ref = lista[0]!;
    const duraciones = lista.map((s) => s.duracionSegundos!);
    const cantidades = lista
      .map((s) => s.cantidadProducida)
      .filter((c): c is number => c != null);
    const ratios = lista
      .filter(
        (s) =>
          s.duracionSegundos != null &&
          s.duracionSegundos > 0 &&
          s.cantidadProducida != null &&
          s.cantidadProducida > 0
      )
      .map((s) => s.duracionSegundos! / s.cantidadProducida!);
    resumenes.push({
      preparacionId: ref.preparacionId,
      preparacionNombre: ref.preparacionNombre,
      area: ref.area,
      unidadCantidad: ref.unidadCantidad,
      cantidadMediana: mediana(cantidades),
      duracionMedianaSegundos: mediana(duraciones),
      segundosPorUnidadMediana: mediana(ratios),
      duracionMinSegundos: duraciones.length ? Math.min(...duraciones) : null,
      duracionMaxSegundos: duraciones.length ? Math.max(...duraciones) : null,
      totalSesiones: lista.length,
      sesionesConCantidad: ratios.length,
    });
  }

  return resumenes.sort((a, b) =>
    a.preparacionNombre.localeCompare(b.preparacionNombre, "es")
  );
}

const DURACION_DEFECTO_SEGUNDOS = 60 * 60;

/** Convierte cantidad a la unidad de referencia del historial (g↔kg, ml↔L). */
export function cantidadEnUnidadReferencia(
  cantidad: number,
  unidad: UnidadCantidad,
  unidadReferencia: UnidadCantidad
): number | null {
  if (unidad === unidadReferencia) {
    return cantidad;
  }
  if (unidad === "g" && unidadReferencia === "kg") {
    return cantidad / 1000;
  }
  if (unidad === "kg" && unidadReferencia === "g") {
    return cantidad * 1000;
  }
  if (unidad === "ml" && unidadReferencia === "L") {
    return cantidad / 1000;
  }
  if (unidad === "L" && unidadReferencia === "ml") {
    return cantidad * 1000;
  }
  return null;
}

export type EstimacionDuracionCantidad = {
  segundos: number;
  escaladoPorCantidad: boolean;
};

/** Estima duración escalando por cantidad si hay historial con unidades. */
export function estimarDuracionSegundosPorCantidad(
  preparacionId: string,
  cantidad: number | null | undefined,
  unidad: UnidadCantidad | null | undefined,
  resumenes: ProduccionResumenPreparacion[]
): EstimacionDuracionCantidad {
  const resumen = resumenes.find((r) => r.preparacionId === preparacionId);
  const fallback = resumen?.duracionMedianaSegundos ?? DURACION_DEFECTO_SEGUNDOS;

  if (
    !cantidad ||
    cantidad <= 0 ||
    !unidad ||
    !resumen?.segundosPorUnidadMediana ||
    !resumen.unidadCantidad
  ) {
    return { segundos: fallback, escaladoPorCantidad: false };
  }

  const normalizada = cantidadEnUnidadReferencia(cantidad, unidad, resumen.unidadCantidad);
  if (normalizada == null) {
    return { segundos: fallback, escaladoPorCantidad: false };
  }

  return {
    segundos: Math.max(60, Math.round(normalizada * resumen.segundosPorUnidadMediana)),
    escaladoPorCantidad: true,
  };
}

export function etiquetaRitmoProduccion(resumen: ProduccionResumenPreparacion): string | null {
  if (
    resumen.segundosPorUnidadMediana == null ||
    !resumen.unidadCantidad ||
    resumen.sesionesConCantidad === 0
  ) {
    return null;
  }
  const minPorUnidad = resumen.segundosPorUnidadMediana / 60;
  const fmt =
    minPorUnidad >= 1
      ? `${minPorUnidad.toLocaleString("es-AR", { maximumFractionDigits: 1 })} min/${resumen.unidadCantidad}`
      : `${(resumen.segundosPorUnidadMediana).toLocaleString("es-AR", { maximumFractionDigits: 0 })} s/${resumen.unidadCantidad}`;
  return fmt;
}

export async function fetchProduccionSesionesRecientes(
  limite = 80
): Promise<ProduccionSesion[]> {
  const { data, error } = await supabase
    .from("produccion_sesiones")
    .select(PRODUCCION_SESION_SELECT)
    .order("started_at", { ascending: false })
    .limit(limite);

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return ((data ?? []) as ProduccionSesionDbRow[]).map(sesionDesdeFila);
}

export async function fetchSesionActivaUsuario(
  usuarioId: string
): Promise<ProduccionSesion | null> {
  const { data, error } = await supabase
    .from("produccion_sesiones")
    .select(PRODUCCION_SESION_SELECT)
    .eq("hecho_por_id", usuarioId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return data ? sesionDesdeFila(data as ProduccionSesionDbRow) : null;
}

export async function fetchSesionesActivasEquipo(): Promise<ProduccionSesion[]> {
  const { data, error } = await supabase
    .from("produccion_sesiones")
    .select(PRODUCCION_SESION_SELECT)
    .is("ended_at", null)
    .order("started_at", { ascending: false });

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return ((data ?? []) as ProduccionSesionDbRow[]).map(sesionDesdeFila);
}

type UsuarioPayload = {
  hecho_por_id: string | null;
  hecho_por_nombre: string | null;
};

function usuarioPayload(usuario: SessionUsuario | null): UsuarioPayload {
  if (!usuario) {
    return { hecho_por_id: null, hecho_por_nombre: null };
  }
  return { hecho_por_id: usuario.id, hecho_por_nombre: usuario.name };
}

export async function iniciarProduccionSesion(
  prep: Preparacion,
  usuario: SessionUsuario | null
): Promise<ProduccionSesion> {
  const { data, error } = await supabase
    .from("produccion_sesiones")
    .insert({
      preparacion_id: prep.id,
      preparacion_nombre: prep.nombre,
      area: prep.area,
      started_at: new Date().toISOString(),
      unidad_cantidad: prep.unidadCantidad,
      ...usuarioPayload(usuario),
    })
    .select(PRODUCCION_SESION_SELECT)
    .single();

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return sesionDesdeFila(data as ProduccionSesionDbRow);
}

export async function pausarProduccionSesion(id: string): Promise<ProduccionSesion> {
  const { data, error } = await supabase
    .from("produccion_sesiones")
    .update({ pausado_at: new Date().toISOString() })
    .eq("id", id)
    .is("ended_at", null)
    .is("pausado_at", null)
    .select(PRODUCCION_SESION_SELECT)
    .single();

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return sesionDesdeFila(data as ProduccionSesionDbRow);
}

export async function reanudarProduccionSesion(
  sesion: ProduccionSesion
): Promise<ProduccionSesion> {
  if (!sesion.pausadoAt) {
    return sesion;
  }
  const pausaExtra = Math.max(
    0,
    Math.floor((Date.now() - new Date(sesion.pausadoAt).getTime()) / 1000)
  );
  const { data, error } = await supabase
    .from("produccion_sesiones")
    .update({
      pausado_at: null,
      pausa_total_segundos: sesion.pausaTotalSegundos + pausaExtra,
    })
    .eq("id", sesion.id)
    .is("ended_at", null)
    .select(PRODUCCION_SESION_SELECT)
    .single();

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return sesionDesdeFila(data as ProduccionSesionDbRow);
}

export async function completarProduccionSesion(
  sesion: ProduccionSesion,
  opts: {
    cantidadProducida?: number | null;
    unidadCantidad?: UnidadCantidad | null;
    notas?: string | null;
  }
): Promise<ProduccionSesion> {
  const ahora = Date.now();
  let pausaTotal = sesion.pausaTotalSegundos;
  if (sesion.pausadoAt) {
    pausaTotal += Math.max(0, Math.floor((ahora - new Date(sesion.pausadoAt).getTime()) / 1000));
  }
  const duracion = Math.max(
    1,
    Math.floor((ahora - new Date(sesion.startedAt).getTime()) / 1000) - pausaTotal
  );

  const { data, error } = await supabase
    .from("produccion_sesiones")
    .update({
      ended_at: new Date(ahora).toISOString(),
      pausado_at: null,
      pausa_total_segundos: pausaTotal,
      duracion_segundos: duracion,
      cantidad_producida: opts.cantidadProducida ?? sesion.cantidadProducida,
      unidad_cantidad: opts.unidadCantidad ?? sesion.unidadCantidad,
      notas: opts.notas?.trim() || sesion.notas,
    })
    .eq("id", sesion.id)
    .is("ended_at", null)
    .select(PRODUCCION_SESION_SELECT)
    .single();

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return sesionDesdeFila(data as ProduccionSesionDbRow);
}

export async function cancelarProduccionSesion(id: string): Promise<void> {
  const { error } = await supabase.from("produccion_sesiones").delete().eq("id", id);

  if (error) {
    throw new Error(formatPostgrestError(error));
  }
}

export async function guardarProduccionSesionManual(opts: {
  prep: Preparacion;
  duracionMinutos: number;
  cantidadProducida?: number | null;
  unidadCantidad?: UnidadCantidad | null;
  notas?: string | null;
  usuario: SessionUsuario | null;
}): Promise<ProduccionSesion> {
  const duracionSegundos = Math.max(1, Math.round(opts.duracionMinutos * 60));
  const fin = new Date();
  const inicio = new Date(fin.getTime() - duracionSegundos * 1000);

  const { data, error } = await supabase
    .from("produccion_sesiones")
    .insert({
      preparacion_id: opts.prep.id,
      preparacion_nombre: opts.prep.nombre,
      area: opts.prep.area,
      started_at: inicio.toISOString(),
      ended_at: fin.toISOString(),
      duracion_segundos: duracionSegundos,
      cantidad_producida: opts.cantidadProducida ?? null,
      unidad_cantidad: opts.unidadCantidad ?? opts.prep.unidadCantidad,
      notas: opts.notas?.trim() || null,
      es_manual: true,
      ...usuarioPayload(opts.usuario),
    })
    .select(PRODUCCION_SESION_SELECT)
    .single();

  if (error) {
    throw new Error(formatPostgrestError(error));
  }

  return sesionDesdeFila(data as ProduccionSesionDbRow);
}

export async function eliminarProduccionSesion(id: string): Promise<void> {
  const { error } = await supabase.from("produccion_sesiones").delete().eq("id", id);

  if (error) {
    throw new Error(formatPostgrestError(error));
  }
}

export function etiquetaAreaSesion(area: AreaProduccion): string {
  return ETIQUETA_AREA_PRODUCCION[area];
}
