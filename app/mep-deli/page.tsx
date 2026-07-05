"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilePlus, Loader2, Lock, Pencil, Save } from "lucide-react";
import Link from "next/link";

import { formatPostgrestError } from "@/src/lib/supabase-errors";
import type { ServicioHistorial } from "@/src/lib/historial-servicios";
import {
  agruparCortesPorCategoria,
  cantidadesDesdeLineas,
  etiquetaCargaMep,
  etiquetaUnidadMep,
  fetchMepCortesActivos,
  fetchUltimaMepDeliCarga,
  fetchUltimoHistorialParaMep,
  hayCantidadesCargadas,
  lineasDesdeCantidades,
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

  const hidratarDesdeCarga = useCallback(
    (carga: MepDeliCarga, opts?: { mostrarResumen?: boolean }) => {
      setFechaServicio(carga.fecha);
      setHoraServicio(carga.hora?.trim() || horaLocalHHmm(new Date()));
      setServicio(carga.servicio ?? (new Date().getHours() < 17 ? "Mediodia" : "Noche"));
      setCantidades(cantidadesDesdeLineas(carga.lineas));
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
      const [listaCortes, carga, historial] = await Promise.all([
        fetchMepCortesActivos(),
        fetchUltimaMepDeliCarga(),
        fetchUltimoHistorialParaMep(),
      ]);

      setCortes(listaCortes);
      setUltimaCarga(carga);

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
    };

    try {
      const { data, error: saveError } = await supabase
        .from("mep_deli_cargas")
        .insert(payload)
        .select("id, fecha, hora, servicio, historial_servicio_id, lineas, created_at")
        .single();

      if (saveError) {
        setError(formatPostgrestError(saveError));
        setIsSaving(false);
        return;
      }

      const guardada = {
        id: data.id as string,
        fecha: data.fecha as string,
        hora: (data.hora as string | null) ?? null,
        servicio: (data.servicio as Servicio | null) ?? null,
        historial_servicio_id: (data.historial_servicio_id as string | null) ?? null,
        lineas,
        created_at: data.created_at as string,
      };

      setUltimaCarga(guardada);
      setResumenGuardado(guardada);
      setEditorOculto(true);
      setSuccess(`MEP guardada para ${fechaServicio} (${servicio} · ${horaServicio}).`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error desconocido al guardar."
      );
    } finally {
      setIsSaving(false);
    }
  };

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
                      {grupo.cortes.map((corte) => (
                        <li
                          key={corte.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                        >
                          <span className="min-w-[8rem] font-medium text-zinc-100">
                            {corte.nombre}
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="—"
                              value={cantidades.get(corte.id) ?? ""}
                              onChange={(e) => actualizarCantidad(corte.id, e.target.value)}
                              className="w-28 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-right text-sm text-zinc-100 outline-none focus:border-zinc-500"
                            />
                            <span className="w-10 text-xs text-zinc-500">
                              {etiquetaUnidadMep(corte.unidad)}
                            </span>
                          </div>
                        </li>
                      ))}
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
