import {
  registroMasRecienteEnHistorial,
  type HistorialServicioRow,
  type ServicioHistorial,
} from "@/src/lib/historial-servicios";
import { supabase } from "@/src/lib/supabase";

export type UnidadMep = "g" | "kg" | "ud" | "porciones";

export type MepCorte = {
  id: string;
  categoria: string;
  nombre: string;
  unidad: UnidadMep;
  orden: number;
  activo: boolean;
};

export type MepCorteDbRow = {
  id: string;
  categoria?: string | null;
  pescado?: string | null;
  nombre: string;
  unidad: string;
  orden: number;
  activo: boolean;
};

export type MepLineaCarga = {
  corte_id: string;
  cantidad: string;
};

export type MepResultadoCierre = "ok" | "falto" | "sobro";

export type MepLineaCierre = {
  corte_id: string;
  resultado: MepResultadoCierre;
  cantidad?: string;
  nota?: string;
};

export type MepDeliCarga = {
  id: string;
  fecha: string;
  hora: string | null;
  servicio: ServicioHistorial | null;
  historial_servicio_id: string | null;
  lineas: MepLineaCarga[];
  cargado_por_id: string | null;
  cargado_por_nombre: string | null;
  cierre_lineas: MepLineaCierre[] | null;
  cierre_at: string | null;
  cerrado_por_id: string | null;
  cerrado_por_nombre: string | null;
  created_at: string;
};

export type MepDeliCargaDbRow = {
  id: string;
  fecha: string;
  hora: string | null;
  servicio: ServicioHistorial | null;
  historial_servicio_id: string | null;
  lineas: MepLineaCarga[] | null;
  cargado_por_id?: string | null;
  cargado_por_nombre?: string | null;
  cierre_lineas?: MepLineaCierre[] | null;
  cierre_at?: string | null;
  cerrado_por_id?: string | null;
  cerrado_por_nombre?: string | null;
  created_at: string;
};

export type RecuentoMepItem = {
  corte_id: string;
  categoria: string;
  nombre: string;
  servicios_con_cierre: number;
  faltos: number;
  sobraron: number;
  ok: number;
};

export const MEP_CARGA_SELECT =
  "id, fecha, hora, servicio, historial_servicio_id, lineas, cargado_por_id, cargado_por_nombre, cierre_lineas, cierre_at, cerrado_por_id, cerrado_por_nombre, created_at";

export const UNIDADES_MEP: UnidadMep[] = ["g", "kg", "ud", "porciones"];

const MEP_CORTES_SELECT = "id, categoria, pescado, nombre, unidad, orden, activo";

export function etiquetaUnidadMep(unidad: UnidadMep): string {
  if (unidad === "porciones") {
    return "porc.";
  }
  return unidad;
}

export function categoriaDesdeFila(row: MepCorteDbRow): string {
  const cat = row.categoria?.trim();
  if (cat) {
    return cat;
  }
  const legacy = row.pescado?.trim();
  return legacy || "General";
}

export function corteDesdeFila(row: MepCorteDbRow): MepCorte {
  const unidad = UNIDADES_MEP.includes(row.unidad as UnidadMep)
    ? (row.unidad as UnidadMep)
    : "g";
  return {
    id: row.id,
    categoria: categoriaDesdeFila(row),
    nombre: row.nombre,
    unidad,
    orden: row.orden,
    activo: row.activo,
  };
}

export function categoriasExistentes(cortes: MepCorte[]): string[] {
  const set = new Set<string>();
  for (const c of cortes) {
    set.add(c.categoria);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
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

const RESULTADOS_CIERRE: MepResultadoCierre[] = ["ok", "falto", "sobro"];

export function normalizarCierreLineas(
  raw: MepLineaCierre[] | null | undefined
): MepLineaCierre[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((l) => {
      const resultado = RESULTADOS_CIERRE.includes(l.resultado as MepResultadoCierre)
        ? (l.resultado as MepResultadoCierre)
        : "ok";
      const cantidad =
        typeof l.cantidad === "string" && l.cantidad.trim() ? l.cantidad.trim() : undefined;
      const nota = typeof l.nota === "string" && l.nota.trim() ? l.nota.trim() : undefined;
      return {
        corte_id: typeof l.corte_id === "string" ? l.corte_id : "",
        resultado,
        ...(cantidad ? { cantidad } : {}),
        ...(nota ? { nota } : {}),
      };
    })
    .filter((l) => l.corte_id.length > 0);
}

export function etiquetaResultadoCierre(resultado: MepResultadoCierre): string {
  if (resultado === "falto") {
    return "Faltó";
  }
  if (resultado === "sobro") {
    return "Sobró";
  }
  return "OK";
}

export function cierreInicialDesdeCarga(carga: MepDeliCarga): MepLineaCierre[] {
  const previas = new Map(
    (carga.cierre_lineas ?? []).map((l) => [l.corte_id, l] as const)
  );
  return carga.lineas.map((l) => {
    const prev = previas.get(l.corte_id);
    if (prev) {
      return prev;
    }
    return { corte_id: l.corte_id, resultado: "ok" as const };
  });
}

export function tieneCierre(carga: MepDeliCarga): boolean {
  return Boolean(carga.cierre_at && (carga.cierre_lineas?.length ?? 0) > 0);
}

export function cargaDesdeFila(row: MepDeliCargaDbRow): MepDeliCarga {
  const cierre = normalizarCierreLineas(row.cierre_lineas);
  return {
    id: row.id,
    fecha: row.fecha,
    hora: row.hora,
    servicio: row.servicio,
    historial_servicio_id: row.historial_servicio_id,
    lineas: normalizarLineasMep(row.lineas),
    cargado_por_id: row.cargado_por_id ?? null,
    cargado_por_nombre: row.cargado_por_nombre ?? null,
    cierre_lineas: cierre.length > 0 ? cierre : null,
    cierre_at: row.cierre_at ?? null,
    cerrado_por_id: row.cerrado_por_id ?? null,
    cerrado_por_nombre: row.cerrado_por_nombre ?? null,
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
    .select(MEP_CORTES_SELECT)
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("categoria", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as MepCorteDbRow[]).map(corteDesdeFila);
}

export async function fetchMepCortesTodos(): Promise<MepCorte[]> {
  const { data, error } = await supabase
    .from("mep_cortes")
    .select(MEP_CORTES_SELECT)
    .order("categoria", { ascending: true })
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
    .select(MEP_CARGA_SELECT)
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

export function agruparCortesPorCategoria(
  cortes: MepCorte[]
): { categoria: string; cortes: MepCorte[] }[] {
  const map = new Map<string, MepCorte[]>();
  for (const c of cortes) {
    const lista = map.get(c.categoria) ?? [];
    lista.push(c);
    map.set(c.categoria, lista);
  }
  return [...map.entries()]
    .map(([categoria, lista]) => ({
      categoria,
      ordenMin: Math.min(...lista.map((c) => c.orden)),
      cortes: [...lista].sort(
        (x, y) => x.orden - y.orden || x.nombre.localeCompare(y.nombre, "es")
      ),
    }))
    .sort(
      (a, b) =>
        a.ordenMin - b.ordenMin || a.categoria.localeCompare(b.categoria, "es")
    )
    .map(({ categoria, cortes: lista }) => ({ categoria, cortes: lista }));
}

/** @deprecated Usar agruparCortesPorCategoria */
export const agruparCortesPorPescado = agruparCortesPorCategoria;

export async function fetchMepDeliCargasHistorial(): Promise<MepDeliCarga[]> {
  const { data, error } = await supabase
    .from("mep_deli_cargas")
    .select(MEP_CARGA_SELECT)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as MepDeliCargaDbRow[]).map(cargaDesdeFila);
}

export type MepLineaEnriquecida = MepLineaCarga & {
  categoria: string;
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
          categoria: "—",
          nombre: `Ítem ${l.corte_id.slice(0, 6)}…`,
          unidad: "g" as UnidadMep,
        };
      }
      return {
        ...l,
        categoria: corte.categoria,
        nombre: corte.nombre,
        unidad: corte.unidad,
      };
    })
    .sort(
      (a, b) =>
        a.categoria.localeCompare(b.categoria, "es") ||
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

export type MepLineaCierreEnriquecida = MepLineaCierre & {
  categoria: string;
  nombre: string;
  cantidad_plan: string;
  unidad: UnidadMep;
};

export function enriquecerCierreLineas(
  carga: MepDeliCarga,
  cortesPorId: Map<string, MepCorte>
): MepLineaCierreEnriquecida[] {
  const plan = new Map(carga.lineas.map((l) => [l.corte_id, l.cantidad]));
  const lineas = cierreInicialDesdeCarga(carga);
  return lineas
    .map((l) => {
      const corte = cortesPorId.get(l.corte_id);
      return {
        ...l,
        categoria: corte?.categoria ?? "—",
        nombre: corte?.nombre ?? `Ítem ${l.corte_id.slice(0, 6)}…`,
        cantidad_plan: plan.get(l.corte_id) ?? "—",
        unidad: corte?.unidad ?? "g",
      };
    })
    .sort(
      (a, b) =>
        a.categoria.localeCompare(b.categoria, "es") ||
        a.nombre.localeCompare(b.nombre, "es")
    );
}

export function calcularRecuentoMep(
  cargas: MepDeliCarga[],
  cortesPorId: Map<string, MepCorte>
): RecuentoMepItem[] {
  const map = new Map<string, RecuentoMepItem>();

  for (const carga of cargas) {
    if (!tieneCierre(carga) || !carga.cierre_lineas) {
      continue;
    }
    for (const linea of carga.cierre_lineas) {
      const corte = cortesPorId.get(linea.corte_id);
      const actual = map.get(linea.corte_id) ?? {
        corte_id: linea.corte_id,
        categoria: corte?.categoria ?? "—",
        nombre: corte?.nombre ?? linea.corte_id.slice(0, 8),
        servicios_con_cierre: 0,
        faltos: 0,
        sobraron: 0,
        ok: 0,
      };
      actual.servicios_con_cierre += 1;
      if (linea.resultado === "falto") {
        actual.faltos += 1;
      } else if (linea.resultado === "sobro") {
        actual.sobraron += 1;
      } else {
        actual.ok += 1;
      }
      map.set(linea.corte_id, actual);
    }
  }

  return [...map.values()]
    .filter((r) => r.faltos > 0 || r.sobraron > 0)
    .sort(
      (a, b) =>
        b.faltos - a.faltos ||
        b.sobraron - a.sobraron ||
        a.categoria.localeCompare(b.categoria, "es") ||
        a.nombre.localeCompare(b.nombre, "es")
    );
}

export type SessionMepUsuario = { id: string; name: string };

export async function fetchSessionMepUsuario(): Promise<SessionMepUsuario | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const data = (await res.json()) as {
      session: { id: string; name: string } | null;
    };
    if (data.session?.id && data.session?.name) {
      return { id: data.session.id, name: data.session.name };
    }
  } catch {
    // sin sesión
  }
  return null;
}
