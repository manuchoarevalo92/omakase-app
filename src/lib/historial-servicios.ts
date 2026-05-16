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

export function etiquetaServicioHistorial(row: HistorialServicioRow): string {
  const hora = row.hora?.trim() ? ` · ${row.hora}` : "";
  const serv = row.servicio ?? "Servicio";
  return `${row.fecha} · ${serv}${hora}`;
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
