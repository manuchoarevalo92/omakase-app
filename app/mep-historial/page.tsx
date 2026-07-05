"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

import { MepCompararPanel } from "@/app/components/mep-comparar-panel";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import {
  agruparCargasPorFecha,
  calcularRecuentoMep,
  deleteMepDeliCarga,
  enriquecerCierreLineas,
  enriquecerLineasMep,
  etiquetaCargaMep,
  etiquetaResultadoCierre,
  etiquetaUnidadMep,
  fetchMepCortesTodos,
  fetchMepDeliCargasHistorial,
  filtrarCargasPorPersona,
  personasEnCargas,
  tieneCierre,
  type FiltroPersonaMep,
  type MepCorte,
  type MepDeliCarga,
} from "@/src/lib/mep-deli";

function fechaHoraCarga(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MepHistorialPage() {
  const [cargas, setCargas] = useState<MepDeliCarga[]>([]);
  const [cortes, setCortes] = useState<MepCorte[]>([]);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [filtroPersona, setFiltroPersona] = useState<string>("todos");
  const [compararAbierto, setCompararAbierto] = useState(false);
  const [compararIdA, setCompararIdA] = useState("");
  const [compararIdB, setCompararIdB] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  const cortesPorId = useMemo(() => new Map(cortes.map((c) => [c.id, c])), [cortes]);

  const personas = useMemo(() => personasEnCargas(cargas), [cargas]);

  const filtroPersonaMep = useMemo((): FiltroPersonaMep => {
    if (filtroPersona === "todos") {
      return { tipo: "todos" };
    }
    const [tipo, ...rest] = filtroPersona.split(":");
    const nombre = rest.join(":");
    if (tipo === "cargado" && nombre) {
      return { tipo: "cargado", nombre };
    }
    if (tipo === "cerrado" && nombre) {
      return { tipo: "cerrado", nombre };
    }
    return { tipo: "todos" };
  }, [filtroPersona]);

  const cargasFiltradas = useMemo(() => {
    const porFecha = cargas.filter((carga) => {
      if (fechaDesde && carga.fecha < fechaDesde) {
        return false;
      }
      if (fechaHasta && carga.fecha > fechaHasta) {
        return false;
      }
      return true;
    });
    return filtrarCargasPorPersona(porFecha, filtroPersonaMep);
  }, [cargas, fechaDesde, fechaHasta, filtroPersonaMep]);

  const cargasAgrupadas = useMemo(
    () => agruparCargasPorFecha(cargasFiltradas),
    [cargasFiltradas]
  );

  const recuento = useMemo(
    () => calcularRecuentoMep(cargasFiltradas, cortesPorId),
    [cargasFiltradas, cortesPorId]
  );

  const serviciosConCierre = useMemo(
    () => cargasFiltradas.filter((c) => tieneCierre(c)).length,
    [cargasFiltradas]
  );

  const cargarHistorial = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [listaCargas, listaCortes] = await Promise.all([
        fetchMepDeliCargasHistorial(),
        fetchMepCortesTodos(),
      ]);
      setCargas(listaCargas);
      setCortes(listaCortes);
      if (listaCargas.length >= 2) {
        setCompararIdA(listaCargas[0]!.id);
        setCompararIdB(listaCargas[1]!.id);
      } else if (listaCargas.length === 1) {
        setCompararIdA(listaCargas[0]!.id);
        setCompararIdB(listaCargas[0]!.id);
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
      void cargarHistorial();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const borrarCarga = async (carga: MepDeliCarga) => {
    const ok = window.confirm(
      `¿Borrar la MEP del ${etiquetaCargaMep(carga)}? No se puede deshacer.`
    );
    if (!ok) {
      return;
    }
    setBorrandoId(carga.id);
    setError(null);
    try {
      await deleteMepDeliCarga(carga.id);
      setCargas((prev) => prev.filter((c) => c.id !== carga.id));
      if (compararIdA === carga.id || compararIdB === carga.id) {
        setCompararAbierto(false);
      }
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? formatPostgrestError(err as Parameters<typeof formatPostgrestError>[0])
          : "No se pudo borrar la MEP."
      );
    } finally {
      setBorrandoId(null);
    }
  };

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Historial MEP Deli</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Cargas del delivery nocturno, quién las hizo y cierres (faltó / sobró).
            </p>
          </div>
          <Link
            href="/mep-deli"
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            ← MEP Deli
          </Link>
        </header>

        <section className="mb-6 grid gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 sm:grid-cols-2 lg:grid-cols-3">
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
            aria-label="Fecha desde"
          />
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
            aria-label="Fecha hasta"
          />
          <select
            value={filtroPersona}
            onChange={(e) => setFiltroPersona(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 sm:col-span-2 lg:col-span-1"
            aria-label="Filtrar por persona"
          >
            <option value="todos">Todas las personas</option>
            {personas.cargadores.length > 0 ? (
              <optgroup label="Cargó">
                {personas.cargadores.map((nombre) => (
                  <option key={`c-${nombre}`} value={`cargado:${nombre}`}>
                    {nombre}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {personas.cerradores.length > 0 ? (
              <optgroup label="Cerró">
                {personas.cerradores.map((nombre) => (
                  <option key={`z-${nombre}`} value={`cerrado:${nombre}`}>
                    {nombre}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
          <button
            type="button"
            onClick={() => {
              setFechaDesde("");
              setFechaHasta("");
              setFiltroPersona("todos");
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-100 sm:col-span-2 lg:col-span-3"
          >
            Limpiar filtros
          </button>
          {cargasFiltradas.length >= 2 ? (
            <button
              type="button"
              onClick={() => setCompararAbierto((v) => !v)}
              className="rounded-lg border border-violet-800/50 bg-violet-950/25 px-3 py-2 text-sm text-violet-200 transition hover:border-violet-600 sm:col-span-2 lg:col-span-3"
            >
              {compararAbierto ? "Ocultar comparación" : "Comparar servicios"}
            </button>
          ) : null}
        </section>

        {compararAbierto && cargasFiltradas.length >= 2 ? (
          <MepCompararPanel
            cargas={cargasFiltradas}
            cortesPorId={cortesPorId}
            idA={compararIdA}
            idB={compararIdB}
            onCambiarA={setCompararIdA}
            onCambiarB={setCompararIdB}
            onCerrar={() => setCompararAbierto(false)}
          />
        ) : null}

        {!isLoading && cargasFiltradas.length > 0 && (
          <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Recuento del período
            </h2>
            <p className="mb-3 text-xs text-zinc-500">
              {serviciosConCierre} servicio{serviciosConCierre === 1 ? "" : "s"} con cierre
              registrado
              {cargasFiltradas.length > serviciosConCierre
                ? ` · ${cargasFiltradas.length - serviciosConCierre} sin cerrar`
                : ""}
            </p>
            {recuento.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Todavía no hay faltantes ni sobrantes en el período filtrado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                      <th className="pb-2 pr-3 font-medium">Ítem</th>
                      <th className="pb-2 pr-3 font-medium text-red-400">Faltó</th>
                      <th className="pb-2 font-medium text-amber-400">Sobró</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recuento.map((r) => (
                      <tr key={r.corte_id} className="border-b border-zinc-800/60">
                        <td className="py-2 pr-3 text-zinc-200">
                          <span className="text-zinc-500">{r.categoria} ·</span> {r.nombre}
                          <span className="ml-1 text-xs text-zinc-600">
                            ({r.servicios_con_cierre} serv.)
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-red-300">{r.faltos || "—"}</td>
                        <td className="py-2 text-amber-300">{r.sobraron || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {error ? (
          <p className="mb-5 rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando historial…
          </div>
        ) : cargasAgrupadas.length === 0 ? (
          cargas.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-4 text-sm leading-relaxed text-zinc-400">
              <p className="font-medium text-zinc-200">Todavía no hay registros</p>
              <p className="mt-2">
                Cuando el equipo guarde MEP desde{" "}
                <Link href="/mep-deli" className="text-zinc-300 underline">
                  MEP Deli
                </Link>
                , aparecerán acá.
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              No hay resultados para los filtros seleccionados.
            </p>
          )
        ) : (
          <div className="space-y-6">
            {cargasAgrupadas.map((grupo) => (
              <section key={grupo.fecha}>
                <h2 className="mb-3 text-sm uppercase tracking-[0.16em] text-zinc-500">
                  {grupo.fecha}
                </h2>
                <div className="space-y-2">
                  {grupo.cargas.map((carga) => {
                    const lineas = enriquecerLineasMep(carga.lineas, cortesPorId);
                    const cierre = tieneCierre(carga)
                      ? enriquecerCierreLineas(carga, cortesPorId)
                      : [];
                    const varianza = cierre.filter((l) => l.resultado !== "ok");

                    return (
                      <article
                        key={carga.id}
                        className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-zinc-100">
                            {etiquetaCargaMep(carga)}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">
                              Guardado {fechaHoraCarga(carga.created_at)}
                            </span>
                            <button
                              type="button"
                              onClick={() => void borrarCarga(carga)}
                              disabled={borrandoId === carga.id}
                              title="Borrar MEP"
                              className="inline-flex items-center gap-1 rounded-lg border border-red-900/50 bg-red-950/30 px-2 py-1 text-xs text-red-300 transition hover:border-red-700 hover:text-red-200 disabled:opacity-50"
                            >
                              {borrandoId === carga.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              Borrar
                            </button>
                          </div>
                        </div>
                        {carga.cargado_por_nombre ? (
                          <p className="mb-2 text-xs text-zinc-500">
                            Cargada por{" "}
                            <span className="text-zinc-300">{carga.cargado_por_nombre}</span>
                          </p>
                        ) : null}

                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                          MEP cargada
                        </p>
                        {lineas.length === 0 ? (
                          <p className="text-sm text-zinc-500">Sin líneas cargadas.</p>
                        ) : (
                          <ul className="mb-3 grid gap-1.5 sm:grid-cols-2">
                            {lineas.map((l) => (
                              <li key={`${carga.id}-${l.corte_id}`} className="text-sm text-zinc-200">
                                <span className="text-zinc-500">{l.categoria} ·</span> {l.nombre}:{" "}
                                <span className="font-medium text-white">
                                  {l.cantidad} {etiquetaUnidadMep(l.unidad)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="border-t border-zinc-800/80 pt-3">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Cierre
                          </p>
                          {!tieneCierre(carga) ? (
                            <p className="text-sm text-zinc-500">Sin cerrar todavía.</p>
                          ) : (
                            <>
                              {carga.cerrado_por_nombre ? (
                                <p className="mb-2 text-xs text-zinc-500">
                                  Cerrado por{" "}
                                  <span className="text-zinc-300">{carga.cerrado_por_nombre}</span>
                                  {carga.cierre_at ? (
                                    <span> · {fechaHoraCarga(carga.cierre_at)}</span>
                                  ) : null}
                                </p>
                              ) : null}
                              {varianza.length === 0 ? (
                                <p className="text-sm text-emerald-300/90">Todo OK.</p>
                              ) : (
                                <ul className="grid gap-1.5 sm:grid-cols-2">
                                  {varianza.map((l) => (
                                    <li
                                      key={`${carga.id}-c-${l.corte_id}`}
                                      className="text-sm text-zinc-200"
                                    >
                                      <span className="text-zinc-500">{l.categoria} ·</span>{" "}
                                      {l.nombre}:{" "}
                                      <span
                                        className={
                                          l.resultado === "falto"
                                            ? "text-red-300"
                                            : "text-amber-300"
                                        }
                                      >
                                        {etiquetaResultadoCierre(l.resultado)}
                                        {l.cantidad
                                          ? ` (${l.cantidad} ${etiquetaUnidadMep(l.unidad)})`
                                          : ""}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
