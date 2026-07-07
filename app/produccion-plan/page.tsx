"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Settings2,
  Timer,
  Trash2,
  X,
} from "lucide-react";

import {
  AREAS_PRODUCCION,
  cantidadSugeridaAlMarcar,
  ETIQUETA_AREA_PRODUCCION,
  fetchPreparaciones,
  parseCantidadInput,
  type Preparacion,
} from "@/src/lib/preparaciones";
import {
  calcularResumenesPorPreparacion,
  fetchProduccionSesionesRecientes,
  fetchSessionUsuario,
  formatearDuracionLegible,
  type SessionUsuario,
} from "@/src/lib/produccion-sesiones";
import {
  bloqueSobrecargado,
  crearProduccionBloque,
  crearProduccionPlanItem,
  diaSemanaIsoDesdeFecha,
  eliminarProduccionBloque,
  eliminarProduccionPlanItem,
  etiquetaDiaSemanaCorto,
  etiquetaDiaSemanaIso,
  etiquetaHorarioBloque,
  etiquetaSemana,
  etiquetaUsoBloque,
  estimarDuracionSegundos,
  fechasSemanaDesdeLunes,
  fetchProduccionBloques,
  fetchProduccionBloquesTodos,
  fetchProduccionPlanSemana,
  formatFechaLocalYYYYMMDD,
  lunesDeSemanaDe,
  marcarPlanItemCompletado,
  marcarPlanItemPendiente,
  type ProduccionBloque,
  type ProduccionPlanItem,
} from "@/src/lib/produccion-plan";
import { formatPostgrestError } from "@/src/lib/supabase-errors";

type ModalTarea = {
  fecha: string;
  bloqueId: string;
};

export default function ProduccionPlanPage() {
  const [lunesSemana, setLunesSemana] = useState(() =>
    lunesDeSemanaDe(formatFechaLocalYYYYMMDD(new Date()))
  );
  const [bloques, setBloques] = useState<ProduccionBloque[]>([]);
  const [plan, setPlan] = useState<ProduccionPlanItem[]>([]);
  const [preparaciones, setPreparaciones] = useState<Preparacion[]>([]);
  const [resumenes, setResumenes] = useState(
    () => [] as ReturnType<typeof calcularResumenesPorPreparacion>
  );
  const [usuario, setUsuario] = useState<SessionUsuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mostrarPlantilla, setMostrarPlantilla] = useState(false);
  const [modalTarea, setModalTarea] = useState<ModalTarea | null>(null);
  const [prepTareaId, setPrepTareaId] = useState("");
  const [duracionTareaMin, setDuracionTareaMin] = useState("");
  const [cantidadTarea, setCantidadTarea] = useState("");
  const [notasTarea, setNotasTarea] = useState("");
  const [nuevoBloqueDia, setNuevoBloqueDia] = useState(1);
  const [nuevoBloqueInicio, setNuevoBloqueInicio] = useState("09:00");
  const [nuevoBloqueFin, setNuevoBloqueFin] = useState("13:00");
  const [nuevoBloqueArea, setNuevoBloqueArea] = useState<(typeof AREAS_PRODUCCION)[number]>("delivery");
  const [nuevoBloqueTitulo, setNuevoBloqueTitulo] = useState("");

  const fechasSemana = useMemo(() => fechasSemanaDesdeLunes(lunesSemana), [lunesSemana]);

  const bloquesPorDia = useMemo(() => {
    const map = new Map<number, ProduccionBloque[]>();
    for (const b of bloques) {
      const lista = map.get(b.diaSemana) ?? [];
      lista.push(b);
      map.set(b.diaSemana, lista);
    }
    return map;
  }, [bloques]);

  const planPorClave = useMemo(() => {
    const map = new Map<string, ProduccionPlanItem[]>();
    for (const item of plan) {
      const clave = `${item.fecha}|${item.bloqueId ?? ""}`;
      const lista = map.get(clave) ?? [];
      lista.push(item);
      map.set(clave, lista);
    }
    return map;
  }, [plan]);

  const prepTarea = useMemo(
    () => preparaciones.find((p) => p.id === prepTareaId) ?? null,
    [preparaciones, prepTareaId]
  );

  const refrescar = useCallback(async () => {
    const [bloquesLista, planLista, preps, sesiones] = await Promise.all([
      fetchProduccionBloques(),
      fetchProduccionPlanSemana(lunesSemana),
      fetchPreparaciones(),
      fetchProduccionSesionesRecientes(200),
    ]);
    setBloques(bloquesLista);
    setPlan(planLista);
    setPreparaciones(preps);
    setResumenes(calcularResumenesPorPreparacion(sesiones));
  }, [lunesSemana]);

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
        await refrescar();
      } catch (err) {
        if (!cancelled) {
          setError(
            err && typeof err === "object" && "message" in err
              ? formatPostgrestError(err as Parameters<typeof formatPostgrestError>[0])
              : "No se pudo cargar el plan."
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

  const cambiarSemana = (delta: number) => {
    const d = new Date(lunesSemana + "T12:00:00");
    d.setDate(d.getDate() + delta * 7);
    setLunesSemana(formatFechaLocalYYYYMMDD(d));
    setSuccess(null);
  };

  const irSemanaActual = () => {
    setLunesSemana(lunesDeSemanaDe(formatFechaLocalYYYYMMDD(new Date())));
    setSuccess(null);
  };

  const abrirModalTarea = (fecha: string, bloqueId: string) => {
    setModalTarea({ fecha, bloqueId });
    setPrepTareaId("");
    setDuracionTareaMin("");
    setCantidadTarea("");
    setNotasTarea("");
    setError(null);
  };

  const onElegirPrepTarea = (prepId: string) => {
    setPrepTareaId(prepId);
    const prep = preparaciones.find((p) => p.id === prepId);
    if (!prep) {
      return;
    }
    const seg = estimarDuracionSegundos(prep.id, resumenes);
    setDuracionTareaMin(String(Math.max(1, Math.round(seg / 60))));
    setCantidadTarea(String(cantidadSugeridaAlMarcar(prep)));
  };

  const guardarTarea = async () => {
    if (!modalTarea || !prepTarea) {
      setError("Elegí una preparación.");
      return;
    }
    const minutos = parseCantidadInput(duracionTareaMin);
    if (!minutos) {
      setError("Ingresá la duración estimada en minutos.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const item = await crearProduccionPlanItem({
        fecha: modalTarea.fecha,
        bloqueId: modalTarea.bloqueId,
        prep: prepTarea,
        duracionEstimadaSegundos: Math.round(minutos * 60),
        cantidadPlanificada: parseCantidadInput(cantidadTarea),
        notas: notasTarea,
        usuario,
      });
      setPlan((prev) => [...prev, item]);
      setModalTarea(null);
      setSuccess(`${prepTarea.nombre} agregada al plan.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la tarea.");
    } finally {
      setIsBusy(false);
    }
  };

  const toggleCompletada = async (item: ProduccionPlanItem) => {
    setIsBusy(true);
    setError(null);
    try {
      const actualizada =
        item.estado === "completada"
          ? await marcarPlanItemPendiente(item.id)
          : await marcarPlanItemCompletado(item.id);
      setPlan((prev) => prev.map((p) => (p.id === actualizada.id ? actualizada : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setIsBusy(false);
    }
  };

  const borrarTarea = async (id: string) => {
    const ok = window.confirm("¿Quitar esta tarea del plan?");
    if (!ok) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await eliminarProduccionPlanItem(id);
      setPlan((prev) => prev.filter((p) => p.id !== id));
      setSuccess("Tarea eliminada del plan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar.");
    } finally {
      setIsBusy(false);
    }
  };

  const crearBloque = async () => {
    if (!nuevoBloqueTitulo.trim()) {
      setError("El bloque necesita un título.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const bloque = await crearProduccionBloque({
        diaSemana: nuevoBloqueDia,
        horaInicio: nuevoBloqueInicio,
        horaFin: nuevoBloqueFin,
        area: nuevoBloqueArea,
        titulo: nuevoBloqueTitulo.trim(),
      });
      setBloques((prev) => [...prev, bloque].sort((a, b) => a.diaSemana - b.diaSemana || a.orden - b.orden));
      setNuevoBloqueTitulo("");
      setSuccess(`Bloque "${bloque.titulo}" creado.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el bloque.");
    } finally {
      setIsBusy(false);
    }
  };

  const borrarBloque = async (id: string) => {
    const ok = window.confirm(
      "¿Borrar este bloque de la plantilla? Las tareas ya asignadas quedan sin bloque."
    );
    if (!ok) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await eliminarProduccionBloque(id);
      const todos = await fetchProduccionBloques();
      setBloques(todos);
      setSuccess("Bloque eliminado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar el bloque.");
    } finally {
      setIsBusy(false);
    }
  };

  const recargarPlantilla = async () => {
    setIsBusy(true);
    try {
      const todos = await fetchProduccionBloquesTodos();
      setBloques(todos.filter((b) => b.activo));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo recargar.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-6xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Plan semanal</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Asigná preparaciones a bloques horarios. Las duraciones usan la mediana de{" "}
              <Link href="/produccion-tiempos" className="text-zinc-300 underline hover:text-white">
                Tiempos prep
              </Link>
              .
            </p>
          </div>
          <Link
            href="/produccion-tiempos"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            <Timer className="h-4 w-4" />
            Cronómetro
          </Link>
        </header>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => cambiarSemana(-1)}
              className="rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-zinc-300 hover:border-zinc-500"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={irSemanaActual}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500"
            >
              Esta semana
            </button>
            <button
              type="button"
              onClick={() => cambiarSemana(1)}
              className="rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-zinc-300 hover:border-zinc-500"
              aria-label="Semana siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <p className="flex items-center gap-2 text-sm text-zinc-300">
            <CalendarDays className="h-4 w-4 text-zinc-500" />
            {etiquetaSemana(lunesSemana)}
          </p>
        </div>

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

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando plan…
          </div>
        ) : bloques.length === 0 ? (
          <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-8 text-center text-sm text-amber-100">
            <p className="font-medium">Todavía no hay bloques horarios.</p>
            <p className="mt-2 text-amber-100/80">
              Creá la plantilla semanal abajo (ej. Lun 9–13 Delivery) y después asigná tareas.
            </p>
            <button
              type="button"
              onClick={() => setMostrarPlantilla(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-700/60 px-4 py-2 text-sm hover:bg-amber-950/40"
            >
              <Settings2 className="h-4 w-4" />
              Configurar bloques
            </button>
          </div>
        ) : (
          <div className="-mx-2 overflow-x-auto pb-2">
            <div className="flex min-w-[56rem] gap-3 px-2">
              {fechasSemana.map((fecha) => {
                const diaIso = diaSemanaIsoDesdeFecha(fecha);
                const bloquesDia = bloquesPorDia.get(diaIso) ?? [];
                const esHoy = fecha === formatFechaLocalYYYYMMDD(new Date());
                return (
                  <div
                    key={fecha}
                    className={`min-w-[8rem] flex-1 rounded-xl border p-3 ${
                      esHoy
                        ? "border-emerald-800/60 bg-emerald-950/10"
                        : "border-zinc-800 bg-zinc-950/40"
                    }`}
                  >
                    <div className="mb-3 border-b border-zinc-800/80 pb-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        {etiquetaDiaSemanaCorto(diaIso)}
                      </p>
                      <p className="text-sm font-medium text-zinc-100 tabular-nums">
                        {fecha.slice(8)}/{fecha.slice(5, 7)}
                      </p>
                    </div>
                    {bloquesDia.length === 0 ? (
                      <p className="text-xs text-zinc-600">Sin bloques</p>
                    ) : (
                      <div className="space-y-3">
                        {bloquesDia.map((bloque) => {
                          const clave = `${fecha}|${bloque.id}`;
                          const items = planPorClave.get(clave) ?? [];
                          const sobrecarga = bloqueSobrecargado(bloque, items);
                          return (
                            <div
                              key={bloque.id}
                              className={`rounded-lg border p-2.5 ${
                                sobrecarga
                                  ? "border-red-900/60 bg-red-950/15"
                                  : "border-zinc-800 bg-zinc-900/50"
                              }`}
                            >
                              <div className="mb-2">
                                <p className="text-xs font-medium text-zinc-100">{bloque.titulo}</p>
                                <p className="text-[10px] text-zinc-500">
                                  {etiquetaHorarioBloque(bloque)} ·{" "}
                                  {ETIQUETA_AREA_PRODUCCION[bloque.area]}
                                </p>
                                <p
                                  className={`mt-1 text-[10px] tabular-nums ${
                                    sobrecarga ? "text-red-300" : "text-zinc-500"
                                  }`}
                                >
                                  {etiquetaUsoBloque(bloque, items)}
                                  {sobrecarga ? " · sobrecargado" : ""}
                                </p>
                              </div>
                              <ul className="mb-2 space-y-1.5">
                                {items.map((item) => (
                                  <li
                                    key={item.id}
                                    className={`rounded-md border px-2 py-1.5 text-[11px] ${
                                      item.estado === "completada"
                                        ? "border-emerald-900/40 bg-emerald-950/20 text-emerald-100/80 line-through"
                                        : "border-zinc-800 bg-zinc-950/60 text-zinc-200"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <span className="min-w-0 font-medium">
                                        {item.preparacionNombre}
                                      </span>
                                      <div className="flex shrink-0 gap-0.5">
                                        <button
                                          type="button"
                                          onClick={() => void toggleCompletada(item)}
                                          disabled={isBusy}
                                          title={
                                            item.estado === "completada"
                                              ? "Marcar pendiente"
                                              : "Marcar hecha"
                                          }
                                          className="rounded p-0.5 text-zinc-500 hover:text-emerald-400 disabled:opacity-50"
                                        >
                                          <Check className="h-3 w-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void borrarTarea(item.id)}
                                          disabled={isBusy}
                                          className="rounded p-0.5 text-zinc-500 hover:text-red-400 disabled:opacity-50"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                    <p className="mt-0.5 text-[10px] text-zinc-500">
                                      {formatearDuracionLegible(item.duracionEstimadaSegundos)}
                                      {item.creadoPorNombre ? ` · ${item.creadoPorNombre}` : ""}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                              <button
                                type="button"
                                onClick={() => abrirModalTarea(fecha, bloque.id)}
                                className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-zinc-700 py-1 text-[10px] text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
                              >
                                <Plus className="h-3 w-3" />
                                Tarea
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-8 border-t border-zinc-800 pt-6">
          <button
            type="button"
            onClick={() => {
              setMostrarPlantilla((v) => !v);
              if (!mostrarPlantilla) {
                void recargarPlantilla();
              }
            }}
            className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            <Settings2 className="h-4 w-4" />
            {mostrarPlantilla ? "Ocultar plantilla de bloques" : "Plantilla de bloques semanal"}
          </button>

          {mostrarPlantilla ? (
            <div className="mt-4 space-y-4">
              <p className="text-xs text-zinc-500">
                Los bloques se repiten cada semana. Ej: Lunes 9:00–13:00 Delivery.
              </p>
              <div className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                    Día
                  </span>
                  <select
                    value={nuevoBloqueDia}
                    onChange={(e) => setNuevoBloqueDia(Number(e.target.value))}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>
                        {etiquetaDiaSemanaIso(d)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                    Inicio
                  </span>
                  <input
                    type="time"
                    value={nuevoBloqueInicio}
                    onChange={(e) => setNuevoBloqueInicio(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                    Fin
                  </span>
                  <input
                    type="time"
                    value={nuevoBloqueFin}
                    onChange={(e) => setNuevoBloqueFin(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                    Área
                  </span>
                  <select
                    value={nuevoBloqueArea}
                    onChange={(e) =>
                      setNuevoBloqueArea(e.target.value as (typeof AREAS_PRODUCCION)[number])
                    }
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  >
                    {AREAS_PRODUCCION.map((a) => (
                      <option key={a} value={a}>
                        {ETIQUETA_AREA_PRODUCCION[a]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                    Título
                  </span>
                  <input
                    type="text"
                    value={nuevoBloqueTitulo}
                    onChange={(e) => setNuevoBloqueTitulo(e.target.value)}
                    placeholder="Prep delivery mañana"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void crearBloque()}
                  disabled={isBusy}
                  className="sm:col-span-3 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Agregar bloque
                </button>
              </div>

              {bloques.length > 0 ? (
                <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
                  {bloques.map((b) => (
                    <li
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                    >
                      <div>
                        <span className="font-medium text-zinc-100">{b.titulo}</span>
                        <span className="ml-2 text-xs text-zinc-500">
                          {etiquetaDiaSemanaIso(b.diaSemana)} · {etiquetaHorarioBloque(b)} ·{" "}
                          {ETIQUETA_AREA_PRODUCCION[b.area]}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void borrarBloque(b.id)}
                        disabled={isBusy}
                        className="rounded-lg border border-zinc-700 p-1.5 text-zinc-500 hover:border-red-800 hover:text-red-300 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {modalTarea ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-white">Asignar tarea</h3>
                <p className="text-sm text-zinc-400 tabular-nums">{modalTarea.fecha}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalTarea(null)}
                className="rounded-lg p-1 text-zinc-500 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Preparación
                </span>
                <select
                  value={prepTareaId}
                  onChange={(e) => onElegirPrepTarea(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm"
                >
                  <option value="">Elegir…</option>
                  {preparaciones.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
              {prepTarea ? (
                <p className="text-xs text-zinc-500">
                  Estimación:{" "}
                  {formatearDuracionLegible(
                    estimarDuracionSegundos(prepTarea.id, resumenes)
                  )}{" "}
                  (mediana de tiempos registrados)
                </p>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Duración estimada (min)
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={duracionTareaMin}
                  onChange={(e) => setDuracionTareaMin(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Cantidad planificada
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={cantidadTarea}
                  onChange={(e) => setCantidadTarea(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Notas
                </span>
                <input
                  type="text"
                  value={notasTarea}
                  onChange={(e) => setNotasTarea(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm"
                />
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setModalTarea(null)}
                className="flex-1 rounded-xl border border-zinc-600 px-4 py-2.5 text-sm text-zinc-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void guardarTarea()}
                disabled={isBusy}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {isBusy ? "Guardando…" : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
