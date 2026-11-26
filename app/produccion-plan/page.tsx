"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Copy,
  Lock,
  Plus,
  Timer,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import {
  Boton,
  BotonIcono,
  Campo,
  EstadoVacio,
  EsqueletoLista,
  Fecha,
  Hoja,
  Seccion,
  Segmentado,
  Selector,
  Pantalla,
  cx,
  useAvisos,
  type OpcionSelector,
} from "@/app/ui";

import {
  cantidadSugeridaAlMarcar,
  ETIQUETA_AREA_PRODUCCION,
  categoriaPlanEsManual,
  categoriaPlanEsServicio,
  esUnidadCantidadValida,
  fetchPreparaciones,
  parseCantidadInput,
  ocultarRecetaSiSoloAdmin,
  preparacionEstaConectada,
  UNIDADES_CANTIDAD,
  type Preparacion,
  type UnidadCantidad,
} from "@/src/lib/preparaciones";
import { puedeVerRecetaDeBloque } from "@/src/lib/receta-acceso";
import { PreparacionRecetaPanel } from "@/app/components/preparacion-receta-panel";
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
  calcularFechasRecurrencia,
  calcularHoraFinDesdeInicio,
  calcularLayoutVisualSemana,
  actualizarProduccionPlanItem,
  autoCompletarServiciosVencidos,
  crearProduccionPlanItem,
  crearProduccionPlanItemsBatch,
  diaSemanaIsoDesdeFecha,
  duracionSegundosEntreHoras,
  eliminarProduccionPlanItem,
  estimarDuracionSegundos,
  ETIQUETA_PLAN_CATEGORIA,
  etiquetaDiaSemanaCorto,
  etiquetaHorarioItem,
  etiquetaSemana,
  fechasSemanaDesdeLunes,
  fetchProduccionPendientesAtrasados,
  fetchProduccionPlanSemana,
  formatFechaLocalYYYYMMDD,
  itemsServicioParaAutoCompletar,
  minutosGrillaAPx,
  horaMinutoDesdePosicionGrillaPx,
  horaDesdePosicionGrillaPx,
  MENSAJE_MIGRACION_CATEGORIA_PLAN,
  MENSAJE_MIGRACION_HORARIOS_PLAN,
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

function redondearMinutosAlPaso(minutos: number, paso: number): number {
  return Math.round(minutos / paso) * paso;
}

function hhmmDesdeMinutos(minutos: number): string {
  const h = Math.floor(minutos / 60) % 24;
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Color de cada persona (por orden en APP_USERS) con tokens del sistema. */
const COLOR_PERSONA = [
  { borde: "border-accent", tinte: "bg-accent-soft", punto: "bg-accent" },
  { borde: "border-info", tinte: "bg-info-soft", punto: "bg-info" },
  { borde: "border-warning", tinte: "bg-warning-soft", punto: "bg-warning" },
] as const;

const COLOR_COMPLETADA = {
  borde: "border-success",
  tinte: "bg-success-soft",
  punto: "bg-success",
} as const;

function colorPersonaBloque(indice: number, completada: boolean) {
  if (completada) {
    return COLOR_COMPLETADA;
  }
  return COLOR_PERSONA[indice] ?? COLOR_PERSONA[COLOR_PERSONA.length - 1]!;
}

const MAX_RECURRENCIA_DIAS = 90;

export default function ProduccionPlanPage() {
  const [lunesSemana, setLunesSemana] = useState(() =>
    lunesDeSemanaDe(formatFechaLocalYYYYMMDD(new Date())),
  );
  const [ahora, setAhora] = useState(() => new Date());
  const [plan, setPlan] = useState<ProduccionPlanItem[]>([]);
  const [pendientesAtrasados, setPendientesAtrasados] = useState<
    ProduccionPlanItem[]
  >([]);
  const [preparaciones, setPreparaciones] = useState<Preparacion[]>([]);
  const [resumenes, setResumenes] = useState(
    () => [] as ReturnType<typeof calcularResumenesPorPreparacion>,
  );
  const [usuario, setUsuario] = useState<SessionUsuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiereMigracionHorarios, setRequiereMigracionHorarios] =
    useState(false);
  const [requiereMigracionCategoria, setRequiereMigracionCategoria] =
    useState(false);
  const { aviso, confirmar } = useAvisos();
  /** Mensajes de éxito como aviso efímero (antes, recuadro verde fijo). */
  const avisar = (mensaje: string) => aviso(mensaje, { tono: "exito" });
  const grillaRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<ModalPrep | null>(null);
  const [itemEditandoId, setItemEditandoId] = useState<string | null>(null);
  const [prepId, setPrepId] = useState("");
  const [horaInicio, setHoraInicio] = useState("10:00");
  const [horaFin, setHoraFin] = useState("10:00");
  const [cantidad, setCantidad] = useState("");
  const [unidadCantidad, setUnidadCantidad] = useState<UnidadCantidad>("kg");
  const [notas, setNotas] = useState("");
  const [estimacionEscalada, setEstimacionEscalada] = useState(false);
  const [asignadoId, setAsignadoId] = useState("");
  const [clipboard, setClipboard] = useState<PlanClipboard | null>(null);
  const [recurrenciaModo, setRecurrenciaModo] =
    useState<RecurrenciaModalModo>("none");
  const [recurrenciaHasta, setRecurrenciaHasta] = useState("");
  const [soloHoy, setSoloHoy] = useState(false);
  const [filtroHoyAsignado, setFiltroHoyAsignado] = useState("");
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);

  const equipo = useMemo(
    () => APP_USERS.map((u) => ({ id: u.id, name: u.displayName })),
    [],
  );
  const personaOrdenIds = useMemo(() => APP_USERS.map((u) => u.id), []);
  const getPersonaIdForItem = useCallback(
    (item: ProduccionPlanItem): string | null => {
      if (item.asignadoAId) {
        return item.asignadoAId;
      }
      if (!item.asignadoANombre) {
        return null;
      }
      const match = APP_USERS.find(
        (u) => u.displayName === item.asignadoANombre,
      );
      return match?.id ?? null;
    },
    [],
  );

  const indicePersonaItem = (item: ProduccionPlanItem) => {
    const personaId = getPersonaIdForItem(item);
    if (!personaId) {
      return 0;
    }
    const idx = personaOrdenIds.indexOf(personaId);
    return idx >= 0 ? idx : 0;
  };

  const fechasSemana = useMemo(
    () => fechasSemanaDesdeLunes(lunesSemana),
    [lunesSemana],
  );
  const fechaHoy = useMemo(() => formatFechaLocalYYYYMMDD(new Date()), []);
  const fechaHoyVisibleEnSemana = useMemo(
    () => fechasSemana.includes(fechaHoy),
    [fechasSemana, fechaHoy],
  );
  const fechasMostradas = useMemo(() => {
    if (!soloHoy) {
      return fechasSemana;
    }
    return fechaHoyVisibleEnSemana ? [fechaHoy] : [];
  }, [soloHoy, fechasSemana, fechaHoyVisibleEnSemana, fechaHoy]);
  const horas = useMemo(() => horasGrilla(), []);
  const anchoGrillaPx = useMemo(
    () =>
      GRILLA_EJE_HORAS_PX +
      Math.max(1, fechasMostradas.length) * GRILLA_ANCHO_DIA_MIN_PX,
    [fechasMostradas.length],
  );
  const columnasGrilla = `${GRILLA_EJE_HORAS_PX}px repeat(${Math.max(
    1,
    fechasMostradas.length,
  )}, ${GRILLA_ANCHO_DIA_MIN_PX}px)`;
  const layoutSemana = useMemo(
    () =>
      calcularLayoutVisualSemana(
        plan,
        lunesSemana,
        personaOrdenIds,
        getPersonaIdForItem,
      ),
    [plan, lunesSemana, personaOrdenIds, getPersonaIdForItem],
  );
  const alturaGrillaSemana = layoutSemana.alturaPx;
  const alturasFranjas = layoutSemana.alturasFranjas;
  const layoutsPorFecha = layoutSemana.porFecha;
  const anchoCarrilPct = 100 / PRODUCCION_PERSONAS_PARALELAS;
  const ahoraMinutos = ahora.getHours() * 60 + ahora.getMinutes();
  const inicioMinutos = GRILLA_HORA_INICIO * 60;
  const finMinutos = GRILLA_HORA_FIN * 60;
  const mostrarLineaAhora =
    ahoraMinutos >= inicioMinutos && ahoraMinutos < finMinutos;
  const lineTopPx = mostrarLineaAhora
    ? minutosGrillaAPx(ahoraMinutos - inicioMinutos, alturasFranjas)
    : 0;
  const ahoraHHmm = `${String(ahora.getHours()).padStart(2, "0")}:${String(
    ahora.getMinutes(),
  ).padStart(2, "0")}`;
  const itemsHoy = useMemo(
    () => itemsPlanPorFecha(plan, fechaHoy),
    [plan, fechaHoy],
  );
  const itemsHoyFiltrados = useMemo(() => {
    if (!filtroHoyAsignado) {
      return itemsHoy;
    }
    return itemsHoy.filter((item) => item.asignadoAId === filtroHoyAsignado);
  }, [itemsHoy, filtroHoyAsignado]);

  const prepSeleccionada = useMemo(
    () => preparaciones.find((p) => p.id === prepId) ?? null,
    [preparaciones, prepId],
  );
  const itemEditando = useMemo(
    () =>
      itemEditandoId
        ? (plan.find((p) => p.id === itemEditandoId) ?? null)
        : null,
    [itemEditandoId, plan],
  );

  const puedeVerRecetaModal = puedeVerRecetaDeBloque({
    viewer: usuario,
    prep: prepSeleccionada,
    asignadoAId: itemEditando?.asignadoAId ?? asignadoId,
  });

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
    (
      prep: Preparacion,
      inicio: string,
      cantidadStr: string,
      unidad: UnidadCantidad,
    ) => {
      const cant = parseCantidadInput(cantidadStr);
      const est = estimarDuracionSegundosPorCantidad(
        prep.id,
        cant,
        unidad,
        resumenes,
      );
      setHoraFin(calcularHoraFinDesdeInicio(inicio, est.segundos));
      setEstimacionEscalada(est.escaladoPorCantidad);
    },
    [resumenes],
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
    [plan],
  );

  const aplicarHorarioSugerido = useCallback(
    (
      fecha: string,
      horaSlot: string,
      personaId: string,
      prep: Preparacion | null,
      cantidadStr: string,
      unidad: UnidadCantidad,
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
    [aplicarDuracionEstimada, sugerirHorarioInicio],
  );

  const refrescar = useCallback(
    async (usuarioActual: SessionUsuario | null) => {
      const [
        planResult,
        prepsResult,
        sesionesResult,
        pendientesResult,
        autoServicioResult,
      ] = await Promise.allSettled([
        fetchProduccionPlanSemana(lunesSemana),
        fetchPreparaciones(),
        fetchProduccionSesionesRecientes(200),
        fetchProduccionPendientesAtrasados(fechaHoy, 300),
        autoCompletarServiciosVencidos(fechaHoy),
      ]);

      const errores: string[] = [];

      if (planResult.status === "fulfilled") {
        setPlan(planResult.value.items);
        setRequiereMigracionHorarios(
          planResult.value.requiereMigracionHorarios,
        );
        setRequiereMigracionCategoria(
          planResult.value.requiereMigracionCategoria,
        );
      } else {
        setPlan([]);
        setRequiereMigracionHorarios(false);
        setRequiereMigracionCategoria(false);
        errores.push(
          planResult.reason instanceof Error
            ? planResult.reason.message
            : "No se pudo cargar el plan.",
        );
      }

      if (prepsResult.status === "fulfilled") {
        const lista = prepsResult.value;
        if (usuarioActual?.role === "staff") {
          setPreparaciones(lista.map(ocultarRecetaSiSoloAdmin));
        } else {
          setPreparaciones(lista);
        }
      } else {
        setPreparaciones([]);
        errores.push(
          prepsResult.reason instanceof Error
            ? prepsResult.reason.message
            : "No se pudieron cargar las preparaciones.",
        );
      }

      if (sesionesResult.status === "fulfilled") {
        setResumenes(calcularResumenesPorPreparacion(sesionesResult.value));
      } else {
        setResumenes([]);
      }

      if (pendientesResult.status === "fulfilled") {
        setPendientesAtrasados(pendientesResult.value);
      } else {
        setPendientesAtrasados([]);
      }

      if (
        autoServicioResult.status === "fulfilled" &&
        autoServicioResult.value.length > 0
      ) {
        const completados = autoServicioResult.value;
        const ids = new Set(completados.map((item) => item.id));
        setPlan((prev) =>
          prev.map((item) => completados.find((c) => c.id === item.id) ?? item),
        );
        setPendientesAtrasados((prev) =>
          prev.filter((item) => !ids.has(item.id)),
        );
      }

      if (errores.length > 0) {
        throw new Error(errores.join(" "));
      }
    },
    [lunesSemana, fechaHoy],
  );

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
        await refrescar(u);
      } catch (err) {
        if (!cancelled) {
          setError(
            err && typeof err === "object" && "message" in err
              ? formatPostgrestError(
                  err as Parameters<typeof formatPostgrestError>[0],
                )
              : "No se pudo cargar el plan.",
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
    const id = window.setInterval(() => setAhora(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const vencidos = itemsServicioParaAutoCompletar(plan, ahora);
    if (vencidos.length === 0 || isBusy) {
      return;
    }
    let cancelled = false;
    const completar = async () => {
      try {
        const actualizados = await Promise.all(
          vencidos.map((item) => marcarPlanItemCompletado(item.id)),
        );
        if (cancelled) {
          return;
        }
        const porId = new Map(actualizados.map((item) => [item.id, item]));
        setPlan((prev) => prev.map((item) => porId.get(item.id) ?? item));
      } catch {
        // El próximo tick o refresh lo reintenta.
      }
    };
    void completar();
    return () => {
      cancelled = true;
    };
  }, [ahora, plan, isBusy]);

  /** Estable: la Hoja vuelve a enfocar el panel si cambia onCerrar (robaría el foco al tipear). */
  const cerrarModal = useCallback(() => {
    setModal(null);
    setItemEditandoId(null);
  }, []);

  /* En celular la grilla scrollea dentro de su caja: arrancar mostrando el día de hoy. */
  useEffect(() => {
    if (isLoading) {
      return;
    }
    const caja = grillaRef.current;
    const columnaHoy = caja?.querySelector<HTMLElement>("[data-hoy='true']");
    if (!caja || !columnaHoy || caja.scrollWidth <= caja.clientWidth) {
      return;
    }
    const desde =
      columnaHoy.getBoundingClientRect().left -
      caja.getBoundingClientRect().left +
      caja.scrollLeft;
    caja.scrollLeft = Math.max(0, desde - GRILLA_EJE_HORAS_PX - 1);
  }, [isLoading, fechasMostradas]);

  const cambiarSemana = (delta: number) => {
    const d = new Date(lunesSemana + "T12:00:00");
    d.setDate(d.getDate() + delta * 7);
    setLunesSemana(formatFechaLocalYYYYMMDD(d));
  };

  const irSemanaActual = () => {
    setLunesSemana(lunesDeSemanaDe(formatFechaLocalYYYYMMDD(new Date())));
  };

  const abrirModal = (fecha: string, hora: number) => {
    const horaSlot = etiquetaHoraGrilla(hora);
    const personaId =
      usuario?.role === "staff" ? usuario.id : (usuario?.id ?? asignadoId);
    setModal({ fecha, horaInicio: horaSlot });
    setItemEditandoId(null);
    setPrepId("");
    setCantidad("");
    setNotas("");
    setEstimacionEscalada(false);
    setRecurrenciaModo("none");
    setRecurrenciaHasta(fecha);
    if (personaId) {
      setAsignadoId(personaId);
    }
    aplicarHorarioSugerido(
      fecha,
      horaSlot,
      personaId,
      null,
      "",
      unidadCantidad,
    );
    setError(null);
  };

  const abrirModalEdicion = (item: ProduccionPlanItem) => {
    setModal({ fecha: item.fecha, horaInicio: item.horaInicio });
    setItemEditandoId(item.id);
    setPrepId(item.preparacionId ?? "");
    setHoraInicio(item.horaInicio);
    setHoraFin(item.horaFin);
    setCantidad(
      item.cantidadPlanificada != null ? String(item.cantidadPlanificada) : "",
    );
    setUnidadCantidad(item.unidadCantidad ?? "kg");
    setNotas(item.notas ?? "");
    setEstimacionEscalada(false);
    setRecurrenciaModo("none");
    setRecurrenciaHasta(item.fecha);
    setAsignadoId(item.asignadoAId ?? "");
    setError(null);
  };

  const onClickGrillaDia = (
    fecha: string,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
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

  const onDragStartItem = (
    event: React.DragEvent<HTMLDivElement>,
    itemId: string,
  ) => {
    event.dataTransfer.setData("text/plain", itemId);
    event.dataTransfer.effectAllowed = "move";
    setDraggingItemId(itemId);
  };

  const onDragEndItem = () => {
    setDraggingItemId(null);
  };

  const onDropEnDia = async (
    fechaDestino: string,
    event: React.DragEvent<HTMLDivElement | HTMLButtonElement>,
  ) => {
    event.preventDefault();
    const itemId = event.dataTransfer.getData("text/plain");
    const item = plan.find((p) => p.id === itemId);
    setDraggingItemId(null);
    if (!item) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const horaInicioNueva = horaMinutoDesdePosicionGrillaPx(
      y,
      alturasFranjas,
      5,
    );
    if (!horaInicioNueva) {
      return;
    }
    const duracion = duracionSegundosEntreHoras(item.horaInicio, item.horaFin);
    const horaFinNueva = calcularHoraFinDesdeInicio(horaInicioNueva, duracion);
    if (item.fecha === fechaDestino && item.horaInicio === horaInicioNueva) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const actualizado = await actualizarProduccionPlanItem(item.id, {
        fecha: fechaDestino,
        hora_inicio: horaInicioNueva,
        hora_fin: horaFinNueva,
        duracion_estimada_segundos: duracion,
      });
      setPlan((prev) =>
        prev.map((p) => (p.id === actualizado.id ? actualizado : p)),
      );
      avisar(
        `${actualizado.preparacionNombre} movida a ${actualizado.fecha} ${actualizado.horaInicio}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo mover el bloque.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const onDragOverDia = (
    event: React.DragEvent<HTMLDivElement | HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const copiarItem = (item: ProduccionPlanItem) => {
    const payload: PlanClipboard = {
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
    };
    setClipboard(payload);
    avisar(`Copiado: ${item.preparacionNombre}. Tocá una hora para pegar.`);
    setError(null);
  };

  const horaBaseReprogramacionHoy = (): string => {
    const actual = new Date();
    const minutosAhora = actual.getHours() * 60 + actual.getMinutes();
    const minimo = GRILLA_HORA_INICIO * 60;
    const maximo = GRILLA_HORA_FIN * 60;
    const clamped = Math.max(minimo, Math.min(maximo, minutosAhora));
    const redondeado = redondearMinutosAlPaso(clamped, 5);
    return hhmmDesdeMinutos(Math.min(redondeado, maximo));
  };

  const reprogramarPendienteAHoy = async (item: ProduccionPlanItem) => {
    const horaBase = horaBaseReprogramacionHoy();
    const horaInicioNueva = siguienteHorarioLibrePersona({
      fecha: fechaHoy,
      horaDesde: horaBase,
      asignadoId: item.asignadoAId,
      plan,
    });
    const duracion = duracionSegundosEntreHoras(item.horaInicio, item.horaFin);
    const horaFinNueva = calcularHoraFinDesdeInicio(horaInicioNueva, duracion);
    setIsBusy(true);
    setError(null);
    try {
      const actualizado = await actualizarProduccionPlanItem(item.id, {
        fecha: fechaHoy,
        hora_inicio: horaInicioNueva,
        hora_fin: horaFinNueva,
        duracion_estimada_segundos: duracion,
        estado: "pendiente",
      });
      setPlan((prev) => {
        const sinItem = prev.filter((p) => p.id !== actualizado.id);
        if (!fechasSemana.includes(fechaHoy)) {
          return sinItem;
        }
        return [...sinItem, actualizado].sort(
          (a, b) =>
            a.fecha.localeCompare(b.fecha) ||
            a.horaInicio.localeCompare(b.horaInicio),
        );
      });
      setPendientesAtrasados((prev) =>
        prev.filter((p) => p.id !== actualizado.id),
      );
      avisar(
        `Reprogramada: ${actualizado.preparacionNombre} para hoy ${actualizado.horaInicio}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo reprogramar el pendiente.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const marcarPendienteComoTerminada = async (item: ProduccionPlanItem) => {
    setIsBusy(true);
    setError(null);
    try {
      const actualizada = await marcarPlanItemCompletado(item.id);
      setPlan((prev) =>
        prev.map((p) => (p.id === actualizada.id ? actualizada : p)),
      );
      setPendientesAtrasados((prev) =>
        prev.filter((p) => p.id !== actualizada.id),
      );
      avisar(`Marcada como terminada: ${actualizada.preparacionNombre}.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo marcar como terminada.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const pegarClipboardEnHorario = async (
    fecha: string,
    horaDestino: string,
  ) => {
    if (!clipboard) {
      return;
    }
    const prep = preparaciones.find((p) => p.id === clipboard.preparacionId);
    if (!prep) {
      setError(
        `No se encontró la preparación "${clipboard.preparacionNombre}" para pegar.`,
      );
      return;
    }
    const duracion = duracionSegundosEntreHoras(
      clipboard.horaInicio,
      clipboard.horaFin,
    );
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
      avisar(
        `Pegado: ${item.preparacionNombre} ${item.fecha} ${item.horaInicio}–${item.horaFin}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo pegar el bloque.",
      );
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
      unidadCantidad,
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

  const onCambioVinculoPrep = (actualizada: Preparacion) => {
    setPreparaciones((prev) =>
      prev.map((p) => (p.id === actualizada.id ? actualizada : p)),
    );
  };

  const onCambioHoraInicio = (valor: string) => {
    setHoraInicio(valor);
    if (prepSeleccionada) {
      aplicarDuracionEstimada(
        prepSeleccionada,
        valor,
        cantidad,
        unidadCantidad,
      );
    }
  };

  const onCambioCantidad = (valor: string) => {
    setCantidad(valor);
    if (prepSeleccionada) {
      aplicarDuracionEstimada(
        prepSeleccionada,
        horaInicio,
        valor,
        unidadCantidad,
      );
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
        setError(
          "La fecha de fin debe ser igual o posterior a la fecha inicial.",
        );
        return;
      }
      if (fechas.length > MAX_RECURRENCIA_DIAS) {
        setError(
          `La recurrencia supera el máximo de ${MAX_RECURRENCIA_DIAS} ocurrencias. Ajustá la fecha de fin.`,
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
      const duracion = duracionSegundosEntreHoras(horaInicio, horaFin);
      let nuevos: ProduccionPlanItem[] = [];
      if (itemEditandoId) {
        const actualizado = await actualizarProduccionPlanItem(itemEditandoId, {
          fecha: fechaBase,
          preparacion_id: prepSeleccionada.id,
          preparacion_nombre: prepSeleccionada.nombre,
          area: prepSeleccionada.area,
          categoria: prepSeleccionada.categoriaPlan,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          duracion_estimada_segundos: duracion,
          cantidad_planificada: parseCantidadInput(cantidad),
          unidad_cantidad: unidadCantidad,
          notas: notas.trim() || null,
          asignado_a_id: asignado.id,
          asignado_a_nombre: asignado.name,
        });
        const fechasExtra = fechasObjetivo.filter((f) => f !== fechaBase);
        if (fechasExtra.length > 0) {
          nuevos = await crearProduccionPlanItemsBatch(
            fechasExtra.map((fecha) => ({ fecha, ...payloadBase })),
          );
        }
        setPlan((prev) =>
          [
            ...prev.map((p) => (p.id === actualizado.id ? actualizado : p)),
            ...nuevos,
          ].sort(
            (a, b) =>
              a.fecha.localeCompare(b.fecha) ||
              a.horaInicio.localeCompare(b.horaInicio),
          ),
        );
      } else {
        nuevos =
          fechasObjetivo.length === 1
            ? [
                await crearProduccionPlanItem({
                  fecha: fechasObjetivo[0]!,
                  ...payloadBase,
                }),
              ]
            : await crearProduccionPlanItemsBatch(
                fechasObjetivo.map((fecha) => ({ fecha, ...payloadBase })),
              );
        setPlan((prev) => [...prev, ...nuevos]);
      }
      setModal(null);
      setItemEditandoId(null);
      if (nuevos.length === 1) {
        const item = nuevos[0]!;
        avisar(
          `${item.preparacionNombre} planificada ${item.fecha} ${item.horaInicio}–${item.horaFin}.`,
        );
      } else if (itemEditandoId && nuevos.length === 0) {
        avisar("Actividad actualizada.");
      } else {
        avisar(
          `${prepSeleccionada.nombre} planificada en ${nuevos.length} fechas (${recurrenciaModo === "daily" ? "diaria" : "semanal"}).`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setIsBusy(false);
    }
  };

  const toggleCompletada = async (item: ProduccionPlanItem) => {
    if (!categoriaPlanEsManual(item.categoria)) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const actualizada =
        item.estado === "completada"
          ? await marcarPlanItemPendiente(item.id)
          : await marcarPlanItemCompletado(item.id);
      setPlan((prev) =>
        prev.map((p) => (p.id === actualizada.id ? actualizada : p)),
      );
      if (actualizada.estado === "completada") {
        setPendientesAtrasados((prev) =>
          prev.filter((p) => p.id !== actualizada.id),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setIsBusy(false);
    }
  };

  const borrar = async (id: string) => {
    const ok = await confirmar({
      titulo: "¿Quitar esta preparación del plan?",
      confirmar: "Quitar",
      peligro: true,
    });
    if (!ok) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await eliminarProduccionPlanItem(id);
      setPlan((prev) => prev.filter((p) => p.id !== id));
      setPendientesAtrasados((prev) => prev.filter((p) => p.id !== id));
      avisar("Preparación eliminada del plan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar.");
    } finally {
      setIsBusy(false);
    }
  };

  const opcionesPreparacion: OpcionSelector<string>[] = preparaciones.map(
    (p) => ({
      valor: p.id,
      label: p.nombre,
      detalle: ETIQUETA_AREA_PRODUCCION[p.area],
    }),
  );
  const opcionesEquipo: OpcionSelector<string>[] = equipo.map((m) => ({
    valor: m.id,
    label: m.name,
  }));
  const linkIcono =
    "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-label-2 transition hover:bg-fill active:scale-95";
  const botonBloque =
    "inline-flex size-8 items-center justify-center rounded-full bg-surface-3/70 text-label-2 transition hover:text-label active:scale-90 disabled:opacity-40";
  const fechaCorta = (fecha: string) =>
    `${fecha.slice(8)}/${fecha.slice(5, 7)}`;

  return (
    <Pantalla
      titulo="Plan semanal"
      subtitulo={etiquetaSemana(lunesSemana)}
      ancho="amplio"
      acciones={
        <Link
          href="/produccion-tiempos"
          aria-label="Cronómetro de preparaciones"
          title="Cronómetro"
          className={linkIcono}
        >
          <Timer className="h-[22px] w-[22px]" aria-hidden />
        </Link>
      }
      ayuda={
        <>
          <p>
            Cada preparación es un bloque en la grilla con inicio y fin. Tocá
            una franja libre para planificar y un bloque para editarlo.
          </p>
          <p>
            Las duraciones salen de{" "}
            <Link
              href="/produccion-tiempos"
              className="font-semibold text-accent underline"
            >
              Tiempos prep
            </Link>
            .
          </p>
          <p>
            La grilla va de 10:00 a 00:00. Entran hasta{" "}
            {PRODUCCION_PERSONAS_PARALELAS} preparaciones en el mismo horario
            (una por persona). El borde rojo marca a la misma persona en dos
            cosas o más de {PRODUCCION_PERSONAS_PARALELAS} a la vez.
          </p>
          <p>
            <strong className="text-label">Produ</strong> se marca hecha a mano;{" "}
            <strong className="text-label">Servicio</strong> se completa sola al
            pasar el horario (se define en Tiempos prep).
          </p>
          <p>
            En el celular, deslizá la grilla de costado para pasar de día. En la
            compu podés arrastrar un bloque a otro horario o día.
          </p>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <BotonIcono
            etiqueta="Semana anterior"
            icono={<ChevronLeft className="h-5 w-5" aria-hidden />}
            onClick={() => cambiarSemana(-1)}
          />
          <Boton variante="secundario" onClick={irSemanaActual}>
            Esta semana
          </Boton>
          <BotonIcono
            etiqueta="Semana siguiente"
            icono={<ChevronRight className="h-5 w-5" aria-hidden />}
            onClick={() => cambiarSemana(1)}
          />
        </div>
        <div className="min-w-[11rem] flex-1 sm:ml-auto sm:max-w-xs">
          <Segmentado
            etiqueta="Qué mostrar en la grilla"
            valor={soloHoy ? "hoy" : "semana"}
            onChange={(v) => setSoloHoy(v === "hoy")}
            opciones={[
              { valor: "semana", label: "Semana" },
              { valor: "hoy", label: "Solo hoy" },
            ]}
          />
        </div>
      </div>

      {requiereMigracionHorarios ? (
        <div className="mt-4 flex gap-3 rounded-card bg-warning-soft px-4 py-3 text-[0.94rem] text-warning">
          <TriangleAlert
            className="mt-0.5 h-[18px] w-[18px] shrink-0"
            aria-hidden
          />
          <p className="min-w-0 flex-1">{MENSAJE_MIGRACION_HORARIOS_PLAN}</p>
        </div>
      ) : null}
      {requiereMigracionCategoria ? (
        <div className="mt-4 flex gap-3 rounded-card bg-warning-soft px-4 py-3 text-[0.94rem] text-warning">
          <TriangleAlert
            className="mt-0.5 h-[18px] w-[18px] shrink-0"
            aria-hidden
          />
          <p className="min-w-0 flex-1">{MENSAJE_MIGRACION_CATEGORIA_PLAN}</p>
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mt-4 flex gap-3 rounded-card bg-danger-soft px-4 py-3 text-[0.94rem] text-danger"
        >
          <CircleAlert
            className="mt-0.5 h-[18px] w-[18px] shrink-0"
            aria-hidden
          />
          <p className="min-w-0 flex-1">{error}</p>
        </div>
      ) : null}

      {clipboard ? (
        <div className="sticky top-[calc(env(safe-area-inset-top,0px)+3.25rem)] z-30 mt-4 flex items-center gap-3 rounded-card bg-surface-3 py-1.5 pl-4 pr-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.18)] ring-1 ring-info/40 sm:top-4">
          <Copy className="h-[18px] w-[18px] shrink-0 text-info" aria-hidden />
          <p className="min-w-0 flex-1 text-[0.9rem] leading-snug text-label-2">
            Copiado:{" "}
            <span className="font-semibold text-label">
              {clipboard.preparacionNombre}
            </span>{" "}
            <span className="tabular-nums">
              ({clipboard.horaInicio}–{clipboard.horaFin})
            </span>
            . Tocá una franja para pegar.
          </p>
          <Boton variante="terciario" onClick={() => setClipboard(null)}>
            Limpiar
          </Boton>
        </div>
      ) : null}

      {pendientesAtrasados.length > 0 ? (
        <Seccion
          titulo={`Atrasados · ${pendientesAtrasados.length}`}
          pie={
            pendientesAtrasados.length > 8
              ? `Mostrando 8 de ${pendientesAtrasados.length}. Navegá a semanas anteriores para ver y ordenar el resto.`
              : "Producción de días anteriores sin terminar. Las de Servicio se completan solas al pasar el horario."
          }
        >
          <ul className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
            {pendientesAtrasados.slice(0, 8).map((item) => (
              <li
                key={`pend-${item.id}`}
                className="flex flex-col gap-2 border-b border-separator px-4 py-3 last:border-0 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[1rem] leading-snug text-label">
                    {item.preparacionNombre}
                  </p>
                  <p className="mt-0.5 text-[0.86rem] text-label-3">
                    <span className="font-medium tabular-nums text-warning">
                      {etiquetaDiaSemanaCorto(
                        diaSemanaIsoDesdeFecha(item.fecha),
                      )}{" "}
                      {fechaCorta(item.fecha)}
                    </span>{" "}
                    ·{" "}
                    <span className="tabular-nums">
                      {etiquetaHorarioItem(item)}
                    </span>{" "}
                    · {item.asignadoANombre ?? "Sin asignar"}
                  </p>
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-2">
                  <Boton
                    variante="secundario"
                    icono={
                      <CalendarClock
                        className="h-[18px] w-[18px]"
                        aria-hidden
                      />
                    }
                    disabled={isBusy}
                    onClick={() => {
                      void reprogramarPendienteAHoy(item);
                    }}
                  >
                    Pasar a hoy
                  </Boton>
                  <Boton
                    variante="secundario"
                    icono={<Check className="h-[18px] w-[18px]" aria-hidden />}
                    disabled={isBusy}
                    onClick={() => {
                      void marcarPendienteComoTerminada(item);
                    }}
                  >
                    Terminada
                  </Boton>
                </div>
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}

      <Seccion titulo={`Hoy · ${fechaCorta(fechaHoy)}`}>
        <Segmentado
          etiqueta="Filtrar lo de hoy por persona"
          valor={filtroHoyAsignado}
          onChange={setFiltroHoyAsignado}
          opciones={[
            { valor: "", label: "Todos" },
            ...equipo.map((m) => ({ valor: m.id, label: m.name })),
          ]}
        />
        {itemsHoyFiltrados.length === 0 ? (
          <p className="mt-2 rounded-card bg-surface-3 px-4 py-4 text-[0.94rem] text-label-3">
            No hay actividades para hoy
            {filtroHoyAsignado ? " con ese filtro" : ""}.
          </p>
        ) : (
          <ul className="mt-2 overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:grid sm:grid-cols-2 lg:grid-cols-3">
            {itemsHoyFiltrados.map((item) => {
              const completada = item.estado === "completada";
              const color = colorPersonaBloque(
                indicePersonaItem(item),
                completada,
              );
              return (
                <li
                  key={`hoy-${item.id}`}
                  className="flex min-h-14 items-center gap-3 border-b border-separator px-4 py-2 last:border-0"
                >
                  <span
                    className={cx(
                      "size-2.5 shrink-0 rounded-full",
                      color.punto,
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cx(
                        "block truncate text-[1rem] leading-snug",
                        completada ? "text-label-3 line-through" : "text-label",
                      )}
                    >
                      {item.preparacionNombre}
                    </span>
                    <span className="block truncate text-[0.86rem] text-label-3">
                      {item.asignadoANombre ?? "Sin asignar"}
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.9rem] tabular-nums text-label-2">
                    {etiquetaHorarioItem(item)}
                  </span>
                  {completada ? (
                    <Check
                      className="h-[18px] w-[18px] shrink-0 text-success"
                      aria-label="Hecha"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Seccion>

      <Seccion titulo={soloHoy ? "Grilla de hoy" : "Grilla de la semana"}>
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[0.82rem] text-label-2">
          {equipo.map((m, i) => (
            <span key={m.id} className="inline-flex items-center gap-1.5">
              <span
                className={cx(
                  "size-2.5 rounded-full",
                  colorPersonaBloque(i, false).punto,
                )}
                aria-hidden
              />
              {m.name}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-success" aria-hidden />
            Hecha
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full ring-2 ring-danger"
              aria-hidden
            />
            Choque de horario
          </span>
        </div>

        {isLoading ? (
          <EsqueletoLista filas={6} />
        ) : fechasMostradas.length === 0 ? (
          <div className="rounded-card bg-surface-3">
            <EstadoVacio
              icono={<CalendarDays className="h-6 w-6" aria-hidden />}
              titulo="Hoy no está en esta semana"
              texto="Volvé a la semana actual para ver lo de hoy."
              accion={<Boton onClick={irSemanaActual}>Ir a esta semana</Boton>}
            />
          </div>
        ) : (
          <div
            ref={grillaRef}
            className="relative isolate -mx-4 snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-2 sm:-mx-6 sm:snap-none"
            style={{ scrollPaddingLeft: GRILLA_EJE_HORAS_PX }}
          >
            <div className="px-4 sm:px-6" style={{ minWidth: anchoGrillaPx }}>
              <div
                className="grid gap-px"
                style={{ gridTemplateColumns: columnasGrilla }}
              >
                <div
                  className="sticky left-0 z-20 bg-surface"
                  style={{ width: GRILLA_EJE_HORAS_PX }}
                />
                {fechasMostradas.map((fecha) => {
                  const diaIso = diaSemanaIsoDesdeFecha(fecha);
                  const esHoy = fecha === formatFechaLocalYYYYMMDD(new Date());
                  const cantidadDia = itemsPlanPorFecha(plan, fecha).length;
                  return (
                    <div
                      key={fecha}
                      className={cx(
                        "border-b-2 px-2 pb-2 text-center",
                        esHoy ? "border-accent" : "border-separator",
                      )}
                      style={{ width: GRILLA_ANCHO_DIA_MIN_PX }}
                    >
                      <p
                        className={cx(
                          "text-[0.8rem] font-semibold uppercase tracking-[0.07em]",
                          esHoy ? "text-accent" : "text-label-3",
                        )}
                      >
                        {etiquetaDiaSemanaCorto(diaIso)}
                      </p>
                      <p
                        className={cx(
                          "text-[1.05rem] font-semibold tabular-nums",
                          esHoy ? "text-accent" : "text-label",
                        )}
                      >
                        {fechaCorta(fecha)}
                      </p>
                      {cantidadDia > 0 ? (
                        <p className="text-[0.8rem] text-label-3">
                          {cantidadDia} prep{cantidadDia === 1 ? "" : "s"}
                        </p>
                      ) : null}
                    </div>
                  );
                })}

                <div
                  className="sticky left-0 z-10 border-r border-separator bg-surface"
                  style={{
                    width: GRILLA_EJE_HORAS_PX,
                    height: alturaGrillaSemana,
                  }}
                >
                  {horas.map((h) => (
                    <div
                      key={h}
                      className="pointer-events-none absolute inset-x-0 border-t border-separator"
                      style={{ top: topFranjaHorariaPx(h, alturasFranjas) }}
                    />
                  ))}
                  {horas.map((h) => (
                    <div
                      key={`label-${h}`}
                      className="absolute right-1.5 -translate-y-1/2 bg-surface px-1 text-[0.8rem] tabular-nums text-label-3"
                      style={{ top: topFranjaHorariaPx(h, alturasFranjas) }}
                    >
                      {etiquetaHoraGrilla(h)}
                    </div>
                  ))}
                  {mostrarLineaAhora ? (
                    <>
                      <div
                        className="pointer-events-none absolute left-0 right-0 z-[60] h-px bg-accent"
                        style={{ top: lineTopPx }}
                      />
                      <div
                        className="pointer-events-none absolute z-[61] -translate-y-1/2 rounded-full bg-accent px-2 py-0.5 text-[0.8rem] font-semibold tabular-nums text-on-accent"
                        style={{ top: lineTopPx, left: 6 }}
                      >
                        {ahoraHHmm}
                      </div>
                    </>
                  ) : null}
                </div>

                {fechasMostradas.map((fecha) => {
                  const itemsDia = itemsPlanPorFecha(plan, fecha);
                  const layoutDia = layoutsPorFecha.get(fecha)!;
                  const esHoy = fecha === formatFechaLocalYYYYMMDD(new Date());
                  return (
                    <div
                      key={fecha}
                      data-hoy={esHoy ? "true" : undefined}
                      className={cx(
                        "relative snap-start border-l",
                        esHoy
                          ? "border-accent/40 bg-accent/[0.04]"
                          : "border-separator",
                      )}
                      style={{
                        width: GRILLA_ANCHO_DIA_MIN_PX,
                        height: alturaGrillaSemana,
                      }}
                      onDragOver={onDragOverDia}
                      onDrop={(e) => {
                        void onDropEnDia(fecha, e);
                      }}
                    >
                      {[1, 2].map((carril) => (
                        <div
                          key={carril}
                          className="pointer-events-none absolute inset-y-0 border-r border-separator/50"
                          style={{ left: `${carril * anchoCarrilPct}%` }}
                        />
                      ))}
                      {horas.map((h) => (
                        <div
                          key={h}
                          className="pointer-events-none absolute inset-x-0 z-[3] border-t border-separator"
                          style={{ top: topFranjaHorariaPx(h, alturasFranjas) }}
                        />
                      ))}
                      {mostrarLineaAhora ? (
                        <div
                          className="pointer-events-none absolute left-0 right-0 z-[40] h-px bg-accent/70"
                          style={{ top: lineTopPx }}
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={(e) => onClickGrillaDia(fecha, e)}
                        onDragOver={onDragOverDia}
                        onDrop={(e) => {
                          void onDropEnDia(fecha, e);
                        }}
                        className={cx(
                          "absolute inset-x-0 top-0 z-[4] bg-transparent transition-colors hover:bg-fill/50",
                          clipboard ? "cursor-copy" : "cursor-cell",
                        )}
                        style={{ height: alturaGrillaSemana }}
                        aria-label={
                          clipboard
                            ? `Pegar ${clipboard.preparacionNombre} el ${fecha}`
                            : `Agregar preparación el ${fecha}`
                        }
                      />

                      {itemsDia.map((item) => {
                        const conflicto = itemTieneConflicto(item, plan);
                        const completada = item.estado === "completada";
                        const prepBloque = item.preparacionId
                          ? preparaciones.find(
                              (p) => p.id === item.preparacionId,
                            )
                          : undefined;
                        const recetaVisible = puedeVerRecetaDeBloque({
                          viewer: usuario,
                          prep: prepBloque ?? null,
                          asignadoAId: item.asignadoAId,
                        });
                        const recetaConectada = Boolean(
                          prepBloque &&
                          preparacionEstaConectada(prepBloque) &&
                          recetaVisible,
                        );
                        const layout = layoutDia.items.get(item.id) ?? {
                          indice: 0,
                          topPx: topItemGrillaPx(item),
                          heightPx: alturaItemGrillaPx(item),
                        };
                        const izqPct = layout.indice * anchoCarrilPct;
                        const color = colorPersonaBloque(
                          layout.indice,
                          completada,
                        );
                        return (
                          <div
                            key={item.id}
                            className={cx(
                              "absolute cursor-pointer overflow-y-auto rounded-control border-l-[3px] bg-surface-3 text-label shadow-[0_1px_3px_rgb(0_0_0/0.18)]",
                              color.borde,
                              conflicto && "ring-2 ring-danger",
                              completada && "opacity-80",
                            )}
                            draggable={!isBusy}
                            onDragStart={(e) => onDragStartItem(e, item.id)}
                            onDragEnd={onDragEndItem}
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirModalEdicion(item);
                            }}
                            style={{
                              top: layout.topPx,
                              height: layout.heightPx,
                              left: `calc(${izqPct}% + 4px)`,
                              width: `calc(${anchoCarrilPct}% - 8px)`,
                              zIndex:
                                10 +
                                layout.indice +
                                (draggingItemId === item.id ? 100 : 0),
                              opacity:
                                draggingItemId === item.id ? 0.65 : undefined,
                            }}
                          >
                            <div
                              className={cx(
                                "flex min-h-full flex-col gap-0.5 px-2 py-1.5",
                                color.tinte,
                              )}
                            >
                              <p
                                className={cx(
                                  "flex items-start gap-1 break-words text-[0.9rem] font-semibold leading-snug",
                                  completada && "line-through",
                                )}
                              >
                                {prepBloque && recetaVisible ? (
                                  recetaConectada ? (
                                    <BookOpen
                                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-label-2"
                                      aria-label="Tiene receta"
                                    />
                                  ) : (
                                    <AlertTriangle
                                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning"
                                      aria-label="Sin receta"
                                    />
                                  )
                                ) : null}
                                <span>{item.preparacionNombre}</span>
                              </p>
                              <p className="break-words text-[0.8rem] leading-snug text-label-2">
                                {item.asignadoANombre ?? "Sin asignar"}
                                {item.cantidadPlanificada && item.unidadCantidad
                                  ? ` · ${item.cantidadPlanificada} ${item.unidadCantidad}`
                                  : ""}
                              </p>
                              <p className="text-[0.8rem] leading-snug text-label-2">
                                <span className="tabular-nums">
                                  {etiquetaHorarioItem(item)}
                                </span>
                                {" · "}
                                {ETIQUETA_PLAN_CATEGORIA[item.categoria]}
                                {categoriaPlanEsServicio(item.categoria)
                                  ? " · auto"
                                  : ""}
                              </p>
                              <div className="mt-auto flex gap-1 pt-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copiarItem(item);
                                  }}
                                  disabled={isBusy}
                                  className={botonBloque}
                                  aria-label="Copiar bloque"
                                  title="Copiar bloque"
                                >
                                  <Copy className="h-4 w-4" aria-hidden />
                                </button>
                                {categoriaPlanEsManual(item.categoria) ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void toggleCompletada(item);
                                    }}
                                    disabled={isBusy}
                                    className={cx(
                                      botonBloque,
                                      completada && "text-success",
                                    )}
                                    aria-label={
                                      completada
                                        ? "Marcar pendiente"
                                        : "Marcar hecha"
                                    }
                                    title={
                                      completada ? "Marcar pendiente" : "Hecha"
                                    }
                                  >
                                    <Check className="h-4 w-4" aria-hidden />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void borrar(item.id);
                                  }}
                                  disabled={isBusy}
                                  className={botonBloque}
                                  aria-label="Quitar del plan"
                                  title="Quitar del plan"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden />
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
      </Seccion>

      <Hoja
        abierta={modal !== null}
        onCerrar={cerrarModal}
        titulo={itemEditando ? "Editar preparación" : "Planificar preparación"}
      >
        {modal ? (
          <div className="space-y-4 pt-1">
            {error ? (
              <div
                role="alert"
                className="flex gap-3 rounded-card bg-danger-soft px-4 py-3 text-[0.94rem] text-danger"
              >
                <CircleAlert
                  className="mt-0.5 h-[18px] w-[18px] shrink-0"
                  aria-hidden
                />
                <p className="min-w-0 flex-1">{error}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Selector
                label="Preparación"
                titulo="Elegí la preparación"
                opciones={opcionesPreparacion}
                valor={prepId || null}
                onChange={onElegirPrep}
                buscar={opcionesPreparacion.length > 10}
              />
              {prepSeleccionada ? (
                <div className="space-y-1 px-1 text-[0.84rem] leading-snug text-label-3">
                  <p>
                    {estimacionEscalada && parseCantidadInput(cantidad) ? (
                      <>
                        Duración escalada:{" "}
                        <span className="text-info">
                          {formatearDuracionLegible(
                            estimarDuracionSegundosPorCantidad(
                              prepSeleccionada.id,
                              parseCantidadInput(cantidad),
                              unidadCantidad,
                              resumenes,
                            ).segundos,
                          )}{" "}
                          para {cantidad} {unidadCantidad}
                        </span>
                      </>
                    ) : (
                      <>
                        Sin historial con cantidad — mediana fija:{" "}
                        <span className="text-label-2">
                          {formatearDuracionLegible(
                            estimarDuracionSegundos(
                              prepSeleccionada.id,
                              resumenes,
                            ),
                          )}
                        </span>
                      </>
                    )}
                  </p>
                  <p>
                    Categoría en plan:{" "}
                    <span className="text-label-2">
                      {ETIQUETA_PLAN_CATEGORIA[prepSeleccionada.categoriaPlan]}
                    </span>
                    {categoriaPlanEsServicio(prepSeleccionada.categoriaPlan)
                      ? " (se completa sola)"
                      : " (marcar hecha manual)"}
                    . Cambiala en{" "}
                    <Link
                      href="/produccion-tiempos"
                      className="font-medium text-accent underline"
                    >
                      Tiempos prep
                    </Link>
                    .
                  </p>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              {usuario?.role === "staff" ? (
                <div className="min-w-0">
                  <p className="mb-1.5 block pl-1 text-[0.82rem] font-medium text-label-2">
                    Quién la hace
                  </p>
                  <div className="flex min-h-12 items-center justify-between gap-2 rounded-control bg-fill px-3.5 text-[1rem] text-label-2">
                    <span className="truncate">
                      {equipo.find((m) => m.id === asignadoId)?.name ??
                        "Sin asignar"}
                    </span>
                    <Lock
                      className="h-4 w-4 shrink-0 text-label-3"
                      aria-hidden
                    />
                  </div>
                </div>
              ) : (
                <Selector
                  label="Quién la hace"
                  opciones={opcionesEquipo}
                  valor={asignadoId || null}
                  onChange={onCambioAsignado}
                />
              )}
              {horarioSugeridoActivo ? (
                <p className="px-1 text-[0.84rem] text-info">
                  Siguiente hueco libre para esta persona:{" "}
                  <span className="tabular-nums">{horaInicio}</span>
                </p>
              ) : null}
            </div>

            <Fecha
              label="Fecha"
              valor={modal.fecha}
              onChange={(iso) =>
                setModal((prev) => (prev ? { ...prev, fecha: iso } : prev))
              }
            />

            <div className="grid grid-cols-2 gap-3">
              <Campo
                label="Inicio"
                type="time"
                value={horaInicio}
                onChange={(e) => onCambioHoraInicio(e.target.value)}
                className="tabular-nums"
              />
              <Campo
                label="Fin"
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
                className="tabular-nums"
              />
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
              <Campo
                label="Cantidad"
                type="text"
                inputMode="decimal"
                value={cantidad}
                onChange={(e) => onCambioCantidad(e.target.value)}
                className="tabular-nums"
              />
              <Selector
                label="Unidad"
                opciones={UNIDADES_CANTIDAD.map((u) => ({
                  valor: u,
                  label: u,
                }))}
                valor={unidadCantidad}
                onChange={onCambioUnidad}
              />
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-1.5 pl-1 text-[0.82rem] font-medium text-label-2">
                  Repetir
                </p>
                <Segmentado
                  etiqueta="Repetir"
                  valor={recurrenciaModo}
                  onChange={setRecurrenciaModo}
                  opciones={[
                    { valor: "none", label: "No" },
                    { valor: "daily", label: "Cada día" },
                    { valor: "weekly", label: "Cada semana" },
                  ]}
                />
              </div>
              {recurrenciaModo !== "none" ? (
                <Fecha
                  label="Repetir hasta"
                  valor={recurrenciaHasta}
                  onChange={setRecurrenciaHasta}
                  min={modal.fecha}
                />
              ) : null}
            </div>

            <Campo
              label="Notas"
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />

            {itemEditando ? (
              <div className="flex flex-wrap gap-2">
                <Boton
                  variante="secundario"
                  icono={<Copy className="h-[18px] w-[18px]" aria-hidden />}
                  disabled={isBusy}
                  onClick={() => {
                    cerrarModal();
                    copiarItem(itemEditando);
                  }}
                >
                  Copiar
                </Boton>
                {categoriaPlanEsManual(itemEditando.categoria) ? (
                  <Boton
                    variante="secundario"
                    icono={
                      itemEditando.estado === "completada" ? (
                        <Undo2 className="h-[18px] w-[18px]" aria-hidden />
                      ) : (
                        <Check className="h-[18px] w-[18px]" aria-hidden />
                      )
                    }
                    disabled={isBusy}
                    onClick={() => {
                      cerrarModal();
                      void toggleCompletada(itemEditando);
                    }}
                  >
                    {itemEditando.estado === "completada"
                      ? "Marcar pendiente"
                      : "Marcar hecha"}
                  </Boton>
                ) : null}
                <Boton
                  variante="peligro"
                  icono={<Trash2 className="h-[18px] w-[18px]" aria-hidden />}
                  disabled={isBusy}
                  onClick={() => {
                    cerrarModal();
                    void borrar(itemEditando.id);
                  }}
                >
                  Quitar
                </Boton>
              </div>
            ) : null}

            {prepSeleccionada ? (
              <PreparacionRecetaPanel
                preparacion={prepSeleccionada}
                onCambio={onCambioVinculoPrep}
                viewer={usuario}
                puedeVer={puedeVerRecetaModal}
              />
            ) : null}

            <div className="sticky bottom-0 z-10 -mx-4 grid grid-cols-[auto_minmax(0,1fr)] gap-2 border-t border-separator bg-surface-2 px-4 pt-3">
              <Boton variante="secundario" onClick={cerrarModal}>
                Cancelar
              </Boton>
              <Boton
                cargando={isBusy}
                icono={
                  itemEditando ? (
                    <Check className="h-[18px] w-[18px]" aria-hidden />
                  ) : (
                    <Plus className="h-[18px] w-[18px]" aria-hidden />
                  )
                }
                onClick={() => void guardar()}
              >
                {itemEditando ? "Guardar cambios" : "Agregar"}
              </Boton>
            </div>
          </div>
        ) : null}
      </Hoja>
    </Pantalla>
  );
}
