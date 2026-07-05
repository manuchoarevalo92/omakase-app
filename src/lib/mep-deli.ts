import {
  registroMasRecienteEnHistorial,
  type HistorialServicioRow,
  type ServicioHistorial,
} from "@/src/lib/historial-servicios";
import { supabase } from "@/src/lib/supabase";

export type UnidadMep = "g" | "kg" | "ud" | "porciones";

export type MepCorte = {
  id: string;
  pescado: string;
  nombre: string;
  unidad: UnidadMep;
  orden: number;
  activo: boolean;
};

export type MepCorteDbRow = {
  id: string;
  pescado: string;
  nombre: string;
  unidad: string;
  orden: number;
  activo: boolean;
};

export type MepLineaCarga = {
  corte_id: string;
  cantidad: string;
};

export type MepDeliCarga = {
  id: string;
  fecha: string;
  hora: string | null;
  servicio: ServicioHistorial | null;
  historial_servicio_id: string | null;
  lineas: MepLineaCarga[];
  created_at: string;
};

export type MepDeliCargaDbRow = {
  id: string;
  fecha: string;
  hora: string | null;
  servicio: ServicioHistorial | null;
  historial_servicio_id: string | null;
  lineas: MepLineaCarga[] | null;
  created_at: string;
};

export const UNIDADES_MEP: UnidadMep[] = ["g", "kg", "ud", "porciones"];

export function etiquetaUnidadMep(unidad: UnidadMep): string {
  if (unidad === "porciones") {
    return "porc.";
  }
  return unidad;
}

export function corteDesdeFila(row: MepCorteDbRow): MepCorte {
  const unidad = UNIDADES_MEP.includes(row.unidad as UnidadMep)
    ? (row.unidad as UnidadMep)
    : "g";
  return {
    id: row.id,
    pescado: row.pescado,
    nombre: row.nombre,
    unidad,
    orden: row.orden,
    activo: row.activo,
  };
}

export function normalizarLineasMep(
  raw: MepLineaCarga[] | null | undefined
): MepLineaCarga[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((l) => ({
      corte_id: typeof l.corte_id === "string" ? l.corte_id : "",
      cantidad: typeof l.cantidad === "string" ? l.cantidad.trim() : "",
    }))
    .filter((l) => l.corte_id.length > 0);
}

export function cargaDesdeFila(row: MepDeliCargaDbRow): MepDeliCarga {
  return {
    id: row.id,
    fecha: row.fecha,
    hora: row.hora,
    servicio: row.servicio,
    historial_servicio_id: row.historial_servicio_id,
    lineas: normalizarLineasMep(row.lineas),
    created_at: row.created_at,
  };
}

export function cantidadesDesdeLineas(
  lineas: MepLineaCarga[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const l of lineas) {
    if (l.corte_id && l.cantidad) {
      map.set(l.corte_id, l.cantidad);
    }
  }
  return map;
}

export function lineasDesdeCantidades(
  cantidades: Map<string, string>
): MepLineaCarga[] {
  const out: MepLineaCarga[] = [];
  cantidades.forEach((cantidad, corte_id) => {
    const c = cantidad.trim();
    if (corte_id && c.length > 0) {
      out.push({ corte_id, cantidad: c });
    }
  });
  return out;
}

export function hayCantidadesCargadas(cantidades: Map<string, string>): boolean {
  for (const v of cantidades.values()) {
    if (v.trim().length > 0) {
      return true;
    }
  }
  return false;
}

export async function fetchMepCortesActivos(): Promise<MepCorte[]> {
  const { data, error } = await supabase
    .from("mep_cortes")
    .select("id, pescado, nombre, unidad, orden, activo")
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("pescado", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as MepCorteDbRow[]).map(corteDesdeFila);
}

export async function fetchMepCortesTodos(): Promise<MepCorte[]> {
  const { data, error } = await supabase
    .from("mep_cortes")
    .select("id, pescado, nombre, unidad, orden, activo")
    .order("pescado", { ascending: true })
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as MepCorteDbRow[]).map(corteDesdeFila);
}

export async function fetchUltimaMepDeliCarga(): Promise<MepDeliCarga | null> {
  const { data, error } = await supabase
    .from("mep_deli_cargas")
    .select("id, fecha, hora, servicio, historial_servicio_id, lineas, created_at")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as MepDeliCargaDbRow[];
  if (!rows.length) {
    return null;
  }

  const ordenadas = [...rows].sort((a, b) => {
    const df = b.fecha.localeCompare(a.fecha);
    if (df !== 0) {
      return df;
    }
    return b.created_at.localeCompare(a.created_at);
  });

  return cargaDesdeFila(ordenadas[0]!);
}

export async function fetchUltimoHistorialParaMep(): Promise<HistorialServicioRow | null> {
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

export function agruparCortesPorPescado(
  cortes: MepCorte[]
): { pescado: string; cortes: MepCorte[] }[] {
  const map = new Map<string, MepCorte[]>();
  for (const c of cortes) {
    const lista = map.get(c.pescado) ?? [];
    lista.push(c);
    map.set(c.pescado, lista);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([pescado, lista]) => ({
      pescado,
      cortes: [...lista].sort((x, y) => x.orden - y.orden || x.nombre.localeCompare(y.nombre, "es")),
    }));
}

export async function fetchMepDeliCargasHistorial(): Promise<MepDeliCarga[]> {
  const { data, error } = await supabase
    .from("mep_deli_cargas")
    .select("id, fecha, hora, servicio, historial_servicio_id, lineas, created_at")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as MepDeliCargaDbRow[]).map(cargaDesdeFila);
}

export type MepLineaEnriquecida = MepLineaCarga & {
  pescado: string;
  nombre: string;
  unidad: UnidadMep;
};

export function enriquecerLineasMep(
  lineas: MepLineaCarga[],
  cortesPorId: Map<string, MepCorte>
): MepLineaEnriquecida[] {
  return lineas
    .map((l) => {
      const corte = cortesPorId.get(l.corte_id);
      if (!corte) {
        return {
          ...l,
          pescado: "—",
          nombre: `Corte ${l.corte_id.slice(0, 6)}…`,
          unidad: "g" as UnidadMep,
        };
      }
      return {
        ...l,
        pescado: corte.pescado,
        nombre: corte.nombre,
        unidad: corte.unidad,
      };
    })
    .sort(
      (a, b) =>
        a.pescado.localeCompare(b.pescado, "es") ||
        a.nombre.localeCompare(b.nombre, "es")
    );
}

export function agruparCargasPorFecha(
  cargas: MepDeliCarga[]
): { fecha: string; cargas: MepDeliCarga[] }[] {
  const grupos = new Map<string, MepDeliCarga[]>();
  for (const carga of cargas) {
    const lista = grupos.get(carga.fecha) ?? [];
    lista.push(carga);
    grupos.set(carga.fecha, lista);
  }

  const ordenServicio: ServicioHistorial[] = ["Mediodia", "Noche"];

  return [...grupos.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([fecha, lista]) => ({
      fecha,
      cargas: [...lista].sort((a, b) => {
        const ia = ordenServicio.indexOf((a.servicio ?? "Noche") as ServicioHistorial);
        const ib = ordenServicio.indexOf((b.servicio ?? "Noche") as ServicioHistorial);
        if (ia !== ib) {
          return ia - ib;
        }
        const ha = a.hora ?? "";
        const hb = b.hora ?? "";
        if (ha !== hb) {
          return hb.localeCompare(ha);
        }
        return b.created_at.localeCompare(a.created_at);
      }),
    }));
}

export function compararCargasMasReciente(a: MepDeliCarga, b: MepDeliCarga): number {
  const df = b.fecha.localeCompare(a.fecha);
  if (df !== 0) {
    return df;
  }
  return b.created_at.localeCompare(a.created_at);
}

export function etiquetaCargaMep(carga: MepDeliCarga): string {
  const hora = carga.hora?.trim() ? ` · ${carga.hora}` : "";
  const serv = carga.servicio ?? "Servicio";
  return `${carga.fecha} · ${serv}${hora}`;
}
