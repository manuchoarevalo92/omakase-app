import {
  ETIQUETA_AREA_PRODUCCION,
  esAreaProduccionValida,
  esUnidadCantidadValida,
  type AreaProduccion,
  type Preparacion,
  type UnidadCantidad,
} from "@/src/lib/preparaciones";
import {
  estimarDuracionSegundosPorCantidad,
  formatearDuracionLegible,
  type ProduccionResumenPreparacion,
} from "@/src/lib/produccion-sesiones";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

export type SessionUsuario = { id: string; name: string };

export type ProduccionPlanEstado = "pendiente" | "completada" | "cancelada";

export type ProduccionPlanItem = {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
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
  creadoPorId: string | null;
  creadoPorNombre: string | null;
  createdAt: string;
};

export type ProduccionPlanItemDbRow = {
  id: string;
  fecha: string;
  hora_inicio?: string | null;
  hora_fin?: string | null;
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

/** Personas que pueden producir en paralelo (Manu, Javi, Santi). */
export const PRODUCCION_PERSONAS_PARALELAS = 3;

/** Grilla visible: 10:00 (entrada) a 24:00 (salida). */
export const GRILLA_HORA_INICIO = 10;
export const GRILLA_HORA_FIN = 24;
/** Altura de cada franja horaria en la grilla (legible en móvil con scroll). */
export const GRILLA_PX_POR_HORA = 112;
/** Altura mínima de un bloque de preparación aunque dure pocos minutos. */
export const GRILLA_ITEM_MIN_ALTURA_PX = 76;
/** Separación vertical entre bloques apilados en el mismo carril. */
export const GRILLA_ITEM_GAP_PX = 4;
export const GRILLA_PADDING_INFERIOR_PX = 12;
/** Ancho mínimo de cada carril cuando hay actividades en paralelo. */
export const GRILLA_ANCHO_CARRIL_MIN_PX = 116;
/** Ancho mínimo de cada día (3 carriles para ver actividades en paralelo). */
export const GRILLA_ANCHO_DIA_MIN_PX =
  PRODUCCION_PERSONAS_PARALELAS * GRILLA_ANCHO_CARRIL_MIN_PX;
export const GRILLA_EJE_HORAS_PX = 72;

export function anchoMinimoGrillaSemanaPx(): number {
  return GRILLA_EJE_HORAS_PX + 7 * GRILLA_ANCHO_DIA_MIN_PX;
}

export const PRODUCCION_PLAN_SELECT =
  "id, fecha, hora_inicio, hora_fin, preparacion_id, preparacion_nombre, area, duracion_estimada_segundos, cantidad_planificada, unidad_cantidad, asignado_a_id, asignado_a_nombre, notas, estado, creado_por_id, creado_por_nombre, created_at";

/** Sin hora_inicio/hora_fin (tablas creadas antes de produccion-plan-horarios.sql). */
const PRODUCCION_PLAN_SELECT_SIN_HORARIOS =
  "id, fecha, preparacion_id, preparacion_nombre, area, duracion_estimada_segundos, cantidad_planificada, unidad_cantidad, asignado_a_id, asignado_a_nombre, notas, estado, creado_por_id, creado_por_nombre, created_at";

export const MENSAJE_MIGRACION_HORARIOS_PLAN =
  "Faltan las columnas hora_inicio y hora_fin en produccion_plan. En Supabase → SQL Editor ejecutá supabase/produccion-plan-horarios.sql y recargá la página para guardar bloques con horario en la grilla.";

export type ProduccionPlanSemanaCarga = {
  items: ProduccionPlanItem[];
  requiereMigracionHorarios: boolean;
};

type PostgrestishError = {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

function errorColumnaFaltante(error: PostgrestishError): boolean {
  const msg = error.message.toLowerCase();
  if (!msg.includes("column")) {
    return false;
  }
  return (
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    (msg.includes("could not find") && msg.includes("column"))
  );
}

function errorColumnaHorarioFaltante(error: PostgrestishError): boolean {
  const msg = error.message.toLowerCase();
  return (
    errorColumnaFaltante(error) &&
    (msg.includes("hora_inicio") || msg.includes("hora_fin"))
  );
}

const HORA_DEFECTO_INICIO = "10:00";

export function formatFechaLocalYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function parseFechaLocalISO(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

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

export function etiquetaDiaSemanaCorto(dia: number): string {
  return DIAS_SEMANA_ISO.find((d) => d.valor === dia)?.corto ?? `D${dia}`;
}

export function minutosDesdeMedianoche(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function formatearHoraHHmm(minutos: number): string {
  const h = Math.floor(minutos / 60) % 24;
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function calcularHoraFinDesdeInicio(
  horaInicio: string,
  duracionSegundos: number
): string {
  const fin = minutosDesdeMedianoche(horaInicio) + Math.round(duracionSegundos / 60);
  return formatearHoraHHmm(fin);
}

export function duracionSegundosEntreHoras(horaInicio: string, horaFin: string): number {
  const diff = minutosDesdeMedianoche(horaFin) - minutosDesdeMedianoche(horaInicio);
  return Math.max(60, diff * 60);
}

export function etiquetaHorarioItem(item: ProduccionPlanItem): string {
  return `${item.horaInicio}–${item.horaFin}`;
}

export function horasGrilla(): number[] {
  return Array.from(
    { length: GRILLA_HORA_FIN - GRILLA_HORA_INICIO },
    (_, i) => GRILLA_HORA_INICIO + i
  );
}

export function alturaGrillaPx(): number {
  return (GRILLA_HORA_FIN - GRILLA_HORA_INICIO) * GRILLA_PX_POR_HORA;
}

export function topItemGrillaPx(item: ProduccionPlanItem): number {
  const mins = minutosDesdeMedianoche(item.horaInicio) - GRILLA_HORA_INICIO * 60;
  return (mins / 60) * GRILLA_PX_POR_HORA;
}

export function alturaItemGrillaPx(item: ProduccionPlanItem): number {
  const mins =
    minutosDesdeMedianoche(item.horaFin) - minutosDesdeMedianoche(item.horaInicio);
  return Math.max((mins / 60) * GRILLA_PX_POR_HORA, GRILLA_ITEM_MIN_ALTURA_PX);
}

export function planItemDesdeFila(row: ProduccionPlanItemDbRow): ProduccionPlanItem {
  const estado = row.estado;
  const estadoValido: ProduccionPlanEstado =
    estado === "completada" || estado === "cancelada" ? estado : "pendiente";
  const horaInicio = row.hora_inicio?.trim() || HORA_DEFECTO_INICIO;
  const horaFin =
    row.hora_fin?.trim() ||
    calcularHoraFinDesdeInicio(horaInicio, row.duracion_estimada_segundos);
  return {
    id: row.id,
    fecha: row.fecha,
    horaInicio,
    horaFin,
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
    creadoPorId: row.creado_por_id ?? null,
    creadoPorNombre: row.creado_por_nombre ?? null,
    createdAt: row.created_at,
  };
}

export function estimarDuracionSegundos(
  preparacionId: string,
  resumenes: ProduccionResumenPreparacion[],
  opts?: { cantidad?: number | null; unidad?: UnidadCantidad | null }
): number {
  return estimarDuracionSegundosPorCantidad(
    preparacionId,
    opts?.cantidad,
    opts?.unidad,
    resumenes
  ).segundos;
}

export function itemsPlanPorFecha(
  plan: ProduccionPlanItem[],
  fecha: string
): ProduccionPlanItem[] {
  return plan
    .filter((p) => p.fecha === fecha)
    .sort(
      (a, b) =>
        minutosDesdeMedianoche(a.horaInicio) - minutosDesdeMedianoche(b.horaInicio) ||
        a.preparacionNombre.localeCompare(b.preparacionNombre, "es")
    );
}

export function itemsSeSolapan(a: ProduccionPlanItem, b: ProduccionPlanItem): boolean {
  if (a.fecha !== b.fecha || a.estado === "cancelada" || b.estado === "cancelada") {
    return false;
  }
  const aIni = minutosDesdeMedianoche(a.horaInicio);
  const aFin = minutosDesdeMedianoche(a.horaFin);
  const bIni = minutosDesdeMedianoche(b.horaInicio);
  const bFin = minutosDesdeMedianoche(b.horaFin);
  return aIni < bFin && bIni < aFin;
}

function itemOcupaMinutoPersona(
  item: ProduccionPlanItem,
  minuto: number,
  asignadoId: string
): boolean {
  if (item.estado === "cancelada" || item.asignadoAId !== asignadoId) {
    return false;
  }
  const ini = minutosDesdeMedianoche(item.horaInicio);
  const fin = minutosDesdeMedianoche(item.horaFin);
  return ini <= minuto && minuto < fin;
}

/** Próximo inicio libre para una persona en un día, a partir del horario tocado en la grilla. */
export function siguienteHorarioLibrePersona(opts: {
  fecha: string;
  horaDesde: string;
  asignadoId: string | null;
  plan: ProduccionPlanItem[];
}): string {
  if (!opts.asignadoId) {
    return opts.horaDesde;
  }

  const limiteMax = GRILLA_HORA_FIN * 60;
  let cursor = minutosDesdeMedianoche(opts.horaDesde);
  const itemsDia = itemsPlanPorFecha(opts.plan, opts.fecha);

  for (let paso = 0; paso <= itemsDia.length; paso++) {
    const bloqueante = itemsDia.find((item) =>
      itemOcupaMinutoPersona(item, cursor, opts.asignadoId!)
    );
    if (!bloqueante) {
      break;
    }
    cursor = minutosDesdeMedianoche(bloqueante.horaFin);
    if (cursor >= limiteMax) {
      break;
    }
  }

  return formatearHoraHHmm(Math.min(cursor, limiteMax));
}

export function maxSolapamientosConcurrentes(
  item: ProduccionPlanItem,
  itemsMismoDia: ProduccionPlanItem[]
): number {
  const activos = itemsMismoDia.filter((i) => i.estado !== "cancelada");
  const ini = minutosDesdeMedianoche(item.horaInicio);
  const fin = minutosDesdeMedianoche(item.horaFin);
  const puntos = new Set<number>([ini]);
  for (const o of activos) {
    if (!itemsSeSolapan(o, item)) {
      continue;
    }
    const oIni = minutosDesdeMedianoche(o.horaInicio);
    const oFin = minutosDesdeMedianoche(o.horaFin);
    if (oIni >= ini && oIni < fin) {
      puntos.add(oIni);
    }
    if (oFin > ini && oFin <= fin) {
      puntos.add(oFin);
    }
  }
  let max = 1;
  for (const t of puntos) {
    const count = activos.filter((o) => {
      const oIni = minutosDesdeMedianoche(o.horaInicio);
      const oFin = minutosDesdeMedianoche(o.horaFin);
      return oIni <= t && oFin > t;
    }).length;
    max = Math.max(max, count);
  }
  return max;
}

/** Conflicto: misma persona dos veces a la vez, o más de 3 en paralelo. */
export function itemTieneConflicto(
  item: ProduccionPlanItem,
  plan: ProduccionPlanItem[]
): boolean {
  if (item.estado === "cancelada") {
    return false;
  }
  const mismoDia = plan.filter((p) => p.fecha === item.fecha && p.estado !== "cancelada");
  if (item.asignadoAId) {
    const doblePersona = mismoDia.some(
      (o) =>
        o.id !== item.id &&
        o.asignadoAId === item.asignadoAId &&
        itemsSeSolapan(o, item)
    );
    if (doblePersona) {
      return true;
    }
  }
  return maxSolapamientosConcurrentes(item, mismoDia) > PRODUCCION_PERSONAS_PARALELAS;
}

export type LayoutParaleloItem = {
  indice: number;
  topPx: number;
  heightPx: number;
};

export type LayoutVisualDia = {
  items: Map<string, LayoutParaleloItem>;
  alturaPx: number;
};

function claveCarrilPersona(item: ProduccionPlanItem): string {
  return item.asignadoAId ?? `sin-asignar-${item.id}`;
}

function asignarCarrilPorPersona(items: ProduccionPlanItem[]): Map<string, number> {
  const carrilPorPersona = new Map<string, number>();
  const ordenados = items
    .filter((i) => i.estado !== "cancelada")
    .sort(
      (a, b) =>
        minutosDesdeMedianoche(a.horaInicio) - minutosDesdeMedianoche(b.horaInicio) ||
        a.id.localeCompare(b.id)
    );

  for (const item of ordenados) {
    const clave = claveCarrilPersona(item);
    if (!carrilPorPersona.has(clave)) {
      carrilPorPersona.set(
        clave,
        Math.min(carrilPorPersona.size, PRODUCCION_PERSONAS_PARALELAS - 1)
      );
    }
  }

  return carrilPorPersona;
}

/** Carriles fijos por persona y apilado vertical para evitar bloques encimados. */
export function calcularLayoutVisualDia(items: ProduccionPlanItem[]): LayoutVisualDia {
  const activos = items.filter((i) => i.estado !== "cancelada");
  const carrilPorPersona = asignarCarrilPorPersona(items);
  const porCarril: ProduccionPlanItem[][] = Array.from(
    { length: PRODUCCION_PERSONAS_PARALELAS },
    () => []
  );

  for (const item of activos) {
    const carril = carrilPorPersona.get(claveCarrilPersona(item)) ?? 0;
    porCarril[carril]!.push(item);
  }

  const layout = new Map<string, LayoutParaleloItem>();
  let maxBottom = alturaGrillaPx();

  for (let carril = 0; carril < PRODUCCION_PERSONAS_PARALELAS; carril++) {
    const lista = porCarril[carril]!.sort(
      (a, b) =>
        minutosDesdeMedianoche(a.horaInicio) - minutosDesdeMedianoche(b.horaInicio) ||
        a.id.localeCompare(b.id)
    );
    let finVisualAnterior = 0;

    for (const item of lista) {
      const topTiempo = topItemGrillaPx(item);
      const altura = alturaItemGrillaPx(item);
      const topVisual =
        finVisualAnterior > 0
          ? Math.max(topTiempo, finVisualAnterior + GRILLA_ITEM_GAP_PX)
          : topTiempo;
      finVisualAnterior = topVisual + altura;
      layout.set(item.id, { indice: carril, topPx: topVisual, heightPx: altura });
      maxBottom = Math.max(maxBottom, finVisualAnterior);
    }
  }

  for (const item of items) {
    if (item.estado === "cancelada" && !layout.has(item.id)) {
      const carril = carrilPorPersona.get(claveCarrilPersona(item)) ?? 0;
      layout.set(item.id, {
        indice: carril,
        topPx: topItemGrillaPx(item),
        heightPx: alturaItemGrillaPx(item),
      });
    }
  }

  return {
    items: layout,
    alturaPx: maxBottom + GRILLA_PADDING_INFERIOR_PX,
  };
}

export function alturaGrillaSemanaPx(plan: ProduccionPlanItem[], lunes: string): number {
  const fechas = fechasSemanaDesdeLunes(lunes);
  const alturas = fechas.map(
    (fecha) => calcularLayoutVisualDia(itemsPlanPorFecha(plan, fecha)).alturaPx
  );
  return Math.max(alturaGrillaPx(), ...alturas);
}

/** @deprecated Usar calcularLayoutVisualDia */
export function calcularLayoutParaleloDia(
  items: ProduccionPlanItem[]
): Map<string, { indice: number; columnas: number }> {
  const visual = calcularLayoutVisualDia(items);
  const legacy = new Map<string, { indice: number; columnas: number }>();
  for (const [id, entry] of visual.items) {
    legacy.set(id, { indice: entry.indice, columnas: PRODUCCION_PERSONAS_PARALELAS });
  }
  return legacy;
}

export function claseAreaBloque(area: AreaProduccion, completada: boolean): string {
  if (completada) {
    return "border-emerald-900/50 bg-emerald-950/30 text-emerald-100/80";
  }
  if (area === "barra") {
    return "border-violet-800/60 bg-violet-950/50 text-violet-50";
  }
  return "border-sky-800/60 bg-sky-950/50 text-sky-50";
}

export function etiquetaAreaPlan(area: AreaProduccion): string {
  return ETIQUETA_AREA_PRODUCCION[area];
}

export async function fetchProduccionPlanSemana(
  lunes: string
): Promise<ProduccionPlanSemanaCarga> {
  const fechas = fechasSemanaDesdeLunes(lunes);
  const buildQuery = (select: string) =>
    supabase
      .from("produccion_plan")
      .select(select)
      .gte("fecha", fechas[0])
      .lte("fecha", fechas[6])
      .neq("estado", "cancelada")
      .order("fecha", { ascending: true });

  const { data, error } = await buildQuery(PRODUCCION_PLAN_SELECT).order(
    "hora_inicio",
    { ascending: true }
  );

  if (!error) {
    return {
      items: ((data ?? []) as unknown as ProduccionPlanItemDbRow[]).map(planItemDesdeFila),
      requiereMigracionHorarios: false,
    };
  }

  if (errorColumnaHorarioFaltante(error)) {
    const legacy = await buildQuery(PRODUCCION_PLAN_SELECT_SIN_HORARIOS).order(
      "created_at",
      { ascending: true }
    );

    if (legacy.error) {
      throw new Error(formatPostgrestError(legacy.error));
    }

    return {
      items: ((legacy.data ?? []) as unknown as ProduccionPlanItemDbRow[]).map(
        planItemDesdeFila
      ),
      requiereMigracionHorarios: true,
    };
  }

  throw new Error(formatPostgrestError(error));
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

export async function crearProduccionPlanItem(opts: {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  prep: Preparacion;
  cantidadPlanificada?: number | null;
  unidadCantidad?: UnidadCantidad | null;
  notas?: string | null;
  asignado?: SessionUsuario | null;
  usuario: SessionUsuario | null;
}): Promise<ProduccionPlanItem> {
  const duracion = duracionSegundosEntreHoras(opts.horaInicio, opts.horaFin);
  const { data, error } = await supabase
    .from("produccion_plan")
    .insert({
      fecha: opts.fecha,
      hora_inicio: opts.horaInicio,
      hora_fin: opts.horaFin,
      preparacion_id: opts.prep.id,
      preparacion_nombre: opts.prep.nombre,
      area: opts.prep.area,
      duracion_estimada_segundos: duracion,
      cantidad_planificada: opts.cantidadPlanificada ?? null,
      unidad_cantidad: opts.unidadCantidad ?? opts.prep.unidadCantidad,
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
    hora_inicio: string;
    hora_fin: string;
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
