"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  Loader2,
  Pause,
  PenLine,
  Play,
  Plus,
  Square,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import {
  actualizarCategoriaPlanPreparacion,
  cantidadSugeridaAlMarcar,
  CATEGORIAS_PLAN,
  crearPreparacion,
  ETIQUETA_AREA_PRODUCCION,
  ETIQUETA_CATEGORIA_PLAN,
  esCategoriaPlanValida,
  esUnidadCantidadValida,
  fetchPreparaciones,
  formatearCantidad,
  parseCantidadInput,
  UNIDADES_CANTIDAD,
  type CategoriaPlan,
  type Preparacion,
  type AreaProduccion,
  type UnidadCantidad,
} from "@/src/lib/preparaciones";
import {
  calcularResumenesPorPreparacion,
  cancelarProduccionSesion,
  completarProduccionSesion,
  eliminarProduccionSesion,
  etiquetaAreaSesion,
  etiquetaRitmoProduccion,
  fetchProduccionSesionesRecientes,
  fetchSesionActivaUsuario,
  fetchSesionesActivasEquipo,
  fetchSessionUsuario,
  formatearDuracionLegible,
  formatearDuracionSegundos,
  guardarProduccionSesionManual,
  iniciarProduccionSesion,
  pausarProduccionSesion,
  reanudarProduccionSesion,
  segundosTranscurridosSesion,
  sesionEstaPausada,
  type ProduccionSesion,
  type SessionUsuario,
} from "@/src/lib/produccion-sesiones";
import { formatPostgrestError } from "@/src/lib/supabase-errors";

function RelojActivo({ sesion }: { sesion: ProduccionSesion }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (sesion.endedAt) {
      return;
    }
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [sesion.endedAt, sesion.id, sesion.pausadoAt, sesion.pausaTotalSegundos, sesion.startedAt]);

  const segundos = segundosTranscurridosSesion(sesion);
  void tick;

  return (
    <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-white sm:text-5xl">
      {formatearDuracionSegundos(segundos)}
    </span>
  );
}

export default function ProduccionTiemposPage() {
  const [preparaciones, setPreparaciones] = useState<Preparacion[]>([]);
  const [sesiones, setSesiones] = useState<ProduccionSesion[]>([]);
  const [activasEquipo, setActivasEquipo] = useState<ProduccionSesion[]>([]);
  const [sesionPropia, setSesionPropia] = useState<ProduccionSesion | null>(null);
  const [usuario, setUsuario] = useState<SessionUsuario | null>(null);
  const [prepSeleccionadaId, setPrepSeleccionadaId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mostrarManual, setMostrarManual] = useState(false);
  const [modalCierre, setModalCierre] = useState(false);
  const [cantidadCierre, setCantidadCierre] = useState("");
  const [unidadCierre, setUnidadCierre] = useState<UnidadCantidad>("kg");
  const [notasCierre, setNotasCierre] = useState("");
  const [filtroPrep, setFiltroPrep] = useState("");
  const [manualDuracion, setManualDuracion] = useState("");
  const [manualCantidad, setManualCantidad] = useState("");
  const [manualUnidad, setManualUnidad] = useState<UnidadCantidad>("kg");
  const [manualNotas, setManualNotas] = useState("");
  const [altaPrepExpandida, setAltaPrepExpandida] = useState(false);
  const [nuevaNombre, setNuevaNombre] = useState("");
  const [nuevaArea, setNuevaArea] = useState<AreaProduccion>("delivery");
  const [nuevaCantidadRef, setNuevaCantidadRef] = useState("1");
  const [nuevaUnidad, setNuevaUnidad] = useState<UnidadCantidad>("L");
  const [isCreandoPrep, setIsCreandoPrep] = useState(false);
  const [categoriaPlanBusyId, setCategoriaPlanBusyId] = useState<string | null>(null);
  const [categoriaDraft, setCategoriaDraft] = useState<Record<string, CategoriaPlan>>({});

  const prepSeleccionada = useMemo(
    () => preparaciones.find((p) => p.id === prepSeleccionadaId) ?? null,
    [preparaciones, prepSeleccionadaId]
  );

  const resumenes = useMemo(() => calcularResumenesPorPreparacion(sesiones), [sesiones]);

  const sesionesFiltradas = useMemo(() => {
    if (!filtroPrep) {
      return sesiones;
    }
    return sesiones.filter((s) => s.preparacionId === filtroPrep);
  }, [sesiones, filtroPrep]);

  const otrasActivas = useMemo(
    () => activasEquipo.filter((s) => s.id !== sesionPropia?.id),
    [activasEquipo, sesionPropia]
  );

  const preparacionesSinCategoria = useMemo(
    () => preparaciones.filter((p) => !p.categoriaPlanConfirmada),
    [preparaciones]
  );

  const categoriaDraftPara = (prep: Preparacion): CategoriaPlan =>
    categoriaDraft[prep.id] ?? prep.categoriaPlan;

  const refrescar = useCallback(async (usuarioActual: SessionUsuario | null) => {
    const [preps, lista, activas] = await Promise.all([
      fetchPreparaciones(),
      fetchProduccionSesionesRecientes(),
      fetchSesionesActivasEquipo(),
    ]);
    setPreparaciones(preps);
    setSesiones(lista);
    setActivasEquipo(activas);

    if (usuarioActual) {
      const propia =
        activas.find((s) => s.hechoPorId === usuarioActual.id) ??
        (await fetchSesionActivaUsuario(usuarioActual.id));
      setSesionPropia(propia);
      if (propia?.preparacionId) {
        setPrepSeleccionadaId(propia.preparacionId);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cargar = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const u = await fetchSessionUsuario();
        if (cancelled) {
          return;
        }
        setUsuario(u);
        await refrescar(u);
      } catch (err) {
        if (!cancelled) {
          setError(
            err && typeof err === "object" && "message" in err
              ? formatPostgrestError(err as Parameters<typeof formatPostgrestError>[0])
              : "No se pudieron cargar los datos."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void cargar();
    return () => {
      cancelled = true;
    };
  }, [refrescar]);

  useEffect(() => {
    if (!isLoading && preparaciones.length === 0) {
      setAltaPrepExpandida(true);
    }
  }, [isLoading, preparaciones.length]);

  const crearPrep = async () => {
    const nombre = nuevaNombre.trim();
    const cantidadRef = parseCantidadInput(nuevaCantidadRef);
    if (!nombre) {
      setError("Ingresá el nombre de la preparación.");
      return;
    }
    if (cantidadRef == null) {
      setError("El lote típico debe ser mayor que 0.");
      return;
    }

    setIsCreandoPrep(true);
    setError(null);
    setSuccess(null);
    try {
      const prep = await crearPreparacion({
        nombre,
        area: nuevaArea,
        cantidadReferencia: cantidadRef,
        unidadCantidad: nuevaUnidad,
      });
      setPreparaciones((prev) => [...prev, prep].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setPrepSeleccionadaId(prep.id);
      setManualUnidad(prep.unidadCantidad);
      setNuevaNombre("");
      setNuevaCantidadRef("1");
      setNuevaUnidad("L");
      setAltaPrepExpandida(false);
      setSuccess(`"${prep.nombre}" agregada. Ya podés cronometrarla.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la preparación.");
    } finally {
      setIsCreandoPrep(false);
    }
  };

  const confirmarCategoriaPlan = async (prep: Preparacion) => {
    const categoriaPlan = categoriaDraftPara(prep);
    setCategoriaPlanBusyId(prep.id);
    setError(null);
    setSuccess(null);
    try {
      const { preparacion, planItemsActualizados } = await actualizarCategoriaPlanPreparacion(
        prep.id,
        categoriaPlan
      );
      setPreparaciones((prev) =>
        prev.map((p) => (p.id === preparacion.id ? preparacion : p))
      );
      setCategoriaDraft((prev) => {
        const next = { ...prev };
        delete next[prep.id];
        return next;
      });
      setSuccess(
        `"${preparacion.nombre}" → ${ETIQUETA_CATEGORIA_PLAN[categoriaPlan]}.` +
          (planItemsActualizados > 0
            ? ` Actualizados ${planItemsActualizados} bloque${planItemsActualizados === 1 ? "" : "s"} en el plan semanal.`
            : "")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar la categoría.");
    } finally {
      setCategoriaPlanBusyId(null);
    }
  };

  const iniciar = async () => {
    if (!prepSeleccionada) {
      setError("Elegí una preparación para cronometrar.");
      return;
    }
    if (sesionPropia) {
      setError("Ya tenés un cronómetro en curso.");
      return;
    }
    setIsBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const sesion = await iniciarProduccionSesion(prepSeleccionada, usuario);
      setSesionPropia(sesion);
      setActivasEquipo((prev) => [sesion, ...prev.filter((s) => s.id !== sesion.id)]);
      setSuccess(`Cronómetro iniciado: ${prepSeleccionada.nombre}.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo iniciar el cronómetro."
      );
    } finally {
      setIsBusy(false);
    }
  };

  const togglePausa = async () => {
    if (!sesionPropia) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const actualizada = sesionEstaPausada(sesionPropia)
        ? await reanudarProduccionSesion(sesionPropia)
        : await pausarProduccionSesion(sesionPropia.id);
      setSesionPropia(actualizada);
      setActivasEquipo((prev) =>
        prev.map((s) => (s.id === actualizada.id ? actualizada : s))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo pausar/reanudar.");
    } finally {
      setIsBusy(false);
    }
  };

  const pedirCierre = () => {
    if (!sesionPropia) {
      return;
    }
    const prep = preparaciones.find((p) => p.id === sesionPropia.preparacionId);
    if (prep) {
      setCantidadCierre(String(cantidadSugeridaAlMarcar(prep)));
      setUnidadCierre(prep.unidadCantidad);
    }
    setNotasCierre("");
    setModalCierre(true);
  };

  const confirmarCierre = async () => {
    if (!sesionPropia) {
      return;
    }
    const cantidad = parseCantidadInput(cantidadCierre);
    if (!cantidad) {
      setError("Ingresá la cantidad producida para calcular tiempos por unidad.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const completada = await completarProduccionSesion(sesionPropia, {
        cantidadProducida: cantidad,
        unidadCantidad: unidadCierre,
        notas: notasCierre,
      });
      setSesionPropia(null);
      setModalCierre(false);
      setSesiones((prev) => [completada, ...prev.filter((s) => s.id !== completada.id)]);
      setActivasEquipo((prev) => prev.filter((s) => s.id !== completada.id));
      setSuccess(
        `${completada.preparacionNombre} guardada · ${formatearDuracionLegible(completada.duracionSegundos ?? 0)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cierre.");
    } finally {
      setIsBusy(false);
    }
  };

  const cancelar = async () => {
    if (!sesionPropia) {
      return;
    }
    const ok = window.confirm("¿Descartar este cronómetro sin guardar?");
    if (!ok) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await cancelarProduccionSesion(sesionPropia.id);
      setSesionPropia(null);
      setActivasEquipo((prev) => prev.filter((s) => s.id !== sesionPropia.id));
      setSuccess("Cronómetro descartado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar.");
    } finally {
      setIsBusy(false);
    }
  };

  const guardarManual = async () => {
    if (!prepSeleccionada) {
      setError("Elegí una preparación.");
      return;
    }
    const minutos = parseCantidadInput(manualDuracion);
    if (!minutos) {
      setError("Ingresá la duración en minutos.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const sesion = await guardarProduccionSesionManual({
        prep: prepSeleccionada,
        duracionMinutos: minutos,
        cantidadProducida: parseCantidadInput(manualCantidad),
        unidadCantidad: manualUnidad,
        notas: manualNotas,
        usuario,
      });
      setSesiones((prev) => [sesion, ...prev]);
      setManualDuracion("");
      setManualCantidad("");
      setManualUnidad(prepSeleccionada.unidadCantidad);
      setManualNotas("");
      setMostrarManual(false);
      setSuccess(`Tiempo manual guardado: ${prepSeleccionada.nombre}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setIsBusy(false);
    }
  };

  const borrarSesion = async (id: string) => {
    const ok = window.confirm("¿Borrar este registro de tiempo?");
    if (!ok) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await eliminarProduccionSesion(id);
      setSesiones((prev) => prev.filter((s) => s.id !== id));
      setSuccess("Registro eliminado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight text-ink">Tiempos de producción</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Cronometrá preparaciones para planificar la semana en{" "}
              <Link href="/produccion-plan" className="text-zinc-300 underline hover:text-white">
                Plan semanal
              </Link>
              .
            </p>
          </div>
          <Link
            href="/produccion-plan"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            <CalendarDays className="h-4 w-4" />
            Plan semanal
          </Link>
        </header>

        {error ? (
          <p className="mb-4 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {success && !error ? (
          <p className="mb-4 rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
            {success}
          </p>
        ) : null}

        {otrasActivas.length > 0 ? (
          <div className="mb-6 rounded-xl border border-sky-900/50 bg-sky-950/20 px-4 py-3 text-sm text-sky-100">
            <p className="font-medium">En curso ahora</p>
            <ul className="mt-2 space-y-1">
              {otrasActivas.map((s) => (
                <li key={s.id} className="text-sky-100/90">
                  {s.hechoPorNombre ?? "Alguien"} · {s.preparacionNombre} ·{" "}
                  {sesionEstaPausada(s) ? "pausado" : "corriendo"} ·{" "}
                  {formatearDuracionSegundos(segundosTranscurridosSesion(s))}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mb-8 rounded-2xl border border-zinc-700/80 bg-zinc-950/80 p-5 sm:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando…
            </div>
          ) : sesionPropia ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                {sesionEstaPausada(sesionPropia) ? "Pausado" : "En curso"}
              </p>
              <p className="text-lg font-medium text-zinc-100">{sesionPropia.preparacionNombre}</p>
              <p className="text-sm text-zinc-500">
                {etiquetaAreaSesion(sesionPropia.area)}
                {sesionPropia.hechoPorNombre ? ` · ${sesionPropia.hechoPorNombre}` : ""}
              </p>
              <RelojActivo sesion={sesionPropia} />
              <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => void togglePausa()}
                  disabled={isBusy}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 disabled:opacity-50"
                >
                  {sesionEstaPausada(sesionPropia) ? (
                    <>
                      <Play className="h-4 w-4" />
                      Reanudar
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4" />
                      Pausar
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={pedirCierre}
                  disabled={isBusy}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Square className="h-4 w-4" />
                  Terminar
                </button>
                <button
                  type="button"
                  onClick={() => void cancelar()}
                  disabled={isBusy}
                  title="Descartar"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200 transition hover:border-red-700 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Preparación
                </span>
                <select
                  value={prepSeleccionadaId}
                  onChange={(e) => setPrepSeleccionadaId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                >
                  <option value="">Elegir preparación…</option>
                  {preparaciones.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({ETIQUETA_AREA_PRODUCCION[p.area]})
                    </option>
                  ))}
                </select>
              </label>
              {altaPrepExpandida ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <p className="mb-3 text-sm font-medium text-zinc-300">Nueva preparación</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                        Nombre
                      </span>
                      <input
                        type="text"
                        value={nuevaNombre}
                        onChange={(e) => setNuevaNombre(e.target.value)}
                        placeholder="Tosazu, Nikiri…"
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                        Área
                      </span>
                      <select
                        value={nuevaArea}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "delivery" || v === "barra") {
                            setNuevaArea(v);
                          }
                        }}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                      >
                        <option value="delivery">Delivery</option>
                        <option value="barra">Barra</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                        Lote típico
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={nuevaCantidadRef}
                          onChange={(e) => setNuevaCantidadRef(e.target.value)}
                          className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                        />
                        <select
                          value={nuevaUnidad}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (esUnidadCantidadValida(v)) {
                              setNuevaUnidad(v);
                            }
                          }}
                          className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2.5 text-sm text-zinc-100"
                        >
                          {UNIDADES_CANTIDAD.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void crearPrep()}
                      disabled={isCreandoPrep || !nuevaNombre.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-800/80 bg-emerald-900/50 px-4 py-2.5 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-800/50 disabled:opacity-50"
                    >
                      {isCreandoPrep ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Agregar y seleccionar
                    </button>
                    {preparaciones.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setAltaPrepExpandida(false)}
                        className="rounded-xl px-4 py-2.5 text-sm text-zinc-500 transition hover:text-zinc-300"
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAltaPrepExpandida(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 px-4 py-2.5 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
                >
                  <Plus className="h-4 w-4" />
                  Agregar preparación nueva
                </button>
              )}
              {prepSeleccionada ? (
                <p className="text-xs text-zinc-500">
                  Referencia: {formatearCantidad(prepSeleccionada.cantidadReferencia, prepSeleccionada.unidadCantidad)}
                  {prepSeleccionada.ultimaCantidad
                    ? ` · última: ${formatearCantidad(prepSeleccionada.ultimaCantidad, prepSeleccionada.unidadCantidad)}`
                    : ""}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void iniciar()}
                disabled={isBusy || !prepSeleccionada}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Timer className="h-4 w-4" />
                )}
                Iniciar cronómetro
              </button>
            </div>
          )}
        </div>

        <div className="mb-8">
          <button
            type="button"
            onClick={() => setMostrarManual((v) => !v)}
            className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            <PenLine className="h-4 w-4" />
            {mostrarManual ? "Ocultar carga manual" : "Cargar tiempo a mano"}
          </button>
          {mostrarManual ? (
            <div className="mt-4 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Preparación
                </span>
                <select
                  value={prepSeleccionadaId}
                  onChange={(e) => {
                    setPrepSeleccionadaId(e.target.value);
                    const p = preparaciones.find((x) => x.id === e.target.value);
                    if (p) {
                      setManualUnidad(p.unidadCantidad);
                    }
                  }}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                >
                  <option value="">Elegir…</option>
                  {preparaciones.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Duración (minutos)
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={manualDuracion}
                  onChange={(e) => setManualDuracion(e.target.value)}
                  placeholder="90"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Cantidad producida
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={manualCantidad}
                    onChange={(e) => setManualCantidad(e.target.value)}
                    placeholder={prepSeleccionada ? String(prepSeleccionada.cantidadReferencia) : ""}
                    className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                  />
                  <select
                    value={manualUnidad}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (esUnidadCantidadValida(v)) {
                        setManualUnidad(v);
                      }
                    }}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2.5 text-sm text-zinc-100"
                  >
                    {UNIDADES_CANTIDAD.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Notas
                </span>
                <input
                  type="text"
                  value={manualNotas}
                  onChange={(e) => setManualNotas(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
              </label>
              <button
                type="button"
                onClick={() => void guardarManual()}
                disabled={isBusy}
                className="sm:col-span-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 disabled:opacity-50 sm:w-auto"
              >
                Guardar tiempo manual
              </button>
            </div>
          ) : null}
        </div>

        {preparaciones.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-zinc-400">
              Categoría en plan semanal
            </h2>
            <p className="mb-3 text-xs text-zinc-500">
              Elegí Produ o Servicio y confirmá. Una vez asignada, la preparación desaparece de esta
              lista. Produ = marcar hecha manual; Servicio = se completa sola al pasar el horario.
            </p>
            {preparacionesSinCategoria.length === 0 ? (
              <p className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-400">
                Todas las preparaciones ya tienen categoría asignada.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Preparación</th>
                      <th className="px-4 py-2.5 font-medium">Categoría</th>
                      <th className="px-4 py-2.5 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {preparacionesSinCategoria.map((p) => (
                      <tr key={p.id} className="text-zinc-200">
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-zinc-100">{p.nombre}</span>
                          <span className="ml-2 text-xs text-zinc-500">
                            {ETIQUETA_AREA_PRODUCCION[p.area]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <select
                            value={categoriaDraftPara(p)}
                            disabled={categoriaPlanBusyId === p.id}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (esCategoriaPlanValida(v)) {
                                setCategoriaDraft((prev) => ({ ...prev, [p.id]: v }));
                              }
                            }}
                            className="w-full min-w-[10rem] rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500 disabled:opacity-50"
                          >
                            {CATEGORIAS_PLAN.map((c) => (
                              <option key={c} value={c}>
                                {ETIQUETA_CATEGORIA_PLAN[c]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              void confirmarCategoriaPlan(p);
                            }}
                            disabled={categoriaPlanBusyId === p.id}
                            className="whitespace-nowrap rounded-lg border border-emerald-800/70 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-900/40 disabled:opacity-50"
                          >
                            {categoriaPlanBusyId === p.id ? "Guardando…" : "Confirmar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {resumenes.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-zinc-400">
              <Clock className="h-4 w-4" />
              Tiempos de referencia
            </h2>
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Preparación</th>
                    <th className="px-4 py-2.5 font-medium">Mediana</th>
                    <th className="px-4 py-2.5 font-medium">Ritmo / unidad</th>
                    <th className="px-4 py-2.5 font-medium">Rango</th>
                    <th className="px-4 py-2.5 font-medium">Registros</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {resumenes.map((r) => (
                    <tr key={r.preparacionId ?? r.preparacionNombre} className="text-zinc-200">
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-zinc-100">{r.preparacionNombre}</span>
                        <span className="ml-2 text-xs text-zinc-500">
                          {ETIQUETA_AREA_PRODUCCION[r.area]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {r.duracionMedianaSegundos != null
                          ? formatearDuracionLegible(r.duracionMedianaSegundos)
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-violet-300/90">
                        {etiquetaRitmoProduccion(r) ?? "—"}
                        {r.sesionesConCantidad > 0 ? (
                          <span className="block text-[10px] text-zinc-500">
                            {r.sesionesConCantidad} con cantidad
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-zinc-400">
                        {r.duracionMinSegundos != null && r.duracionMaxSegundos != null
                          ? `${formatearDuracionLegible(r.duracionMinSegundos)} – ${formatearDuracionLegible(r.duracionMaxSegundos)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-zinc-400">{r.totalSesiones}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
              Historial reciente
            </h2>
            <select
              value={filtroPrep}
              onChange={(e) => setFiltroPrep(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-500"
            >
              <option value="">Todas las preparaciones</option>
              {preparaciones.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          {sesionesFiltradas.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              Todavía no hay tiempos registrados. Iniciá un cronómetro arriba.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
              {sesionesFiltradas.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-100">{s.preparacionNombre}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {s.startedAt.slice(0, 10)} · {etiquetaAreaSesion(s.area)}
                      {s.hechoPorNombre ? ` · ${s.hechoPorNombre}` : ""}
                      {s.esManual ? " · manual" : ""}
                    </p>
                    {s.cantidadProducida && s.unidadCantidad ? (
                      <p className="mt-1 text-xs text-zinc-400">
                        {formatearCantidad(s.cantidadProducida, s.unidadCantidad)}
                      </p>
                    ) : null}
                    {s.notas ? (
                      <p className="mt-1 text-xs text-zinc-500">{s.notas}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm tabular-nums text-emerald-300">
                      {s.duracionSegundos != null
                        ? formatearDuracionLegible(s.duracionSegundos)
                        : "en curso"}
                    </span>
                    {s.endedAt ? (
                      <button
                        type="button"
                        onClick={() => void borrarSesion(s.id)}
                        disabled={isBusy}
                        title="Borrar"
                        className="rounded-lg border border-zinc-700 p-1.5 text-zinc-500 transition hover:border-red-800 hover:text-red-300 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      {modalCierre && sesionPropia ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Terminar producción</h3>
            <p className="mt-1 text-sm text-zinc-400">{sesionPropia.preparacionNombre}</p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Cantidad producida
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cantidadCierre}
                    onChange={(e) => setCantidadCierre(e.target.value)}
                    placeholder="ej. 5"
                    className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                  />
                  <select
                    value={unidadCierre}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (esUnidadCantidadValida(v)) {
                        setUnidadCierre(v);
                      }
                    }}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2.5 text-sm text-zinc-100"
                  >
                    {UNIDADES_CANTIDAD.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Necesaria para escalar tiempos en el plan (ej. 5 kg en 1 h → 10 kg en 2 h).
                </p>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Notas (opcional)
                </span>
                <input
                  type="text"
                  value={notasCierre}
                  onChange={(e) => setNotasCierre(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setModalCierre(false)}
                className="flex-1 rounded-xl border border-zinc-600 px-4 py-2.5 text-sm text-zinc-200 hover:border-zinc-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmarCierre()}
                disabled={isBusy}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {isBusy ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
