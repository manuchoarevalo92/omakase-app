"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  ChartColumn,
  CircleAlert,
  GlassWater,
  Sparkles,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react";

import {
  Boton,
  Campo,
  EsqueletoLista,
  EstadoVacio,
  Etiqueta,
  Pantalla,
  Seccion,
  Segmentado,
} from "@/app/ui";

import {
  fetchBebidasPorHistorial,
  type BebidaAsientoResumen,
} from "@/src/lib/bebidas-asientos";
import {
  normalizarRubro,
  type RubroIngrediente,
} from "@/src/lib/ingredientes-rubro";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { formatearFechaServicio } from "@/src/lib/historial-servicios";
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

const CATEGORIA_TONO: Record<
  Categoria,
  "alerta" | "info" | "acento" | "exito"
> = {
  Otsumami: "alerta",
  Nigiri: "info",
  Postre: "acento",
  Extensión: "exito",
};

const CATEGORIA_BAR: Record<Categoria, string> = {
  Otsumami: "bg-warning",
  Nigiri: "bg-info",
  Postre: "bg-accent",
  Extensión: "bg-success",
};

const RUBRO_DOT: Record<RubroIngrediente, string> = {
  "Pescado/Marisco": "bg-info",
  "Fruta/Vegetal": "bg-success",
  "Despensa/Prep": "bg-warning",
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
    <li className="border-b border-separator px-4 py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-[1rem] text-label">
          {prefijo}
          <span className="truncate">{etiqueta}</span>
          {detalle}
        </span>
        <span className="shrink-0 text-[0.95rem] tabular-nums text-label-2">
          {valor}
          {sufijo ? <span className="text-label-3">{sufijo}</span> : null}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-fill">
        <div
          className={`h-full rounded-full ${colorBarra ?? "bg-label-3"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
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
    <div className="min-w-0 rounded-card bg-surface-3 p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <p className="flex items-center gap-1.5 text-[0.8rem] font-medium text-label-3">
        {icono}
        <span className="truncate">{titulo}</span>
      </p>
      <p className="mt-1.5 text-[1.6rem] font-semibold leading-tight tabular-nums text-label">
        {valor}
      </p>
      {sub ? (
        <p className="mt-0.5 text-[0.82rem] leading-snug text-label-3">{sub}</p>
      ) : null}
    </div>
  );
}

/** Lista agrupada donde van las filas de ranking. */
function ListaRanking(props: { children: React.ReactNode }) {
  return (
    <ul className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      {props.children}
    </ul>
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
  const [filtroServicio, setFiltroServicio] = useState<"Todos" | Servicio>(
    "Todos",
  );
  const [verTodosPlatos, setVerTodosPlatos] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advertenciaBebidas, setAdvertenciaBebidas] = useState<string | null>(
    null,
  );

  const platosMap = useMemo(
    () => new Map(platos.map((p) => [p.id, p])),
    [platos],
  );
  const ingredientesMap = useMemo(
    () => new Map(ingredientes.map((i) => [i.id, i])),
    [ingredientes],
  );

  const historialFiltrado = useMemo(() => {
    return historial.filter((r) => {
      if (filtroServicio !== "Todos" && r.servicio !== filtroServicio) {
        return false;
      }
      if (fechaDesde && r.fecha.slice(0, 10) < fechaDesde) {
        return false;
      }
      if (fechaHasta && r.fecha.slice(0, 10) > fechaHasta) {
        return false;
      }
      return true;
    });
  }, [historial, filtroServicio, fechaDesde, fechaHasta]);

  const kpis = useMemo(() => {
    const total = historialFiltrado.length;
    const mediodia = historialFiltrado.filter(
      (r) => r.servicio === "Mediodia",
    ).length;
    const noche = historialFiltrado.filter(
      (r) => r.servicio === "Noche",
    ).length;
    const fechas = historialFiltrado.map((r) => r.fecha).sort();
    const desde = fechas[0] ?? null;
    const hasta = fechas[fechas.length - 1] ?? null;

    let sumaExtensiones = 0;
    historialFiltrado.forEach((r) => {
      sumaExtensiones += (r.extensiones ?? []).filter((id) =>
        String(id ?? "").trim(),
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
      const ids = [...(r.menu_omakase ?? []), ...(r.extensiones ?? [])]
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
      .sort(
        (a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre, "es"),
      );

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
      .sort(
        (a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"),
      );

    const totalUnidades = filas.reduce((acc, f) => acc + f.total, 0);

    return { filas, serviciosConBebidas, totalUnidades };
  }, [historialFiltrado, bebidasPorServicio]);

  /** Ingredientes por nº de servicios en que se necesitaron (vía platos del menú). */
  const rankingIngredientes = useMemo(() => {
    const conteo = new Map<string, number>();
    historialFiltrado.forEach((r) => {
      const platoIds = [...(r.menu_omakase ?? []), ...(r.extensiones ?? [])]
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
        conteo.set(id, (conteo.get(id) ?? 0) + 1),
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
        (a, b) =>
          b.servicios - a.servicios || a.nombre.localeCompare(b.nombre, "es"),
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
            .select("id, nombre, categoria, ingredientes_requeridos")
            .eq("tipo", "carta"),
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
            bebidasErr as {
              message: string;
              code?: string;
              details?: string;
              hint?: string;
            },
          ),
        );
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
      void cargarDatos();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const hayFiltros =
    Boolean(fechaDesde) || Boolean(fechaHasta) || filtroServicio !== "Todos";

  const platosVisibles = verTodosPlatos
    ? rankingPlatos
    : rankingPlatos.slice(0, 12);
  const maxPlatos = rankingPlatos[0]?.veces ?? 0;
  const bebidasVisibles = rankingBebidas.filas.slice(0, 12);
  const maxBebidas = rankingBebidas.filas[0]?.total ?? 0;
  const ingredientesVisibles = rankingIngredientes.slice(0, 12);
  const maxIngredientes = rankingIngredientes[0]?.servicios ?? 0;

  return (
    <Pantalla
      titulo="Estadísticas"
      subtitulo={
        isLoading
          ? "Cargando…"
          : `${kpis.total} ${kpis.total === 1 ? "servicio" : "servicios"}${hayFiltros ? " · con filtros" : ""}`
      }
      ancho="amplio"
      ayuda={
        <>
          <p>
            Análisis del historial de servicios: platos más servidos, bebidas
            más pedidas e ingredientes más usados.
          </p>
          <p>
            Filtrá por fecha y servicio. Las fechas son opcionales: si las dejás
            vacías se cuenta todo el historial.
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
              onClick={() => {
                setFechaDesde("");
                setFechaHasta("");
                setFiltroServicio("Todos");
              }}
            >
              Limpiar
            </Boton>
          ) : null
        }
      >
        <div className="space-y-3">
          <Segmentado
            etiqueta="Filtrar por servicio"
            valor={filtroServicio}
            onChange={setFiltroServicio}
            opciones={[
              { valor: "Todos", label: "Todos" },
              { valor: "Mediodia", label: "Mediodía" },
              { valor: "Noche", label: "Noche" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
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
        </div>
      </Seccion>

      {isLoading ? (
        <Seccion>
          <EsqueletoLista filas={6} />
        </Seccion>
      ) : kpis.total === 0 ? (
        <EstadoVacio
          icono={<ChartColumn className="h-6 w-6" aria-hidden />}
          titulo={
            historial.length === 0
              ? "Todavía no hay servicios"
              : "Nada para estos filtros"
          }
          texto={
            historial.length === 0
              ? "Cuando se guarden servicios en el historial, vas a ver las estadísticas acá."
              : "No hay servicios para los filtros elegidos."
          }
        />
      ) : (
        <>
          <Seccion titulo="Resumen">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                icono={<CalendarRange className="h-4 w-4" aria-hidden />}
                titulo="Servicios"
                valor={String(kpis.total)}
                sub={
                  kpis.desde && kpis.hasta
                    ? kpis.desde === kpis.hasta
                      ? formatearFechaServicio(kpis.desde)
                      : `${formatearFechaServicio(kpis.desde)} → ${formatearFechaServicio(kpis.hasta)}`
                    : undefined
                }
              />
              <KpiCard
                icono={<UtensilsCrossed className="h-4 w-4" aria-hidden />}
                titulo="Mediodía / Noche"
                valor={`${kpis.mediodia} / ${kpis.noche}`}
                sub="Servicios por franja"
              />
              <KpiCard
                icono={<Sparkles className="h-4 w-4" aria-hidden />}
                titulo="Extensiones/serv."
                valor={kpis.promedioExtensiones.toFixed(1)}
                sub="Promedio de extras"
              />
              <KpiCard
                icono={<GlassWater className="h-4 w-4" aria-hidden />}
                titulo="Bebidas"
                valor={String(Math.round(rankingBebidas.totalUnidades))}
                sub={`En ${rankingBebidas.serviciosConBebidas} ${rankingBebidas.serviciosConBebidas === 1 ? "servicio" : "servicios"}`}
              />
            </div>
          </Seccion>

          <Seccion
            titulo="Platos más servidos"
            accion={
              rankingPlatos.length > 12 ? (
                <Boton
                  variante="terciario"
                  onClick={() => setVerTodosPlatos((v) => !v)}
                >
                  {verTodosPlatos
                    ? "Ver top 12"
                    : `Ver todos (${rankingPlatos.length})`}
                </Boton>
              ) : null
            }
            pie={
              platosSinUso.length > 0 ? (
                <>
                  <span className="font-semibold text-label-2">
                    Sin uso en el período ({platosSinUso.length}):
                  </span>{" "}
                  {platosSinUso.map((p) => p.nombre).join(" · ")}
                </>
              ) : null
            }
          >
            {platosVisibles.length === 0 ? (
              <p className="px-1 text-[0.94rem] text-label-3">
                Sin platos en el período.
              </p>
            ) : (
              <ListaRanking>
                {platosVisibles.map((fila) => (
                  <BarraRanking
                    key={fila.id}
                    etiqueta={fila.nombre}
                    valor={fila.veces}
                    max={maxPlatos}
                    sufijo=" serv."
                    colorBarra={
                      fila.categoria
                        ? CATEGORIA_BAR[fila.categoria]
                        : "bg-label-3"
                    }
                    detalle={
                      fila.categoria ? (
                        <span className="shrink-0">
                          <Etiqueta tono={CATEGORIA_TONO[fila.categoria]}>
                            {fila.categoria}
                          </Etiqueta>
                        </span>
                      ) : null
                    }
                  />
                ))}
              </ListaRanking>
            )}
          </Seccion>

          <Seccion titulo="Bebidas más pedidas">
            {advertenciaBebidas ? (
              <div
                role="alert"
                className="flex gap-3 rounded-card bg-warning-soft px-4 py-3 text-[0.94rem] text-warning"
              >
                <TriangleAlert
                  className="mt-0.5 h-[18px] w-[18px] shrink-0"
                  aria-hidden
                />
                <p className="min-w-0 flex-1">
                  No se pudieron cargar las bebidas: {advertenciaBebidas}
                </p>
              </div>
            ) : bebidasVisibles.length === 0 ? (
              <p className="px-1 text-[0.94rem] text-label-3">
                No hay bebidas registradas en el período.
              </p>
            ) : (
              <ListaRanking>
                {bebidasVisibles.map((fila) => (
                  <BarraRanking
                    key={fila.nombre}
                    etiqueta={fila.nombre}
                    valor={fila.total}
                    max={maxBebidas}
                    colorBarra="bg-accent"
                  />
                ))}
              </ListaRanking>
            )}
          </Seccion>

          <Seccion
            titulo="Ingredientes más usados"
            pie={
              <>
                Por cantidad de servicios en los que se necesitaron (según los
                platos del menú). Sirve para anticipar compras.
                <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {(Object.keys(RUBRO_DOT) as RubroIngrediente[]).map((r) => (
                    <span key={r} className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className={`size-2.5 rounded-full ${RUBRO_DOT[r]}`}
                      />
                      {r}
                    </span>
                  ))}
                </span>
              </>
            }
          >
            {ingredientesVisibles.length === 0 ? (
              <p className="px-1 text-[0.94rem] text-label-3">
                No hay ingredientes asociados a los platos del período.
              </p>
            ) : (
              <ListaRanking>
                {ingredientesVisibles.map((fila) => (
                  <BarraRanking
                    key={fila.id}
                    etiqueta={fila.nombre}
                    valor={fila.servicios}
                    max={maxIngredientes}
                    sufijo=" serv."
                    colorBarra="bg-label-3"
                    prefijo={
                      <span
                        className={`size-2.5 shrink-0 rounded-full ${RUBRO_DOT[fila.rubro]}`}
                        title={fila.rubro}
                        aria-label={fila.rubro}
                        role="img"
                      />
                    }
                  />
                ))}
              </ListaRanking>
            )}
          </Seccion>
        </>
      )}
    </Pantalla>
  );
}
