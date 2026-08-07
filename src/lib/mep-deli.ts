import {
  registroMasRecienteEnHistorial,
  type HistorialServicioRow,
  type ServicioHistorial,
} from "@/src/lib/historial-servicios";
import { supabase } from "@/src/lib/supabase";

export type UnidadMep = "g" | "kg" | "ud" | "porciones";

/** MEP Deli es solo delivery nocturno; la barra usa mediodía y noche en historial_servicios. */
export const MEP_DELI_SERVICIO: ServicioHistorial = "Noche";

export type MepCorte = {
  id: string;
  categoria: string;
  nombre: string;
  unidad: UnidadMep;
  /** Peso objetivo de referencia (pizarra), ej. "15 g" o "12/14 g". */
  peso_ref: string | null;
  orden: number;
  activo: boolean;
};

export type MepCorteDbRow = {
  id: string;
  categoria?: string | null;
  pescado?: string | null;
  nombre: string;
  unidad: string;
  peso_ref?: string | null;
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

export type MepSugerenciaCantidad = {
  corte_id: string;
  categoria: string;
  nombre: string;
  unidad: UnidadMep;
  cantidad_base: number | null;
  cantidad_sugerida: number | null;
  motivo: string | null;
};

export type FiltroPersonaMep =
  | { tipo: "todos" }
  | { tipo: "cargado"; nombre: string }
  | { tipo: "cerrado"; nombre: string };

export const MEP_CARGA_SELECT =
  "id, fecha, hora, servicio, historial_servicio_id, lineas, cargado_por_id, cargado_por_nombre, cierre_lineas, cierre_at, cerrado_por_id, cerrado_por_nombre, created_at";

const MEP_CARGA_SELECT_BASE =
  "id, fecha, hora, servicio, historial_servicio_id, lineas, created_at";

const MEP_CARGA_SELECT_VARIANTS = [MEP_CARGA_SELECT, MEP_CARGA_SELECT_BASE] as const;

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

function errorFechaDuplicada(error: PostgrestishError): boolean {
  if (error.code === "23505") {
    return true;
  }
  const msg = error.message.toLowerCase();
  return msg.includes("unique") && msg.includes("fecha");
}

async function ejecutarSelectMepCargas(
  build: (
    select: string
  ) => PromiseLike<{ data: unknown; error: PostgrestishError | null }>
): Promise<MepDeliCargaDbRow[]> {
  let lastError: PostgrestishError | null = null;
  for (const select of MEP_CARGA_SELECT_VARIANTS) {
    const { data, error } = await build(select);
    if (!error) {
      return (data ?? []) as MepDeliCargaDbRow[];
    }
    if (errorColumnaFaltante(error)) {
      lastError = error;
      continue;
    }
    throw error;
  }
  throw lastError ?? new Error("No se pudo leer mep_deli_cargas.");
}

/** Excluye cargas de mediodía (solo delivery nocturno en MEP Deli). */
export function esCargaMepDeli(carga: MepDeliCarga): boolean {
  return carga.servicio !== "Mediodia";
}

export function filtrarCargasMepDeli(cargas: MepDeliCarga[]): MepDeliCarga[] {
  return cargas.filter(esCargaMepDeli);
}

export const UNIDADES_MEP: UnidadMep[] = ["g", "kg", "ud", "porciones"];

const MEP_CORTES_SELECT =
  "id, categoria, pescado, nombre, unidad, peso_ref, orden, activo";

const MEP_CORTES_SELECT_BASE =
  "id, categoria, pescado, nombre, unidad, orden, activo";

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
  const peso = row.peso_ref?.trim();
  return {
    id: row.id,
    categoria: categoriaDesdeFila(row),
    nombre: row.nombre,
    unidad,
    peso_ref: peso && peso.length > 0 ? peso : null,
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

/** MEP sin cierre más antigua: hay que cerrarla antes de abrir otra fecha. */
export function obtenerMepPendienteCierre(
  cargas: MepDeliCarga[]
): MepDeliCarga | null {
  const pendientes = deduplicarCargasPorFecha(cargas).filter((c) => !tieneCierre(c));
  if (!pendientes.length) {
    return null;
  }
  return [...pendientes].sort((a, b) => {
    const df = a.fecha.localeCompare(b.fecha);
    if (df !== 0) {
      return df;
    }
    return a.created_at.localeCompare(b.created_at);
  })[0];
}

export function fechaBloqueadaPorCierrePendiente(
  fecha: string,
  pendiente: MepDeliCarga | null
): boolean {
  if (!pendiente) {
    return false;
  }
  return fecha !== pendiente.fecha;
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

const MEP_DELI_BORRADOR_KEY = "omakase-mep-deli-borrador";

export type MepDeliBorrador = {
  fecha: string;
  hora: string;
  cantidades: Record<string, string>;
  confirmados: string[];
  updatedAt: string;
};

function borradorStorageKey(fecha: string): string {
  return `${MEP_DELI_BORRADOR_KEY}:${fecha}`;
}

export function leerBorradorMepDeli(fecha: string): MepDeliBorrador | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(borradorStorageKey(fecha));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as MepDeliBorrador;
    if (parsed.fecha !== fecha || typeof parsed.cantidades !== "object") {
      return null;
    }
    return {
      fecha: parsed.fecha,
      hora: typeof parsed.hora === "string" ? parsed.hora : "",
      cantidades: parsed.cantidades ?? {},
      confirmados: Array.isArray(parsed.confirmados) ? parsed.confirmados : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
}

export function guardarBorradorMepDeli(borrador: MepDeliBorrador): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(borradorStorageKey(borrador.fecha), JSON.stringify(borrador));
  } catch {
    // quota / modo privado
  }
}

export function limpiarBorradorMepDeli(fecha: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(borradorStorageKey(fecha));
  } catch {
    // ignorar
  }
}

export function cantidadesDesdeBorrador(borrador: MepDeliBorrador): Map<string, string> {
  const map = new Map<string, string>();
  for (const [corteId, cantidad] of Object.entries(borrador.cantidades)) {
    const c = cantidad.trim();
    if (corteId && c.length > 0) {
      map.set(corteId, c);
    }
  }
  return map;
}

export async function fetchMepCortesActivos(): Promise<MepCorte[]> {
  const selects = [MEP_CORTES_SELECT, MEP_CORTES_SELECT_BASE] as const;
  let lastError: PostgrestishError | null = null;

  for (const select of selects) {
    const { data, error } = await supabase
      .from("mep_cortes")
      .select(select as string)
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("categoria", { ascending: true })
      .order("nombre", { ascending: true });

    if (!error) {
      return ((data ?? []) as unknown as MepCorteDbRow[]).map(corteDesdeFila);
    }
    if (errorColumnaFaltante(error)) {
      lastError = error;
      continue;
    }
    throw error;
  }

  throw lastError ?? new Error("No se pudo leer mep_cortes.");
}

export async function fetchMepCortesTodos(): Promise<MepCorte[]> {
  const selects = [MEP_CORTES_SELECT, MEP_CORTES_SELECT_BASE] as const;
  let lastError: PostgrestishError | null = null;

  for (const select of selects) {
    const { data, error } = await supabase
      .from("mep_cortes")
      .select(select as string)
      .order("categoria", { ascending: true })
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });

    if (!error) {
      return ((data ?? []) as unknown as MepCorteDbRow[]).map(corteDesdeFila);
    }
    if (errorColumnaFaltante(error)) {
      lastError = error;
      continue;
    }
    throw error;
  }

  throw lastError ?? new Error("No se pudo leer mep_cortes.");
}

export async function fetchUltimaMepDeliCarga(): Promise<MepDeliCarga | null> {
  const rows = await ejecutarSelectMepCargas((select) =>
    supabase
      .from("mep_deli_cargas")
      .select(select)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40)
  );

  const deli = deduplicarCargasPorFecha(rows.map(cargaDesdeFila));
  return deli[0] ?? null;
}

export async function fetchMepDeliCargaPorFecha(
  fecha: string
): Promise<MepDeliCarga | null> {
  const rows = await ejecutarSelectMepCargas((select) =>
    supabase
      .from("mep_deli_cargas")
      .select(select)
      .eq("fecha", fecha)
      .order("created_at", { ascending: false })
      .limit(5)
  );

  const deli = deduplicarCargasPorFecha(rows.map(cargaDesdeFila));
  return deli.find((c) => c.fecha === fecha) ?? null;
}

export function deduplicarCargasPorFecha(cargas: MepDeliCarga[]): MepDeliCarga[] {
  const porFecha = new Map<string, MepDeliCarga>();
  for (const c of filtrarCargasMepDeli(cargas)) {
    const prev = porFecha.get(c.fecha);
    if (!prev || compararCargasMasReciente(c, prev) < 0) {
      porFecha.set(c.fecha, c);
    }
  }
  return [...porFecha.values()].sort(compararCargasMasReciente);
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

  const rows = ((data ?? []) as HistorialServicioRow[]).filter(
    (r) => r.servicio === MEP_DELI_SERVICIO
  );

  return registroMasRecienteEnHistorial(rows);
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
  const rows = await ejecutarSelectMepCargas((select) =>
    supabase
      .from("mep_deli_cargas")
      .select(select)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
  );

  return deduplicarCargasPorFecha(rows.map(cargaDesdeFila));
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

  return [...grupos.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([fecha, lista]) => ({
      fecha,
      cargas: [...filtrarCargasMepDeli(lista)].sort((a, b) => {
        const ha = a.hora ?? "";
        const hb = b.hora ?? "";
        if (ha !== hb) {
          return hb.localeCompare(ha);
        }
        return b.created_at.localeCompare(a.created_at);
      }),
    }))
    .filter((g) => g.cargas.length > 0);
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
  return `${carga.fecha}${hora}`;
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

const DIAS_SEMANA = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const;

export function parseFechaLocalISO(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function diaSemanaDesdeFechaISO(fecha: string): number {
  return parseFechaLocalISO(fecha).getDay();
}

export function etiquetaDiaSemana(fecha: string): string {
  return DIAS_SEMANA[diaSemanaDesdeFechaISO(fecha)] ?? "";
}

export function buscarMepMismoDiaSemana(
  cargas: MepDeliCarga[],
  fecha: string
): MepDeliCarga | null {
  const diaObjetivo = diaSemanaDesdeFechaISO(fecha);
  const candidatas = filtrarCargasMepDeli(cargas).filter(
    (c) => c.fecha !== fecha && diaSemanaDesdeFechaISO(c.fecha) === diaObjetivo
  );
  if (!candidatas.length) {
    return null;
  }
  return [...candidatas].sort(compararCargasMasReciente)[0] ?? null;
}

export async function actualizarMepDeliCarga(
  id: string,
  patch: Record<string, unknown>
): Promise<MepDeliCarga> {
  const intentos: Record<string, unknown>[] = [patch];

  const sinAutor = { ...patch };
  delete sinAutor.cargado_por_id;
  delete sinAutor.cargado_por_nombre;
  if (Object.keys(sinAutor).length) {
    intentos.push(sinAutor);
  }

  if (patch.cierre_lineas !== undefined || patch.cierre_at !== undefined) {
    intentos.push({
      cierre_lineas: patch.cierre_lineas,
      cierre_at: patch.cierre_at,
      cerrado_por_id: patch.cerrado_por_id,
      cerrado_por_nombre: patch.cerrado_por_nombre,
    });
  }

  let lastError: PostgrestishError | null = null;
  for (const body of intentos) {
    for (const select of MEP_CARGA_SELECT_VARIANTS) {
      const { data, error } = await supabase
        .from("mep_deli_cargas")
        .update(body)
        .eq("id", id)
        .select(select)
        .single();

      if (!error && data) {
        return cargaDesdeFila(data as unknown as MepDeliCargaDbRow);
      }
      if (error) {
        if (errorColumnaFaltante(error)) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
  }

  throw lastError ?? new Error("No se pudo actualizar la MEP.");
}

export async function insertMepDeliCarga(
  payload: Record<string, unknown>
): Promise<MepDeliCarga> {
  const intentos = [
    payload,
    {
      fecha: payload.fecha,
      hora: payload.hora,
      servicio: payload.servicio,
      historial_servicio_id: payload.historial_servicio_id,
      lineas: payload.lineas,
      cargado_por_id: payload.cargado_por_id,
      cargado_por_nombre: payload.cargado_por_nombre,
    },
    {
      fecha: payload.fecha,
      hora: payload.hora,
      servicio: payload.servicio,
      historial_servicio_id: payload.historial_servicio_id,
      lineas: payload.lineas,
    },
  ];

  let lastError: PostgrestishError | null = null;
  for (const body of intentos) {
    for (const select of MEP_CARGA_SELECT_VARIANTS) {
      const { data, error } = await supabase
        .from("mep_deli_cargas")
        .insert(body)
        .select(select)
        .single();

      if (!error && data) {
        return cargaDesdeFila(data as unknown as MepDeliCargaDbRow);
      }
      if (error) {
        if (errorColumnaFaltante(error)) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
  }

  throw lastError ?? new Error("No se pudo guardar la MEP.");
}

export async function guardarMepDeliCarga(
  payload: Record<string, unknown>,
  idExistente?: string | null
): Promise<MepDeliCarga> {
  const fecha = String(payload.fecha ?? "");
  let id = idExistente ?? null;

  if (!id && fecha) {
    const existente = await fetchMepDeliCargaPorFecha(fecha);
    id = existente?.id ?? null;
  }

  if (id) {
    return actualizarMepDeliCarga(id, {
      hora: payload.hora,
      servicio: payload.servicio,
      historial_servicio_id: payload.historial_servicio_id,
      lineas: payload.lineas,
      cargado_por_id: payload.cargado_por_id,
      cargado_por_nombre: payload.cargado_por_nombre,
    });
  }

  try {
    return await insertMepDeliCarga(payload);
  } catch (err) {
    if (errorFechaDuplicada(err as PostgrestishError) && fecha) {
      const existente = await fetchMepDeliCargaPorFecha(fecha);
      if (existente) {
        return guardarMepDeliCarga(payload, existente.id);
      }
    }
    throw err;
  }
}

export async function deleteMepDeliCarga(id: string): Promise<void> {
  const { error } = await supabase.from("mep_deli_cargas").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function fetchMepCargasSinCerrarRecientes(): Promise<MepDeliCarga[]> {
  const hace = new Date();
  hace.setDate(hace.getDate() - 14);
  const desde = `${hace.getFullYear()}-${String(hace.getMonth() + 1).padStart(2, "0")}-${String(hace.getDate()).padStart(2, "0")}`;

  const ordenar = (rows: MepDeliCargaDbRow[]) =>
    filtrarCargasMepDeli(rows.map(cargaDesdeFila)).filter((c) => !tieneCierre(c));

  try {
    const rows = await ejecutarSelectMepCargas((select) =>
      supabase
        .from("mep_deli_cargas")
        .select(select)
        .gte("fecha", desde)
        .is("cierre_at", null)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
    );
    return ordenar(rows);
  } catch (err) {
    if (!errorColumnaFaltante(err as PostgrestishError)) {
      throw err;
    }
  }

  const rows = await ejecutarSelectMepCargas((select) =>
    supabase
      .from("mep_deli_cargas")
      .select(select)
      .gte("fecha", desde)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
  );
  return ordenar(rows);
}

export function personasEnCargas(cargas: MepDeliCarga[]): {
  cargadores: string[];
  cerradores: string[];
} {
  const cargadores = new Set<string>();
  const cerradores = new Set<string>();
  for (const c of cargas) {
    if (c.cargado_por_nombre?.trim()) {
      cargadores.add(c.cargado_por_nombre.trim());
    }
    if (c.cerrado_por_nombre?.trim()) {
      cerradores.add(c.cerrado_por_nombre.trim());
    }
  }
  return {
    cargadores: [...cargadores].sort((a, b) => a.localeCompare(b, "es")),
    cerradores: [...cerradores].sort((a, b) => a.localeCompare(b, "es")),
  };
}

export function filtrarCargasPorPersona(
  cargas: MepDeliCarga[],
  filtro: FiltroPersonaMep
): MepDeliCarga[] {
  if (filtro.tipo === "todos") {
    return cargas;
  }
  if (filtro.tipo === "cargado") {
    return cargas.filter((c) => c.cargado_por_nombre === filtro.nombre);
  }
  return cargas.filter((c) => c.cerrado_por_nombre === filtro.nombre);
}

function parseCantidadMep(valor: string): number | null {
  const n = Number(valor.replace(",", ".").trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function formatearCantidadMep(valor: number, unidad: UnidadMep): string {
  if (unidad === "ud" || unidad === "porciones") {
    return String(Math.max(0, Math.round(valor)));
  }
  const redondeado = Math.round(valor * 10) / 10;
  return Number.isInteger(redondeado) ? String(redondeado) : redondeado.toFixed(1);
}

export function formatearCantidadSugerida(valor: number, unidad: UnidadMep): string {
  return formatearCantidadMep(valor, unidad);
}

function promedioCantidadHistorial(
  cargas: MepDeliCarga[],
  corteId: string
): number | null {
  const vals: number[] = [];
  for (const c of cargas) {
    const linea = c.lineas.find((l) => l.corte_id === corteId);
    if (!linea) {
      continue;
    }
    const n = parseCantidadMep(linea.cantidad);
    if (n !== null) {
      vals.push(n);
    }
  }
  if (!vals.length) {
    return null;
  }
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function calcularSugerenciasCantidades(
  cargasHistorial: MepDeliCarga[],
  cortes: MepCorte[],
  cantidadesActuales: Map<string, string>
): MepSugerenciaCantidad[] {
  const recuento = calcularRecuentoMep(
    cargasHistorial,
    new Map(cortes.map((c) => [c.id, c]))
  );
  const recuentoPorId = new Map(recuento.map((r) => [r.corte_id, r]));
  const ultimas = [...cargasHistorial]
    .sort(compararCargasMasReciente)
    .slice(0, 12);

  return cortes
    .map((corte) => {
      const actual = parseCantidadMep(cantidadesActuales.get(corte.id) ?? "");
      const promedio = promedioCantidadHistorial(ultimas, corte.id);
      const base = actual ?? promedio;
      const stats = recuentoPorId.get(corte.id);

      if (base === null) {
        return {
          corte_id: corte.id,
          categoria: corte.categoria,
          nombre: corte.nombre,
          unidad: corte.unidad,
          cantidad_base: null,
          cantidad_sugerida: null,
          motivo: null,
        };
      }

      if (!stats || stats.servicios_con_cierre < 2) {
        return {
          corte_id: corte.id,
          categoria: corte.categoria,
          nombre: corte.nombre,
          unidad: corte.unidad,
          cantidad_base: base,
          cantidad_sugerida: null,
          motivo: null,
        };
      }

      const ratioFalto = stats.faltos / stats.servicios_con_cierre;
      const ratioSobro = stats.sobraron / stats.servicios_con_cierre;
      let factor = 1;
      let motivo: string | null = null;

      if (ratioFalto >= 0.5) {
        factor = 1.15;
        motivo = `Faltó en ${stats.faltos}/${stats.servicios_con_cierre} cierres → +15%`;
      } else if (ratioFalto >= 0.3) {
        factor = 1.1;
        motivo = `Faltó a menudo (${stats.faltos}/${stats.servicios_con_cierre}) → +10%`;
      } else if (ratioSobro >= 0.5) {
        factor = 0.85;
        motivo = `Sobró en ${stats.sobraron}/${stats.servicios_con_cierre} cierres → −15%`;
      } else if (ratioSobro >= 0.3) {
        factor = 0.9;
        motivo = `Sobró a menudo (${stats.sobraron}/${stats.servicios_con_cierre}) → −10%`;
      }

      if (factor === 1) {
        return {
          corte_id: corte.id,
          categoria: corte.categoria,
          nombre: corte.nombre,
          unidad: corte.unidad,
          cantidad_base: base,
          cantidad_sugerida: null,
          motivo: null,
        };
      }

      return {
        corte_id: corte.id,
        categoria: corte.categoria,
        nombre: corte.nombre,
        unidad: corte.unidad,
        cantidad_base: base,
        cantidad_sugerida: parseCantidadMep(
          formatearCantidadMep(base * factor, corte.unidad)
        ),
        motivo,
      };
    })
    .filter((s) => s.cantidad_sugerida !== null);
}
