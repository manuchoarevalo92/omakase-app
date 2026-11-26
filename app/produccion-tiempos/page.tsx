"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CircleAlert,
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
  Boton,
  BotonIcono,
  Campo,
  EstadoVacio,
  EsqueletoLista,
  Etiqueta,
  Fila,
  Hoja,
  Lista,
  Pantalla,
  Seccion,
  Segmentado,
  Selector,
  cx,
  useAvisos,
  type OpcionSelector,
} from "@/app/ui";
import {
  actualizarCategoriaPlanPreparacion,
  AREAS_PRODUCCION,
  cantidadSugeridaAlMarcar,
  CATEGORIAS_PLAN,
  crearPreparacion,
  ETIQUETA_AREA_PRODUCCION,
  ETIQUETA_CATEGORIA_PLAN,
  fetchPreparaciones,
  formatearCantidad,
  ocultarRecetaSiSoloAdmin,
  parseCantidadInput,
  preparacionEstaConectada,
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

const SOMBRA = "shadow-[0_1px_2px_rgb(0_0_0/0.04)]";

const OPCIONES_UNIDAD: OpcionSelector<UnidadCantidad>[] = UNIDADES_CANTIDAD.map(
  (u) => ({ valor: u, label: u }),
);

const OPCIONES_CATEGORIA = CATEGORIAS_PLAN.map((c) => ({
  valor: c,
  label: ETIQUETA_CATEGORIA_PLAN[c],
}));

const OPCIONES_AREA = AREAS_PRODUCCION.map((a) => ({
  valor: a,
  label: ETIQUETA_AREA_PRODUCCION[a],
}));

function SelectorUnidad(props: {
  valor: UnidadCantidad;
  onChange: (u: UnidadCantidad) => void;
}) {
  return (
    <div className="w-[5.75rem] shrink-0">
      <Selector
        titulo="Unidad"
        opciones={OPCIONES_UNIDAD}
        valor={props.valor}
        onChange={props.onChange}
      />
    </div>
  );
}

function AlertaError(props: { texto: string; className?: string }) {
  return (
    <div
      role="alert"
      className={cx(
        "flex gap-3 rounded-card bg-danger-soft px-4 py-3 text-[0.94rem] text-danger",
        props.className,
      )}
    >
      <CircleAlert className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">{props.texto}</p>
    </div>
  );
}

function RelojActivo({ sesion }: { sesion: ProduccionSesion }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (sesion.endedAt) {
      return;
    }
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [
    sesion.endedAt,
    sesion.id,
    sesion.pausadoAt,
    sesion.pausaTotalSegundos,
    sesion.startedAt,
  ]);

  const segundos = segundosTranscurridosSesion(sesion);
  void tick;

  return (
    <span className="font-mono text-[3.25rem] font-semibold leading-none tabular-nums tracking-tight text-label sm:text-[3.75rem]">
      {formatearDuracionSegundos(segundos)}
    </span>
  );
}

export default function ProduccionTiemposPage() {
  const [preparaciones, setPreparaciones] = useState<Preparacion[]>([]);
  const [sesiones, setSesiones] = useState<ProduccionSesion[]>([]);
  const [activasEquipo, setActivasEquipo] = useState<ProduccionSesion[]>([]);
  const [sesionPropia, setSesionPropia] = useState<ProduccionSesion | null>(
    null,
  );
  const [usuario, setUsuario] = useState<SessionUsuario | null>(null);
  const [prepSeleccionadaId, setPrepSeleccionadaId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { aviso, confirmar } = useAvisos();
  /** Mensajes de éxito como aviso efímero (antes, recuadro verde fijo). */
  const avisar = (mensaje: string) => aviso(mensaje, { tono: "exito" });
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
  const [categoriaPlanBusyId, setCategoriaPlanBusyId] = useState<string | null>(
    null,
  );
  const [categoriaDraft, setCategoriaDraft] = useState<
    Record<string, CategoriaPlan>
  >({});
  const idCantidadCierre = useId();

  /** Estable: la Hoja vuelve a enfocar su panel si cambia `onCerrar`. */
  const cerrarModalCierre = useCallback(() => setModalCierre(false), []);

  const prepSeleccionada = useMemo(
    () => preparaciones.find((p) => p.id === prepSeleccionadaId) ?? null,
    [preparaciones, prepSeleccionadaId],
  );

  const opcionesPrep = useMemo<OpcionSelector<string>[]>(
    () =>
      preparaciones.map((p) => ({
        valor: p.id,
        label: p.nombre,
        detalle: ETIQUETA_AREA_PRODUCCION[p.area],
      })),
    [preparaciones],
  );

  const resumenes = useMemo(
    () => calcularResumenesPorPreparacion(sesiones),
    [sesiones],
  );

  const sesionesFiltradas = useMemo(() => {
    if (!filtroPrep) {
      return sesiones;
    }
    return sesiones.filter((s) => s.preparacionId === filtroPrep);
  }, [sesiones, filtroPrep]);

  const otrasActivas = useMemo(
    () => activasEquipo.filter((s) => s.id !== sesionPropia?.id),
    [activasEquipo, sesionPropia],
  );

  const preparacionesSinCategoria = useMemo(
    () => preparaciones.filter((p) => !p.categoriaPlanConfirmada),
    [preparaciones],
  );

  const preparacionesParaReceta = useMemo(
    () =>
      [...preparaciones].sort((a, b) => {
        const aOk = preparacionEstaConectada(a) ? 1 : 0;
        const bOk = preparacionEstaConectada(b) ? 1 : 0;
        if (aOk !== bOk) {
          return aOk - bOk;
        }
        return a.nombre.localeCompare(b.nombre, "es");
      }),
    [preparaciones],
  );

  const categoriaDraftPara = (prep: Preparacion): CategoriaPlan =>
    categoriaDraft[prep.id] ?? prep.categoriaPlan;

  const refrescar = useCallback(
    async (usuarioActual: SessionUsuario | null) => {
      const esAdmin = usuarioActual?.role === "admin";
      const [preps, lista, activas] = await Promise.all([
        fetchPreparaciones(),
        fetchProduccionSesionesRecientes(),
        fetchSesionesActivasEquipo(),
      ]);
      setPreparaciones(esAdmin ? preps : preps.map(ocultarRecetaSiSoloAdmin));
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
    },
    [],
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
        await refrescar(u);
      } catch (err) {
        if (!cancelled) {
          setError(
            err && typeof err === "object" && "message" in err
              ? formatPostgrestError(
                  err as Parameters<typeof formatPostgrestError>[0],
                )
              : "No se pudieron cargar los datos.",
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

  // Sin preparaciones cargadas, el alta se muestra abierta.
  const altaPrepVisible =
    altaPrepExpandida || (!isLoading && preparaciones.length === 0);

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
    try {
      const prep = await crearPreparacion({
        nombre,
        area: nuevaArea,
        cantidadReferencia: cantidadRef,
        unidadCantidad: nuevaUnidad,
      });
      setPreparaciones((prev) =>
        [...prev, prep].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );
      setPrepSeleccionadaId(prep.id);
      setManualUnidad(prep.unidadCantidad);
      setNuevaNombre("");
      setNuevaCantidadRef("1");
      setNuevaUnidad("L");
      setAltaPrepExpandida(false);
      avisar(`"${prep.nombre}" agregada. Ya aparece en Recetas y procesos.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear la preparación.",
      );
    } finally {
      setIsCreandoPrep(false);
    }
  };

  const confirmarCategoriaPlan = async (prep: Preparacion) => {
    const categoriaPlan = categoriaDraftPara(prep);
    setCategoriaPlanBusyId(prep.id);
    setError(null);
    try {
      const { preparacion, planItemsActualizados } =
        await actualizarCategoriaPlanPreparacion(prep.id, categoriaPlan);
      setPreparaciones((prev) =>
        prev.map((p) => (p.id === preparacion.id ? preparacion : p)),
      );
      setCategoriaDraft((prev) => {
        const next = { ...prev };
        delete next[prep.id];
        return next;
      });
      avisar(
        `"${preparacion.nombre}" → ${ETIQUETA_CATEGORIA_PLAN[categoriaPlan]}.` +
          (planItemsActualizados > 0
            ? ` Actualizados ${planItemsActualizados} bloque${planItemsActualizados === 1 ? "" : "s"} en el plan semanal.`
            : ""),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo confirmar la categoría.",
      );
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
    try {
      const sesion = await iniciarProduccionSesion(prepSeleccionada, usuario);
      setSesionPropia(sesion);
      setActivasEquipo((prev) => [
        sesion,
        ...prev.filter((s) => s.id !== sesion.id),
      ]);
      avisar(`Cronómetro iniciado: ${prepSeleccionada.nombre}.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo iniciar el cronómetro.",
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
        prev.map((s) => (s.id === actualizada.id ? actualizada : s)),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo pausar/reanudar.",
      );
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
      setError(
        "Ingresá la cantidad producida para calcular tiempos por unidad.",
      );
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
      setSesiones((prev) => [
        completada,
        ...prev.filter((s) => s.id !== completada.id),
      ]);
      setActivasEquipo((prev) => prev.filter((s) => s.id !== completada.id));
      avisar(
        `${completada.preparacionNombre} guardada · ${formatearDuracionLegible(completada.duracionSegundos ?? 0)}`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar el cierre.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const cancelar = async () => {
    if (!sesionPropia) {
      return;
    }
    const ok = await confirmar({
      titulo: "¿Descartar este cronómetro sin guardar?",
      confirmar: "Descartar",
      peligro: true,
    });
    if (!ok) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await cancelarProduccionSesion(sesionPropia.id);
      setSesionPropia(null);
      setActivasEquipo((prev) => prev.filter((s) => s.id !== sesionPropia.id));
      avisar("Cronómetro descartado.");
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
      avisar(`Tiempo manual guardado: ${prepSeleccionada.nombre}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setIsBusy(false);
    }
  };

  const borrarSesion = async (id: string) => {
    const ok = await confirmar({
      titulo: "¿Borrar este registro de tiempo?",
      confirmar: "Borrar",
      peligro: true,
    });
    if (!ok) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await eliminarProduccionSesion(id);
      setSesiones((prev) => prev.filter((s) => s.id !== id));
      avisar("Registro eliminado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar.");
    } finally {
      setIsBusy(false);
    }
  };

  const pausada = sesionPropia ? sesionEstaPausada(sesionPropia) : false;

  const referenciaSeleccionada = prepSeleccionada
    ? `Referencia: ${formatearCantidad(prepSeleccionada.cantidadReferencia, prepSeleccionada.unidadCantidad)}` +
      (prepSeleccionada.ultimaCantidad
        ? ` · última: ${formatearCantidad(prepSeleccionada.ultimaCantidad, prepSeleccionada.unidadCantidad)}`
        : "")
    : undefined;

  return (
    <Pantalla
      titulo="Tiempos de producción"
      subtitulo={
        isLoading
          ? "Cargando…"
          : sesionPropia
            ? pausada
              ? "Tu cronómetro está en pausa"
              : "Tu cronómetro está en curso"
            : otrasActivas.length > 0
              ? `${otrasActivas.length} en curso en el equipo`
              : `${sesiones.length} registros recientes`
      }
      acciones={
        <Link
          href="/produccion-plan"
          aria-label="Plan semanal"
          title="Plan semanal"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-label-2 transition hover:bg-fill active:scale-95"
        >
          <CalendarDays className="h-[22px] w-[22px]" aria-hidden />
        </Link>
      }
      ayuda={
        <>
          <p>
            Cronometrá preparaciones para planificar la semana en el{" "}
            <Link href="/produccion-plan" className="text-accent underline">
              Plan semanal
            </Link>
            .
          </p>
          <p>
            Elegí la preparación y tocá{" "}
            <strong className="text-label">Iniciar cronómetro</strong>. Al
            terminar, confirmá la cantidad producida: sirve para escalar tiempos
            en el plan (ej. 5 kg en 1 h → 10 kg en 2 h).
          </p>
          <p>
            Si no cronometraste, usá{" "}
            <strong className="text-label">Cargar tiempo a mano</strong>.
          </p>
          <p>
            <strong className="text-label">Categoría en plan semanal</strong>:
            elegí Produ o Servicio y confirmá. Una vez asignada, la preparación
            sale de esa lista.
          </p>
          {usuario?.role === "admin" ? (
            <p>
              Las preparaciones nuevas aparecen en{" "}
              <Link href="/receta" className="text-accent underline">
                Recetas y procesos
              </Link>{" "}
              junto con los platos de carta. La receta o el proceso se carga
              ahí.
            </p>
          ) : null}
        </>
      }
    >
      {error ? <AlertaError texto={error} className="mb-4" /> : null}

      {isLoading ? (
        <EsqueletoLista filas={6} />
      ) : sesionPropia ? (
        <div
          className={cx(
            "rounded-card bg-surface-3 px-4 pb-4 pt-5 text-center",
            SOMBRA,
          )}
        >
          <Etiqueta tono={pausada ? "alerta" : "exito"}>
            {pausada ? "Pausado" : "En curso"}
          </Etiqueta>
          <p className="mt-3 text-[1.25rem] font-semibold leading-snug text-label">
            {sesionPropia.preparacionNombre}
          </p>
          <p className="mt-0.5 text-[0.9rem] text-label-3">
            {etiquetaAreaSesion(sesionPropia.area)}
            {sesionPropia.hechoPorNombre
              ? ` · ${sesionPropia.hechoPorNombre}`
              : ""}
          </p>
          <div className="my-5">
            <RelojActivo sesion={sesionPropia} />
          </div>
          <Boton
            ancho
            tamano="grande"
            disabled={isBusy}
            icono={<Square className="h-[18px] w-[18px]" aria-hidden />}
            onClick={pedirCierre}
          >
            Terminar
          </Boton>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Boton
              variante="secundario"
              tamano="grande"
              disabled={isBusy}
              icono={
                pausada ? (
                  <Play className="h-[18px] w-[18px]" aria-hidden />
                ) : (
                  <Pause className="h-[18px] w-[18px]" aria-hidden />
                )
              }
              onClick={() => void togglePausa()}
            >
              {pausada ? "Reanudar" : "Pausar"}
            </Boton>
            <Boton
              variante="peligro"
              tamano="grande"
              disabled={isBusy}
              icono={<X className="h-[18px] w-[18px]" aria-hidden />}
              onClick={() => void cancelar()}
            >
              Descartar
            </Boton>
          </div>
        </div>
      ) : (
        <>
          <div
            className={cx("space-y-3 rounded-card bg-surface-3 p-4", SOMBRA)}
          >
            <Selector
              label="Preparación"
              titulo="Preparación"
              opciones={opcionesPrep}
              valor={prepSeleccionadaId || null}
              onChange={setPrepSeleccionadaId}
              placeholder="Elegir preparación…"
              ayuda={referenciaSeleccionada}
            />
            <Boton
              ancho
              tamano="grande"
              cargando={isBusy}
              disabled={!prepSeleccionada}
              icono={<Timer className="h-[18px] w-[18px]" aria-hidden />}
              onClick={() => void iniciar()}
            >
              Iniciar cronómetro
            </Boton>
          </div>

          {altaPrepVisible ? (
            <Seccion
              titulo="Nueva preparación"
              accion={
                preparaciones.length > 0 ? (
                  <Boton
                    variante="terciario"
                    onClick={() => setAltaPrepExpandida(false)}
                  >
                    Cancelar
                  </Boton>
                ) : null
              }
            >
              <div
                className={cx(
                  "space-y-3 rounded-card bg-surface-3 p-4",
                  SOMBRA,
                )}
              >
                <Campo
                  label="Nombre"
                  value={nuevaNombre}
                  onChange={(e) => setNuevaNombre(e.target.value)}
                  placeholder="Tosazu, Nikiri…"
                />
                <div>
                  <p className="mb-1.5 pl-1 text-[0.82rem] font-medium text-label-2">
                    Área
                  </p>
                  <Segmentado
                    etiqueta="Área"
                    opciones={OPCIONES_AREA}
                    valor={nuevaArea}
                    onChange={setNuevaArea}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Campo
                      label="Lote típico"
                      inputMode="decimal"
                      value={nuevaCantidadRef}
                      onChange={(e) => setNuevaCantidadRef(e.target.value)}
                      className="tabular-nums"
                    />
                  </div>
                  <SelectorUnidad
                    valor={nuevaUnidad}
                    onChange={setNuevaUnidad}
                  />
                </div>
                <Boton
                  variante="secundario"
                  ancho
                  cargando={isCreandoPrep}
                  disabled={!nuevaNombre.trim()}
                  icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
                  onClick={() => void crearPrep()}
                >
                  Agregar y seleccionar
                </Boton>
              </div>
            </Seccion>
          ) : (
            <Boton
              variante="terciario"
              ancho
              className="mt-2"
              icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
              onClick={() => setAltaPrepExpandida(true)}
            >
              Agregar preparación nueva
            </Boton>
          )}
        </>
      )}

      {otrasActivas.length > 0 ? (
        <Seccion titulo="En curso ahora">
          <ul
            className={cx("overflow-hidden rounded-card bg-surface-3", SOMBRA)}
          >
            {otrasActivas.map((s) => (
              <li
                key={s.id}
                className="flex min-h-14 items-center gap-3 border-b border-separator px-4 py-2 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[1rem] leading-snug text-label">
                    {s.preparacionNombre}
                  </p>
                  <p className="truncate text-[0.84rem] text-label-3">
                    {s.hechoPorNombre ?? "Alguien"} ·{" "}
                    {sesionEstaPausada(s) ? "pausado" : "corriendo"}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[0.98rem] tabular-nums text-label-2">
                  {formatearDuracionSegundos(segundosTranscurridosSesion(s))}
                </span>
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}

      {!isLoading ? (
        <div className="mt-4">
          <Boton
            variante="terciario"
            aria-expanded={mostrarManual}
            icono={<PenLine className="h-[18px] w-[18px]" aria-hidden />}
            onClick={() => setMostrarManual((v) => !v)}
          >
            {mostrarManual ? "Ocultar carga manual" : "Cargar tiempo a mano"}
          </Boton>
          {mostrarManual ? (
            <div
              className={cx(
                "mt-2 space-y-3 rounded-card bg-surface-3 p-4",
                SOMBRA,
              )}
            >
              <Selector
                label="Preparación"
                titulo="Preparación"
                opciones={opcionesPrep}
                valor={prepSeleccionadaId || null}
                onChange={(id) => {
                  setPrepSeleccionadaId(id);
                  const p = preparaciones.find((x) => x.id === id);
                  if (p) {
                    setManualUnidad(p.unidadCantidad);
                  }
                }}
                placeholder="Elegir…"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo
                  label="Duración (minutos)"
                  inputMode="decimal"
                  value={manualDuracion}
                  onChange={(e) => setManualDuracion(e.target.value)}
                  placeholder="90"
                  className="tabular-nums"
                />
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Campo
                      label="Cantidad producida"
                      inputMode="decimal"
                      value={manualCantidad}
                      onChange={(e) => setManualCantidad(e.target.value)}
                      placeholder={
                        prepSeleccionada
                          ? String(prepSeleccionada.cantidadReferencia)
                          : ""
                      }
                      className="tabular-nums"
                    />
                  </div>
                  <SelectorUnidad
                    valor={manualUnidad}
                    onChange={setManualUnidad}
                  />
                </div>
              </div>
              <Campo
                label="Notas"
                value={manualNotas}
                onChange={(e) => setManualNotas(e.target.value)}
              />
              <Boton
                ancho
                tamano="grande"
                variante="secundario"
                disabled={isBusy}
                icono={<Check className="h-[18px] w-[18px]" aria-hidden />}
                onClick={() => void guardarManual()}
              >
                Guardar tiempo manual
              </Boton>
            </div>
          ) : null}
        </div>
      ) : null}

      {preparaciones.length > 0 ? (
        <Seccion
          titulo="Categoría en plan semanal"
          pie={
            preparacionesSinCategoria.length > 0
              ? "Produ = marcar hecha a mano. Servicio = se completa sola al pasar el horario."
              : undefined
          }
        >
          {preparacionesSinCategoria.length === 0 ? (
            <p
              className={cx(
                "rounded-card bg-surface-3 px-4 py-3 text-[0.94rem] text-label-2",
                SOMBRA,
              )}
            >
              Todas las preparaciones ya tienen categoría asignada.
            </p>
          ) : (
            <ul
              className={cx(
                "overflow-hidden rounded-card bg-surface-3",
                SOMBRA,
              )}
            >
              {preparacionesSinCategoria.map((p) => {
                const busy = categoriaPlanBusyId === p.id;
                return (
                  <li
                    key={p.id}
                    className="border-b border-separator px-4 py-3 last:border-0"
                  >
                    <p className="text-[1rem] leading-snug text-label">
                      <span className="font-medium">{p.nombre}</span>
                      <span className="ml-2 text-[0.84rem] text-label-3">
                        {ETIQUETA_AREA_PRODUCCION[p.area]}
                      </span>
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <Segmentado
                          etiqueta={`Categoría de ${p.nombre}`}
                          opciones={OPCIONES_CATEGORIA}
                          valor={categoriaDraftPara(p)}
                          onChange={(v) => {
                            if (busy) {
                              return;
                            }
                            setCategoriaDraft((prev) => ({
                              ...prev,
                              [p.id]: v,
                            }));
                          }}
                        />
                      </div>
                      <Boton
                        variante="secundario"
                        cargando={busy}
                        onClick={() => {
                          void confirmarCategoriaPlan(p);
                        }}
                      >
                        Confirmar
                      </Boton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Seccion>
      ) : null}

      {usuario?.role === "admin" && preparaciones.length > 0 ? (
        <Seccion
          titulo="Recetas de preparaciones"
          pie="La receta o el proceso se carga en Recetas y procesos."
        >
          <Lista>
            {preparacionesParaReceta.map((p) => {
              const conectada = preparacionEstaConectada(p);
              return (
                <Fila
                  key={p.id}
                  href={`/receta?prep=${p.id}`}
                  titulo={p.nombre}
                  detalle={
                    <>
                      {ETIQUETA_AREA_PRODUCCION[p.area]}
                      {p.recetaSoloAdmin ? (
                        <span className="text-warning"> · solo Manu</span>
                      ) : null}
                    </>
                  }
                  valor={
                    <Etiqueta tono={conectada ? "exito" : "alerta"}>
                      {conectada
                        ? p.proceso &&
                          p.recetaIngredientes.some((i) => i.nombre.trim())
                          ? "Receta y proceso"
                          : p.proceso
                            ? "Proceso"
                            : "Receta"
                        : "Sin receta"}
                    </Etiqueta>
                  }
                />
              );
            })}
          </Lista>
        </Seccion>
      ) : null}

      {resumenes.length > 0 ? (
        <Seccion titulo="Tiempos de referencia">
          <ul
            className={cx("overflow-hidden rounded-card bg-surface-3", SOMBRA)}
          >
            {resumenes.map((r) => {
              const ritmo = etiquetaRitmoProduccion(r);
              const rango =
                r.duracionMinSegundos != null && r.duracionMaxSegundos != null
                  ? `${formatearDuracionLegible(r.duracionMinSegundos)} – ${formatearDuracionLegible(r.duracionMaxSegundos)}`
                  : null;
              return (
                <li
                  key={r.preparacionId ?? r.preparacionNombre}
                  className="flex min-h-14 items-center gap-3 border-b border-separator px-4 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[1rem] leading-snug text-label">
                      <span className="font-medium">{r.preparacionNombre}</span>
                      <span className="ml-2 text-[0.84rem] text-label-3">
                        {ETIQUETA_AREA_PRODUCCION[r.area]}
                      </span>
                    </p>
                    {ritmo ? (
                      <p className="mt-0.5 text-[0.86rem] text-info">
                        {ritmo}
                        {r.sesionesConCantidad > 0 ? (
                          <span className="text-label-3">
                            {" "}
                            · {r.sesionesConCantidad} con cantidad
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-[0.84rem] text-label-3">
                      {rango ? `Rango ${rango} · ` : ""}
                      {r.totalSesiones} registro
                      {r.totalSesiones === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-[1.02rem] font-semibold tabular-nums text-label">
                      {r.duracionMedianaSegundos != null
                        ? formatearDuracionLegible(r.duracionMedianaSegundos)
                        : "—"}
                    </p>
                    <p className="text-[0.8rem] text-label-3">mediana</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Seccion>
      ) : null}

      {!isLoading ? (
        <Seccion titulo="Historial reciente">
          {preparaciones.length > 0 ? (
            <div className="mb-3">
              <Selector
                titulo="Filtrar por preparación"
                opciones={opcionesPrep}
                valor={filtroPrep}
                onChange={setFiltroPrep}
                placeholder="Todas las preparaciones"
                vaciar={{ valor: "", label: "Todas las preparaciones" }}
              />
            </div>
          ) : null}
          {sesionesFiltradas.length === 0 ? (
            <div className={cx("rounded-card bg-surface-3", SOMBRA)}>
              <EstadoVacio
                icono={<Timer className="h-6 w-6" aria-hidden />}
                titulo="Sin tiempos registrados"
                texto="Iniciá un cronómetro arriba."
              />
            </div>
          ) : (
            <ul
              className={cx(
                "overflow-hidden rounded-card bg-surface-3",
                SOMBRA,
              )}
            >
              {sesionesFiltradas.map((s) => (
                <li
                  key={s.id}
                  className="flex min-h-14 items-center gap-2 border-b border-separator py-2.5 pl-4 pr-1.5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[1rem] font-medium leading-snug text-label">
                      {s.preparacionNombre}
                    </p>
                    <p className="mt-0.5 text-[0.84rem] text-label-3">
                      {s.startedAt.slice(0, 10)} · {etiquetaAreaSesion(s.area)}
                      {s.hechoPorNombre ? ` · ${s.hechoPorNombre}` : ""}
                      {s.esManual ? " · manual" : ""}
                    </p>
                    {s.cantidadProducida && s.unidadCantidad ? (
                      <p className="mt-0.5 text-[0.88rem] text-label-2">
                        {formatearCantidad(
                          s.cantidadProducida,
                          s.unidadCantidad,
                        )}
                      </p>
                    ) : null}
                    {s.notas ? (
                      <p className="mt-0.5 text-[0.84rem] text-label-3">
                        {s.notas}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-mono text-[0.98rem] tabular-nums text-success">
                    {s.duracionSegundos != null
                      ? formatearDuracionLegible(s.duracionSegundos)
                      : "en curso"}
                  </span>
                  {s.endedAt ? (
                    <BotonIcono
                      etiqueta="Borrar registro"
                      variante="plano"
                      disabled={isBusy}
                      onClick={() => void borrarSesion(s.id)}
                      className="hover:text-danger"
                      icono={
                        <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                      }
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      ) : null}

      <Hoja
        abierta={modalCierre && sesionPropia !== null}
        onCerrar={cerrarModalCierre}
        titulo="Terminar producción"
      >
        {sesionPropia ? (
          <div className="space-y-4 pb-1">
            <p className="text-[0.97rem] text-label-2">
              {sesionPropia.preparacionNombre}
            </p>
            {error ? <AlertaError texto={error} /> : null}
            <div>
              <label
                htmlFor={idCantidadCierre}
                className="mb-1.5 block pl-1 text-[0.82rem] font-medium text-label-2"
              >
                Cantidad producida
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={idCantidadCierre}
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  value={cantidadCierre}
                  onChange={(e) => setCantidadCierre(e.target.value)}
                  placeholder="ej. 5"
                  className="h-14 min-w-0 flex-1 rounded-control bg-fill px-4 text-right font-mono text-[1.5rem] tabular-nums text-label outline-none ring-accent/60 placeholder:text-label-3 focus:bg-surface-3 focus:ring-2"
                />
                <SelectorUnidad
                  valor={unidadCierre}
                  onChange={setUnidadCierre}
                />
              </div>
              <p className="mt-1.5 pl-1 text-[0.82rem] text-label-3">
                Necesaria para escalar tiempos en el plan (ej. 5 kg en 1 h → 10
                kg en 2 h).
              </p>
            </div>
            <Campo
              label="Notas (opcional)"
              value={notasCierre}
              onChange={(e) => setNotasCierre(e.target.value)}
            />
            <div className="flex flex-col gap-2 pt-1">
              <Boton
                ancho
                tamano="grande"
                cargando={isBusy}
                icono={<Check className="h-[18px] w-[18px]" aria-hidden />}
                onClick={() => void confirmarCierre()}
              >
                Guardar
              </Boton>
              <Boton variante="secundario" ancho onClick={cerrarModalCierre}>
                Cancelar
              </Boton>
            </div>
          </div>
        ) : null}
      </Hoja>
    </Pantalla>
  );
}
