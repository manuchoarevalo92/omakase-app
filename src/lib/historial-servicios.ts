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
  b: HistorialServicioRow
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
  rows: HistorialServicioRow[]
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
export function formatearFechaServicio(fecha: string | null | undefined): string {
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
