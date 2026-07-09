"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, FilePlus, List, Loader2, Pencil, RefreshCw, Save, Sparkles } from "lucide-react";
import Link from "next/link";

import { MepCierrePanel } from "@/app/components/mep-cierre-panel";
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
    d.getDate()
  ).padStart(2, "0")}`;
}

function horaLocalHHmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function MepDeliPage() {
  const now = new Date();
  const [cortes, setCortes] = useState<MepCorte[]>([]);
  const [cantidades, setCantidades] = useState<Map<string, string>>(() => new Map());
  const [confirmados, setConfirmados] = useState<Set<string>>(() => new Set());
  const [fechaServicio, setFechaServicio] = useState(() => formatFechaLocalYYYYMMDD(now));
  const [horaServicio, setHoraServicio] = useState(() => horaLocalHHmm(now));
  const [resumenGuardado, setResumenGuardado] = useState<MepDeliCarga | null>(null);
  const [editorOculto, setEditorOculto] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [historialCargas, setHistorialCargas] = useState<MepDeliCarga[]>([]);
  const [sinCerrar, setSinCerrar] = useState<MepDeliCarga[]>([]);

  const grupos = useMemo(() => agruparCortesPorCategoria(cortes), [cortes]);

  const cortesPorId = useMemo(() => new Map(cortes.map((c) => [c.id, c])), [cortes]);

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
      .sort((a, b) => a.categoria.localeCompare(b.categoria, "es") || a.nombre.localeCompare(b.nombre, "es"));
  }, [cantidades, cortesPorId]);

  const lineasResumen = useMemo(() => {
    if (!resumenGuardado) {
      return [];
    }
    return enriquecerLineasMep(resumenGuardado.lineas, cortesPorId);
  }, [resumenGuardado, cortesPorId]);

  const sugerencias = useMemo(
    () => calcularSugerenciasCantidades(historialCargas, cortes, cantidades),
    [historialCargas, cortes, cantidades]
  );

  const sugerenciasPorId = useMemo(
    () => new Map(sugerencias.map((s) => [s.corte_id, s])),
    [sugerencias]
  );

  const plantillaMismoDia = useMemo(
    () => buscarMepMismoDiaSemana(historialCargas, fechaServicio),
    [historialCargas, fechaServicio]
  );

  const mepPendienteCierre = useMemo(
    () => obtenerMepPendienteCierre(sinCerrar),
    [sinCerrar]
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
      fecha: string
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
    []
  );

  const hidratarDesdeCarga = useCallback(
    (carga: MepDeliCarga, opts?: { mostrarResumen?: boolean; conservarFecha?: boolean }) => {
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
    []
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
    [hidratarDesdeCarga]
  );

  const cargarDatos = async () => {
    setIsLoading(true);
    setError(null);
    const avisos: string[] = [];

    const registrarFallo = (contexto: string, err: unknown) => {
      if (err && typeof err === "object" && "message" in err) {
        avisos.push(
          `${contexto}: ${formatPostgrestError(
            err as Parameters<typeof formatPostgrestError>[0]
          )}`
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
    const fechaInicial = pendiente?.fecha ?? formatFechaLocalYYYYMMDD(new Date());
    setFechaServicio(fechaInicial);

    try {
      cargaHoy = await aplicarMepDeFecha(fechaInicial, { conservarHoraSiVacia: true });
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
      void aplicarMepDeFecha(fechaServicio, { conservarHoraSiVacia: true }).catch(() => {
        // silencioso al volver a la pestaña
      });
    };
    document.addEventListener("visibilitychange", refrescarSiVisible);
    return () => document.removeEventListener("visibilitychange", refrescarSiVisible);
  }, [fechaServicio, isLoading, aplicarMepDeFecha, editorOculto]);

  const onCambioFecha = (fecha: string) => {
    const pendiente = obtenerMepPendienteCierre(sinCerrar);
    if (fechaBloqueadaPorCierrePendiente(fecha, pendiente)) {
      setError(
        `Cerrá primero la MEP del ${etiquetaCargaMep(pendiente!)} antes de abrir otra fecha.`
      );
      setSuccess(null);
      return;
    }
    setFechaServicio(fecha);
    setSuccess(null);
    void aplicarMepDeFecha(fecha).catch((err) => {
      setError(
        err && typeof err === "object" && "message" in err
          ? formatPostgrestError(err as Parameters<typeof formatPostgrestError>[0])
          : "No se pudo cargar la MEP de ese día."
      );
    });
  };

  const refrescarMepDelDia = () => {
    setSuccess(null);
    void aplicarMepDeFecha(fechaServicio, { conservarHoraSiVacia: true })
      .then((carga) => {
        if (carga) {
          setSuccess(`MEP del ${fechaServicio} actualizada.`);
        } else {
          setSuccess(`No hay MEP guardada para el ${fechaServicio}.`);
        }
        setError(null);
      })
      .catch((err) => {
        setError(
          err && typeof err === "object" && "message" in err
            ? formatPostgrestError(err as Parameters<typeof formatPostgrestError>[0])
            : "No se pudo refrescar."
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
    persistirBorrador(nextCantidades, nextConfirmados, horaServicio, fechaServicio);
  };

  const confirmarCorte = (corteId: string) => {
    const cantidad = cantidades.get(corteId)?.trim();
    if (!cantidad) {
      setError("Ingresá una cantidad antes de confirmar.");
      setSuccess(null);
      return;
    }
    const nextConfirmados = new Set(confirmados);
    nextConfirmados.add(corteId);
    setConfirmados(nextConfirmados);
    setError(null);
    setSuccess(null);
    persistirBorrador(cantidades, nextConfirmados, horaServicio, fechaServicio);
  };

  const desconfirmarCorte = (corteId: string) => {
    const nextConfirmados = new Set(confirmados);
    nextConfirmados.delete(corteId);
    setConfirmados(nextConfirmados);
    setError(null);
    setSuccess(null);
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
        `Cerrá primero la MEP del ${etiquetaCargaMep(pendiente!)} para habilitar la de hoy.`
      );
      setSuccess(null);
      return;
    }
    setHoraServicio(horaLocalHHmm(d));
    onCambioFecha(hoy);
    setSuccess("Mostrando la MEP de hoy.");
    setError(null);
  };

  const cargarMismoDiaSemana = () => {
    if (!plantillaMismoDia) {
      setError(`No hay MEP guardada para un ${etiquetaDiaSemana(fechaServicio)} anterior.`);
      return;
    }
    if (hayCantidadesCargadas(cantidades) && !resumenGuardado) {
      const ok = window.confirm(
        `¿Copiar cantidades del ${etiquetaCargaMep(plantillaMismoDia)} al ${fechaServicio}?`
      );
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
    setSuccess(`Plantilla del ${etiquetaCargaMep(plantillaMismoDia)} aplicada al ${fechaServicio}.`);
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
          formatearCantidadSugerida(s.cantidad_sugerida, s.unidad)
        );
      }
    }
    setCantidades(next);
    setConfirmados(new Set());
    persistirBorrador(next, new Set(), horaServicio, fechaServicio);
    setSuccess(`Sugerencias aplicadas (${sugerencias.length} ítems).`);
    setError(null);
  };

  const guardarMep = async () => {
    const pendiente = obtenerMepPendienteCierre(sinCerrar);
    if (fechaBloqueadaPorCierrePendiente(fechaServicio, pendiente)) {
      setError(
        `Cerrá primero la MEP del ${etiquetaCargaMep(pendiente!)} antes de guardar otra fecha.`
      );
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

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
        tieneCierre(guardada) ? prev.filter((c) => c.id !== guardada.id) : [guardada, ...prev.filter((c) => c.id !== guardada.id)]
      );
      setSuccess(
        `${resumenGuardado ? "MEP actualizada" : "MEP guardada"} para ${fechaServicio} (${horaServicio})${
          guardada.cargado_por_nombre ? ` · ${guardada.cargado_por_nombre}` : ""
        }.`
      );
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? formatPostgrestError(err as Parameters<typeof formatPostgrestError>[0])
          : err instanceof Error
            ? err.message
            : "Error desconocido al guardar."
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
      deduplicarCargasPorFecha(prev.map((c) => (c.id === carga.id ? carga : c)))
    );

    const pendiente = obtenerMepPendienteCierre(nextSinCerrar);
    const destino = pendiente?.fecha ?? formatFechaLocalYYYYMMDD(new Date());
    setFechaServicio(destino);
    setError(null);
    try {
      await aplicarMepDeFecha(destino, { conservarHoraSiVacia: true });
      setSuccess(
        pendiente
          ? `Cierre guardado. Falta cerrar la MEP del ${etiquetaCargaMep(pendiente)}.`
          : "Cierre guardado. Ya podés cargar la MEP de hoy."
      );
    } catch (err) {
      setSuccess("Cierre guardado.");
      setError(
        err && typeof err === "object" && "message" in err
          ? formatPostgrestError(err as Parameters<typeof formatPostgrestError>[0])
          : "No se pudo cargar la siguiente MEP."
      );
    }
  };

  const sugerenciasActivas = sugerencias.length;
  const totalConfirmados = confirmados.size;
  const cantidadesCargadas = hayCantidadesCargadas(cantidades);
  const borradorRestaurado = useMemo(
    () => leerBorradorMepDeli(fechaServicio),
    [fechaServicio, totalConfirmados, cantidades]
  );

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">MEP Deli</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Una MEP por día — todo el equipo ve la misma. Con MEP guardada, usá{" "}
              <span className="text-zinc-300">Ver sólo lista</span> o{" "}
              <span className="text-zinc-300">Editar MEP</span> como en Omakase.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/mep-historial"
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Historial
            </Link>
            <Link
              href="/mep-cortes"
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Catálogo →
            </Link>
          </div>
        </header>

        {mepPendienteCierre ? (
          <div className="mb-6 rounded-xl border border-amber-700/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-50">
            <p className="font-medium">
              Cierre pendiente: {etiquetaCargaMep(mepPendienteCierre)}
            </p>
            <p className="mt-1 text-amber-100/85">
              La planilla guardada sigue abierta hasta que hagan el cierre. La MEP de hoy
              {mepPendienteCierre.fecha < formatFechaLocalYYYYMMDD(new Date())
                ? " solo se habilita después"
                : " debe cerrarse antes de pasar a otro día"}
              .
            </p>
          </div>
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

        {resumenGuardado && editorOculto ? (
          <div className="relative z-10 mb-6 min-w-0 rounded-xl border border-zinc-500/80 bg-zinc-950/95 p-3 shadow-[0_12px_48px_rgba(0,0,0,0.45)] backdrop-blur-sm ring-1 ring-zinc-500/20 sm:sticky sm:top-2 sm:p-5">
            <div className="mb-3 flex flex-col gap-2 border-b border-zinc-800/80 pb-3 max-sm:border-0 max-sm:pb-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Visor · MEP guardada · solo lectura
                </p>
                <p className="mt-1 flex flex-wrap gap-x-1 text-sm text-zinc-100">
                  <span className="tabular-nums">{etiquetaCargaMep(resumenGuardado)}</span>
                  {resumenGuardado.cargado_por_nombre ? (
                    <>
                      <span className="text-zinc-600">·</span>
                      <span>{resumenGuardado.cargado_por_nombre}</span>
                    </>
                  ) : null}
                </p>
                <p className="mt-1.5 max-w-xl text-[11px] leading-snug text-zinc-500">
                  La misma MEP ve todo el equipo para este día.{" "}
                  <span className="text-zinc-400">Editar MEP</span> para cambiar cantidades;{" "}
                  <span className="text-zinc-400">Refrescar</span> si alguien más guardó.
                </p>
              </div>
              <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[11rem] sm:flex-row sm:flex-wrap sm:justify-end">
                <button
                  type="button"
                  onClick={abrirEditorMep}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-900/50 bg-emerald-950/50 px-3 py-2.5 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-900/40 sm:w-auto"
                >
                  <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Editar MEP
                </button>
                <button
                  type="button"
                  onClick={refrescarMepDelDia}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2.5 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 sm:w-auto"
                >
                  <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Refrescar
                </button>
              </div>
            </div>
            <ul className="mb-4 grid gap-1.5 sm:grid-cols-2">
              {lineasResumen.map((l) => (
                <li key={l.corte_id} className="text-sm text-zinc-200">
                  <span className="text-zinc-500">{l.categoria} ·</span> {l.nombre}:{" "}
                  <span className="font-medium text-white">
                    {l.cantidad} {etiquetaUnidadMep(l.unidad)}
                  </span>
                </li>
              ))}
            </ul>
            <MepCierrePanel
              carga={resumenGuardado}
              cortesPorId={cortesPorId}
              onCierreGuardado={onCierreGuardado}
            />
          </div>
        ) : null}

        {resumenGuardado && !editorOculto ? (
          <div className="mb-4 flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-400">
              Editando MEP del{" "}
              <span className="tabular-nums text-zinc-200">{fechaServicio}</span>
              {resumenGuardado.cargado_por_nombre ? (
                <span className="text-zinc-500">
                  {" "}
                  · cargada por {resumenGuardado.cargado_por_nombre}
                </span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={() => setEditorOculto(true)}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-[11px] font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/90"
            >
              <List className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Ver sólo lista
            </button>
          </div>
        ) : null}

        {!(resumenGuardado && editorOculto) ? (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={irAHoy}
            disabled={Boolean(
              mepPendienteCierre &&
                fechaBloqueadaPorCierrePendiente(
                  formatFechaLocalYYYYMMDD(new Date()),
                  mepPendienteCierre
                )
            )}
            title={
              mepPendienteCierre &&
              fechaBloqueadaPorCierrePendiente(
                formatFechaLocalYYYYMMDD(new Date()),
                mepPendienteCierre
              )
                ? `Cerrá primero la MEP del ${etiquetaCargaMep(mepPendienteCierre)}`
                : undefined
            }
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FilePlus className="h-4 w-4" />
            Ir a hoy
          </button>
          <button
            type="button"
            onClick={refrescarMepDelDia}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
          >
            <RefreshCw className="h-4 w-4" />
            Refrescar
          </button>
          <button
            type="button"
            onClick={cargarMismoDiaSemana}
            disabled={!plantillaMismoDia}
            title={
              plantillaMismoDia
                ? `Basado en ${etiquetaCargaMep(plantillaMismoDia)}`
                : "Sin historial para este día"
            }
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {etiquetaPlantillaMismoDia}
          </button>
          {sugerenciasActivas > 0 ? (
            <button
              type="button"
              onClick={aplicarSugerencias}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-800/60 bg-violet-950/30 px-4 py-2 text-sm text-violet-200 transition hover:border-violet-600"
            >
              <Sparkles className="h-4 w-4" />
              Sugerencias ({sugerenciasActivas})
            </button>
          ) : null}
        </div>
        ) : null}

        {(!editorOculto || !resumenGuardado) && (
          <>
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Fecha
                </span>
                <input
                  type="date"
                  value={fechaServicio}
                  disabled={Boolean(mepPendienteCierre)}
                  onChange={(e) => onCambioFecha(e.target.value)}
                  title={
                    mepPendienteCierre
                      ? `Cerrá primero la MEP del ${etiquetaCargaMep(mepPendienteCierre)}`
                      : undefined
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Hora
                </span>
                <input
                  type="time"
                  value={horaServicio}
                  onChange={(e) => {
                    const hora = e.target.value;
                    setHoraServicio(hora);
                    if (confirmados.size > 0 || hayCantidadesCargadas(cantidades)) {
                      persistirBorrador(cantidades, confirmados, hora, fechaServicio);
                    }
                  }}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
              </label>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                Cargando cortes…
              </div>
            ) : cortes.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                No hay cortes activos.{" "}
                <Link href="/mep-cortes" className="text-zinc-300 underline">
                  Agregá cortes
                </Link>{" "}
                o ejecutá <code className="text-zinc-300">supabase/mep-cortes.sql</code>.
              </p>
            ) : (
              <div className="space-y-6">
                {!resumenGuardado ? (
                  <p className="rounded-xl border border-sky-900/40 bg-sky-950/25 px-4 py-3 text-sm text-sky-100/90">
                    Podés cargar y guardar la MEP con cualquier cantidad. Si te interrumpen,
                    usá <span className="font-medium text-sky-50">Confirmar</span> en cada corte
                    listo — queda bloqueado y no se pierde aunque se corte la pantalla.
                    {borradorRestaurado &&
                    (borradorRestaurado.confirmados.length > 0 ||
                      Object.keys(borradorRestaurado.cantidades).length > 0) ? (
                      <span className="mt-1 block text-sky-200/80">
                        Borrador restaurado
                        {borradorRestaurado.confirmados.length > 0
                          ? ` · ${borradorRestaurado.confirmados.length} confirmado${
                              borradorRestaurado.confirmados.length === 1 ? "" : "s"
                            }`
                          : ""}
                        .
                      </span>
                    ) : null}
                  </p>
                ) : null}

                {totalConfirmados > 0 ? (
                  <p className="text-xs text-zinc-500">
                    {totalConfirmados} de {cortes.length} cortes confirmados
                  </p>
                ) : null}

                {grupos.map((grupo) => (
                  <div key={grupo.categoria}>
                    <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">
                      {grupo.categoria}
                    </h2>
                    <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
                      {grupo.cortes.map((corte) => {
                        const sug = sugerenciasPorId.get(corte.id);
                        const estaConfirmado = confirmados.has(corte.id);
                        return (
                        <li
                          key={corte.id}
                          className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                            estaConfirmado ? "bg-emerald-950/20" : ""
                          }`}
                        >
                          <div className="min-w-[8rem] flex items-start gap-2">
                            {estaConfirmado ? (
                              <Check
                                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                                aria-hidden
                              />
                            ) : null}
                            <div>
                              <span className="font-medium text-zinc-100">
                                {corte.nombre}
                              </span>
                              {sug?.motivo ? (
                                <p className="mt-0.5 text-[11px] text-violet-300/90">{sug.motivo}</p>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder={
                                sug?.cantidad_sugerida != null
                                  ? formatearCantidadSugerida(sug.cantidad_sugerida, corte.unidad)
                                  : "—"
                              }
                              value={cantidades.get(corte.id) ?? ""}
                              onChange={(e) => actualizarCantidad(corte.id, e.target.value)}
                              readOnly={estaConfirmado}
                              className={`w-28 rounded-xl border px-3 py-2 text-right text-sm outline-none focus:border-zinc-500 ${
                                estaConfirmado
                                  ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-50"
                                  : "border-zinc-700 bg-zinc-950 text-zinc-100"
                              }`}
                            />
                            <span className="w-10 text-xs text-zinc-500">
                              {etiquetaUnidadMep(corte.unidad)}
                            </span>
                            {estaConfirmado ? (
                              <button
                                type="button"
                                onClick={() => desconfirmarCorte(corte.id)}
                                className="rounded-lg border border-zinc-600 bg-zinc-900 px-2.5 py-2 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                              >
                                Editar
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => confirmarCorte(corte.id)}
                                disabled={!cantidades.get(corte.id)?.trim()}
                                className="rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-2.5 py-2 text-[11px] font-semibold text-emerald-100 transition hover:border-emerald-600 hover:bg-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Confirmar
                              </button>
                            )}
                          </div>
                        </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => void guardarMep()}
                  disabled={isSaving || !cantidadesCargadas}
                  title={
                    !cantidadesCargadas
                      ? "Ingresá al menos una cantidad antes de guardar"
                      : undefined
                  }
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {resumenGuardado ? "Actualizar MEP" : "Guardar MEP"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
