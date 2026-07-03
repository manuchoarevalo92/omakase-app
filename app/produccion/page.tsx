"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChefHat,
  HelpCircle,
  Loader2,
  Plus,
  StickyNote,
  Trash2,
  Undo2,
} from "lucide-react";

import {
  calcularPrediccionProduccion,
  compararPorUrgenciaProduccion,
  ESTADO_PRODUCCION_BADGE,
  type EstadoProduccion,
  type PrediccionProduccion,
} from "@/src/lib/produccion-prediccion";
import {
  AREAS_PRODUCCION,
  cantidadSugeridaAlMarcar,
  ETIQUETA_AREA_PRODUCCION,
  fetchPreparaciones,
  formatearCantidad,
  hoyISO,
  parseCantidadInput,
  preparacionDesdeFila,
  UNIDADES_CANTIDAD,
  type AreaProduccion,
  type Preparacion,
  type PreparacionDbRow,
  type UnidadCantidad,
} from "@/src/lib/preparaciones";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

const ESTADOS_URGENTES: EstadoProduccion[] = [
  "Hacer ahora",
  "Atrasado",
  "Rehacer pronto",
];

function bordePorEstado(prep: Preparacion, prediccion: PrediccionProduccion): string {
  if (prep.pendiente) {
    return "border-orange-800/80 bg-orange-950/20";
  }
  if (prediccion.estado === "Atrasado") {
    return "border-red-900/70 bg-red-950/15";
  }
  if (prediccion.estado === "Rehacer pronto") {
    return "border-amber-900/50 bg-amber-950/10";
  }
  return "border-zinc-800 bg-zinc-950/40";
}

function fondoPorEstado(prep: Preparacion, prediccion: PrediccionProduccion): string {
  if (prep.pendiente) {
    return "bg-orange-950/25";
  }
  if (prediccion.estado === "Atrasado") {
    return "bg-red-950/20";
  }
  if (prediccion.estado === "Rehacer pronto") {
    return "bg-amber-950/15";
  }
  return "bg-zinc-950/30";
}

const ETIQUETA_URGENTE_CORTA: Record<EstadoProduccion, string | null> = {
  "Hacer ahora": "Ahora",
  Atrasado: "Venció",
  "Rehacer pronto": "Pronto",
  OK: null,
  "Sin datos": null,
  Inactiva: null,
};

function esUrgente(estado: EstadoProduccion): boolean {
  return ESTADOS_URGENTES.includes(estado);
}

const ESTADO_ICONO: Record<EstadoProduccion, React.ReactNode> = {
  "Hacer ahora": <ChefHat className="h-3.5 w-3.5" aria-hidden />,
  Atrasado: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />,
  "Rehacer pronto": <CalendarClock className="h-3.5 w-3.5" aria-hidden />,
  OK: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
  "Sin datos": <HelpCircle className="h-3.5 w-3.5" aria-hidden />,
  Inactiva: <HelpCircle className="h-3.5 w-3.5" aria-hidden />,
};

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function formatearFechaCorta(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return `${d} ${MESES_CORTOS[(m ?? 1) - 1]} ${y}`;
}

function KpiCard(props: { icono: React.ReactNode; titulo: string; valor: number; tono: string }) {
  const { icono, titulo, valor, tono } = props;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className={`flex items-center gap-2 ${tono}`}>
        {icono}
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">{titulo}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{valor}</p>
    </div>
  );
}

function EstadoBadge(props: { estado: EstadoProduccion }) {
  const { estado } = props;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${ESTADO_PRODUCCION_BADGE[estado]}`}
    >
      {ESTADO_ICONO[estado]}
      {estado}
    </span>
  );
}

type ItemConPrediccion = {
  prep: Preparacion;
  prediccion: PrediccionProduccion;
};

type SnapshotHecho = {
  prepId: string;
  nombre: string;
  pendiente: boolean;
  fechaUltimaProduccion: string | null;
  ultimaCantidad: number | null;
  cantidadInput: string;
};

const UNDO_HECHO_MS = 8000;

const STORAGE_AREA = "omakase-produccion-area";
const STORAGE_SOLO_URGENTES = "omakase-produccion-solo-urgentes";

function leerAreaGuardada(): AreaProduccion {
  if (typeof window === "undefined") {
    return "delivery";
  }
  try {
    const raw = localStorage.getItem(STORAGE_AREA);
    if (raw === "delivery" || raw === "barra") {
      return raw;
    }
  } catch {
    // ignore
  }
  return "delivery";
}

function leerSoloUrgentesGuardado(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return localStorage.getItem(STORAGE_SOLO_URGENTES) === "1";
  } catch {
    return false;
  }
}

export default function ProduccionPage() {
  const [items, setItems] = useState<Preparacion[]>([]);
  const [areaActiva, setAreaActiva] = useState<AreaProduccion>("delivery");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaDuracion, setNuevaDuracion] = useState("7");
  const [nuevaCantidadRef, setNuevaCantidadRef] = useState("1");
  const [nuevaUnidad, setNuevaUnidad] = useState<UnidadCantidad>("L");
  const [nuevaNotas, setNuevaNotas] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alDiaExpandido, setAlDiaExpandido] = useState(false);
  const [altaExpandida, setAltaExpandida] = useState(false);
  const [soloUrgentes, setSoloUrgentes] = useState(false);
  const [notasAbiertas, setNotasAbiertas] = useState<Set<string>>(() => new Set());
  const [notasBorrador, setNotasBorrador] = useState<Record<string, string>>({});
  const [cantidadPorId, setCantidadPorId] = useState<Record<string, string>>({});
  const [undoHecho, setUndoHecho] = useState<SnapshotHecho | null>(null);
  const inputNuevoNombreRef = useRef<HTMLInputElement>(null);

  const cargar = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setItems(await fetchPreparaciones());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar con Supabase.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setAreaActiva(leerAreaGuardada());
    setSoloUrgentes(leerSoloUrgentesGuardado());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_AREA, areaActiva);
    } catch {
      // ignore
    }
  }, [areaActiva]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SOLO_URGENTES, soloUrgentes ? "1" : "0");
    } catch {
      // ignore
    }
  }, [soloUrgentes]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargar();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    setAlDiaExpandido(false);
    setAltaExpandida(false);
  }, [areaActiva]);

  useEffect(() => {
    if (altaExpandida) {
      const t = window.setTimeout(() => inputNuevoNombreRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [altaExpandida]);

  const itemsDelArea = useMemo(
    () => items.filter((prep) => prep.area === areaActiva),
    [items, areaActiva]
  );

  useEffect(() => {
    if (itemsDelArea.length === 0 && !isLoading) {
      setAltaExpandida(true);
    }
  }, [itemsDelArea.length, isLoading, areaActiva]);

  useEffect(() => {
    if (itemsDelArea.length === 0) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "u" || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      e.preventDefault();
      setSoloUrgentes((v) => !v);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [itemsDelArea.length]);

  useEffect(() => {
    setCantidadPorId((prev) => {
      const next = { ...prev };
      items.forEach((prep) => {
        if (next[prep.id] === undefined) {
          next[prep.id] = String(cantidadSugeridaAlMarcar(prep));
        }
      });
      return next;
    });
  }, [items]);

  const itemsConPrediccion = useMemo((): ItemConPrediccion[] => {
    return itemsDelArea.map((prep) => ({
      prep,
      prediccion: calcularPrediccionProduccion({
        seguimientoActivo: prep.seguimientoActivo,
        pendiente: prep.pendiente,
        fechaUltimaProduccion: prep.fechaUltimaProduccion,
        duracionDias: prep.duracionDias,
        cantidadReferencia: prep.cantidadReferencia,
        ultimaCantidad: prep.ultimaCantidad,
        bufferPct: prep.bufferPct,
      }),
    }));
  }, [itemsDelArea]);

  const contadoresUrgentesPorArea = useMemo(() => {
    const map: Record<AreaProduccion, number> = { delivery: 0, barra: 0 };
    items.forEach((prep) => {
      if (!prep.seguimientoActivo) {
        return;
      }
      const pred = calcularPrediccionProduccion({
        seguimientoActivo: prep.seguimientoActivo,
        pendiente: prep.pendiente,
        fechaUltimaProduccion: prep.fechaUltimaProduccion,
        duracionDias: prep.duracionDias,
        cantidadReferencia: prep.cantidadReferencia,
        ultimaCantidad: prep.ultimaCantidad,
        bufferPct: prep.bufferPct,
      });
      if (
        pred.estado === "Hacer ahora" ||
        pred.estado === "Atrasado" ||
        pred.estado === "Rehacer pronto"
      ) {
        map[prep.area] += 1;
      }
    });
    return map;
  }, [items]);

  const ordenados = useMemo(() => {
    return [...itemsConPrediccion].sort((a, b) => {
      const cmp = compararPorUrgenciaProduccion(a.prediccion, b.prediccion);
      if (cmp !== 0) {
        return cmp;
      }
      return a.prep.nombre.localeCompare(b.prep.nombre, "es");
    });
  }, [itemsConPrediccion]);

  const activos = useMemo(
    () => ordenados.filter((e) => e.prep.seguimientoActivo),
    [ordenados]
  );

  const urgentes = useMemo(
    () => activos.filter((e) => esUrgente(e.prediccion.estado)),
    [activos]
  );

  const alDia = useMemo(
    () => activos.filter((e) => !esUrgente(e.prediccion.estado)),
    [activos]
  );

  const inactivos = useMemo(
    () => ordenados.filter((e) => !e.prep.seguimientoActivo),
    [ordenados]
  );

  const kpis = useMemo(() => {
    const base = {
      "Hacer ahora": 0,
      Atrasado: 0,
      "Rehacer pronto": 0,
      OK: 0,
      "Sin datos": 0,
    } as Record<string, number>;
    activos.forEach(({ prediccion }) => {
      if (prediccion.estado in base) {
        base[prediccion.estado] += 1;
      }
    });
    return base;
  }, [activos]);

  const actualizar = async (
    id: string,
    patch: Record<string, unknown>
  ): Promise<Preparacion | null> => {
    setGuardandoId(id);
    setError(null);
    try {
      const { data, error: updateError } = await supabase
        .from("preparaciones")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        throw new Error(formatPostgrestError(updateError));
      }

      const actualizada = preparacionDesdeFila(data as PreparacionDbRow);
      setItems((prev) => prev.map((p) => (p.id === id ? actualizada : p)));
      return actualizada;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      return null;
    } finally {
      setGuardandoId(null);
    }
  };

  const deshacerHecho = useCallback(async () => {
    if (!undoHecho) {
      return;
    }
    const snap = undoHecho;
    setUndoHecho(null);
    const actualizada = await actualizar(snap.prepId, {
      pendiente: snap.pendiente,
      fecha_ultima_produccion: snap.fechaUltimaProduccion,
      ultima_cantidad: snap.ultimaCantidad,
    });
    if (actualizada) {
      setCantidadPorId((prev) => ({ ...prev, [snap.prepId]: snap.cantidadInput }));
    }
  }, [undoHecho]);

  const marcarHecha = async (prep: Preparacion) => {
    const cantidad = parseCantidadInput(cantidadPorId[prep.id] ?? "");
    if (cantidad == null) {
      setError("Indicá cuánto hiciste (cantidad mayor que 0).");
      return;
    }
    const snapshot: SnapshotHecho = {
      prepId: prep.id,
      nombre: prep.nombre,
      pendiente: prep.pendiente,
      fechaUltimaProduccion: prep.fechaUltimaProduccion,
      ultimaCantidad: prep.ultimaCantidad,
      cantidadInput: cantidadPorId[prep.id] ?? String(cantidad),
    };
    const actualizada = await actualizar(prep.id, {
      pendiente: false,
      fecha_ultima_produccion: hoyISO(),
      ultima_cantidad: cantidad,
    });
    if (!actualizada) {
      return;
    }
    setCantidadPorId((prev) => ({ ...prev, [prep.id]: String(cantidad) }));
    setUndoHecho(snapshot);
  };

  useEffect(() => {
    if (!undoHecho) {
      return;
    }
    const snap = undoHecho;
    const timer = window.setTimeout(() => {
      setUndoHecho((current) => (current?.prepId === snap.prepId ? null : current));
    }, UNDO_HECHO_MS);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "z" || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      e.preventDefault();
      void deshacerHecho();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [undoHecho, deshacerHecho]);

  const togglePendiente = async (prep: Preparacion) => {
    await actualizar(prep.id, { pendiente: !prep.pendiente });
  };

  const toggleNotas = (prep: Preparacion) => {
    setNotasAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(prep.id)) {
        next.delete(prep.id);
      } else {
        next.add(prep.id);
        setNotasBorrador((b) =>
          b[prep.id] !== undefined ? b : { ...b, [prep.id]: prep.notas ?? "" }
        );
      }
      return next;
    });
  };

  const guardarNotas = (prep: Preparacion) => {
    const valor = (notasBorrador[prep.id] ?? prep.notas ?? "").trim();
    const actual = (prep.notas ?? "").trim();
    if (valor === actual) {
      return;
    }
    void actualizar(prep.id, { notas: valor || null });
  };

  const toggleSeguimiento = async (prep: Preparacion) => {
    const nuevo = !prep.seguimientoActivo;
    await actualizar(prep.id, {
      seguimiento_activo: nuevo,
      pendiente: nuevo ? prep.pendiente : false,
    });
  };

  const eliminar = async (prep: Preparacion) => {
    if (!window.confirm(`¿Eliminar "${prep.nombre}"?`)) {
      return;
    }
    setError(null);
    const { error: deleteError } = await supabase.from("preparaciones").delete().eq("id", prep.id);
    if (deleteError) {
      setError(formatPostgrestError(deleteError));
      return;
    }
    setItems((prev) => prev.filter((p) => p.id !== prep.id));
  };

  const onCrear = async (e: FormEvent) => {
    e.preventDefault();
    const nombre = nuevoNombre.trim();
    const duracion = parseInt(nuevaDuracion, 10);
    const cantidadRef = parseCantidadInput(nuevaCantidadRef);
    if (!nombre) {
      return;
    }
    if (!Number.isFinite(duracion) || duracion < 1) {
      setError("La duración debe ser al menos 1 día.");
      return;
    }
    if (cantidadRef == null) {
      setError("El lote típico debe ser mayor que 0.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from("preparaciones").insert({
        nombre,
        area: areaActiva,
        duracion_dias: duracion,
        cantidad_referencia: cantidadRef,
        unidad_cantidad: nuevaUnidad,
        notas: nuevaNotas.trim() || null,
        seguimiento_activo: true,
        pendiente: false,
      });
      if (insertError) {
        throw new Error(formatPostgrestError(insertError));
      }
      setNuevoNombre("");
      setNuevaDuracion("7");
      setNuevaCantidadRef("1");
      setNuevaUnidad("L");
      setNuevaNotas("");
      setAltaExpandida(false);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFilaCompacta = ({ prep, prediccion }: ItemConPrediccion) => {
    const busy = guardandoId === prep.id;
    const etiqueta = ETIQUETA_URGENTE_CORTA[prediccion.estado];

    return (
      <li
        key={prep.id}
        className={`flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 ${fondoPorEstado(prep, prediccion)}`}
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-medium text-white">
            {prep.notas ? (
              <StickyNote
                className="h-3.5 w-3.5 shrink-0 text-amber-500/80"
                aria-label="Tiene notas"
              />
            ) : null}
            <span className="truncate">{prep.nombre}</span>
          </p>
          {etiqueta ? (
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {etiqueta}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={cantidadPorId[prep.id] ?? ""}
            disabled={busy}
            onChange={(e) =>
              setCantidadPorId((prev) => ({ ...prev, [prep.id]: e.target.value }))
            }
            aria-label={`Cantidad de ${prep.nombre}`}
            className="w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-center text-sm tabular-nums text-white"
          />
          <span className="w-8 shrink-0 text-xs text-zinc-500">{prep.unidadCantidad}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void marcarHecha(prep)}
            aria-label={`Marcar ${prep.nombre} como hecho`}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-emerald-700/80 bg-emerald-800/60 text-emerald-50 transition active:scale-95 hover:bg-emerald-700/70 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
      </li>
    );
  };

  const renderFila = ({ prep, prediccion }: ItemConPrediccion) => {
    const busy = guardandoId === prep.id;
    const loteTipico = formatearCantidad(prep.cantidadReferencia, prep.unidadCantidad);
    const notasVisibles = notasAbiertas.has(prep.id);
    const notasValor = notasBorrador[prep.id] ?? prep.notas ?? "";

    return (
      <li
        key={prep.id}
        className={`rounded-xl border p-4 ${bordePorEstado(prep, prediccion)}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-white">{prep.nombre}</h3>
              <EstadoBadge estado={prediccion.estado} />
            </div>
            <dl className="mt-2 grid gap-1 text-xs text-zinc-400 sm:grid-cols-2">
              <div>
                <dt className="inline text-zinc-500">Lote típico </dt>
                <dd className="inline text-zinc-300">
                  {loteTipico} → {prep.duracionDias} día{prep.duracionDias === 1 ? "" : "s"}
                </dd>
              </div>
              <div>
                <dt className="inline text-zinc-500">Última vez </dt>
                <dd className="inline text-zinc-300">
                  {prep.fechaUltimaProduccion
                    ? formatearFechaCorta(prep.fechaUltimaProduccion)
                    : "—"}
                  {prep.ultimaCantidad != null
                    ? ` · ${formatearCantidad(prep.ultimaCantidad, prep.unidadCantidad)}`
                    : null}
                </dd>
              </div>
              {prediccion.duracionEfectivaDias != null &&
              prep.fechaUltimaProduccion &&
              prep.ultimaCantidad != null &&
              prep.ultimaCantidad !== prep.cantidadReferencia ? (
                <div className="sm:col-span-2">
                  <dt className="inline text-zinc-500">Duración estimada </dt>
                  <dd className="inline tabular-nums text-zinc-300">
                    ~{prediccion.duracionEfectivaDias} día
                    {prediccion.duracionEfectivaDias === 1 ? "" : "s"} con el último lote
                  </dd>
                </div>
              ) : null}
              {prediccion.proximaFechaSugerida && prep.seguimientoActivo && !prep.pendiente ? (
                <div className="sm:col-span-2">
                  <dt className="inline text-zinc-500">Rehacer hacia </dt>
                  <dd className="inline text-zinc-300">
                    {formatearFechaCorta(prediccion.proximaFechaSugerida)}
                    {prediccion.diasParaProxima != null ? (
                      <span className="text-zinc-500">
                        {" "}
                        ({prediccion.diasParaProxima <= 0
                          ? "ya toca"
                          : `en ${prediccion.diasParaProxima} día${prediccion.diasParaProxima === 1 ? "" : "s"}`}
                        )
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void eliminar(prep)}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-zinc-500 transition hover:border-red-900/60 hover:text-red-300 disabled:opacity-50"
            aria-label={`Eliminar ${prep.nombre}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {prep.seguimientoActivo ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="text-xs text-zinc-500 sm:flex-1">
              Cantidad hecha
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={cantidadPorId[prep.id] ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    setCantidadPorId((prev) => ({ ...prev, [prep.id]: e.target.value }))
                  }
                  className="w-full max-w-[8rem] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm tabular-nums text-white"
                />
                <span className="text-sm text-zinc-400">{prep.unidadCantidad}</span>
              </div>
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void marcarHecha(prep)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-700/80 bg-emerald-800/60 px-4 py-3 text-base font-semibold text-emerald-50 shadow-sm transition active:scale-[0.99] hover:bg-emerald-700/70 disabled:opacity-50 sm:min-h-11 sm:w-auto sm:min-w-[9rem] sm:text-sm"
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
              )}
              Hecho
            </button>
          </div>
        ) : null}

        <div className="mt-3 border-t border-zinc-800/80 pt-3">
          <button
            type="button"
            onClick={() => toggleNotas(prep)}
            className="flex w-full items-center gap-2 rounded-lg py-1 text-left text-xs font-medium text-zinc-400 transition hover:text-zinc-200"
          >
            {notasVisibles ? (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <StickyNote className="h-3.5 w-3.5 shrink-0 text-amber-500/80" aria-hidden />
            Notas / receta
            {prep.notas ? (
              <span className="truncate text-zinc-600">
                · {prep.notas.split("\n")[0].slice(0, 48)}
                {prep.notas.length > 48 ? "…" : ""}
              </span>
            ) : (
              <span className="text-zinc-600">· opcional</span>
            )}
          </button>
          {notasVisibles ? (
            <textarea
              value={notasValor}
              disabled={busy}
              onChange={(e) =>
                setNotasBorrador((prev) => ({ ...prev, [prep.id]: e.target.value }))
              }
              onBlur={() => guardarNotas(prep)}
              placeholder="Receta, temperatura, dónde guardar, rendimiento del lote…"
              rows={4}
              className="mt-2 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600"
            />
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-zinc-800/80 pt-3">
          <label className="text-xs text-zinc-500">
            Días (lote típico)
            <input
              type="number"
              min={1}
              max={365}
              value={prep.duracionDias}
              disabled={busy}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isFinite(v)) {
                  return;
                }
                setItems((prev) =>
                  prev.map((p) => (p.id === prep.id ? { ...p, duracionDias: v } : p))
                );
              }}
              onBlur={(e) => {
                const v = Math.min(365, Math.max(1, parseInt(e.target.value, 10) || 7));
                void actualizar(prep.id, { duracion_dias: v });
              }}
              className="mt-1 block w-20 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm tabular-nums text-white"
            />
          </label>
          <label className="text-xs text-zinc-500">
            Lote típico
            <div className="mt-1 flex items-center gap-1.5">
              <input
                type="text"
                inputMode="decimal"
                defaultValue={String(prep.cantidadReferencia)}
                disabled={busy}
                key={`${prep.id}-${prep.cantidadReferencia}`}
                onBlur={(e) => {
                  const v = parseCantidadInput(e.target.value);
                  if (v != null && v !== prep.cantidadReferencia) {
                    void actualizar(prep.id, { cantidad_referencia: v });
                  }
                }}
                className="w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm tabular-nums text-white"
              />
              <select
                value={prep.unidadCantidad}
                disabled={busy}
                onChange={(e) => {
                  const u = e.target.value as UnidadCantidad;
                  void actualizar(prep.id, { unidad_cantidad: u });
                }}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-white"
              >
                {UNIDADES_CANTIDAD.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              className="size-4 rounded border-zinc-600 bg-zinc-800 accent-emerald-600"
              checked={prep.seguimientoActivo}
              disabled={busy}
              onChange={() => void toggleSeguimiento(prep)}
            />
            Seguimiento activo
          </label>
          {prep.seguimientoActivo ? (
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                className="size-4 rounded border-zinc-600 bg-zinc-800 accent-orange-500"
                checked={prep.pendiente}
                disabled={busy}
                onChange={() => void togglePendiente(prep)}
              />
              Hacer pronto
            </label>
          ) : null}
        </div>
      </li>
    );
  };

  const renderBloqueAlta = (className = "mb-6") => (
    <div className={className}>
      {altaExpandida ? (
        <form
          onSubmit={(e) => void onCrear(e)}
          className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-300">
              Nueva preparación · {ETIQUETA_AREA_PRODUCCION[areaActiva]}
            </p>
            {itemsDelArea.length > 0 ? (
              <button
                type="button"
                onClick={() => setAltaExpandida(false)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
              >
                <ChevronDown className="h-4 w-4" aria-hidden />
                Cerrar
              </button>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="min-w-0 flex-1 text-xs text-zinc-500 sm:min-w-[12rem]">
              Nombre
              <input
                ref={inputNuevoNombreRef}
                type="text"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Tosazu, Nikiri…"
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
              />
            </label>
            <label className="text-xs text-zinc-500">
              Dura (días)
              <input
                type="number"
                min={1}
                max={365}
                value={nuevaDuracion}
                onChange={(e) => setNuevaDuracion(e.target.value)}
                className="mt-1 block w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm tabular-nums text-white"
              />
            </label>
            <label className="text-xs text-zinc-500">
              Lote típico
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  type="text"
                  inputMode="decimal"
                  value={nuevaCantidadRef}
                  onChange={(e) => setNuevaCantidadRef(e.target.value)}
                  className="w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm tabular-nums text-white"
                />
                <select
                  value={nuevaUnidad}
                  onChange={(e) => setNuevaUnidad(e.target.value as UnidadCantidad)}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-white"
                >
                  {UNIDADES_CANTIDAD.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <button
              type="submit"
              disabled={isSubmitting || !nuevoNombre.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-800/80 bg-emerald-900/50 px-4 py-2.5 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-800/50 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Agregar
            </button>
          </div>
          <label className="block text-xs text-zinc-500">
            Notas / receta (opcional)
            <textarea
              value={nuevaNotas}
              onChange={(e) => setNuevaNotas(e.target.value)}
              placeholder="Ingredientes, proceso, conservación…"
              rows={2}
              className="mt-1 block w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
            />
          </label>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAltaExpandida(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 px-4 py-3 text-sm font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900/60 hover:text-zinc-200"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Agregar preparación
          <span className="text-zinc-600">· {ETIQUETA_AREA_PRODUCCION[areaActiva]}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
        </button>
      )}
    </div>
  );

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Producción</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Preparaciones de cocina: marcá <span className="text-zinc-300">Hacer pronto</span>{" "}
            cuando tengas que hacerlas, <span className="text-zinc-300">Hecho</span> cuando
            termines, y la app te avisará cuándo toca rehacer según cuánto duren.
          </p>
          <div
            className="mt-4 inline-flex w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-950/80 p-1 sm:w-auto"
            role="tablist"
            aria-label="Área de producción"
          >
            {AREAS_PRODUCCION.map((area) => {
              const activa = areaActiva === area;
              const urgentes = contadoresUrgentesPorArea[area];
              return (
                <button
                  key={area}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  onClick={() => setAreaActiva(area)}
                  className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:flex-initial sm:px-6 ${
                    activa
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {ETIQUETA_AREA_PRODUCCION[area]}
                  {urgentes > 0 ? (
                    <span
                      className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                        activa
                          ? "bg-orange-500 text-white"
                          : "bg-orange-900/60 text-orange-200"
                      }`}
                    >
                      {urgentes}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {!isLoading && itemsDelArea.length > 0 ? (
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2.5 rounded-xl border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-600">
              <input
                type="checkbox"
                className="size-4 rounded border-zinc-600 bg-zinc-800 accent-orange-500"
                checked={soloUrgentes}
                onChange={(e) => setSoloUrgentes(e.target.checked)}
              />
              Solo urgentes
              <kbd className="hidden rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:inline">
                U
              </kbd>
            </label>
          ) : null}
        </header>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : itemsDelArea.length === 0 ? (
          renderBloqueAlta()
        ) : (
          <>
            {urgentes.length === 0 ? (
              <div className="mb-6 flex flex-col gap-2 rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  Nada urgente en {ETIQUETA_AREA_PRODUCCION[areaActiva].toLowerCase()}.
                </div>
                {soloUrgentes && (alDia.length > 0 || inactivos.length > 0) ? (
                  <p className="text-xs text-emerald-300/80">
                    Desactivá <span className="text-emerald-100">Solo urgentes</span> para ver{" "}
                    {alDia.length + inactivos.length} preparación
                    {alDia.length + inactivos.length === 1 ? "" : "es"} al día.
                  </p>
                ) : null}
              </div>
            ) : null}

            {urgentes.length > 0 ? (
              <section className="mb-6">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-orange-300">
                  <ChefHat className="h-4 w-4" aria-hidden />
                  Para hacer
                  <span className="rounded-full bg-orange-900/60 px-2 py-0.5 text-[11px] font-bold tabular-nums text-orange-100">
                    {urgentes.length}
                  </span>
                </h2>
                <ul className="overflow-hidden rounded-xl border border-zinc-800 divide-y divide-zinc-800/90">
                  {urgentes.map(renderFilaCompacta)}
                </ul>
              </section>
            ) : null}

            {!soloUrgentes && alDia.length > 0 ? (
              <section className="mb-6">
                <button
                  type="button"
                  onClick={() => setAlDiaExpandido((v) => !v)}
                  className="mb-3 flex w-full items-center gap-2 rounded-lg py-1 text-left text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500 transition hover:text-zinc-300"
                >
                  {alDiaExpandido ? (
                    <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  Al día
                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] font-bold tabular-nums text-zinc-400">
                    {alDia.length}
                  </span>
                </button>
                {alDiaExpandido ? (
                  <ul className="space-y-3 opacity-90">{alDia.map(renderFila)}</ul>
                ) : null}
              </section>
            ) : null}

            {!soloUrgentes && urgentes.length === 0 && alDia.length === 0 ? (
              <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <KpiCard
                  icono={<ChefHat className="h-4 w-4" />}
                  titulo="Hacer ahora"
                  valor={kpis["Hacer ahora"]}
                  tono="text-orange-300"
                />
                <KpiCard
                  icono={<AlertTriangle className="h-4 w-4" />}
                  titulo="Atrasadas"
                  valor={kpis.Atrasado}
                  tono="text-red-300"
                />
                <KpiCard
                  icono={<CalendarClock className="h-4 w-4" />}
                  titulo="Rehacer pronto"
                  valor={kpis["Rehacer pronto"]}
                  tono="text-amber-300"
                />
                <KpiCard
                  icono={<CheckCircle2 className="h-4 w-4" />}
                  titulo="OK"
                  valor={kpis.OK}
                  tono="text-emerald-300"
                />
                <KpiCard
                  icono={<HelpCircle className="h-4 w-4" />}
                  titulo="Sin datos"
                  valor={kpis["Sin datos"]}
                  tono="text-zinc-400"
                />
              </div>
            ) : null}

            {!soloUrgentes && inactivos.length > 0 ? (
              <section className="mt-8">
                <h2 className="mb-3 text-sm uppercase tracking-[0.14em] text-zinc-500">
                  Sin seguimiento
                </h2>
                <ul className="space-y-3 opacity-80">{inactivos.map(renderFila)}</ul>
              </section>
            ) : null}

            {!soloUrgentes ? renderBloqueAlta("mt-8") : null}
          </>
        )}
      </section>

      {undoHecho ? (
        <div
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-3xl items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/95 px-4 py-3 shadow-xl backdrop-blur-sm sm:inset-x-6"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-zinc-200">
            <span className="font-medium text-white">{undoHecho.nombre}</span> marcado hecho
          </p>
          <button
            type="button"
            onClick={() => void deshacerHecho()}
            disabled={guardandoId === undoHecho.prepId}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
          >
            {guardandoId === undoHecho.prepId ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Undo2 className="h-4 w-4" aria-hidden />
            )}
            Deshacer
            <kbd className="hidden rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 sm:inline">
              Z
            </kbd>
          </button>
        </div>
      ) : null}
    </main>
  );
}
