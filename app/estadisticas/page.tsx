"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  GlassWater,
  Loader2,
  Sparkles,
  Sprout,
  UtensilsCrossed,
} from "lucide-react";

import {
  fetchBebidasPorHistorial,
  type BebidaAsientoResumen,
} from "@/src/lib/bebidas-asientos";
import {
  normalizarRubro,
  type RubroIngrediente,
} from "@/src/lib/ingredientes-rubro";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

type Servicio = "Mediodia" | "Noche";
type Categoria = "Otsumami" | "Nigiri" | "Postre" | "Extensión";

type RegistroHistorial = {
  id: string;
  fecha: string;
  hora: string | null;
  servicio: Servicio | null;
  menu_omakase: string[] | null;
  extensiones: string[] | null;
};

type PlatoLite = {
  id: string;
  nombre: string;
  categoria: Categoria | null;
  ingredientes_requeridos: string[] | null;
};

type IngredienteLite = {
  id: string;
  nombre: string;
  rubro: string | null;
};

const CATEGORIA_CHIP: Record<Categoria, string> = {
  Otsumami: "border-amber-500/40 bg-amber-950/40 text-amber-200",
  Nigiri: "border-sky-500/40 bg-sky-950/40 text-sky-200",
  Postre: "border-rose-500/40 bg-rose-950/40 text-rose-200",
  Extensión: "border-emerald-500/40 bg-emerald-950/40 text-emerald-200",
};

const CATEGORIA_BAR: Record<Categoria, string> = {
  Otsumami: "bg-amber-500/70",
  Nigiri: "bg-sky-500/70",
  Postre: "bg-rose-500/70",
  Extensión: "bg-emerald-500/70",
};

const RUBRO_DOT: Record<RubroIngrediente, string> = {
  "Pescado/Marisco": "bg-sky-400",
  "Fruta/Vegetal": "bg-emerald-400",
  "Despensa/Prep": "bg-amber-400",
};

/** Cantidad de bebida a número: vacío o no parseable cuenta como 1 (una línea = al menos un consumo). */
const cantidadBebidaANumero = (s: string): number => {
  const t = s.trim().replace(",", ".");
  if (!t) {
    return 1;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

/** Agrupa textos equivalentes (trim + minúsculas) conservando el primero visto para mostrar. */
const claveNormalizada = (s: string): string => s.trim().toLowerCase();

function BarraRanking(props: {
  etiqueta: string;
  valor: number;
  max: number;
  sufijo?: string;
  colorBarra?: string;
  detalle?: React.ReactNode;
  prefijo?: React.ReactNode;
}) {
  const { etiqueta, valor, max, sufijo, colorBarra, detalle, prefijo } = props;
  const pct = max > 0 ? Math.max(4, Math.round((valor / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm text-zinc-100">
          {prefijo}
          <span className="truncate">{etiqueta}</span>
          {detalle}
        </span>
        <span className="shrink-0 text-sm tabular-nums text-zinc-300">
          {valor}
          {sufijo ? <span className="text-zinc-500">{sufijo}</span> : null}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${colorBarra ?? "bg-zinc-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function KpiCard(props: {
  icono: React.ReactNode;
  titulo: string;
  valor: string;
  sub?: string;
}) {
  const { icono, titulo, valor, sub } = props;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex items-center gap-2 text-zinc-400">
        {icono}
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
          {titulo}
        </p>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{valor}</p>
      {sub ? <p className="mt-0.5 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}

export default function EstadisticasPage() {
  const [historial, setHistorial] = useState<RegistroHistorial[]>([]);
  const [platos, setPlatos] = useState<PlatoLite[]>([]);
  const [ingredientes, setIngredientes] = useState<IngredienteLite[]>([]);
  const [bebidasPorServicio, setBebidasPorServicio] = useState<
    Map<string, BebidaAsientoResumen[]>
  >(() => new Map());
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [filtroServicio, setFiltroServicio] = useState<"Todos" | Servicio>("Todos");
  const [verTodosPlatos, setVerTodosPlatos] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advertenciaBebidas, setAdvertenciaBebidas] = useState<string | null>(null);

  const platosMap = useMemo(
    () => new Map(platos.map((p) => [p.id, p])),
    [platos]
  );
  const ingredientesMap = useMemo(
    () => new Map(ingredientes.map((i) => [i.id, i])),
    [ingredientes]
  );

  const historialFiltrado = useMemo(() => {
    return historial.filter((r) => {
      if (filtroServicio !== "Todos" && r.servicio !== filtroServicio) {
        return false;
      }
      if (fechaDesde && r.fecha < fechaDesde) {
        return false;
      }
      if (fechaHasta && r.fecha > fechaHasta) {
        return false;
      }
      return true;
    });
  }, [historial, filtroServicio, fechaDesde, fechaHasta]);

  const kpis = useMemo(() => {
    const total = historialFiltrado.length;
    const mediodia = historialFiltrado.filter((r) => r.servicio === "Mediodia").length;
    const noche = historialFiltrado.filter((r) => r.servicio === "Noche").length;
    const fechas = historialFiltrado.map((r) => r.fecha).sort();
    const desde = fechas[0] ?? null;
    const hasta = fechas[fechas.length - 1] ?? null;

    let sumaExtensiones = 0;
    historialFiltrado.forEach((r) => {
      sumaExtensiones += (r.extensiones ?? []).filter((id) =>
        String(id ?? "").trim()
      ).length;
    });
    const promedioExtensiones = total > 0 ? sumaExtensiones / total : 0;

    return {
      total,
      mediodia,
      noche,
      desde,
      hasta,
      promedioExtensiones,
    };
  }, [historialFiltrado]);

  const rankingPlatos = useMemo(() => {
    const conteo = new Map<string, number>();
    historialFiltrado.forEach((r) => {
      const ids = [
        ...(r.menu_omakase ?? []),
        ...(r.extensiones ?? []),
      ]
        .map((id) => String(id ?? "").trim())
        .filter(Boolean);
      ids.forEach((id) => conteo.set(id, (conteo.get(id) ?? 0) + 1));
    });

    const filas = [...conteo.entries()]
      .map(([id, veces]) => {
        const plato = platosMap.get(id);
        return {
          id,
          nombre: plato?.nombre ?? `Plato ${id.slice(0, 6)}…`,
          categoria: (plato?.categoria ?? null) as Categoria | null,
          veces,
        };
      })
      .sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre, "es"));

    return filas;
  }, [historialFiltrado, platosMap]);

  /** Platos del catálogo que no aparecieron ni una vez en el período filtrado. */
  const platosSinUso = useMemo(() => {
    const usados = new Set(rankingPlatos.map((f) => f.id));
    return platos
      .filter((p) => !usados.has(p.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [platos, rankingPlatos]);

  const rankingBebidas = useMemo(() => {
    const ids = new Set(historialFiltrado.map((r) => r.id));
    const conteo = new Map<string, { nombre: string; total: number }>();
    let serviciosConBebidas = 0;

    ids.forEach((id) => {
      const asientos = bebidasPorServicio.get(id);
      if (!asientos || asientos.length === 0) {
        return;
      }
      serviciosConBebidas += 1;
      asientos.forEach((asiento) => {
        asiento.lineas.forEach((linea) => {
          if (!linea.bebida.trim()) {
            return;
          }
          const key = claveNormalizada(linea.bebida);
          const prev = conteo.get(key);
          const sumar = cantidadBebidaANumero(linea.cantidad);
          if (prev) {
            prev.total += sumar;
          } else {
            conteo.set(key, { nombre: linea.bebida.trim(), total: sumar });
          }
        });
      });
    });

    const filas = [...conteo.values()]
      .map((f) => ({ ...f, total: Math.round(f.total * 100) / 100 }))
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"));

    const totalUnidades = filas.reduce((acc, f) => acc + f.total, 0);

    return { filas, serviciosConBebidas, totalUnidades };
  }, [historialFiltrado, bebidasPorServicio]);

  /** Ingredientes por nº de servicios en que se necesitaron (vía platos del menú). */
  const rankingIngredientes = useMemo(() => {
    const conteo = new Map<string, number>();
    historialFiltrado.forEach((r) => {
      const platoIds = [
        ...(r.menu_omakase ?? []),
        ...(r.extensiones ?? []),
      ]
        .map((id) => String(id ?? "").trim())
        .filter(Boolean);

      const ingredientesDelServicio = new Set<string>();
      platoIds.forEach((pid) => {
        const plato = platosMap.get(pid);
        (plato?.ingredientes_requeridos ?? []).forEach((ingId) => {
          const id = String(ingId ?? "").trim();
          if (id) {
            ingredientesDelServicio.add(id);
          }
        });
      });

      ingredientesDelServicio.forEach((id) =>
        conteo.set(id, (conteo.get(id) ?? 0) + 1)
      );
    });

    return [...conteo.entries()]
      .map(([id, servicios]) => {
        const ing = ingredientesMap.get(id);
        return {
          id,
          nombre: ing?.nombre ?? `Ingrediente ${id.slice(0, 6)}…`,
          rubro: normalizarRubro(ing?.rubro),
          servicios,
        };
      })
      .sort(
        (a, b) => b.servicios - a.servicios || a.nombre.localeCompare(b.nombre, "es")
      );
  }, [historialFiltrado, platosMap, ingredientesMap]);

  const cargarDatos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [historialResponse, platosResponse, ingredientesResponse] =
        await Promise.all([
          supabase
            .from("historial_servicios")
            .select("id, fecha, hora, servicio, menu_omakase, extensiones")
            .order("fecha", { ascending: false }),
          supabase
            .from("platos")
            .select("id, nombre, categoria, ingredientes_requeridos"),
          supabase.from("ingredientes").select("id, nombre, rubro"),
        ]);

      if (historialResponse.error) {
        setError(formatPostgrestError(historialResponse.error));
        return;
      }
      if (platosResponse.error) {
        setError(formatPostgrestError(platosResponse.error));
        return;
      }
      if (ingredientesResponse.error) {
        setError(formatPostgrestError(ingredientesResponse.error));
        return;
      }

      setHistorial((historialResponse.data as RegistroHistorial[]) ?? []);
      setPlatos((platosResponse.data as PlatoLite[]) ?? []);
      setIngredientes((ingredientesResponse.data as IngredienteLite[]) ?? []);

      try {
        const bebidasMap = await fetchBebidasPorHistorial();
        setBebidasPorServicio(bebidasMap);
        setAdvertenciaBebidas(null);
      } catch (bebidasErr) {
        setBebidasPorServicio(new Map());
        setAdvertenciaBebidas(
          formatPostgrestError(
            bebidasErr as { message: string; code?: string; details?: string; hint?: string }
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar con Supabase.");
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

  const hayFiltros =
    Boolean(fechaDesde) || Boolean(fechaHasta) || filtroServicio !== "Todos";

  const platosVisibles = verTodosPlatos ? rankingPlatos : rankingPlatos.slice(0, 12);
  const maxPlatos = rankingPlatos[0]?.veces ?? 0;
  const bebidasVisibles = rankingBebidas.filas.slice(0, 12);
  const maxBebidas = rankingBebidas.filas[0]?.total ?? 0;
  const ingredientesVisibles = rankingIngredientes.slice(0, 12);
  const maxIngredientes = rankingIngredientes[0]?.servicios ?? 0;

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <Sparkles className="h-5 w-5 text-zinc-400" aria-hidden />
            Estadísticas
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Análisis del historial de servicios: platos más servidos, bebidas más
            pedidas e ingredientes más usados. Filtrá por fecha y servicio.
          </p>
        </header>

        <section className="mb-6 grid gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 sm:grid-cols-3">
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
            value={filtroServicio}
            onChange={(e) => setFiltroServicio(e.target.value as "Todos" | Servicio)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
            aria-label="Filtrar por servicio"
          >
            <option value="Todos">Todos los servicios</option>
            <option value="Mediodia">Mediodia</option>
            <option value="Noche">Noche</option>
          </select>
          {hayFiltros ? (
            <button
              type="button"
              onClick={() => {
                setFechaDesde("");
                setFechaHasta("");
                setFiltroServicio("Todos");
              }}
              className="sm:col-span-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-100"
            >
              Limpiar filtros
            </button>
          ) : null}
        </section>

        {error ? (
          <p className="mb-5 rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculando estadísticas...
          </div>
        ) : kpis.total === 0 ? (
          <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-4 text-sm text-zinc-400">
            {historial.length === 0
              ? "Todavía no hay servicios guardados en el historial."
              : "No hay servicios para los filtros seleccionados."}
          </p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                icono={<CalendarRange className="h-4 w-4" aria-hidden />}
                titulo="Servicios"
                valor={String(kpis.total)}
                sub={
                  kpis.desde && kpis.hasta
                    ? kpis.desde === kpis.hasta
                      ? kpis.desde
                      : `${kpis.desde} → ${kpis.hasta}`
                    : undefined
                }
              />
              <KpiCard
                icono={<UtensilsCrossed className="h-4 w-4" aria-hidden />}
                titulo="Mediodía / Noche"
                valor={`${kpis.mediodia} / ${kpis.noche}`}
                sub="servicios por franja"
              />
              <KpiCard
                icono={<Sparkles className="h-4 w-4" aria-hidden />}
                titulo="Extensiones/serv."
                valor={kpis.promedioExtensiones.toFixed(1)}
                sub="promedio de extras"
              />
              <KpiCard
                icono={<GlassWater className="h-4 w-4" aria-hidden />}
                titulo="Bebidas"
                valor={String(Math.round(rankingBebidas.totalUnidades))}
                sub={`en ${rankingBebidas.serviciosConBebidas} servicio(s)`}
              />
            </div>

            <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-zinc-400">
                  <UtensilsCrossed className="h-4 w-4" aria-hidden />
                  Platos más servidos
                </h2>
                {rankingPlatos.length > 12 ? (
                  <button
                    type="button"
                    onClick={() => setVerTodosPlatos((v) => !v)}
                    className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
                  >
                    {verTodosPlatos ? "Ver top 12" : `Ver todos (${rankingPlatos.length})`}
                  </button>
                ) : null}
              </div>
              {platosVisibles.length === 0 ? (
                <p className="text-sm text-zinc-500">Sin platos en el período.</p>
              ) : (
                <div className="space-y-3">
                  {platosVisibles.map((fila) => (
                    <BarraRanking
                      key={fila.id}
                      etiqueta={fila.nombre}
                      valor={fila.veces}
                      max={maxPlatos}
                      sufijo=" serv."
                      colorBarra={
                        fila.categoria ? CATEGORIA_BAR[fila.categoria] : "bg-zinc-400"
                      }
                      detalle={
                        fila.categoria ? (
                          <span
                            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${CATEGORIA_CHIP[fila.categoria]}`}
                          >
                            {fila.categoria}
                          </span>
                        ) : null
                      }
                    />
                  ))}
                </div>
              )}
              {platosSinUso.length > 0 ? (
                <div className="mt-4 border-t border-zinc-800/80 pt-3">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Sin uso en el período ({platosSinUso.length})
                  </p>
                  <p className="text-xs leading-relaxed text-zinc-500">
                    {platosSinUso.map((p) => p.nombre).join(" · ")}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <h2 className="mb-4 flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-zinc-400">
                <GlassWater className="h-4 w-4" aria-hidden />
                Bebidas más pedidas
              </h2>
              {advertenciaBebidas ? (
                <p className="rounded-lg border border-amber-900/70 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
                  No se pudieron cargar las bebidas: {advertenciaBebidas}
                </p>
              ) : bebidasVisibles.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No hay bebidas registradas en el período.
                </p>
              ) : (
                <div className="space-y-3">
                  {bebidasVisibles.map((fila) => (
                    <BarraRanking
                      key={fila.nombre}
                      etiqueta={fila.nombre}
                      valor={fila.total}
                      max={maxBebidas}
                      colorBarra="bg-fuchsia-500/70"
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <h2 className="mb-1 flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-zinc-400">
                <Sprout className="h-4 w-4" aria-hidden />
                Ingredientes más usados
              </h2>
              <p className="mb-4 text-xs text-zinc-500">
                Por cantidad de servicios en los que se necesitaron (según los platos
                del menú). Útil para anticipar compras.
              </p>
              {ingredientesVisibles.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No hay ingredientes asociados a los platos del período.
                </p>
              ) : (
                <div className="space-y-3">
                  {ingredientesVisibles.map((fila) => (
                    <BarraRanking
                      key={fila.id}
                      etiqueta={fila.nombre}
                      valor={fila.servicios}
                      max={maxIngredientes}
                      sufijo=" serv."
                      colorBarra="bg-zinc-400"
                      prefijo={
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${RUBRO_DOT[fila.rubro]}`}
                          title={fila.rubro}
                        />
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
