"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  History,
  Loader2,
  SearchX,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import {
  Boton,
  BotonIcono,
  Campo,
  EstadoVacio,
  EsqueletoLista,
  Etiqueta,
  Pantalla,
  Seccion,
  Selector,
  useAvisos,
  type OpcionSelector,
} from "@/app/ui";
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

/** "2025-11-20" → "Jueves 20 nov" (con año si no es el actual). */
function fechaGrupo(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) {
    return iso;
  }
  const fecha = new Date(a, m - 1, d);
  const texto = fecha.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: a === new Date().getFullYear() ? undefined : "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
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
  const { confirmar } = useAvisos();

  const cortesPorId = useMemo(
    () => new Map(cortes.map((c) => [c.id, c])),
    [cortes],
  );

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
    [cargasFiltradas],
  );

  const recuento = useMemo(
    () => calcularRecuentoMep(cargasFiltradas, cortesPorId),
    [cargasFiltradas, cortesPorId],
  );

  const serviciosConCierre = useMemo(
    () => cargasFiltradas.filter((c) => tieneCierre(c)).length,
    [cargasFiltradas],
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
        err instanceof Error ? err.message : "Error al conectar con Supabase.",
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
    const ok = await confirmar({
      titulo: `¿Borrar la MEP del ${etiquetaCargaMep(carga)}?`,
      texto: "Se borran la carga y su cierre. No se puede deshacer.",
      confirmar: "Borrar MEP",
      peligro: true,
    });
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
          ? formatPostgrestError(
              err as Parameters<typeof formatPostgrestError>[0],
            )
          : "No se pudo borrar la MEP.",
      );
    } finally {
      setBorrandoId(null);
    }
  };

  const limpiarFiltros = () => {
    setFechaDesde("");
    setFechaHasta("");
    setFiltroPersona("todos");
  };

  const hayFiltros = Boolean(
    fechaDesde || fechaHasta || filtroPersona !== "todos",
  );

  const opcionesPersona: OpcionSelector<string>[] = [
    { valor: "todos", label: "Todas las personas" },
    ...personas.cargadores.map((nombre) => ({
      valor: `cargado:${nombre}`,
      label: `Cargó: ${nombre}`,
    })),
    ...personas.cerradores.map((nombre) => ({
      valor: `cerrado:${nombre}`,
      label: `Cerró: ${nombre}`,
    })),
  ];

  const sinCerrar = cargasFiltradas.length - serviciosConCierre;

  return (
    <Pantalla
      titulo="Historial MEP"
      subtitulo={
        isLoading
          ? "Cargando…"
          : `${cargasFiltradas.length} ${cargasFiltradas.length === 1 ? "servicio" : "servicios"}${
              hayFiltros ? " (filtrado)" : ""
            }${sinCerrar > 0 ? ` · ${sinCerrar} sin cerrar` : ""}`
      }
      ancho="amplio"
      acciones={
        <Link
          href="/mep-deli"
          className="inline-flex min-h-11 items-center rounded-full bg-fill px-4 text-[0.92rem] font-semibold text-label transition hover:bg-fill-strong active:scale-95"
        >
          MEP Deli
        </Link>
      }
      ayuda={
        <>
          <p>
            Las MEP del delivery nocturno: qué se cargó, quién la cargó y cómo
            cerró cada servicio (qué faltó y qué sobró).
          </p>
          <p>
            Filtrá por fechas o por persona. El{" "}
            <strong className="text-label">Recuento</strong> suma los faltantes
            y sobrantes de los servicios filtrados.
          </p>
          <p>
            <strong className="text-label">Comparar</strong> pone dos servicios
            uno al lado del otro. Tocá «MEP cargada» en un servicio para ver
            todas sus cantidades.
          </p>
        </>
      }
    >
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

      <Seccion
        titulo="Filtros"
        accion={
          hayFiltros ? (
            <Boton
              variante="terciario"
              tamano="chico"
              className="min-h-11"
              onClick={limpiarFiltros}
            >
              Limpiar
            </Boton>
          ) : undefined
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <Campo
              type="date"
              label="Desde"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
            <Campo
              type="date"
              label="Hasta"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          <Selector
            label="Persona"
            titulo="Filtrar por persona"
            valor={filtroPersona}
            opciones={opcionesPersona}
            onChange={setFiltroPersona}
            buscar={opcionesPersona.length > 10}
          />
        </div>
        {cargasFiltradas.length >= 2 && !compararAbierto ? (
          <Boton
            variante="secundario"
            ancho
            className="mt-3"
            icono={<ArrowLeftRight className="h-[18px] w-[18px]" aria-hidden />}
            onClick={() => setCompararAbierto(true)}
          >
            Comparar servicios
          </Boton>
        ) : null}
      </Seccion>

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
        <Seccion
          titulo="Recuento del período"
          pie={`${serviciosConCierre} ${serviciosConCierre === 1 ? "servicio" : "servicios"} con cierre registrado${
            sinCerrar > 0 ? ` · ${sinCerrar} sin cerrar` : ""
          }`}
        >
          {recuento.length === 0 ? (
            <p className="rounded-card bg-surface-3 px-4 py-3.5 text-[0.94rem] text-label-3">
              Todavía no hay faltantes ni sobrantes en el período filtrado.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
              <li
                aria-hidden
                className="flex items-center gap-2 border-b border-separator py-2 pl-4 pr-4 text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-label-3"
              >
                <span className="flex-1">Ítem</span>
                <span className="w-14 text-center text-danger">Faltó</span>
                <span className="w-14 text-center text-warning">Sobró</span>
              </li>
              {recuento.map((r) => (
                <li
                  key={r.corte_id}
                  className="flex min-h-14 items-center gap-2 border-b border-separator py-2 pl-4 pr-4 last:border-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[1rem] leading-snug text-label">
                      {r.nombre}
                    </span>
                    <span className="block truncate text-[0.84rem] text-label-3">
                      {r.categoria} · {r.servicios_con_cierre} serv.
                    </span>
                  </span>
                  <span
                    className={`w-14 text-center font-mono text-[1.02rem] tabular-nums ${
                      r.faltos ? "font-semibold text-danger" : "text-label-3"
                    }`}
                  >
                    <span className="sr-only">Faltó </span>
                    {r.faltos || "—"}
                  </span>
                  <span
                    className={`w-14 text-center font-mono text-[1.02rem] tabular-nums ${
                      r.sobraron ? "font-semibold text-warning" : "text-label-3"
                    }`}
                  >
                    <span className="sr-only">Sobró </span>
                    {r.sobraron || "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      )}

      {isLoading ? (
        <div className="mt-6">
          <EsqueletoLista filas={6} />
        </div>
      ) : cargasAgrupadas.length === 0 ? (
        <div className="mt-6 rounded-card bg-surface-3">
          {cargas.length === 0 ? (
            <EstadoVacio
              icono={<History className="h-6 w-6" aria-hidden />}
              titulo="Todavía no hay registros"
              texto="Cuando el equipo guarde una MEP desde MEP Deli, aparece acá."
              accion={
                <Link
                  href="/mep-deli"
                  className="inline-flex min-h-11 items-center justify-center rounded-control bg-accent px-4 text-[0.97rem] font-semibold text-on-accent transition active:scale-[0.97]"
                >
                  Ir a MEP Deli
                </Link>
              }
            />
          ) : (
            <EstadoVacio
              icono={<SearchX className="h-6 w-6" aria-hidden />}
              titulo="Sin resultados"
              texto="No hay servicios para los filtros elegidos."
              accion={
                <Boton variante="secundario" onClick={limpiarFiltros}>
                  Limpiar filtros
                </Boton>
              }
            />
          )}
        </div>
      ) : (
        cargasAgrupadas.map((grupo) => (
          <Seccion key={grupo.fecha} titulo={fechaGrupo(grupo.fecha)}>
            <div className="space-y-3">
              {grupo.cargas.map((carga) => {
                const lineas = enriquecerLineasMep(carga.lineas, cortesPorId);
                const cerrada = tieneCierre(carga);
                const cierre = cerrada
                  ? enriquecerCierreLineas(carga, cortesPorId)
                  : [];
                const varianza = cierre.filter((l) => l.resultado !== "ok");
                const borrando = borrandoId === carga.id;

                return (
                  <article
                    key={carga.id}
                    className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
                  >
                    <header className="flex items-start gap-3 py-3 pl-4 pr-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[1.03rem] font-semibold text-label">
                            {etiquetaCargaMep(carga)}
                          </p>
                          <Etiqueta tono={cerrada ? "exito" : "alerta"}>
                            {cerrada ? "Cerrada" : "Sin cerrar"}
                          </Etiqueta>
                        </div>
                        <p className="mt-0.5 text-[0.86rem] text-label-3">
                          {carga.cargado_por_nombre ? (
                            <>
                              Cargada por{" "}
                              <span className="text-label-2">
                                {carga.cargado_por_nombre}
                              </span>{" "}
                              ·{" "}
                            </>
                          ) : null}
                          Guardado {fechaHoraCarga(carga.created_at)}
                        </p>
                      </div>
                      <BotonIcono
                        etiqueta={`Borrar MEP del ${etiquetaCargaMep(carga)}`}
                        variante="plano"
                        disabled={borrando}
                        onClick={() => void borrarCarga(carga)}
                        className="text-label-3 hover:text-danger"
                        icono={
                          borrando ? (
                            <Loader2
                              className="h-[18px] w-[18px] animate-spin"
                              aria-hidden
                            />
                          ) : (
                            <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                          )
                        }
                      />
                    </header>

                    <div className="border-t border-separator px-4 py-3">
                      <p className="mb-1.5 text-[0.8rem] font-semibold uppercase tracking-[0.07em] text-label-3">
                        Cierre
                      </p>
                      {!cerrada ? (
                        <p className="text-[0.94rem] text-label-3">
                          Sin cerrar todavía.
                        </p>
                      ) : (
                        <>
                          {carga.cerrado_por_nombre ? (
                            <p className="mb-2 text-[0.86rem] text-label-3">
                              Cerrado por{" "}
                              <span className="text-label-2">
                                {carga.cerrado_por_nombre}
                              </span>
                              {carga.cierre_at
                                ? ` · ${fechaHoraCarga(carga.cierre_at)}`
                                : null}
                            </p>
                          ) : null}
                          {varianza.length === 0 ? (
                            <p className="flex items-center gap-2 text-[0.94rem] font-medium text-success">
                              <CircleCheck
                                className="h-[18px] w-[18px]"
                                aria-hidden
                              />
                              Todo OK
                            </p>
                          ) : (
                            <ul className="grid gap-x-6 sm:grid-cols-2">
                              {varianza.map((l) => (
                                <li
                                  key={`${carga.id}-c-${l.corte_id}`}
                                  className="flex items-center gap-3 border-t border-separator py-2 first:border-t-0 sm:[&:nth-child(2)]:border-t-0"
                                >
                                  <span className="min-w-0 flex-1 text-[0.94rem] leading-snug text-label">
                                    {l.nombre}
                                    <span className="ml-1.5 text-[0.8rem] text-label-3">
                                      {l.categoria}
                                    </span>
                                  </span>
                                  <Etiqueta
                                    tono={
                                      l.resultado === "falto"
                                        ? "peligro"
                                        : "alerta"
                                    }
                                  >
                                    {etiquetaResultadoCierre(l.resultado)}
                                    {l.cantidad
                                      ? ` · ${l.cantidad} ${etiquetaUnidadMep(l.unidad)}`
                                      : ""}
                                  </Etiqueta>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </div>

                    <details className="group border-t border-separator">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-[0.94rem] font-medium text-label-2 transition active:bg-fill [&::-webkit-details-marker]:hidden">
                        <span className="flex-1">
                          MEP cargada ·{" "}
                          {lineas.length === 0
                            ? "sin líneas"
                            : `${lineas.length} ${lineas.length === 1 ? "corte" : "cortes"}`}
                        </span>
                        <ChevronDown
                          className="h-[18px] w-[18px] text-label-3 transition-transform group-open:rotate-180"
                          aria-hidden
                        />
                      </summary>
                      {lineas.length === 0 ? (
                        <p className="px-4 pb-3 text-[0.94rem] text-label-3">
                          Sin líneas cargadas.
                        </p>
                      ) : (
                        <ul className="grid gap-x-6 px-4 pb-2 sm:grid-cols-2">
                          {lineas.map((l) => (
                            <li
                              key={`${carga.id}-${l.corte_id}`}
                              className="flex items-baseline gap-3 border-t border-separator py-2"
                            >
                              <span className="min-w-0 flex-1 text-[0.94rem] leading-snug text-label">
                                {l.nombre}
                                <span className="ml-1.5 text-[0.8rem] text-label-3">
                                  {l.categoria}
                                </span>
                              </span>
                              <span className="shrink-0 font-mono text-[0.97rem] font-semibold tabular-nums text-label">
                                {l.cantidad}
                                <span className="ml-1 font-sans text-[0.8rem] font-normal text-label-3">
                                  {etiquetaUnidadMep(l.unidad)}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  </article>
                );
              })}
            </div>
          </Seccion>
        ))
      )}
    </Pantalla>
  );
}
