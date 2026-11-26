"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Receipt, Scale, TrendingUp, Wallet } from "lucide-react";
import {
  EsqueletoLista,
  EstadoVacio,
  Pantalla,
  Seccion,
  Segmentado,
  Selector,
} from "@/app/ui";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  agruparComprasPorStockItem,
  fetchComprasHistorial,
  ultimoPrecioUnitarioPorStockItem,
  type CompraHistorialRow,
} from "@/src/lib/compras-historial";
import {
  agruparConsumoIngredientePorSemana,
  agruparGastoPorPeriodo,
  clavePeriodo,
  combinarSeriesGasto,
  gastoPorProveedor,
  proyectarGastoPorPeriodo,
  semanasConConsumo,
  totalKilosEnPeriodo,
  type GastoProveedor,
  type PeriodoGasto,
} from "@/src/lib/gasto";
import { fetchStockItems, type StockItem } from "@/src/lib/stock-items";

const PERIODOS_GRAFICO: {
  id: PeriodoGasto;
  label: string;
  nBuckets: number;
  horizonteDias: number;
}[] = [
  { id: "semana", label: "Semanal", nBuckets: 12, horizonteDias: 84 },
  { id: "mes", label: "Mensual", nBuckets: 12, horizonteDias: 180 },
];

function hoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatearEuros(n: number): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + "€";
}

function formatearKilos(n: number): string {
  if (n <= 0) {
    return "—";
  }
  return (
    n.toLocaleString("es-ES", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    }) + " kg"
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

const LISTA =
  "overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]";

type ChartPoint = {
  etiqueta: string;
  etiquetaLarga: string;
  valor: number;
  esProyectado: boolean;
};

function TooltipGasto({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const p = payload[0].payload;
  return (
    <div className="rounded-control border border-separator bg-surface-2 px-3 py-2 text-[0.86rem] shadow-lg">
      <p className="font-medium text-label">{p.etiquetaLarga}</p>
      <p className="mt-0.5 tabular-nums text-label-2">
        {formatearEuros(p.valor)}{" "}
        {p.esProyectado ? (
          <span className="text-warning">(proyectado)</span>
        ) : null}
      </p>
    </div>
  );
}

export default function GastoPage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [compras, setCompras] = useState<CompraHistorialRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodoGrafico, setPeriodoGrafico] = useState<PeriodoGasto>("semana");
  const [semanaSeleccionada, setSemanaSeleccionada] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const cargar = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const [items, historial] = await Promise.all([
            fetchStockItems(),
            fetchComprasHistorial(),
          ]);
          setStockItems(items);
          setCompras(historial);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Error al conectar con Supabase.",
          );
        } finally {
          setIsLoading(false);
        }
      };
      void cargar();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const config =
    PERIODOS_GRAFICO.find((p) => p.id === periodoGrafico) ??
    PERIODOS_GRAFICO[0];

  const comprasPorStockItem = useMemo(
    () => agruparComprasPorStockItem(compras),
    [compras],
  );
  const precioPorStockItem = useMemo(
    () => ultimoPrecioUnitarioPorStockItem(compras),
    [compras],
  );

  const consumoSemanal = useMemo(
    () => agruparConsumoIngredientePorSemana(compras),
    [compras],
  );

  const semanasDisponibles = useMemo(
    () => semanasConConsumo(consumoSemanal, 12),
    [consumoSemanal],
  );

  const claveSemanaActiva =
    semanaSeleccionada ?? semanasDisponibles[0]?.clave ?? null;

  const filasSemanaActiva = useMemo(() => {
    if (!claveSemanaActiva) {
      return [];
    }
    return consumoSemanal
      .filter((f) => f.claveSemana === claveSemanaActiva)
      .sort((a, b) => b.gasto - a.gasto || b.kilos - a.kilos);
  }, [consumoSemanal, claveSemanaActiva]);

  const totalesSemanaActiva = useMemo(() => {
    return filasSemanaActiva.reduce(
      (acc, f) => ({ kilos: acc.kilos + f.kilos, gasto: acc.gasto + f.gasto }),
      { kilos: 0, gasto: 0 },
    );
  }, [filasSemanaActiva]);

  const gastoReal = useMemo(
    () => agruparGastoPorPeriodo(compras, periodoGrafico),
    [compras, periodoGrafico],
  );
  const gastoProyectado = useMemo(
    () =>
      proyectarGastoPorPeriodo(
        stockItems,
        comprasPorStockItem,
        precioPorStockItem,
        periodoGrafico,
        config.horizonteDias,
      ),
    [
      stockItems,
      comprasPorStockItem,
      precioPorStockItem,
      periodoGrafico,
      config.horizonteDias,
    ],
  );

  const chartData = useMemo((): ChartPoint[] => {
    const serie = combinarSeriesGasto(
      gastoReal,
      gastoProyectado,
      periodoGrafico,
    );
    const pasado = serie.filter((p) => p.real != null);
    const futuro = serie.filter((p) => p.real == null && p.proyectado != null);
    const pasadoRecortado = pasado.slice(-config.nBuckets);

    return [...pasadoRecortado, ...futuro].map((p) => ({
      etiqueta: p.etiqueta,
      etiquetaLarga: p.etiquetaLarga ?? p.etiqueta,
      valor: p.real ?? p.proyectado ?? 0,
      esProyectado: p.real == null,
    }));
  }, [gastoReal, gastoProyectado, periodoGrafico, config.nBuckets]);

  const claveActual = clavePeriodo(hoyISO(), periodoGrafico);
  const gastoPeriodoActual = gastoReal.get(claveActual) ?? 0;
  const kilosPeriodoActual = totalKilosEnPeriodo(
    compras,
    periodoGrafico,
    claveActual,
  );

  const clavesPasadasCompletas = [...gastoReal.keys()]
    .filter((k) => k !== claveActual)
    .sort();
  const ultimasCompletas = clavesPasadasCompletas.slice(-config.nBuckets);
  const promedioPeriodo =
    ultimasCompletas.length > 0
      ? ultimasCompletas.reduce((acc, k) => acc + (gastoReal.get(k) ?? 0), 0) /
        ultimasCompletas.length
      : 0;

  const proximaClaveProyectada = [...gastoProyectado.keys()].sort()[0];
  const proyeccionProximoPeriodo = proximaClaveProyectada
    ? (gastoProyectado.get(proximaClaveProyectada) ?? 0)
    : 0;

  const gastoTotalHistorico = useMemo(
    () => compras.reduce((acc, c) => acc + (c.importeTotal ?? 0), 0),
    [compras],
  );

  const proveedoresTop = useMemo<GastoProveedor[]>(
    () => gastoPorProveedor(compras),
    [compras],
  );
  const conPrecioCount = useMemo(
    () => stockItems.filter((it) => precioPorStockItem.has(it.id)).length,
    [stockItems, precioPorStockItem],
  );

  const etiquetaPeriodoActual =
    periodoGrafico === "semana" ? "esta semana" : "este mes";

  return (
    <Pantalla
      titulo="Gasto"
      subtitulo={
        isLoading
          ? "Cargando…"
          : `${compras.length} ${compras.length === 1 ? "compra cargada" : "compras cargadas"}`
      }
      ancho="amplio"
      ayuda={
        <>
          <p>Gasto en euros según los albaranes importados.</p>
          <p>
            Consumo en kilos por ingrediente (solo ítems comprados en Kilo) y
            proyección según el ritmo de compra de cada ítem de Stock.
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

      {isLoading ? (
        <EsqueletoLista filas={6} />
      ) : compras.length === 0 ? (
        <EstadoVacio
          icono={<Receipt className="h-6 w-6" aria-hidden />}
          titulo="Todavía no hay compras"
          texto="Importá albaranes con precio desde Compras para ver el gasto acá."
        />
      ) : (
        <>
          <Segmentado
            etiqueta="Período"
            valor={periodoGrafico}
            onChange={setPeriodoGrafico}
            opciones={PERIODOS_GRAFICO.map((p) => ({
              valor: p.id,
              label: p.label,
            }))}
          />

          <Seccion titulo="Resumen">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                icono={<Wallet className="h-4 w-4" aria-hidden />}
                titulo={`Gasto ${etiquetaPeriodoActual}`}
                valor={formatearEuros(gastoPeriodoActual)}
                sub="Hasta hoy"
              />
              <KpiCard
                icono={<Scale className="h-4 w-4" aria-hidden />}
                titulo={`Kg ${etiquetaPeriodoActual}`}
                valor={
                  kilosPeriodoActual > 0
                    ? formatearKilos(kilosPeriodoActual)
                    : "—"
                }
                sub="Solo ítems comprados en Kilo"
              />
              <KpiCard
                icono={<TrendingUp className="h-4 w-4" aria-hidden />}
                titulo="Próximo período (proy.)"
                valor={formatearEuros(proyeccionProximoPeriodo)}
                sub={
                  conPrecioCount === 0
                    ? "Cargá precios para estimar"
                    : undefined
                }
              />
              <KpiCard
                icono={<Wallet className="h-4 w-4" aria-hidden />}
                titulo="Total histórico"
                valor={formatearEuros(gastoTotalHistorico)}
                sub={`Prom. ${config.label.toLowerCase()}: ${formatearEuros(promedioPeriodo)}`}
              />
            </div>
          </Seccion>

          <Seccion
            titulo="Evolución del gasto"
            pie={
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block size-2.5 rounded-sm bg-success"
                  />
                  Real
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block size-2.5 rounded-sm bg-warning/45"
                  />
                  Proyectado
                </span>
                <span>
                  {periodoGrafico === "semana"
                    ? "Semanas de lunes a domingo"
                    : "Por mes calendario"}
                </span>
              </span>
            }
          >
            <div className="h-64 rounded-card bg-surface-3 p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-[0.94rem] text-label-3">
                  Sin datos suficientes para graficar.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--separator)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="etiqueta"
                      tick={{ fill: "var(--label-3)", fontSize: 13 }}
                      axisLine={{ stroke: "var(--separator)" }}
                      tickLine={false}
                      interval="preserveStartEnd"
                      minTickGap={4}
                      angle={periodoGrafico === "semana" ? -35 : 0}
                      textAnchor={
                        periodoGrafico === "semana" ? "end" : "middle"
                      }
                      height={periodoGrafico === "semana" ? 56 : 30}
                    />
                    <YAxis
                      tick={{ fill: "var(--label-3)", fontSize: 13 }}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                    />
                    <Tooltip
                      content={<TooltipGasto />}
                      cursor={{ fill: "var(--fill)" }}
                    />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.esProyectado
                              ? "var(--warning)"
                              : "var(--success)"
                          }
                          fillOpacity={entry.esProyectado ? 0.45 : 1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Seccion>

          <Seccion
            titulo="Consumo por ingrediente"
            pie="Kilos (solo compras en Kilo) y gasto por semana. Los ítems en Caja o Unidad muestran gasto pero no kg."
          >
            {semanasDisponibles.length > 0 ? (
              <div className="mb-3">
                <Selector
                  label="Semana"
                  titulo="Elegir semana"
                  opciones={semanasDisponibles.map((s) => ({
                    valor: s.clave,
                    label: s.etiqueta,
                  }))}
                  valor={claveSemanaActiva}
                  onChange={setSemanaSeleccionada}
                />
              </div>
            ) : null}

            {filasSemanaActiva.length === 0 ? (
              <p className="px-1 text-[0.94rem] text-label-3">
                Sin compras en esta semana.
              </p>
            ) : (
              <ul className={LISTA}>
                <li className="flex min-h-10 items-center gap-3 border-b border-separator px-4 text-[0.8rem] font-medium text-label-3">
                  <span className="min-w-0 flex-1">Ingrediente</span>
                  <span className="w-20 shrink-0 text-right">Kg</span>
                  <span className="w-20 shrink-0 text-right">Gasto</span>
                </li>
                {filasSemanaActiva.map((fila) => (
                  <li
                    key={`${fila.claveSemana}-${fila.nombre}`}
                    className="flex min-h-12 items-center gap-3 border-b border-separator px-4 py-2 text-[1rem]"
                  >
                    <span className="min-w-0 flex-1 text-label">
                      {fila.nombre}
                    </span>
                    <span className="w-20 shrink-0 text-right tabular-nums text-label-2">
                      {fila.kilos > 0 ? formatearKilos(fila.kilos) : "—"}
                    </span>
                    <span className="w-20 shrink-0 text-right tabular-nums text-label-2">
                      {fila.gasto > 0 ? formatearEuros(fila.gasto) : "—"}
                    </span>
                  </li>
                ))}
                <li className="flex min-h-12 items-center gap-3 bg-fill px-4 py-2 text-[1rem] font-semibold">
                  <span className="min-w-0 flex-1 text-label">Total</span>
                  <span className="w-20 shrink-0 text-right tabular-nums text-label">
                    {formatearKilos(totalesSemanaActiva.kilos)}
                  </span>
                  <span className="w-20 shrink-0 text-right tabular-nums text-label">
                    {formatearEuros(totalesSemanaActiva.gasto)}
                  </span>
                </li>
              </ul>
            )}
          </Seccion>

          <Seccion titulo="Gasto histórico por proveedor">
            {proveedoresTop.length === 0 ? (
              <p className="px-1 text-[0.94rem] text-label-3">
                Sin importes cargados todavía.
              </p>
            ) : (
              <ul className={LISTA}>
                {proveedoresTop.map(({ proveedor, total }) => {
                  const max = proveedoresTop[0]?.total || 1;
                  const pct = Math.max(4, Math.round((total / max) * 100));
                  return (
                    <li
                      key={proveedor}
                      className="border-b border-separator px-4 py-3 last:border-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-[1rem] text-label">
                          {proveedor}
                        </span>
                        <span className="shrink-0 text-[0.95rem] tabular-nums text-label-2">
                          {formatearEuros(total)}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-fill">
                        <div
                          className="h-full rounded-full bg-info"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Seccion>
        </>
      )}
    </Pantalla>
  );
}
