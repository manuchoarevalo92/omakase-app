"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CircleAlert,
  FilePlus,
  History,
  List,
  Pencil,
  RefreshCw,
  Save,
  Scissors,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import { MepCierrePanel } from "@/app/components/mep-cierre-panel";
import {
  Boton,
  EstadoVacio,
  EsqueletoLista,
  Etiqueta,
  Fecha,
  Pantalla,
  Seccion,
  cx,
  useAvisos,
  vibrar,
} from "@/app/ui";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import {
  agruparCortesPorCategoria,
  buscarMepMismoDiaSemana,
  calcularSugerenciasCantidades,
  cantidadesDesdeBorrador,
  cantidadesDesdeLineas,
  deduplicarCargasPorFecha,
  etiquetaCargaMep,
  etiquetaDiaSemana,
  etiquetaUnidadMep,
  enriquecerLineasMep,
  formatearCantidadSugerida,
  fechaBloqueadaPorCierrePendiente,
  fetchMepCargasSinCerrarRecientes,
  fetchMepCortesActivos,
  fetchMepDeliCargaPorFecha,
  fetchMepDeliCargasHistorial,
  fetchUltimoHistorialParaMep,
  fetchSessionMepUsuario,
  guardarBorradorMepDeli,
  guardarMepDeliCarga,
  hayCantidadesCargadas,
  leerBorradorMepDeli,
  limpiarBorradorMepDeli,
  lineasDesdeCantidades,
  MEP_DELI_SERVICIO,
  obtenerMepPendienteCierre,
  tieneCierre,
  type MepCorte,
  type MepDeliCarga,
} from "@/src/lib/mep-deli";

function formatFechaLocalYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function horaLocalHHmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function MepDeliPage() {
  const now = new Date();
  const [cortes, setCortes] = useState<MepCorte[]>([]);
  const [cantidades, setCantidades] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [confirmados, setConfirmados] = useState<Set<string>>(() => new Set());
  const [fechaServicio, setFechaServicio] = useState(() =>
    formatFechaLocalYYYYMMDD(now),
  );
  const [horaServicio, setHoraServicio] = useState(() => horaLocalHHmm(now));
  const [resumenGuardado, setResumenGuardado] = useState<MepDeliCarga | null>(
    null,
  );
  const [editorOculto, setEditorOculto] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { aviso, confirmar } = useAvisos();
  /** Mensajes de éxito como aviso efímero (antes, recuadro verde fijo). */
  const avisar = (mensaje: string) => aviso(mensaje, { tono: "exito" });
  const [historialCargas, setHistorialCargas] = useState<MepDeliCarga[]>([]);
  const [sinCerrar, setSinCerrar] = useState<MepDeliCarga[]>([]);

  const grupos = useMemo(() => agruparCortesPorCategoria(cortes), [cortes]);

  const cortesPorId = useMemo(
    () => new Map(cortes.map((c) => [c.id, c])),
    [cortes],
  );

  const lineasConDatos = useMemo(() => {
    return lineasDesdeCantidades(cantidades)
      .map((l) => {
        const corte = cortesPorId.get(l.corte_id);
        return corte
          ? {
              ...l,
              categoria: corte.categoria,
              nombre: corte.nombre,
              unidad: corte.unidad,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort(
        (a, b) =>
          a.categoria.localeCompare(b.categoria, "es") ||
          a.nombre.localeCompare(b.nombre, "es"),
      );
  }, [cantidades, cortesPorId]);

  const lineasResumen = useMemo(() => {
    if (!resumenGuardado) {
      return [];
    }
    return enriquecerLineasMep(resumenGuardado.lineas, cortesPorId);
  }, [resumenGuardado, cortesPorId]);

  const sugerencias = useMemo(
    () => calcularSugerenciasCantidades(historialCargas, cortes, cantidades),
    [historialCargas, cortes, cantidades],
  );

  const sugerenciasPorId = useMemo(
    () => new Map(sugerencias.map((s) => [s.corte_id, s])),
    [sugerencias],
  );

  const plantillaMismoDia = useMemo(
    () => buscarMepMismoDiaSemana(historialCargas, fechaServicio),
    [historialCargas, fechaServicio],
  );

  const mepPendienteCierre = useMemo(
    () => obtenerMepPendienteCierre(sinCerrar),
    [sinCerrar],
  );

  const etiquetaPlantillaMismoDia = useMemo(() => {
    const dia = etiquetaDiaSemana(fechaServicio);
    return `Cargar último ${dia}`;
  }, [fechaServicio]);

  const persistirBorrador = useCallback(
    (
      cantidadesActuales: Map<string, string>,
      confirmadosActuales: Set<string>,
      hora: string,
      fecha: string,
    ) => {
      if (
        confirmadosActuales.size === 0 &&
        !hayCantidadesCargadas(cantidadesActuales)
      ) {
        limpiarBorradorMepDeli(fecha);
        return;
      }
      guardarBorradorMepDeli({
        fecha,
        hora,
        cantidades: Object.fromEntries(cantidadesActuales),
        confirmados: [...confirmadosActuales],
        updatedAt: new Date().toISOString(),
      });
    },
    [],
  );

  const hidratarDesdeCarga = useCallback(
    (
      carga: MepDeliCarga,
      opts?: { mostrarResumen?: boolean; conservarFecha?: boolean },
    ) => {
      if (!opts?.conservarFecha) {
        setFechaServicio(carga.fecha);
      }
      setHoraServicio(carga.hora?.trim() || horaLocalHHmm(new Date()));
      setCantidades(cantidadesDesdeLineas(carga.lineas));
      if (opts?.mostrarResumen) {
        setResumenGuardado(carga);
        setEditorOculto(true);
        setConfirmados(new Set());
      } else {
        setResumenGuardado(null);
        setEditorOculto(false);
        const ids = new Set(carga.lineas.map((l) => l.corte_id));
        setConfirmados(ids);
      }
      setError(null);
    },
    [],
  );

  const aplicarMepDeFecha = useCallback(
    async (fecha: string, opts?: { conservarHoraSiVacia?: boolean }) => {
      const carga = await fetchMepDeliCargaPorFecha(fecha);
      if (carga) {
        setHoraServicio(carga.hora?.trim() || horaLocalHHmm(new Date()));
        hidratarDesdeCarga(carga, { mostrarResumen: true });
      } else {
        setResumenGuardado(null);
        setEditorOculto(false);
        const borrador = leerBorradorMepDeli(fecha);
        if (borrador) {
          setCantidades(cantidadesDesdeBorrador(borrador));
          setConfirmados(new Set(borrador.confirmados));
          if (borrador.hora?.trim()) {
            setHoraServicio(borrador.hora.trim());
          } else if (!opts?.conservarHoraSiVacia) {
            setHoraServicio(horaLocalHHmm(new Date()));
          }
        } else {
          setCantidades(new Map());
          setConfirmados(new Set());
          if (!opts?.conservarHoraSiVacia) {
            setHoraServicio(horaLocalHHmm(new Date()));
          }
        }
      }
      return carga;
    },
    [hidratarDesdeCarga],
  );

  const cargarDatos = async () => {
    setIsLoading(true);
    setError(null);
    const avisos: string[] = [];

    const registrarFallo = (contexto: string, err: unknown) => {
      if (err && typeof err === "object" && "message" in err) {
        avisos.push(
          `${contexto}: ${formatPostgrestError(
            err as Parameters<typeof formatPostgrestError>[0],
          )}`,
        );
      } else {
        avisos.push(`${contexto}: no se pudo cargar.`);
      }
    };

    let cargaHoy: MepDeliCarga | null = null;

    try {
      setCortes(await fetchMepCortesActivos());
    } catch (err) {
      registrarFallo("Catálogo de cortes", err);
    }

    try {
      setHistorialCargas(await fetchMepDeliCargasHistorial());
    } catch (err) {
      registrarFallo("Historial MEP", err);
    }

    let sinCerrarLista: MepDeliCarga[] = [];
    try {
      sinCerrarLista = await fetchMepCargasSinCerrarRecientes();
      setSinCerrar(sinCerrarLista);
    } catch (err) {
      registrarFallo("MEP sin cerrar", err);
    }

    const pendiente = obtenerMepPendienteCierre(sinCerrarLista);
    const fechaInicial =
      pendiente?.fecha ?? formatFechaLocalYYYYMMDD(new Date());
    setFechaServicio(fechaInicial);

    try {
      cargaHoy = await aplicarMepDeFecha(fechaInicial, {
        conservarHoraSiVacia: true,
      });
    } catch (err) {
      registrarFallo("MEP del día", err);
    }

    if (!cargaHoy && !pendiente) {
      try {
        const historial = await fetchUltimoHistorialParaMep();
        if (historial?.fecha === fechaInicial) {
          setHoraServicio(historial.hora?.trim() || horaLocalHHmm(new Date()));
        }
      } catch (err) {
        registrarFallo("Fecha del servicio", err);
      }
    }

    if (avisos.length) {
      setError(avisos.join(" "));
    }

    setIsLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargarDatos();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const refrescarSiVisible = () => {
      if (document.visibilityState !== "visible" || isLoading) {
        return;
      }
      // No pisar borrador local mientras se edita
      if (!editorOculto) {
        return;
      }
      void aplicarMepDeFecha(fechaServicio, {
        conservarHoraSiVacia: true,
      }).catch(() => {
        // silencioso al volver a la pestaña
      });
    };
    document.addEventListener("visibilitychange", refrescarSiVisible);
    return () =>
      document.removeEventListener("visibilitychange", refrescarSiVisible);
  }, [fechaServicio, isLoading, aplicarMepDeFecha, editorOculto]);

  const onCambioFecha = (fecha: string) => {
    const pendiente = obtenerMepPendienteCierre(sinCerrar);
    if (fechaBloqueadaPorCierrePendiente(fecha, pendiente)) {
      setError(
        `Cerrá primero la MEP del ${etiquetaCargaMep(pendiente!)} antes de abrir otra fecha.`,
      );
      return;
    }
    setFechaServicio(fecha);
    void aplicarMepDeFecha(fecha).catch((err) => {
      setError(
        err && typeof err === "object" && "message" in err
          ? formatPostgrestError(
              err as Parameters<typeof formatPostgrestError>[0],
            )
          : "No se pudo cargar la MEP de ese día.",
      );
    });
  };

  const refrescarMepDelDia = () => {
    void aplicarMepDeFecha(fechaServicio, { conservarHoraSiVacia: true })
      .then((carga) => {
        if (carga) {
          avisar(`MEP del ${fechaServicio} actualizada.`);
        } else {
          avisar(`No hay MEP guardada para el ${fechaServicio}.`);
        }
        setError(null);
      })
      .catch((err) => {
        setError(
          err && typeof err === "object" && "message" in err
            ? formatPostgrestError(
                err as Parameters<typeof formatPostgrestError>[0],
              )
            : "No se pudo refrescar.",
        );
      });
  };

  const actualizarCantidad = (corteId: string, valor: string) => {
    setError(null);
    const nextCantidades = new Map(cantidades);
    if (valor.trim()) {
      nextCantidades.set(corteId, valor);
    } else {
      nextCantidades.delete(corteId);
    }
    setCantidades(nextCantidades);

    let nextConfirmados = confirmados;
    if (confirmados.has(corteId)) {
      nextConfirmados = new Set(confirmados);
      nextConfirmados.delete(corteId);
      setConfirmados(nextConfirmados);
    }
    persistirBorrador(
      nextCantidades,
      nextConfirmados,
      horaServicio,
      fechaServicio,
    );
  };

  const confirmarCorte = (corteId: string) => {
    const cantidad = cantidades.get(corteId)?.trim();
    if (!cantidad) {
      setError("Ingresá una cantidad antes de confirmar.");
      return;
    }
    const nextConfirmados = new Set(confirmados);
    nextConfirmados.add(corteId);
    setConfirmados(nextConfirmados);
    setError(null);
    persistirBorrador(cantidades, nextConfirmados, horaServicio, fechaServicio);
  };

  const desconfirmarCorte = (corteId: string) => {
    const nextConfirmados = new Set(confirmados);
    nextConfirmados.delete(corteId);
    setConfirmados(nextConfirmados);
    setError(null);
    persistirBorrador(cantidades, nextConfirmados, horaServicio, fechaServicio);
  };

  const abrirEditorMep = () => {
    setEditorOculto(false);
    if (resumenGuardado) {
      const ids = new Set(resumenGuardado.lineas.map((l) => l.corte_id));
      setConfirmados(ids);
      persistirBorrador(cantidades, ids, horaServicio, fechaServicio);
    }
  };

  const irAHoy = () => {
    const d = new Date();
    const hoy = formatFechaLocalYYYYMMDD(d);
    const pendiente = obtenerMepPendienteCierre(sinCerrar);
    if (fechaBloqueadaPorCierrePendiente(hoy, pendiente)) {
      setError(
        `Cerrá primero la MEP del ${etiquetaCargaMep(pendiente!)} para habilitar la de hoy.`,
      );
      return;
    }
    setHoraServicio(horaLocalHHmm(d));
    onCambioFecha(hoy);
    avisar("Mostrando la MEP de hoy.");
    setError(null);
  };

  const cargarMismoDiaSemana = async () => {
    if (!plantillaMismoDia) {
      setError(
        `No hay MEP guardada para un ${etiquetaDiaSemana(fechaServicio)} anterior.`,
      );
      return;
    }
    if (hayCantidadesCargadas(cantidades) && !resumenGuardado) {
      const ok = await confirmar({
        titulo: `¿Copiar las cantidades del ${etiquetaCargaMep(plantillaMismoDia)}?`,
        texto: `Reemplazan lo que cargaste para el ${fechaServicio}.`,
        confirmar: "Copiar cantidades",
      });
      if (!ok) {
        return;
      }
    }
    const nuevasCantidades = cantidadesDesdeLineas(plantillaMismoDia.lineas);
    setCantidades(nuevasCantidades);
    setConfirmados(new Set());
    setResumenGuardado(null);
    setEditorOculto(false);
    persistirBorrador(nuevasCantidades, new Set(), horaServicio, fechaServicio);
    avisar(
      `Plantilla del ${etiquetaCargaMep(plantillaMismoDia)} aplicada al ${fechaServicio}.`,
    );
    setError(null);
  };

  const aplicarSugerencias = () => {
    if (!sugerencias.length) {
      setError("No hay sugerencias con historial de cierres suficiente.");
      return;
    }
    const next = new Map(cantidades);
    for (const s of sugerencias) {
      if (s.cantidad_sugerida !== null) {
        next.set(
          s.corte_id,
          formatearCantidadSugerida(s.cantidad_sugerida, s.unidad),
        );
      }
    }
    setCantidades(next);
    setConfirmados(new Set());
    persistirBorrador(next, new Set(), horaServicio, fechaServicio);
    avisar(`Sugerencias aplicadas (${sugerencias.length} ítems).`);
    setError(null);
  };

  const guardarMep = async () => {
    const pendiente = obtenerMepPendienteCierre(sinCerrar);
    if (fechaBloqueadaPorCierrePendiente(fechaServicio, pendiente)) {
      setError(
        `Cerrá primero la MEP del ${etiquetaCargaMep(pendiente!)} antes de guardar otra fecha.`,
      );
      return;
    }

    setIsSaving(true);
    setError(null);

    const lineas = lineasDesdeCantidades(cantidades);
    if (lineas.length === 0) {
      setError("Ingresá al menos una cantidad antes de guardar.");
      setIsSaving(false);
      return;
    }

    let historialId: string | null = null;
    try {
      const historial = await fetchUltimoHistorialParaMep();
      if (
        historial &&
        historial.fecha === fechaServicio &&
        historial.servicio === MEP_DELI_SERVICIO
      ) {
        historialId = historial.id;
      }
    } catch {
      // opcional: seguir sin vincular
    }

    const payload = {
      fecha: fechaServicio,
      hora: horaServicio,
      servicio: MEP_DELI_SERVICIO,
      historial_servicio_id: historialId,
      lineas,
      cargado_por_id: null as string | null,
      cargado_por_nombre: null as string | null,
    };

    const usuario = await fetchSessionMepUsuario();
    if (usuario) {
      payload.cargado_por_id = usuario.id;
      payload.cargado_por_nombre = usuario.name;
    }

    try {
      const guardada = await guardarMepDeliCarga(payload, resumenGuardado?.id);

      setResumenGuardado(guardada);
      setEditorOculto(true);
      setConfirmados(new Set());
      limpiarBorradorMepDeli(fechaServicio);
      setHistorialCargas((prev) => {
        const sinFecha = prev.filter((c) => c.fecha !== guardada.fecha);
        return deduplicarCargasPorFecha([guardada, ...sinFecha]);
      });
      setSinCerrar((prev) =>
        tieneCierre(guardada)
          ? prev.filter((c) => c.id !== guardada.id)
          : [guardada, ...prev.filter((c) => c.id !== guardada.id)],
      );
      avisar(
        `${resumenGuardado ? "MEP actualizada" : "MEP guardada"} para ${fechaServicio} (${horaServicio})${
          guardada.cargado_por_nombre ? ` · ${guardada.cargado_por_nombre}` : ""
        }.`,
      );
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? formatPostgrestError(
              err as Parameters<typeof formatPostgrestError>[0],
            )
          : err instanceof Error
            ? err.message
            : "Error desconocido al guardar.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const onCierreGuardado = async (carga: MepDeliCarga) => {
    setResumenGuardado(carga);
    setCantidades(cantidadesDesdeLineas(carga.lineas));
    const nextSinCerrar = sinCerrar.filter((c) => c.id !== carga.id);
    setSinCerrar(nextSinCerrar);
    setHistorialCargas((prev) =>
      deduplicarCargasPorFecha(
        prev.map((c) => (c.id === carga.id ? carga : c)),
      ),
    );

    const pendiente = obtenerMepPendienteCierre(nextSinCerrar);
    const destino = pendiente?.fecha ?? formatFechaLocalYYYYMMDD(new Date());
    setFechaServicio(destino);
    setError(null);
    try {
      await aplicarMepDeFecha(destino, { conservarHoraSiVacia: true });
      avisar(
        pendiente
          ? `Cierre guardado. Falta cerrar la MEP del ${etiquetaCargaMep(pendiente)}.`
          : "Cierre guardado. Ya podés cargar la MEP de hoy.",
      );
    } catch (err) {
      avisar("Cierre guardado.");
      setError(
        err && typeof err === "object" && "message" in err
          ? formatPostgrestError(
              err as Parameters<typeof formatPostgrestError>[0],
            )
          : "No se pudo cargar la siguiente MEP.",
      );
    }
  };

  const sugerenciasActivas = sugerencias.length;
  const totalConfirmados = confirmados.size;
  const cantidadesCargadas = hayCantidadesCargadas(cantidades);
  const borradorRestaurado = useMemo(
    () => leerBorradorMepDeli(fechaServicio),
    [fechaServicio, totalConfirmados, cantidades],
  );

  const hoyBloqueado = Boolean(
    mepPendienteCierre &&
    fechaBloqueadaPorCierrePendiente(
      formatFechaLocalYYYYMMDD(new Date()),
      mepPendienteCierre,
    ),
  );
  const enVisor = Boolean(resumenGuardado && editorOculto);
  const hayBorrador = Boolean(
    borradorRestaurado &&
    (borradorRestaurado.confirmados.length > 0 ||
      Object.keys(borradorRestaurado.cantidades).length > 0),
  );
  const linkIcono =
    "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-label-2 transition hover:bg-fill active:scale-95";

  return (
    <Pantalla
      titulo="MEP Deli"
      subtitulo={
        isLoading
          ? "Cargando…"
          : resumenGuardado
            ? etiquetaCargaMep(resumenGuardado)
            : `Sin guardar · ${etiquetaDiaSemana(fechaServicio)} ${fechaServicio.slice(8, 10)}/${fechaServicio.slice(5, 7)}`
      }
      ancho="amplio"
      acciones={
        <>
          <Link
            href="/mep-historial"
            aria-label="Historial de MEP"
            title="Historial"
            className={linkIcono}
          >
            <History className="h-[22px] w-[22px]" aria-hidden />
          </Link>
          <Link
            href="/mep-cortes"
            aria-label="Catálogo de cortes"
            title="Catálogo"
            className={linkIcono}
          >
            <Scissors className="h-[22px] w-[22px]" aria-hidden />
          </Link>
        </>
      }
      ayuda={
        <>
          <p>Una MEP por día: todo el equipo ve y edita la misma.</p>
          <p>
            Cargá la cantidad de cada corte. Si te interrumpen, tocá el ✓ de
            cada corte listo: queda bloqueado y no se pierde aunque se cierre la
            pantalla. Se puede guardar con cualquier cantidad.
          </p>
          <p>
            <strong className="text-label">Cargar último jueves</strong> copia
            las cantidades del mismo día de la semana anterior;{" "}
            <strong className="text-label">Sugerencias</strong> propone
            cantidades según los cierres.
          </p>
          <p>
            Hasta que no se haga el cierre de una MEP no se puede abrir la de
            otro día.
          </p>
        </>
      }
    >
      {mepPendienteCierre ? (
        <div className="mb-4 flex gap-3 rounded-card bg-warning-soft px-4 py-3 text-[0.94rem] text-warning">
          <TriangleAlert
            className="mt-0.5 h-[18px] w-[18px] shrink-0"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="font-semibold">
              Cierre pendiente: {etiquetaCargaMep(mepPendienteCierre)}
            </p>
            <p className="mt-0.5 opacity-90">
              La MEP de hoy
              {mepPendienteCierre.fecha < formatFechaLocalYYYYMMDD(new Date())
                ? " se habilita después del cierre"
                : " debe cerrarse antes de pasar a otro día"}
              .
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mb-4 flex gap-3 rounded-card bg-danger-soft px-4 py-3 text-[0.94rem] text-danger"
        >
          <CircleAlert
            className="mt-0.5 h-[18px] w-[18px] shrink-0"
            aria-hidden
          />
          <p className="min-w-0 flex-1">{error}</p>
        </div>
      ) : null}

      {enVisor && resumenGuardado ? (
        <>
          <div className="rounded-card bg-surface-3 p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-[1.6rem] font-semibold leading-tight text-label">
                  {etiquetaCargaMep(resumenGuardado)}
                </p>
                <p className="mt-0.5 text-[0.94rem] text-label-2">
                  {lineasResumen.length} cortes
                  {resumenGuardado.cargado_por_nombre
                    ? ` · ${resumenGuardado.cargado_por_nombre}`
                    : ""}
                </p>
              </div>
              <Etiqueta
                tono={tieneCierre(resumenGuardado) ? "exito" : "alerta"}
              >
                {tieneCierre(resumenGuardado) ? "Cerrada" : "Sin cerrar"}
              </Etiqueta>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Boton
                variante="secundario"
                icono={<Pencil className="h-[18px] w-[18px]" aria-hidden />}
                onClick={abrirEditorMep}
              >
                Editar
              </Boton>
              <Boton
                variante="secundario"
                icono={<RefreshCw className="h-[18px] w-[18px]" aria-hidden />}
                onClick={refrescarMepDelDia}
              >
                Refrescar
              </Boton>
            </div>
          </div>

          <Seccion titulo="Cantidades">
            <ul className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:grid sm:grid-cols-2">
              {lineasResumen.map((l) => {
                const peso = cortesPorId.get(l.corte_id)?.peso_ref;
                return (
                  <li
                    key={l.corte_id}
                    className="flex min-h-14 items-center gap-3 border-b border-separator px-4 py-2 last:border-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1rem] leading-snug text-label">
                        {l.nombre}
                      </span>
                      <span className="block truncate text-[0.84rem] text-label-3">
                        {l.categoria}
                        {peso ? ` · ${peso}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right font-mono text-[1.02rem] font-semibold tabular-nums text-label">
                      {l.cantidad}
                      <span className="ml-1 font-sans text-[0.8rem] font-normal text-label-3">
                        {etiquetaUnidadMep(l.unidad)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Seccion>

          <Seccion titulo="Cierre">
            <div className="rounded-card bg-surface-3 p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
              <MepCierrePanel
                carga={resumenGuardado}
                cortesPorId={cortesPorId}
                onCierreGuardado={onCierreGuardado}
              />
            </div>
          </Seccion>
        </>
      ) : (
        <>
          {resumenGuardado ? (
            <div className="mb-4 flex items-center gap-2 rounded-card bg-fill py-1.5 pl-4 pr-1.5">
              <p className="min-w-0 flex-1 leading-tight">
                <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-label-3">
                  Editando
                </span>
                <span className="block truncate text-[0.9rem] text-label">
                  {etiquetaCargaMep(resumenGuardado)}
                  {resumenGuardado.cargado_por_nombre
                    ? ` · ${resumenGuardado.cargado_por_nombre}`
                    : ""}
                </span>
              </p>
              <Boton
                variante="terciario"
                tamano="chico"
                icono={<List className="h-4 w-4" aria-hidden />}
                onClick={() => setEditorOculto(true)}
              >
                Ver lista
              </Boton>
            </div>
          ) : null}

          <div className="ui-sin-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            <Boton
              variante="secundario"
              tamano="chico"
              className="shrink-0"
              icono={<FilePlus className="h-4 w-4" aria-hidden />}
              onClick={irAHoy}
              disabled={hoyBloqueado}
              title={
                hoyBloqueado && mepPendienteCierre
                  ? `Cerrá primero la MEP del ${etiquetaCargaMep(mepPendienteCierre)}`
                  : undefined
              }
            >
              Ir a hoy
            </Boton>
            <Boton
              variante="secundario"
              tamano="chico"
              className="shrink-0"
              icono={<RefreshCw className="h-4 w-4" aria-hidden />}
              onClick={refrescarMepDelDia}
            >
              Refrescar
            </Boton>
            <Boton
              variante="secundario"
              tamano="chico"
              className="shrink-0"
              icono={<CalendarDays className="h-4 w-4" aria-hidden />}
              onClick={() => void cargarMismoDiaSemana()}
              disabled={!plantillaMismoDia}
              title={
                plantillaMismoDia
                  ? `Basado en ${etiquetaCargaMep(plantillaMismoDia)}`
                  : "Sin historial para este día"
              }
            >
              {etiquetaPlantillaMismoDia}
            </Boton>
            {sugerenciasActivas > 0 ? (
              <Boton
                variante="secundario"
                tamano="chico"
                className="shrink-0 bg-info-soft text-info"
                icono={<Sparkles className="h-4 w-4" aria-hidden />}
                onClick={aplicarSugerencias}
              >
                Sugerencias · {sugerenciasActivas}
              </Boton>
            ) : null}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Fecha
              valor={fechaServicio}
              onChange={onCambioFecha}
              disabled={Boolean(mepPendienteCierre)}
            />
            <label className="flex min-h-12 items-center gap-3 rounded-control bg-fill pl-4 pr-1">
              <span className="flex-1 text-[0.94rem] text-label-2">Hora</span>
              <input
                type="time"
                value={horaServicio}
                onChange={(e) => {
                  const hora = e.target.value;
                  setHoraServicio(hora);
                  if (
                    confirmados.size > 0 ||
                    hayCantidadesCargadas(cantidades)
                  ) {
                    persistirBorrador(
                      cantidades,
                      confirmados,
                      hora,
                      fechaServicio,
                    );
                  }
                }}
                className="min-h-11 bg-transparent px-2 text-right text-[1rem] tabular-nums text-label outline-none"
              />
            </label>
          </div>

          {isLoading ? (
            <div className="mt-6 space-y-6">
              <EsqueletoLista filas={5} />
              <EsqueletoLista filas={4} />
            </div>
          ) : cortes.length === 0 ? (
            <div className="mt-6 rounded-card bg-surface-3">
              <EstadoVacio
                icono={<Scissors className="h-6 w-6" aria-hidden />}
                titulo="No hay cortes activos"
                texto="Agregá cortes en el catálogo para armar la MEP."
                accion={
                  <Link
                    href="/mep-cortes"
                    className="inline-flex min-h-11 items-center rounded-control bg-accent px-4 font-semibold text-on-accent"
                  >
                    Ir al catálogo
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <div className="mt-4 rounded-card bg-surface-3 px-4 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[0.94rem] text-label-2">
                    <span className="font-semibold tabular-nums text-label">
                      {totalConfirmados}/{cortes.length}
                    </span>{" "}
                    confirmados
                  </p>
                  {hayBorrador && !resumenGuardado ? (
                    <Etiqueta tono="info">Borrador restaurado</Etiqueta>
                  ) : null}
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-fill">
                  <div
                    className="h-full rounded-full bg-success transition-all duration-300"
                    style={{
                      width: `${cortes.length ? (totalConfirmados / cortes.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-x-6 lg:grid-cols-2">
                {grupos.map((grupo) => (
                  <Seccion key={grupo.categoria} titulo={grupo.categoria}>
                    <ul className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
                      {grupo.cortes.map((corte) => {
                        const sug = sugerenciasPorId.get(corte.id);
                        const estaConfirmado = confirmados.has(corte.id);
                        const valor = cantidades.get(corte.id) ?? "";
                        return (
                          <li
                            key={corte.id}
                            className={cx(
                              "flex min-h-16 items-center gap-2 border-b border-separator py-2 pl-4 pr-2 transition-colors last:border-0",
                              estaConfirmado && "bg-success-soft",
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[1rem] leading-snug text-label">
                                {corte.nombre}
                                {corte.peso_ref ? (
                                  <span className="ml-1.5 text-[0.8rem] tabular-nums text-warning">
                                    {corte.peso_ref}
                                  </span>
                                ) : null}
                              </p>
                              {sug?.motivo ? (
                                <p className="text-[0.8rem] leading-snug text-info">
                                  {sug.motivo}
                                </p>
                              ) : null}
                            </div>
                            <label className="flex shrink-0 items-center gap-1">
                              <span className="sr-only">
                                Cantidad de {corte.nombre}
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                enterKeyHint="next"
                                placeholder={
                                  sug?.cantidad_sugerida != null
                                    ? formatearCantidadSugerida(
                                        sug.cantidad_sugerida,
                                        corte.unidad,
                                      )
                                    : "—"
                                }
                                value={valor}
                                onChange={(e) =>
                                  actualizarCantidad(corte.id, e.target.value)
                                }
                                readOnly={estaConfirmado}
                                className={cx(
                                  "h-11 w-[4.5rem] rounded-[0.65rem] px-2 text-right font-mono text-[1.02rem] tabular-nums outline-none ring-accent/60 placeholder:text-label-3 focus:ring-2",
                                  estaConfirmado
                                    ? "bg-transparent font-semibold text-success"
                                    : "bg-fill text-label",
                                )}
                              />
                              <span className="w-8 text-[0.8rem] text-label-3">
                                {etiquetaUnidadMep(corte.unidad)}
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                vibrar(estaConfirmado ? "toque" : "exito");
                                if (estaConfirmado) {
                                  desconfirmarCorte(corte.id);
                                } else {
                                  confirmarCorte(corte.id);
                                }
                              }}
                              disabled={!estaConfirmado && !valor.trim()}
                              aria-pressed={estaConfirmado}
                              aria-label={
                                estaConfirmado
                                  ? `Editar ${corte.nombre}`
                                  : `Confirmar ${corte.nombre}`
                              }
                              className={cx(
                                "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-30",
                                estaConfirmado
                                  ? "bg-success text-[#fff]"
                                  : "bg-fill text-label-3",
                              )}
                            >
                              <Check
                                className="h-5 w-5"
                                strokeWidth={estaConfirmado ? 3 : 2}
                                aria-hidden
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </Seccion>
                ))}
              </div>

              {cantidadesCargadas ? (
                <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] z-20 -mx-4 mt-6 px-4 pb-1 sm:bottom-4 sm:mx-0 sm:px-0">
                  <Boton
                    ancho
                    tamano="grande"
                    cargando={isSaving}
                    icono={<Save className="h-[18px] w-[18px]" aria-hidden />}
                    onClick={() => void guardarMep()}
                    className="shadow-[0_8px_24px_rgb(0_0_0/0.18)]"
                  >
                    {resumenGuardado ? "Actualizar MEP" : "Guardar MEP"}
                  </Boton>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </Pantalla>
  );
}
