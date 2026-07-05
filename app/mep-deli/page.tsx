"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilePlus, Loader2, Lock, Pencil, Save, Sparkles } from "lucide-react";
import Link from "next/link";

import { MepCierrePanel } from "@/app/components/mep-cierre-panel";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import type { ServicioHistorial } from "@/src/lib/historial-servicios";
import {
  agruparCortesPorCategoria,
  buscarMepMismoDiaSemana,
  calcularSugerenciasCantidades,
  cantidadesDesdeLineas,
  etiquetaCargaMep,
  etiquetaDiaSemana,
  etiquetaServicioMep,
  etiquetaUnidadMep,
  formatearCantidadSugerida,
  fetchMepCargasSinCerrarRecientes,
  fetchMepCortesActivos,
  fetchMepDeliCargasHistorial,
  fetchUltimaMepDeliCarga,
  fetchUltimoHistorialParaMep,
  fetchSessionMepUsuario,
  hayCantidadesCargadas,
  lineasDesdeCantidades,
  MEP_CARGA_SELECT,
  cargaDesdeFila,
  tieneCierre,
  type MepCorte,
  type MepDeliCarga,
} from "@/src/lib/mep-deli";
import { supabase } from "@/src/lib/supabase";

type Servicio = ServicioHistorial;

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
  const [fechaServicio, setFechaServicio] = useState(() => formatFechaLocalYYYYMMDD(now));
  const [horaServicio, setHoraServicio] = useState(() => horaLocalHHmm(now));
  const [servicio, setServicio] = useState<Servicio>(now.getHours() < 17 ? "Mediodia" : "Noche");
  const [ultimaCarga, setUltimaCarga] = useState<MepDeliCarga | null>(null);
  const [resumenGuardado, setResumenGuardado] = useState<MepDeliCarga | null>(null);
  const [editorOculto, setEditorOculto] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notaRelevo, setNotaRelevo] = useState("");
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

  const sugerencias = useMemo(
    () => calcularSugerenciasCantidades(historialCargas, cortes, cantidades),
    [historialCargas, cortes, cantidades]
  );

  const sugerenciasPorId = useMemo(
    () => new Map(sugerencias.map((s) => [s.corte_id, s])),
    [sugerencias]
  );

  const plantillaMismoDia = useMemo(
    () => buscarMepMismoDiaSemana(historialCargas, fechaServicio, servicio),
    [historialCargas, fechaServicio, servicio]
  );

  const etiquetaPlantillaMismoDia = useMemo(() => {
    const dia = etiquetaDiaSemana(fechaServicio);
    const serv = etiquetaServicioMep(servicio);
    return `Cargar último ${dia} ${serv}`;
  }, [fechaServicio, servicio]);

  const hidratarDesdeCarga = useCallback(
    (carga: MepDeliCarga, opts?: { mostrarResumen?: boolean }) => {
      setFechaServicio(carga.fecha);
      setHoraServicio(carga.hora?.trim() || horaLocalHHmm(new Date()));
      setServicio(carga.servicio ?? (new Date().getHours() < 17 ? "Mediodia" : "Noche"));
      setCantidades(cantidadesDesdeLineas(carga.lineas));
      setNotaRelevo(carga.nota_relevo ?? "");
      if (opts?.mostrarResumen) {
        setResumenGuardado(carga);
        setEditorOculto(true);
      } else {
        setResumenGuardado(null);
        setEditorOculto(false);
      }
      setError(null);
    },
    []
  );

  const cargarDatos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [listaCortes, carga, historial, listaHistorial, pendientes] = await Promise.all([
        fetchMepCortesActivos(),
        fetchUltimaMepDeliCarga(),
        fetchUltimoHistorialParaMep(),
        fetchMepDeliCargasHistorial(),
        fetchMepCargasSinCerrarRecientes(),
      ]);

      setCortes(listaCortes);
      setUltimaCarga(carga);
      setHistorialCargas(listaHistorial);
      setSinCerrar(pendientes);

      if (carga) {
        hidratarDesdeCarga(carga);
      } else if (historial) {
        setFechaServicio(historial.fecha);
        setHoraServicio(historial.hora?.trim() || horaLocalHHmm(new Date()));
        setServicio(historial.servicio ?? servicio);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al conectar con Supabase."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargarDatos();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const actualizarCantidad = (corteId: string, valor: string) => {
    setError(null);
    setCantidades((prev) => {
      const next = new Map(prev);
      if (valor.trim()) {
        next.set(corteId, valor);
      } else {
        next.delete(corteId);
      }
      return next;
    });
  };

  const iniciarNuevaMep = () => {
    if (hayCantidadesCargadas(cantidades)) {
      const ok = window.confirm(
        "¿Empezar una MEP nueva desde cero? Se vaciarán las cantidades que no hayas guardado."
      );
      if (!ok) {
        return;
      }
    }
    const d = new Date();
    setCantidades(new Map());
    setFechaServicio(formatFechaLocalYYYYMMDD(d));
    setHoraServicio(horaLocalHHmm(d));
    setServicio(d.getHours() < 17 ? "Mediodia" : "Noche");
    setResumenGuardado(null);
    setEditorOculto(false);
    setNotaRelevo("");
    setSuccess("MEP nueva en blanco: fecha y hora puestas a hoy.");
    setError(null);
  };

  const cargarUltimaMep = () => {
    if (!ultimaCarga) {
      setError("No hay ninguna MEP guardada todavía.");
      return;
    }
    if (hayCantidadesCargadas(cantidades)) {
      const ok = window.confirm(
        "¿Cargar la última MEP guardada? Se reemplazarán las cantidades actuales."
      );
      if (!ok) {
        return;
      }
    }
    hidratarDesdeCarga(ultimaCarga);
    setSuccess(`Cargada la MEP de ${etiquetaCargaMep(ultimaCarga)}.`);
    setError(null);
  };

  const cargarMismoDiaSemana = () => {
    if (!plantillaMismoDia) {
      setError(`No hay MEP guardada para un ${etiquetaDiaSemana(fechaServicio)} ${etiquetaServicioMep(servicio)} anterior.`);
      return;
    }
    if (hayCantidadesCargadas(cantidades)) {
      const ok = window.confirm(
        `¿Cargar la MEP del ${etiquetaCargaMep(plantillaMismoDia)}? Se reemplazarán las cantidades actuales.`
      );
      if (!ok) {
        return;
      }
    }
    hidratarDesdeCarga(plantillaMismoDia);
    setNotaRelevo("");
    setSuccess(`Plantilla cargada: ${etiquetaCargaMep(plantillaMismoDia)}.`);
    setError(null);
  };

  const aplicarSugerencias = () => {
    if (!sugerencias.length) {
      setError("No hay sugerencias con historial de cierres suficiente.");
      return;
    }
    setCantidades((prev) => {
      const next = new Map(prev);
      for (const s of sugerencias) {
        if (s.cantidad_sugerida !== null) {
          next.set(
            s.corte_id,
            formatearCantidadSugerida(s.cantidad_sugerida, s.unidad)
          );
        }
      }
      return next;
    });
    setSuccess(`Sugerencias aplicadas (${sugerencias.length} ítems).`);
    setError(null);
  };

  const guardarMep = async () => {
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
        historial.servicio === servicio
      ) {
        historialId = historial.id;
      }
    } catch {
      // opcional: seguir sin vincular
    }

    const payload = {
      fecha: fechaServicio,
      hora: horaServicio,
      servicio,
      historial_servicio_id: historialId,
      lineas,
      nota_relevo: notaRelevo.trim() || null,
      cargado_por_id: null as string | null,
      cargado_por_nombre: null as string | null,
    };

    const usuario = await fetchSessionMepUsuario();
    if (usuario) {
      payload.cargado_por_id = usuario.id;
      payload.cargado_por_nombre = usuario.name;
    }

    try {
      const { data, error: saveError } = await supabase
        .from("mep_deli_cargas")
        .insert(payload)
        .select(MEP_CARGA_SELECT)
        .single();

      if (saveError) {
        setError(formatPostgrestError(saveError));
        setIsSaving(false);
        return;
      }

      const guardada = cargaDesdeFila(data);

      setUltimaCarga(guardada);
      setResumenGuardado(guardada);
      setEditorOculto(true);
      setHistorialCargas((prev) => [guardada, ...prev.filter((c) => c.id !== guardada.id)]);
      setSinCerrar((prev) =>
        tieneCierre(guardada) ? prev.filter((c) => c.id !== guardada.id) : [guardada, ...prev.filter((c) => c.id !== guardada.id)]
      );
      setSuccess(
        `MEP guardada para ${fechaServicio} (${servicio} · ${horaServicio})${
          guardada.cargado_por_nombre ? ` · ${guardada.cargado_por_nombre}` : ""
        }.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error desconocido al guardar."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const onCierreGuardado = (carga: MepDeliCarga) => {
    setResumenGuardado(carga);
    setUltimaCarga(carga);
    setCantidades(cantidadesDesdeLineas(carga.lineas));
    setSinCerrar((prev) => prev.filter((c) => c.id !== carga.id));
  };

  const sugerenciasActivas = sugerencias.length;

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">MEP Deli</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Cargá la mise en place del delivery por categoría e ítem.
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

        {sinCerrar.length > 0 && (
          <div className="mb-6 rounded-xl border border-amber-900/50 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
            <span className="font-medium">
              {sinCerrar.length} MEP sin cerrar
            </span>
            <span className="text-amber-200/80">
              {" "}
              en los últimos 14 días:{" "}
              {sinCerrar
                .slice(0, 3)
                .map((c) => etiquetaCargaMep(c))
                .join(" · ")}
              {sinCerrar.length > 3 ? "…" : ""}
            </span>
          </div>
        )}

        {resumenGuardado && editorOculto && (
          <div className="mb-6 rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-300">
                <Lock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  MEP guardada · {etiquetaCargaMep(resumenGuardado)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditorOculto(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </button>
            </div>
            {resumenGuardado.cargado_por_nombre ? (
              <p className="mb-3 text-xs text-zinc-500">
                Cargada por{" "}
                <span className="text-zinc-300">{resumenGuardado.cargado_por_nombre}</span>
              </p>
            ) : null}
            {resumenGuardado.nota_relevo ? (
              <p className="mb-3 rounded-lg border border-sky-900/40 bg-sky-950/20 px-3 py-2 text-xs text-sky-100">
                <span className="font-medium text-sky-300">Nota de relevo: </span>
                {resumenGuardado.nota_relevo}
              </p>
            ) : null}
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {lineasConDatos.map((l) => (
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
        )}

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={iniciarNuevaMep}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
          >
            <FilePlus className="h-4 w-4" />
            Nueva MEP
          </button>
          <button
            type="button"
            onClick={cargarUltimaMep}
            disabled={!ultimaCarga}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cargar última
          </button>
          <button
            type="button"
            onClick={cargarMismoDiaSemana}
            disabled={!plantillaMismoDia}
            title={
              plantillaMismoDia
                ? `Basado en ${etiquetaCargaMep(plantillaMismoDia)}`
                : "Sin historial para este día y servicio"
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

        {(!editorOculto || !resumenGuardado) && (
          <>
            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Fecha
                </span>
                <input
                  type="date"
                  value={fechaServicio}
                  onChange={(e) => setFechaServicio(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Hora
                </span>
                <input
                  type="time"
                  value={horaServicio}
                  onChange={(e) => setHoraServicio(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                  Servicio
                </span>
                <select
                  value={servicio}
                  onChange={(e) => setServicio(e.target.value as Servicio)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                >
                  <option value="Mediodia">Mediodía</option>
                  <option value="Noche">Noche</option>
                </select>
              </label>
            </div>

            <label className="mb-6 block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                Nota de relevo (opcional)
              </span>
              <textarea
                value={notaRelevo}
                onChange={(e) => setNotaRelevo(e.target.value)}
                rows={2}
                placeholder="Ej: quedó poco salmón, pedir más mañana…"
                className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
              />
            </label>

            {error && (
              <p className="mb-4 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            )}
            {success && !error && (
              <p className="mb-4 rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
                {success}
              </p>
            )}

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
                {grupos.map((grupo) => (
                  <div key={grupo.categoria}>
                    <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">
                      {grupo.categoria}
                    </h2>
                    <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
                      {grupo.cortes.map((corte) => {
                        const sug = sugerenciasPorId.get(corte.id);
                        return (
                        <li
                          key={corte.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="min-w-[8rem]">
                            <span className="font-medium text-zinc-100">
                              {corte.nombre}
                            </span>
                            {sug?.motivo ? (
                              <p className="mt-0.5 text-[11px] text-violet-300/90">{sug.motivo}</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
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
                              className="w-28 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-right text-sm text-zinc-100 outline-none focus:border-zinc-500"
                            />
                            <span className="w-10 text-xs text-zinc-500">
                              {etiquetaUnidadMep(corte.unidad)}
                            </span>
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
                  disabled={isSaving}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Guardar MEP
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
