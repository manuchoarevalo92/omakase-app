"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, Package, Search, X } from "lucide-react";

import { fetchComprasHistorial, type CompraHistorialRow } from "@/src/lib/compras-historial";
import {
  calcularConsumoPorItem,
  type ConsumoItem,
} from "@/src/lib/consumo-stats";
import { fetchStockItems, type StockItem } from "@/src/lib/stock-items";
import { ordenarProveedores, type Proveedor } from "@/src/lib/proveedores";

type OrdenConsumo = "frecuencia" | "nombre" | "compras" | "reciente";

function normalizar(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fechaCorta(fecha: string | null): string {
  if (!fecha) return "—";
  const [y, m, d] = fecha.split("-").map(Number);
  return `${d} ${MESES[(m ?? 1) - 1]} ${y}`;
}

function frecuenciaTexto(item: ConsumoItem): string {
  const dias = item.intervaloTipicoDias ?? item.intervaloPromedioDias;
  if (dias == null) {
    return "Una sola compra";
  }
  if (dias < 1.5) {
    return "Casi a diario";
  }
  if (dias <= 9) {
    return `Cada ${Math.round(dias)} días (~semanal)`;
  }
  if (dias <= 45) {
    const semanas = Math.round(dias / 7);
    return `Cada ${Math.round(dias)} días (~${semanas} sem)`;
  }
  const meses = Math.round(dias / 30);
  return `Cada ${Math.round(dias)} días (~${meses} ${meses === 1 ? "mes" : "meses"})`;
}

export default function ConsumoPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [compras, setCompras] = useState<CompraHistorialRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [proveedorFiltro, setProveedorFiltro] = useState<Proveedor | "">("");
  const [orden, setOrden] = useState<OrdenConsumo>("frecuencia");

  const cargar = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [itemsData, comprasData] = await Promise.all([
        fetchStockItems(),
        fetchComprasHistorial(),
      ]);
      setItems(itemsData);
      setCompras(comprasData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar con Supabase.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargar();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  const consumo = useMemo(
    () => calcularConsumoPorItem(items, compras),
    [items, compras]
  );

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    let lista = consumo;
    if (q) {
      lista = lista.filter((c) => normalizar(c.nombre).includes(q));
    }
    if (proveedorFiltro) {
      lista = lista.filter((c) => c.proveedor === proveedorFiltro);
    }
    const ordenada = [...lista];
    ordenada.sort((a, b) => {
      if (orden === "nombre") {
        return a.nombre.localeCompare(b.nombre, "es");
      }
      if (orden === "compras") {
        return b.cantidadCompras - a.cantidadCompras;
      }
      if (orden === "reciente") {
        return (b.ultimaCompra ?? "").localeCompare(a.ultimaCompra ?? "");
      }
      // frecuencia: menor intervalo (más frecuente) primero; sin dato al final
      const da = a.intervaloTipicoDias ?? a.intervaloPromedioDias ?? Infinity;
      const db = b.intervaloTipicoDias ?? b.intervaloPromedioDias ?? Infinity;
      if (da !== db) {
        return da - db;
      }
      return a.nombre.localeCompare(b.nombre, "es");
    });
    return ordenada;
  }, [consumo, busqueda, proveedorFiltro, orden]);

  const proveedoresConDatos = useMemo(() => {
    const set = new Set<Proveedor>();
    consumo.forEach((c) => {
      if (c.proveedor) set.add(c.proveedor);
    });
    return ordenarProveedores(set);
  }, [consumo]);

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6">
          <h1 className="flex items-center gap-2 font-display text-3xl font-medium tracking-tight text-ink">
            <Package className="h-5 w-5 text-emerald-400" aria-hidden />
            Consumo
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Cada cuánto se compra cada ítem y cuánto se consume, calculado a partir del
            historial real de compras. Cuantas más compras registradas, más preciso.
          </p>
        </header>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden
            />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar ítem..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-8 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500"
            />
            {busqueda ? (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
          <select
            value={proveedorFiltro}
            onChange={(e) => setProveedorFiltro(e.target.value as Proveedor | "")}
            aria-label="Filtrar por proveedor"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
          >
            <option value="">Todos los proveedores</option>
            {proveedoresConDatos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as OrdenConsumo)}
            aria-label="Ordenar por"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
          >
            <option value="frecuencia">Más frecuentes primero</option>
            <option value="reciente">Compra más reciente</option>
            <option value="compras"># de compras</option>
            <option value="nombre">Nombre (A-Z)</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : filtrados.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-6 text-center text-sm text-zinc-500">
            {consumo.length === 0
              ? "Todavía no hay compras registradas para calcular consumo."
              : "Ningún ítem coincide con el filtro."}
          </p>
        ) : (
          <ul className="space-y-2">
            {filtrados.map((c) => (
              <li
                key={c.itemId}
                className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{c.nombre}</p>
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                      {c.proveedor ?? "Sin proveedor"}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/60 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                    {frecuenciaTexto(c)}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-400 sm:grid-cols-4">
                  <div>
                    <dt className="text-zinc-600">Compras</dt>
                    <dd className="tabular-nums text-zinc-200">{c.cantidadCompras}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Consumo/mes</dt>
                    <dd className="tabular-nums text-zinc-200">
                      {c.consumoMensual != null
                        ? `${c.consumoMensual} ${c.unidad}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Cant. promedio</dt>
                    <dd className="tabular-nums text-zinc-200">
                      {c.cantidadPromedio != null
                        ? `${c.cantidadPromedio} ${c.unidad}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Última compra</dt>
                    <dd className="text-zinc-200">{fechaCorta(c.ultimaCompra)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
