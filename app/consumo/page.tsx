"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CircleAlert, Package } from "lucide-react";
import {
  CampoBusqueda,
  EsqueletoLista,
  EstadoVacio,
  Etiqueta,
  Pantalla,
  Seccion,
  Selector,
  type OpcionSelector,
} from "@/app/ui";

import {
  fetchComprasHistorial,
  type CompraHistorialRow,
} from "@/src/lib/compras-historial";
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

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function fechaCorta(fecha: string | null): string {
  if (!fecha) return "—";
  const [y, m, d] = fecha.split("-").map(Number);
  return `${d} ${MESES[(m ?? 1) - 1]} ${y}`;
}

const OPCIONES_ORDEN: OpcionSelector<OrdenConsumo>[] = [
  { valor: "frecuencia", label: "Más frecuentes primero" },
  { valor: "reciente", label: "Compra más reciente" },
  { valor: "compras", label: "Cantidad de compras" },
  { valor: "nombre", label: "Nombre (A-Z)" },
];

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
      setError(
        err instanceof Error ? err.message : "Error al conectar con Supabase.",
      );
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
    [items, compras],
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

  const opcionesProveedor = useMemo<OpcionSelector<Proveedor | "">[]>(
    () => proveedoresConDatos.map((p) => ({ valor: p, label: p })),
    [proveedoresConDatos],
  );

  return (
    <Pantalla
      titulo="Consumo"
      subtitulo={
        isLoading
          ? "Cargando…"
          : `${filtrados.length} ${filtrados.length === 1 ? "ítem" : "ítems"}`
      }
      ancho="amplio"
      ayuda={
        <>
          <p>
            Cada cuánto se compra cada ítem y cuánto se consume, calculado a
            partir del historial real de compras.
          </p>
          <p>Cuantas más compras registradas, más preciso.</p>
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

      <div className="space-y-3">
        <CampoBusqueda
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar ítem"
          etiqueta="Buscar ítem"
        />
        <div className="grid grid-cols-2 gap-3">
          <Selector
            label="Proveedor"
            titulo="Filtrar por proveedor"
            opciones={opcionesProveedor}
            valor={proveedorFiltro}
            onChange={setProveedorFiltro}
            placeholder="Todos"
            vaciar={{ valor: "", label: "Todos los proveedores" }}
          />
          <Selector
            label="Orden"
            titulo="Ordenar por"
            opciones={OPCIONES_ORDEN}
            valor={orden}
            onChange={setOrden}
          />
        </div>
      </div>

      <Seccion>
        {isLoading ? (
          <EsqueletoLista filas={6} />
        ) : filtrados.length === 0 ? (
          <EstadoVacio
            icono={<Package className="h-6 w-6" aria-hidden />}
            titulo={
              consumo.length === 0 ? "Todavía no hay compras" : "Sin resultados"
            }
            texto={
              consumo.length === 0
                ? "Cuando haya compras registradas se calcula el consumo de cada ítem."
                : "Ningún ítem coincide con el filtro."
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-card bg-surface-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
            {filtrados.map((c) => (
              <li
                key={c.itemId}
                className="border-b border-separator px-4 py-3 last:border-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[1rem] font-medium text-label">
                      {c.nombre}
                    </p>
                    <p className="text-[0.86rem] text-label-3">
                      {c.proveedor ?? "Sin proveedor"}
                    </p>
                  </div>
                  <Etiqueta
                    tono="exito"
                    icono={
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                    }
                  >
                    {frecuenciaTexto(c)}
                  </Etiqueta>
                </div>
                <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  <div>
                    <dt className="text-[0.8rem] text-label-3">Compras</dt>
                    <dd className="text-[0.94rem] tabular-nums text-label">
                      {c.cantidadCompras}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.8rem] text-label-3">Consumo/mes</dt>
                    <dd className="text-[0.94rem] tabular-nums text-label">
                      {c.consumoMensual != null
                        ? `${c.consumoMensual} ${c.unidad}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.8rem] text-label-3">
                      Cant. promedio
                    </dt>
                    <dd className="text-[0.94rem] tabular-nums text-label">
                      {c.cantidadPromedio != null
                        ? `${c.cantidadPromedio} ${c.unidad}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.8rem] text-label-3">
                      Última compra
                    </dt>
                    <dd className="text-[0.94rem] tabular-nums text-label">
                      {fechaCorta(c.ultimaCompra)}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </Pantalla>
  );
}
