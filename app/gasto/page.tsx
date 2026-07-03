"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingUp, Wallet } from "lucide-react";
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
  fetchComprasHistorial,
  ultimoPrecioUnitarioPorStockItem,
  type CompraHistorialRow,
} from "@/src/lib/compras-historial";
import { agruparComprasPorStockItem } from "@/src/lib/compras-historial";
import {
  agruparGastoPorPeriodo,
  clavePeriodo,
  combinarSeriesGasto,
  gastoPorProveedor,
  proyectarGastoPorPeriodo,
  type GastoProveedor,
  type PeriodoGasto,
} from "@/src/lib/gasto";
import { fetchStockItems, type StockItem } from "@/src/lib/stock-items";

const PERIODOS: { id: PeriodoGasto; label: string; nBuckets: number; horizonteDias: number }[] = [
  { id: "dia", label: "Diario", nBuckets: 21, horizonteDias: 21 },
  { id: "semana", label: "Semanal", nBuckets: 16, horizonteDias: 84 },
  { id: "mes", label: "Mensual", nBuckets: 12, horizonteDias: 180 },
  { id: "anio", label: "Anual", nBuckets: 5, horizonteDias: 730 },
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

function KpiCard(props: { icono: React.ReactNode; titulo: string; valor: string; sub?: string }) {
  const { icono, titulo, valor, sub } = props;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex items-center gap-2 text-zinc-400">
        {icono}
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">{titulo}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{valor}</p>
      {sub ? <p className="mt-0.5 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}

function TooltipGasto({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { etiqueta: string; valor: number; esProyectado: boolean } }[];
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-zinc-100">{p.etiqueta}</p>
      <p className="mt-0.5 text-zinc-300">
        {formatearEuros(p.valor)} {p.esProyectado ? <span className="text-amber-400">(proyectado)</span> : null}
      </p>
    </div>
  );
}

export default function GastoPage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [compras, setCompras] = useState<CompraHistorialRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoGasto>("mes");

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
          setError(err instanceof Error ? err.message : "Error al conectar con Supabase.");
        } finally {
          setIsLoading(false);
        }
      };
      void cargar();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const config = PERIODOS.find((p) => p.id === periodo) ?? PERIODOS[2];

  const comprasPorStockItem = useMemo(() => agruparComprasPorStockItem(compras), [compras]);
  const precioPorStockItem = useMemo(() => ultimoPrecioUnitarioPorStockItem(compras), [compras]);

  const gastoReal = useMemo(() => agruparGastoPorPeriodo(compras, periodo), [compras, periodo]);
  const gastoProyectado = useMemo(
    () =>
      proyectarGastoPorPeriodo(
        stockItems,
        comprasPorStockItem,
        precioPorStockItem,
        periodo,
        config.horizonteDias
      ),
    [stockItems, comprasPorStockItem, precioPorStockItem, periodo, config.horizonteDias]
  );

  const chartData = useMemo(() => {
    const serie = combinarSeriesGasto(gastoReal, gastoProyectado, periodo);
    const pasado = serie.filter((p) => p.real != null);
    const futuro = serie.filter((p) => p.real == null && p.proyectado != null);
    const pasadoRecortado = pasado.slice(-config.nBuckets);

    return [...pasadoRecortado, ...futuro].map((p) => ({
      etiqueta: p.etiqueta,
      valor: p.real ?? p.proyectado ?? 0,
      esProyectado: p.real == null,
    }));
  }, [gastoReal, gastoProyectado, periodo, config.nBuckets]);

  const claveActual = clavePeriodo(hoyISO(), periodo);
  const gastoPeriodoActual = gastoReal.get(claveActual) ?? 0;

  const clavesPasadasCompletas = [...gastoReal.keys()].filter((k) => k !== claveActual).sort();
  const ultimasCompletas = clavesPasadasCompletas.slice(-config.nBuckets);
  const promedioPeriodo =
    ultimasCompletas.length > 0
      ? ultimasCompletas.reduce((acc, k) => acc + (gastoReal.get(k) ?? 0), 0) / ultimasCompletas.length
      : 0;

  const proximaClaveProyectada = [...gastoProyectado.keys()].sort()[0];
  const proyeccionProximoPeriodo = proximaClaveProyectada
    ? gastoProyectado.get(proximaClaveProyectada) ?? 0
    : 0;

  const gastoTotalHistorico = useMemo(
    () => compras.reduce((acc, c) => acc + (c.importeTotal ?? 0), 0),
    [compras]
  );

  const proveedoresTop = useMemo<GastoProveedor[]>(() => gastoPorProveedor(compras), [compras]);
  const conPrecioCount = useMemo(
    () => stockItems.filter((it) => precioPorStockItem.has(it.id)).length,
    [stockItems, precioPorStockItem]
  );

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Gasto</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Gasto real (según <span className="text-zinc-300">importe</span> cargado en los
              albaranes de <span className="text-zinc-300">Compras</span>) y proyección a futuro
              según el ritmo de compra esperado de cada ítem de Stock.
            </p>
          </div>
          <div className="inline-flex shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 p-0.5">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodo(p.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  periodo === p.id
                    ? "border border-zinc-500 bg-zinc-800 text-zinc-50"
                    : "border border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </header>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando gasto...
          </div>
        ) : compras.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Todavía no hay compras cargadas. Importá albaranes con precio desde{" "}
            <span className="text-zinc-300">/compras</span> para ver el gasto acá.
          </p>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard
                icono={<Wallet className="h-4 w-4" aria-hidden />}
                titulo={`Este ${config.label.toLowerCase()}`}
                valor={formatearEuros(gastoPeriodoActual)}
                sub="Va lo que corrió hasta hoy"
              />
              <KpiCard
                icono={<Wallet className="h-4 w-4" aria-hidden />}
                titulo="Promedio período"
                valor={formatearEuros(promedioPeriodo)}
                sub={`Últimos ${ultimasCompletas.length} completos`}
              />
              <KpiCard
                icono={<TrendingUp className="h-4 w-4" aria-hidden />}
                titulo="Próximo período (proy.)"
                valor={formatearEuros(proyeccionProximoPeriodo)}
                sub={conPrecioCount === 0 ? "Cargá precios para estimar" : undefined}
              />
              <KpiCard
                icono={<Wallet className="h-4 w-4" aria-hidden />}
                titulo="Total histórico"
                valor={formatearEuros(gastoTotalHistorico)}
              />
            </div>

            <div className="mb-8 h-64 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-zinc-600">
                  Sin datos suficientes para graficar.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis
                      dataKey="etiqueta"
                      tick={{ fill: "#a1a1aa", fontSize: 11 }}
                      axisLine={{ stroke: "#3f3f46" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#a1a1aa", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip content={<TooltipGasto />} cursor={{ fill: "#3f3f4630" }} />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.esProyectado ? "#f59e0b55" : "#34d399"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <p className="-mt-6 mb-8 flex items-center gap-3 text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm bg-emerald-400" /> Real
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm bg-amber-500/40" /> Proyectado
              </span>
              {conPrecioCount === 0 ? (
                <span>· Sin precios cargados todavía, la proyección va a estar vacía.</span>
              ) : (
                <span>
                  · {conPrecioCount} de {stockItems.length} ítems de Stock tienen precio de
                  referencia.
                </span>
              )}
            </p>

            <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <h2 className="mb-3 text-sm uppercase tracking-[0.14em] text-zinc-400">
                Gasto histórico por proveedor
              </h2>
              {proveedoresTop.length === 0 ? (
                <p className="text-sm text-zinc-600">Sin importes cargados todavía.</p>
              ) : (
                <ul className="space-y-2">
                  {proveedoresTop.map(({ proveedor, total }) => {
                    const max = proveedoresTop[0]?.total || 1;
                    const pct = Math.max(4, Math.round((total / max) * 100));
                    return (
                      <li key={proveedor} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="text-zinc-100">{proveedor}</span>
                          <span className="tabular-nums text-zinc-300">
                            {formatearEuros(total)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-zinc-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
