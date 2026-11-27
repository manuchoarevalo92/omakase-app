import { supabase } from "@/src/lib/supabase";

export type ServicioHistorial = "Mediodia" | "Noche";

export type HistorialServicioRow = {
  id: string;
  fecha: string;
  hora: string | null;
  servicio: ServicioHistorial | null;
};

function minutosHistoriaHora(h: string | null): number {
  if (!h?.trim()) {
    return -1;
  }
  const parts = h.trim().split(":");
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
    return -1;
  }
  return hh * 60 + mm;
}

/** Último servicio cerrado primero (fecha ISO desc, hora desc, id). */
export function compararHistorialMasReciente(
  a: HistorialServicioRow,
  b: HistorialServicioRow,
): number {
  const df = b.fecha.localeCompare(a.fecha);
  if (df !== 0) {
    return df;
  }
  const ma = minutosHistoriaHora(a.hora);
  const mb = minutosHistoriaHora(b.hora);
  if (ma !== mb) {
    return mb - ma;
  }
  return b.id.localeCompare(a.id);
}

export function registroMasRecienteEnHistorial(
  rows: HistorialServicioRow[],
): HistorialServicioRow | null {
  if (!rows.length) {
    return null;
  }
  return [...rows].sort(compararHistorialMasReciente)[0] ?? null;
}

const FORMATO_FECHA_SERVICIO = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Fecha legible ("mié, 25 nov 2026") a partir de lo que devuelve Supabase
 * ("2026-11-25" o "2026-11-25T00:00:00+00:00"). Solo para mostrar: no usar como clave ni para guardar.
 */
export function formatearFechaServicio(
  fecha: string | null | undefined,
): string {
  const texto = fecha?.trim() ?? "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (!m) {
    return texto;
  }
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return FORMATO_FECHA_SERVICIO.format(d);
}

/** Hora legible "20:01" a partir de "20:01", "20:01:00" o "20:01:00+00". Solo para mostrar. */
export function formatearHoraServicio(hora: string | null | undefined): string {
  const texto = hora?.trim() ?? "";
  const m = /^(\d{1,2}):(\d{2})/.exec(texto);
  if (!m) {
    return texto;
  }
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export function etiquetaServicioHistorial(row: HistorialServicioRow): string {
  const hora = row.hora?.trim() ? ` · ${formatearHoraServicio(row.hora)}` : "";
  const serv = row.servicio ?? "Servicio";
  return `${formatearFechaServicio(row.fecha)} · ${serv}${hora}`;
}

export async function fetchUltimoHistorialServicio(): Promise<HistorialServicioRow | null> {
  const { data, error } = await supabase
    .from("historial_servicios")
    .select("id, fecha, hora, servicio")
    .order("fecha", { ascending: false })
    .limit(80);

  if (error) {
    throw error;
  }

  return registroMasRecienteEnHistorial((data ?? []) as HistorialServicioRow[]);
}

/* ---------------- Turno de Bebidas ---------------- */

/**
 * La hoja de Bebidas cambia sola de turno: a las 19:00 empieza la noche y a
 * las 4:00 el mediodía. La noche que pasa de medianoche sigue siendo del día
 * en que empezó.
 */
export const HORA_EMPIEZA_NOCHE = 19;
export const HORA_TERMINA_NOCHE = 4;

export type TurnoBebidas = { fecha: string; servicio: ServicioHistorial };

const fechaLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

export function turnoActual(ahora: Date = new Date()): TurnoBebidas {
  const h = ahora.getHours();
  if (h >= HORA_EMPIEZA_NOCHE) {
    return { fecha: fechaLocal(ahora), servicio: "Noche" };
  }
  if (h < HORA_TERMINA_NOCHE) {
    const ayer = new Date(ahora);
    ayer.setDate(ayer.getDate() - 1);
    return { fecha: fechaLocal(ayer), servicio: "Noche" };
  }
  return { fecha: fechaLocal(ahora), servicio: "Mediodia" };
}

export const claveTurno = (t: TurnoBebidas): string =>
  `${t.fecha}-${t.servicio}`;

export function etiquetaTurno(t: TurnoBebidas): string {
  return `${formatearFechaServicio(t.fecha)} · ${t.servicio === "Mediodia" ? "Mediodía" : "Noche"}`;
}

/** Hora a la que la hoja pasa al turno siguiente ("19:00" o "4:00"). */
export const horaProximoTurno = (t: TurnoBebidas): string =>
  t.servicio === "Mediodia"
    ? `${HORA_EMPIEZA_NOCHE}:00`
    : `${HORA_TERMINA_NOCHE}:00`;

const esDelTurno = (row: HistorialServicioRow, t: TurnoBebidas) =>
  row.fecha.slice(0, 10) === t.fecha && row.servicio === t.servicio;

/**
 * El servicio guardado para este turno (menú cerrado en Omakase o creado por
 * Bebidas). Si hay varios, gana el que ya tiene bebidas, para no dejarlas
 * colgadas en otro.
 */
export async function fetchHistorialDelTurno(
  t: TurnoBebidas,
): Promise<HistorialServicioRow | null> {
  const { data, error } = await supabase
    .from("historial_servicios")
    .select("id, fecha, hora, servicio")
    .order("fecha", { ascending: false })
    .limit(80);
  if (error) {
    throw error;
  }
  const candidatos = ((data ?? []) as HistorialServicioRow[]).filter((r) =>
    esDelTurno(r, t),
  );
  if (candidatos.length <= 1) {
    return candidatos[0] ?? null;
  }
  const { data: conBebidas, error: errorBebidas } = await supabase
    .from("bebidas_asientos")
    .select("historial_servicio_id")
    .in(
      "historial_servicio_id",
      candidatos.map((c) => c.id),
    );
  if (errorBebidas) {
    throw errorBebidas;
  }
  const ids = new Set(
    (conBebidas ?? []).map(
      (b: { historial_servicio_id: string }) => b.historial_servicio_id,
    ),
  );
  const preferidos = candidatos.filter((c) => ids.has(c.id));
  return registroMasRecienteEnHistorial(
    preferidos.length ? preferidos : candidatos,
  );
}

/**
 * Crea el servicio del turno sin menú (Bebidas lo necesita para guardar). Si
 * después se cierra el menú en Omakase, se completa este mismo registro.
 */
export async function crearHistorialParaTurno(
  t: TurnoBebidas,
  ahora: Date = new Date(),
): Promise<HistorialServicioRow> {
  const hora = `${String(ahora.getHours()).padStart(2, "0")}:${String(
    ahora.getMinutes(),
  ).padStart(2, "0")}`;
  const { data, error } = await supabase
    .from("historial_servicios")
    .insert({
      fecha: t.fecha,
      hora,
      servicio: t.servicio,
      menu_omakase: [],
      extensiones: [],
    })
    .select("id, fecha, hora, servicio")
    .single();
  if (error) {
    throw error;
  }
  return data as HistorialServicioRow;
}

/** Registro creado por Bebidas que todavía no tiene menú. */
export const sinMenu = (row: { menu_omakase?: string[] | null }): boolean =>
  !(row.menu_omakase ?? []).some((id) => id && id.trim().length > 0);
