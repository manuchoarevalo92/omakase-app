"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Plus,
  Timer,
  Trash2,
  X,
} from "lucide-react";

import {
  cantidadSugeridaAlMarcar,
  esUnidadCantidadValida,
  ETIQUETA_AREA_PRODUCCION,
  fetchPreparaciones,
  parseCantidadInput,
  UNIDADES_CANTIDAD,
  type Preparacion,
  type UnidadCantidad,
} from "@/src/lib/preparaciones";
import { APP_USERS } from "@/src/lib/auth-users";
import {
  calcularResumenesPorPreparacion,
  estimarDuracionSegundosPorCantidad,
  fetchProduccionSesionesRecientes,
  fetchSessionUsuario,
  formatearDuracionLegible,
  type SessionUsuario,
} from "@/src/lib/produccion-sesiones";
import {
  alturaItemGrillaPx,
  anchoMinimoGrillaSemanaPx,
  calcularFechasRecurrencia,
  calcularHoraFinDesdeInicio,
  calcularLayoutVisualSemana,
  claseAreaBloque,
  crearProduccionPlanItem,
  crearProduccionPlanItemsBatch,
  diaSemanaIsoDesdeFecha,
  duracionSegundosEntreHoras,
  eliminarProduccionPlanItem,
  estimarDuracionSegundos,
  etiquetaDiaSemanaCorto,
  etiquetaHorarioItem,
  etiquetaSemana,
  fechasSemanaDesdeLunes,
  fetchProduccionPlanSemana,
  formatFechaLocalYYYYMMDD,
  horaDesdePosicionGrillaPx,
  MENSAJE_MIGRACION_HORARIOS_PLAN,
  GRILLA_ANCHO_CARRIL_MIN_PX,
  GRILLA_ANCHO_DIA_MIN_PX,
  GRILLA_EJE_HORAS_PX,
  GRILLA_HORA_FIN,
  GRILLA_HORA_INICIO,
  horasGrilla,
  itemTieneConflicto,
  itemsPlanPorFecha,
  lunesDeSemanaDe,
  marcarPlanItemCompletado,
  marcarPlanItemPendiente,
  PRODUCCION_PERSONAS_PARALELAS,
  siguienteHorarioLibrePersona,
  topFranjaHorariaPx,
  topItemGrillaPx,
  type ProduccionPlanItem,
} from "@/src/lib/produccion-plan";
import { formatPostgrestError } from "@/src/lib/supabase-errors";

type ModalPrep = {
  fecha: string;
  horaInicio: string;
};

type RecurrenciaModalModo = "none" | "daily" | "weekly";

type PlanClipboard = {
  itemId: string;
  preparacionId: string | null;
  preparacionNombre: string;
  area: Preparacion["area"];
  horaInicio: string;
  horaFin: string;
  cantidadPlanificada: number | null;
  unidadCantidad: UnidadCantidad | null;
  notas: string | null;
  asignadoAId: string | null;
  asignadoANombre: string | null;
};

function etiquetaHoraGrilla(hora: number): string {
  return `${String(hora).padStart(2, "0")}:00`;
}

const MAX_RECURRENCIA_DIAS = 90;

export default function ProduccionPlanPage() {
  const [lunesSemana, setLunesSemana] = useState(() =>
    lunesDeSemanaDe(formatFechaLocalYYYYMMDD(new Date()))
  );
  const [plan, setPlan] = useState<ProduccionPlanItem[]>([]);
  const [preparaciones, setPreparaciones] = useState<Preparacion[]>([]);
  const [resumenes, setResumenes] = useState(
    () => [] as ReturnType<typeof calcularResumenesPorPreparacion>
  );
  const [usuario, setUsuario] = useState<SessionUsuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiereMigracionHorarios, setRequiereMigracionHorarios] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalPrep | null>(null);
  const [prepId, setPrepId] = useState("");
  const [horaInicio, setHoraInicio] = useState("10:00");
  const [horaFin, setHoraFin] = useState("10:00");
  const [cantidad, setCantidad] = useState("");
  const [unidadCantidad, setUnidadCantidad] = useState<UnidadCantidad>("kg");
  const [notas, setNotas] = useState("");
  const [estimacionEscalada, setEstimacionEscalada] = useState(false);
  const [asignadoId, setAsignadoId] = useState("");
  const [clipboard, setClipboard] = useState<PlanClipboard | null>(null);
  const [recurrenciaModo, setRecurrenciaModo] = useState<RecurrenciaModalModo>("none");
  const [recurrenciaHasta, setRecurrenciaHasta] = useState("");

  const equipo = useMemo(() => APP_USERS.map((u) => ({ id: u.id, name: u.displayName })), []);

  const fechasSemana = useMemo(() => fechasSemanaDesdeLunes(lunesSemana), [lunesSemana]);
  const horas = useMemo(() => horasGrilla(), []);
  const anchoGrillaPx = useMemo(() => anchoMinimoGrillaSemanaPx(), []);
  const columnasGrilla = `${GRILLA_EJE_HORAS_PX}px repeat(7, ${GRILLA_ANCHO_DIA_MIN_PX}px)`;
  const layoutSemana = useMemo(
    () => calcularLayoutVisualSemana(plan, lunesSemana),
    [plan, lunesSemana]
  );
  const alturaGrillaSemana = layoutSemana.alturaPx;
  const alturasFranjas = layoutSemana.alturasFranjas;
  const layoutsPorFecha = layoutSemana.porFecha;
  const anchoCarrilPct = 100 / PRODUCCION_PERSONAS_PARALELAS;

  const prepSeleccionada = useMemo(
    () => preparaciones.find((p) => p.id === prepId) ?? null,
    [preparaciones, prepId]
  );

  const horarioSugeridoActivo = useMemo(() => {
    if (!modal || !asignadoId) {
      return false;
    }
    return (
      siguienteHorarioLibrePersona({
        fecha: modal.fecha,
        horaDesde: modal.horaInicio,
        asignadoId,
        plan,
      }) !== modal.horaInicio
    );
  }, [modal, asignadoId, plan]);

  const aplicarDuracionEstimada = useCallback(
    (prep: Preparacion, inicio: string, cantidadStr: string, unidad: UnidadCantidad) => {
      const cant = parseCantidadInput(cantidadStr);
      const est = estimarDuracionSegundosPorCantidad(prep.id, cant, unidad, resumenes);
      setHoraFin(calcularHoraFinDesdeInicio(inicio, est.segundos));
      setEstimacionEscalada(est.escaladoPorCantidad);
    },
    [resumenes]
  );

  const sugerirHorarioInicio = useCallback(
    (fecha: string, horaSlot: string, personaId: string) => {
      return siguienteHorarioLibrePersona({
        fecha,
        horaDesde: horaSlot,
        asignadoId: personaId || null,
        plan,
      });
    },
    [plan]
  );

  const aplicarHorarioSugerido = useCallback(
    (
      fecha: string,
      horaSlot: string,
      personaId: string,
      prep: Preparacion | null,
      cantidadStr: string,
      unidad: UnidadCantidad
    ) => {
      const inicio = sugerirHorarioInicio(fecha, horaSlot, personaId);
      setHoraInicio(inicio);
      if (prep) {
        aplicarDuracionEstimada(prep, inicio, cantidadStr, unidad);
      } else {
        setHoraFin(calcularHoraFinDesdeInicio(inicio, 60 * 60));
      }
      return inicio;
    },
    [aplicarDuracionEstimada, sugerirHorarioInicio]
  );

  const refrescar = useCallback(async () => {
    const [planResult, prepsResult, sesionesResult] = await Promise.allSettled([
      fetchProduccionPlanSemana(lunesSemana),
      fetchPreparaciones(),
      fetchProduccionSesionesRecientes(200),
    ]);

    const errores: string[] = [];

    if (planResult.status === "fulfilled") {
      setPlan(planResult.value.items);
      setRequiereMigracionHorarios(planResult.value.requiereMigracionHorarios);
    } else {
      setPlan([]);
      setRequiereMigracionHorarios(false);
      errores.push(
        planResult.reason instanceof Error
          ? planResult.reason.message
          : "No se pudo cargar el plan."
      );
    }

    if (prepsResult.status === "fulfilled") {
      setPreparaciones(prepsResult.value);
    } else {
      setPreparaciones([]);
      errores.push(
        prepsResult.reason instanceof Error
          ? prepsResult.reason.message
          : "No se pudieron cargar las preparaciones."
      );
    }

    if (sesionesResult.status === "fulfilled") {
      setResumenes(calcularResumenesPorPreparacion(sesionesResult.value));
    } else {
      setResumenes([]);
    }

    if (errores.length > 0) {
      throw new Error(errores.join(" "));
    }
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
        if (u) {
          setAsignadoId(u.id);
        }
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

  const abrirModal = (fecha: string, hora: number) => {
    const horaSlot = etiquetaHoraGrilla(hora);
    const personaId = usuario?.id ?? asignadoId;
    setModal({ fecha, horaInicio: horaSlot });
    setPrepId("");
    setCantidad("");
    setNotas("");
    setEstimacionEscalada(false);
    setRecurrenciaModo("none");
    setRecurrenciaHasta(fecha);
    if (personaId) {
      setAsignadoId(personaId);
    }
    aplicarHorarioSugerido(fecha, horaSlot, personaId, null, "", unidadCantidad);
    setError(null);
  };

  const onClickGrillaDia = (fecha: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (isBusy) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const hora = horaDesdePosicionGrillaPx(y, alturasFranjas);
    if (hora == null) {
      return;
    }
    if (clipboard) {
      void pegarClipboardEnHorario(fecha, etiquetaHoraGrilla(hora));
      return;
    }
    abrirModal(fecha, hora);
  };

  const copiarItem = (item: ProduccionPlanItem) => {
    setClipboard({
      itemId: item.id,
      preparacionId: item.preparacionId,
      preparacionNombre: item.preparacionNombre,
      area: item.area,
      horaInicio: item.horaInicio,
      horaFin: item.horaFin,
      cantidadPlanificada: item.cantidadPlanificada,
      unidadCantidad: item.unidadCantidad,
      notas: item.notas,
      asignadoAId: item.asignadoAId,
      asignadoANombre: item.asignadoANombre,
    });
    setSuccess(`Copiado: ${item.preparacionNombre}. Tocá una hora para pegar.`);
    setError(null);
  };

  const pegarClipboardEnHorario = async (fecha: string, horaDestino: string) => {
    if (!clipboard) {
      return;
    }
    const prep = preparaciones.find((p) => p.id === clipboard.preparacionId);
    if (!prep) {
      setError(
        `No se encontró la preparación "${clipboard.preparacionNombre}" para pegar.`
      );
      return;
    }
    const duracion = duracionSegundosEntreHoras(clipboard.horaInicio, clipboard.horaFin);
    const horaFinDestino = calcularHoraFinDesdeInicio(horaDestino, duracion);
    const asignado =
      clipboard.asignadoAId && clipboard.asignadoANombre
        ? { id: clipboard.asignadoAId, name: clipboard.asignadoANombre }
        : null;
    setIsBusy(true);
    setError(null);
    try {
      const item = await crearProduccionPlanItem({
        fecha,
        horaInicio: horaDestino,
        horaFin: horaFinDestino,
        prep,
        cantidadPlanificada: clipboard.cantidadPlanificada,
        unidadCantidad: clipboard.unidadCantidad ?? prep.unidadCantidad,
        notas: clipboard.notas,
        asignado,
        usuario,
      });
      setPlan((prev) => [...prev, item]);
      setSuccess(
        `Pegado: ${item.preparacionNombre} ${item.fecha} ${item.horaInicio}–${item.horaFin}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo pegar el bloque.");
    } finally {
      setIsBusy(false);
    }
  };

  const onCambioAsignado = (id: string) => {
    setAsignadoId(id);
    if (!modal) {
      return;
    }
    aplicarHorarioSugerido(
      modal.fecha,
      modal.horaInicio,
      id,
      prepSeleccionada,
      cantidad,
      unidadCantidad
    );
  };

  const onElegirPrep = (id: string) => {
    setPrepId(id);
    const prep = preparaciones.find((p) => p.id === id);
    if (!prep) {
      return;
    }
    setUnidadCantidad(prep.unidadCantidad);
    const cant = String(cantidadSugeridaAlMarcar(prep));
    setCantidad(cant);
    aplicarDuracionEstimada(prep, horaInicio, cant, prep.unidadCantidad);
  };

  const onCambioHoraInicio = (valor: string) => {
    setHoraInicio(valor);
    if (prepSeleccionada) {
      aplicarDuracionEstimada(prepSeleccionada, valor, cantidad, unidadCantidad);
    }
  };

  const onCambioCantidad = (valor: string) => {
    setCantidad(valor);
    if (prepSeleccionada) {
      aplicarDuracionEstimada(prepSeleccionada, horaInicio, valor, unidadCantidad);
    }
  };

  const onCambioUnidad = (valor: string) => {
    if (!esUnidadCantidadValida(valor) || !prepSeleccionada) {
      return;
    }
    setUnidadCantidad(valor);
    aplicarDuracionEstimada(prepSeleccionada, horaInicio, cantidad, valor);
  };

  const guardar = async () => {
    if (!modal || !prepSeleccionada) {
      setError("Elegí una preparación.");
      return;
    }
    if (horaFin <= horaInicio) {
      setError("La hora de fin debe ser posterior al inicio.");
      return;
    }
    const asignado = equipo.find((m) => m.id === asignadoId) ?? null;
    if (!asignado) {
      setError("Elegí quién hace esta preparación.");
      return;
    }
    const fechaBase = modal.fecha;
    let fechasObjetivo = [fechaBase];
    if (recurrenciaModo !== "none") {
      if (!recurrenciaHasta) {
        setError("Elegí hasta qué fecha repetir.");
        return;
      }
      const fechas = calcularFechasRecurrencia({
        fechaInicio: fechaBase,
        fechaFin: recurrenciaHasta,
        modo: recurrenciaModo,
      });
      if (fechas.length === 0) {
        setError("La fecha de fin debe ser igual o posterior a la fecha inicial.");
        return;
      }
      if (fechas.length > MAX_RECURRENCIA_DIAS) {
        setError(
          `La recurrencia supera el máximo de ${MAX_RECURRENCIA_DIAS} ocurrencias. Ajustá la fecha de fin.`
        );
        return;
      }
      fechasObjetivo = fechas;
    }
    setIsBusy(true);
    setError(null);
    try {
      const payloadBase = {
        horaInicio,
        horaFin,
        prep: prepSeleccionada,
        cantidadPlanificada: parseCantidadInput(cantidad),
        unidadCantidad,
        notas,
        asignado: { id: asignado.id, name: asignado.name },
        usuario,
      };
      const nuevos =
        fechasObjetivo.length === 1
          ? [await crearProduccionPlanItem({ fecha: fechasObjetivo[0]!, ...payloadBase })]
          : await crearProduccionPlanItemsBatch(
              fechasObjetivo.map((fecha) => ({ fecha, ...payloadBase }))
            );
      setPlan((prev) => [...prev, ...nuevos]);
      setModal(null);
      if (nuevos.length === 1) {
        const item = nuevos[0]!;
        setSuccess(
          `${item.preparacionNombre} planificada ${item.fecha} ${item.horaInicio}–${item.horaFin}.`
        );
      } else {
        setSuccess(
          `${prepSeleccionada.nombre} planificada en ${nuevos.length} fechas (${recurrenciaModo === "daily" ? "diaria" : "semanal"}).`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
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

  const borrar = async (id: string) => {
    const ok = window.confirm("¿Quitar esta preparación del plan?");
    if (!ok) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await eliminarProduccionPlanItem(id);
      setPlan((prev) => prev.filter((p) => p.id !== id));
      setSuccess("Preparación eliminada del plan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-[100rem] rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur sm:p-6">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Plan semanal</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Cada preparación es un bloque en la grilla con inicio y fin. Tocá una hora para
              agregar. Duraciones desde{" "}
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

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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

        <div className="mb-4 flex flex-wrap gap-3 text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-sky-800/60 bg-sky-950/50" />
            Delivery
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-violet-800/60 bg-violet-950/50" />
            Barra
          </span>
          <span>
            Hasta {PRODUCCION_PERSONAS_PARALELAS} preparaciones en el mismo horario (una por persona).
          </span>
          <span className="text-red-400/90">Borde rojo = misma persona doble o más de 3 a la vez.</span>
        </div>

        {clipboard ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-900/60 bg-sky-950/30 px-3 py-2 text-sm text-sky-100">
            <p>
              Copiado: <span className="font-medium">{clipboard.preparacionNombre}</span> (
              {clipboard.horaInicio}–{clipboard.horaFin}). Tocá una franja para pegar.
            </p>
            <button
              type="button"
              onClick={() => setClipboard(null)}
              className="rounded-lg border border-sky-700/70 px-2.5 py-1 text-xs text-sky-100/90 hover:bg-sky-900/40"
            >
              Limpiar copia
            </button>
          </div>
        ) : null}

        {requiereMigracionHorarios ? (
          <p className="mb-4 rounded-xl border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
            {MENSAJE_MIGRACION_HORARIOS_PLAN}
          </p>
        ) : null}
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
            Cargando grilla…
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto pb-2 sm:-mx-6">
            <div className="px-4 sm:px-6" style={{ minWidth: anchoGrillaPx }}>
              <div
                className="grid gap-px"
                style={{ gridTemplateColumns: columnasGrilla }}
              >
                <div
                  className="sticky left-0 z-20 bg-zinc-900/95"
                  style={{ width: GRILLA_EJE_HORAS_PX }}
                />
                {fechasSemana.map((fecha) => {
                  const diaIso = diaSemanaIsoDesdeFecha(fecha);
                  const esHoy = fecha === formatFechaLocalYYYYMMDD(new Date());
                  const cantidadDia = itemsPlanPorFecha(plan, fecha).length;
                  return (
                    <div
                      key={fecha}
                      className={`sticky top-0 z-10 border-b px-2 pb-2 text-center ${
                        esHoy ? "border-emerald-800/60" : "border-zinc-800"
                      }`}
                      style={{ width: GRILLA_ANCHO_DIA_MIN_PX }}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        {etiquetaDiaSemanaCorto(diaIso)}
                      </p>
                      <p
                        className={`text-sm font-medium tabular-nums ${
                          esHoy ? "text-emerald-300" : "text-zinc-100"
                        }`}
                      >
                        {fecha.slice(8)}/{fecha.slice(5, 7)}
                      </p>
                      {cantidadDia > 0 ? (
                        <p className="mt-0.5 text-[10px] text-zinc-500">
                          {cantidadDia} prep{cantidadDia === 1 ? "" : "s"}
                        </p>
                      ) : null}
                    </div>
                  );
                })}

                <div
                  className="relative sticky left-0 z-10 border-r border-zinc-800/80 bg-zinc-900/95"
                  style={{ width: GRILLA_EJE_HORAS_PX, height: alturaGrillaSemana }}
                >
                  {horas.map((h) => (
                    <div
                      key={h}
                      className="pointer-events-none absolute inset-x-0 border-t border-zinc-700/55"
                      style={{ top: topFranjaHorariaPx(h, alturasFranjas) }}
                    />
                  ))}
                  {horas.map((h) => (
                    <div
                      key={`label-${h}`}
                      className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-zinc-500"
                      style={{ top: topFranjaHorariaPx(h, alturasFranjas) }}
                    >
                      {etiquetaHoraGrilla(h)}
                    </div>
                  ))}
                </div>

                {fechasSemana.map((fecha) => {
                  const itemsDia = itemsPlanPorFecha(plan, fecha);
                  const layoutDia = layoutsPorFecha.get(fecha)!;
                  const esHoy = fecha === formatFechaLocalYYYYMMDD(new Date());
                  return (
                    <div
                      key={fecha}
                      className={`relative border-l ${
                        esHoy ? "border-emerald-900/40 bg-emerald-950/5" : "border-zinc-800/80"
                      }`}
                      style={{ width: GRILLA_ANCHO_DIA_MIN_PX, height: alturaGrillaSemana }}
                    >
                      {[1, 2].map((carril) => (
                        <div
                          key={carril}
                          className="pointer-events-none absolute inset-y-0 border-r border-zinc-800/35"
                          style={{ left: `${carril * anchoCarrilPct}%` }}
                        />
                      ))}
                      {horas.map((h) => (
                        <div
                          key={h}
                          className="pointer-events-none absolute inset-x-0 z-[3] border-t border-zinc-700/55"
                          style={{ top: topFranjaHorariaPx(h, alturasFranjas) }}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={(e) => onClickGrillaDia(fecha, e)}
                        className="absolute inset-x-0 top-0 z-[4] cursor-cell bg-transparent hover:bg-zinc-800/20"
                        style={{ height: alturaGrillaSemana }}
                        aria-label={`Agregar preparación el ${fecha}`}
                      />

                      {itemsDia.map((item) => {
                        const conflicto = itemTieneConflicto(item, plan);
                        const completada = item.estado === "completada";
                        const layout = layoutDia.items.get(item.id) ?? {
                          indice: 0,
                          topPx: topItemGrillaPx(item),
                          heightPx: alturaItemGrillaPx(item),
                        };
                        const izqPct = layout.indice * anchoCarrilPct;
                        return (
                          <div
                            key={item.id}
                            className={`absolute overflow-y-auto rounded-lg border px-2 py-1.5 shadow-md ${claseAreaBloque(
                              item.area,
                              completada
                            )} ${conflicto ? "ring-2 ring-red-500/70" : ""} ${completada ? "opacity-80" : ""}`}
                            style={{
                              top: layout.topPx,
                              height: layout.heightPx,
                              left: `calc(${izqPct}% + 4px)`,
                              width: `calc(${anchoCarrilPct}% - 8px)`,
                              zIndex: 10 + layout.indice,
                            }}
                          >
                            <div className="flex min-h-full flex-col gap-1">
                              <p
                                className={`break-words text-sm font-semibold leading-snug ${
                                  completada ? "line-through" : ""
                                }`}
                              >
                                {item.preparacionNombre}
                              </p>
                              <p className="break-words text-xs font-medium leading-snug opacity-90">
                                {item.asignadoANombre ?? "Sin asignar"}
                                {item.cantidadPlanificada && item.unidadCantidad
                                  ? ` · ${item.cantidadPlanificada} ${item.unidadCantidad}`
                                  : ""}
                              </p>
                              <p className="text-xs tabular-nums leading-snug opacity-80">
                                {etiquetaHorarioItem(item)}
                              </p>
                              <div className="mt-auto flex gap-1 pt-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copiarItem(item);
                                  }}
                                  disabled={isBusy}
                                  className="rounded-md border border-white/10 bg-black/20 p-1 opacity-90 hover:opacity-100 disabled:opacity-40"
                                  title="Copiar bloque"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void toggleCompletada(item);
                                  }}
                                  disabled={isBusy}
                                  className="rounded-md border border-white/10 bg-black/20 p-1 opacity-90 hover:opacity-100 disabled:opacity-40"
                                  title={completada ? "Marcar pendiente" : "Hecha"}
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void borrar(item.id);
                                  }}
                                  disabled={isBusy}
                                  className="rounded-md border border-white/10 bg-black/20 p-1 opacity-90 hover:opacity-100 disabled:opacity-40"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-zinc-500">
          Grilla 10:00–00:00. Cada día tiene espacio para 3 actividades en paralelo (~
          {GRILLA_ANCHO_CARRIL_MIN_PX}px por carril). Deslizá horizontalmente si no entra en
          pantalla. Tocá una franja para planificar.
        </p>
      </section>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-white">Planificar preparación</h3>
                <p className="text-sm text-zinc-400 tabular-nums">
                  {modal.fecha} · desde {modal.horaInicio}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
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
                  value={prepId}
                  onChange={(e) => onElegirPrep(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm"
                >
                  <option value="">Elegir…</option>
                  {preparaciones.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({ETIQUETA_AREA_PRODUCCION[p.area]})
                    </option>
                  ))}
                </select>
              </label>
              {prepSeleccionada ? (
                <p className="text-xs text-zinc-500">
                  {estimacionEscalada && parseCantidadInput(cantidad) ? (
                    <>
                      Duración escalada:{" "}
                      <span className="text-violet-300">
                        {formatearDuracionLegible(
                          estimarDuracionSegundosPorCantidad(
                            prepSeleccionada.id,
                            parseCantidadInput(cantidad),
                            unidadCantidad,
                            resumenes
                          ).segundos
                        )}{" "}
                        para {cantidad} {unidadCantidad}
                      </span>
                    </>
                  ) : (
                    <>
                      Sin historial con cantidad — mediana fija:{" "}
                      {formatearDuracionLegible(
                        estimarDuracionSegundos(prepSeleccionada.id, resumenes)
                      )}
                    </>
                  )}
                </p>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Quién la hace
                </span>
                <select
                  value={asignadoId}
                  onChange={(e) => onCambioAsignado(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm"
                >
                  <option value="">Elegir…</option>
                  {equipo.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              {horarioSugeridoActivo ? (
                <p className="text-xs text-sky-300/90">
                  Siguiente hueco libre para esta persona: {horaInicio}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                    Inicio
                  </span>
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => onCambioHoraInicio(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                    Fin
                  </span>
                  <input
                    type="time"
                    value={horaFin}
                    onChange={(e) => setHoraFin(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                    Recurrencia
                  </span>
                  <select
                    value={recurrenciaModo}
                    onChange={(e) => setRecurrenciaModo(e.target.value as RecurrenciaModalModo)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm"
                  >
                    <option value="none">Sin recurrencia</option>
                    <option value="daily">Diaria</option>
                    <option value="weekly">Semanal</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                    Repetir hasta
                  </span>
                  <input
                    type="date"
                    value={recurrenciaHasta}
                    onChange={(e) => setRecurrenciaHasta(e.target.value)}
                    disabled={recurrenciaModo === "none"}
                    min={modal.fecha}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm disabled:opacity-50"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Cantidad
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cantidad}
                    onChange={(e) => onCambioCantidad(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm"
                  />
                  <select
                    value={unidadCantidad}
                    onChange={(e) => onCambioUnidad(e.target.value)}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2.5 text-sm"
                  >
                    {UNIDADES_CANTIDAD.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Notas
                </span>
                <input
                  type="text"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm"
                />
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="flex-1 rounded-xl border border-zinc-600 px-4 py-2.5 text-sm text-zinc-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void guardar()}
                disabled={isBusy}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {isBusy ? "Guardando…" : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
