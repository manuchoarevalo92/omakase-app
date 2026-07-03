"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  HelpCircle,
  ListPlus,
  Loader2,
  Plus,
  X,
} from "lucide-react";

import {
  agruparComprasPorStockItem,
  fetchComprasHistorial,
  insertarComprasHistorial,
  type CompraHistorialRow,
} from "@/src/lib/compras-historial";
import {
  calcularPrediccionCompra,
  compararPorUrgencia,
  ESTADO_COMPRA_BADGE,
  type EstadoCompra,
  type PrediccionCompra,
} from "@/src/lib/compras-prediccion";
import { parsearLineasMasivo, type LineaParseada } from "@/src/lib/parseo-lineas";
import {
  PROVEEDORES,
  UNIDADES,
  type Proveedor,
  type UnidadMedida,
} from "@/src/lib/proveedores";
import {
  buscarStockItemPorNombre,
  fetchStockItems,
  normalizarNombreClave,
  STOCK_ITEM_SELECT,
  stockItemDesdeFila,
  type StockItem,
  type StockItemDbRow,
} from "@/src/lib/stock-items";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

type ItemConPrediccion = {
  item: StockItem;
  prediccion: PrediccionCompra;
};

type PedidoItemDraft = {
  id: string;
  item: string;
  cantidad: string;
  unidad: UnidadMedida;
};

const ESTADO_ICONO: Record<EstadoCompra, React.ReactNode> = {
  Atrasado: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />,
  "Pedir pronto": <CalendarClock className="h-3.5 w-3.5" aria-hidden />,
  OK: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
  "Sin datos": <HelpCircle className="h-3.5 w-3.5" aria-hidden />,
};

const SIN_PROVEEDOR = "Sin proveedor asignado";

function hoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function parseCantidad(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) {
    return null;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function KpiCard(props: { icono: React.ReactNode; titulo: string; valor: number; tono: string }) {
  const { icono, titulo, valor, tono } = props;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className={`flex items-center gap-2 ${tono}`}>
        {icono}
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">{titulo}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{valor}</p>
    </div>
  );
}

function EstadoBadge(props: { estado: EstadoCompra }) {
  const { estado } = props;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${ESTADO_COMPRA_BADGE[estado]}`}
    >
      {ESTADO_ICONO[estado]}
      {estado}
    </span>
  );
}

export default function ComprasPage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [compras, setCompras] = useState<CompraHistorialRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [agregandoId, setAgregandoId] = useState<string | null>(null);
  const [agregadoOkId, setAgregadoOkId] = useState<string | null>(null);

  const [importAbierto, setImportAbierto] = useState(false);
  const [importProveedor, setImportProveedor] = useState<Proveedor | "">("");
  const [importFecha, setImportFecha] = useState(hoyISO());
  const [importUnidadDefault, setImportUnidadDefault] = useState<UnidadMedida>("Unidad");
  const [importTipoPrecio, setImportTipoPrecio] = useState<"unitario" | "total">("unitario");
  const [importTexto, setImportTexto] = useState("");
  const [importIsSaving, setImportIsSaving] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const cargarDatos = async () => {
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

  const comprasPorStockItem = useMemo(
    () => agruparComprasPorStockItem(compras),
    [compras]
  );

  const itemsConPrediccion = useMemo(() => {
    return stockItems
      .filter((item) => item.activo)
      .map((item) => {
        const puntos = (comprasPorStockItem.get(item.id) ?? []).map((c) => ({
          fecha: c.fecha,
          cantidad: c.cantidad,
        }));
        const prediccion = calcularPrediccionCompra(puntos, item.bufferPct);
        return { item, prediccion };
      });
  }, [stockItems, comprasPorStockItem]);

  const kpis = useMemo(() => {
    const base = { Atrasado: 0, "Pedir pronto": 0, OK: 0, "Sin datos": 0 } as Record<
      EstadoCompra,
      number
    >;
    itemsConPrediccion.forEach(({ prediccion }) => {
      base[prediccion.estado] += 1;
    });
    return base;
  }, [itemsConPrediccion]);

  const gruposPorProveedor = useMemo(() => {
    const grupos = new Map<string, ItemConPrediccion[]>();
    itemsConPrediccion.forEach((entry) => {
      const clave = entry.item.proveedor ?? SIN_PROVEEDOR;
      const lista = grupos.get(clave) ?? [];
      lista.push(entry);
      grupos.set(clave, lista);
    });
    grupos.forEach((lista) => {
      lista.sort((a, b) => compararPorUrgencia(a.prediccion, b.prediccion));
    });
    const ordenados: [string, ItemConPrediccion[]][] = [];
    PROVEEDORES.forEach((p) => {
      const lista = grupos.get(p);
      if (lista && lista.length > 0) {
        ordenados.push([p, lista]);
      }
    });
    const sinProveedor = grupos.get(SIN_PROVEEDOR);
    if (sinProveedor && sinProveedor.length > 0) {
      ordenados.push([SIN_PROVEEDOR, sinProveedor]);
    }
    return ordenados;
  }, [itemsConPrediccion]);

  const importLineasPreview = useMemo(() => {
    if (!importAbierto) {
      return [] as (LineaParseada & { existente: StockItem | null })[];
    }
    return parsearLineasMasivo(importTexto, importUnidadDefault)
      .filter((l) => l.item.trim().length > 0)
      .map((l) => ({ ...l, existente: buscarStockItemPorNombre(l.item, stockItems) }));
  }, [importAbierto, importTexto, importUnidadDefault, stockItems]);

  const abrirImport = (proveedorPreseleccionado?: Proveedor) => {
    setImportProveedor(proveedorPreseleccionado ?? "");
    setImportFecha(hoyISO());
    setImportUnidadDefault("Unidad");
    setImportTipoPrecio("unitario");
    setImportTexto("");
    setImportError(null);
    setImportAbierto(true);
  };

  const cerrarImport = () => {
    setImportAbierto(false);
    setImportTexto("");
  };

  const confirmarImport = async () => {
    if (!importProveedor) {
      setImportError("Elegí el proveedor del albarán.");
      return;
    }
    if (!importFecha) {
      setImportError("Elegí la fecha del albarán.");
      return;
    }
    if (importLineasPreview.length === 0) {
      setImportError("Pegá al menos una línea con nombre de ítem.");
      return;
    }

    setImportIsSaving(true);
    setImportError(null);

    try {
      let itemsActuales = stockItems;
      const nuevosItems: StockItem[] = [];

      for (const linea of importLineasPreview) {
        if (linea.existente) {
          continue;
        }
        const yaCreado = nuevosItems.find(
          (it) => normalizarNombreClave(it.nombre) === normalizarNombreClave(linea.item)
        );
        if (yaCreado) {
          continue;
        }
        const { data, error: insertError } = await supabase
          .from("stock_items")
          .insert({
            nombre: linea.item.trim(),
            rubro: "Despensa/Prep",
            proveedor: importProveedor,
            unidad_compra: linea.unidad,
            buffer_pct: 15,
            activo: true,
          })
          .select(STOCK_ITEM_SELECT)
          .single();

        if (insertError) {
          throw new Error(formatPostgrestError(insertError));
        }
        nuevosItems.push(stockItemDesdeFila(data as StockItemDbRow));
      }

      itemsActuales = [...stockItems, ...nuevosItems];

      const payload = importLineasPreview.map((linea) => {
        const match =
          linea.existente ??
          itemsActuales.find(
            (it) => normalizarNombreClave(it.nombre) === normalizarNombreClave(linea.item)
          ) ??
          null;
        const cantidad = parseCantidad(linea.cantidad);
        const precio = linea.precio ? parseCantidad(linea.precio) : null;
        return {
          stockItemId: match?.id ?? null,
          stockItemNombre: linea.item.trim(),
          proveedor: importProveedor as Proveedor,
          cantidad,
          unidad: linea.unidad,
          fecha: importFecha,
          origen: "import" as const,
          precioUnitario: importTipoPrecio === "unitario" ? precio : null,
          importeTotal: importTipoPrecio === "total" ? precio : null,
        };
      });

      await insertarComprasHistorial(payload);
      await cargarDatos();
      cerrarImport();
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "No se pudo importar el albarán."
      );
    } finally {
      setImportIsSaving(false);
    }
  };

  const agregarAPedido = async (proveedor: Proveedor, entry: ItemConPrediccion) => {
    setAgregandoId(entry.item.id);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("pedidos_proveedores")
        .select("items")
        .eq("proveedor", proveedor)
        .maybeSingle();

      if (fetchError) {
        throw new Error(formatPostgrestError(fetchError));
      }

      const itemsActuales: PedidoItemDraft[] = Array.isArray(
        (data as { items?: unknown } | null)?.items
      )
        ? ((data as { items: PedidoItemDraft[] }).items ?? [])
        : [];

      const nuevoItem: PedidoItemDraft = {
        id: crypto.randomUUID(),
        item: entry.item.nombre,
        cantidad:
          entry.prediccion.cantidadSugerida != null
            ? String(entry.prediccion.cantidadSugerida)
            : "",
        unidad: entry.item.unidadCompra,
      };

      const { error: upsertError } = await supabase.from("pedidos_proveedores").upsert(
        {
          proveedor,
          items: [...itemsActuales, nuevoItem],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "proveedor" }
      );

      if (upsertError) {
        throw new Error(formatPostgrestError(upsertError));
      }

      setAgregadoOkId(entry.item.id);
      window.setTimeout(() => {
        setAgregadoOkId((current) => (current === entry.item.id ? null : current));
      }, 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar al pedido.");
    } finally {
      setAgregandoId(null);
    }
  };

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Compras</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Cada cuánto conviene volver a pedir cada ítem de{" "}
              <span className="text-zinc-300">Stock</span>, según el historial real de compras
              (sin conteo de stock: el margen de seguridad adelanta el aviso antes de que se
              acabe).
            </p>
          </div>
          <button
            type="button"
            onClick={() => abrirImport()}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-800/80 bg-emerald-900/50 px-4 py-2.5 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-800/50"
          >
            <ListPlus className="h-4 w-4" aria-hidden />
            Importar albarán
          </button>
        </header>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando compras...
          </div>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard
                icono={<AlertTriangle className="h-4 w-4" aria-hidden />}
                titulo="Atrasados"
                valor={kpis.Atrasado}
                tono="text-red-300"
              />
              <KpiCard
                icono={<CalendarClock className="h-4 w-4" aria-hidden />}
                titulo="Pedir pronto"
                valor={kpis["Pedir pronto"]}
                tono="text-amber-300"
              />
              <KpiCard
                icono={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                titulo="OK"
                valor={kpis.OK}
                tono="text-emerald-300"
              />
              <KpiCard
                icono={<HelpCircle className="h-4 w-4" aria-hidden />}
                titulo="Sin datos"
                valor={kpis["Sin datos"]}
                tono="text-zinc-400"
              />
            </div>

            {itemsConPrediccion.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Todavía no hay ítems activos en Stock, o no tienen historial de compras. Cargá el
                catálogo en <span className="text-zinc-300">/stock</span> e importá algún albarán
                acá para empezar.
              </p>
            ) : (
              <div className="space-y-6">
                {gruposPorProveedor.map(([proveedor, lista]) => (
                  <section
                    key={proveedor}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm uppercase tracking-[0.14em] text-zinc-400">
                        {proveedor}
                      </h2>
                      {proveedor !== SIN_PROVEEDOR ? (
                        <button
                          type="button"
                          onClick={() => abrirImport(proveedor as Proveedor)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                        >
                          <ListPlus className="h-3.5 w-3.5" aria-hidden />
                          Importar para {proveedor}
                        </button>
                      ) : null}
                    </div>

                    <ul className="space-y-2" role="list">
                      {lista.map(({ item, prediccion }) => (
                        <li
                          key={item.id}
                          className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-zinc-100">
                                {item.nombre}
                              </span>
                              <EstadoBadge estado={prediccion.estado} />
                            </div>
                            <p className="mt-1 text-[11px] text-zinc-500">
                              {prediccion.ultimaCompra ? (
                                <>
                                  Última compra: {prediccion.ultimaCompra}
                                  {prediccion.intervaloTipicoDias != null ? (
                                    <> · Ciclo típico: {prediccion.intervaloTipicoDias} días</>
                                  ) : null}
                                  {prediccion.proximaFechaSugerida ? (
                                    <>
                                      {" "}
                                      · Próxima sugerida: {prediccion.proximaFechaSugerida} (
                                      {prediccion.diasParaProxima != null &&
                                      prediccion.diasParaProxima <= 0
                                        ? "atrasado"
                                        : `en ${prediccion.diasParaProxima} días`}
                                      )
                                    </>
                                  ) : null}
                                </>
                              ) : (
                                "Sin compras registradas todavía."
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-xs tabular-nums text-zinc-400">
                              {prediccion.cantidadSugerida != null
                                ? `${prediccion.cantidadSugerida} ${item.unidadCompra}`
                                : "—"}
                            </span>
                            <button
                              type="button"
                              disabled={agregandoId === item.id || proveedor === SIN_PROVEEDOR}
                              onClick={() =>
                                void agregarAPedido(item.proveedor as Proveedor, {
                                  item,
                                  prediccion,
                                })
                              }
                              title={
                                proveedor === SIN_PROVEEDOR
                                  ? "Asigná un proveedor en /stock para poder agregarlo a un pedido"
                                  : undefined
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {agregandoId === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <Plus className="h-3.5 w-3.5" aria-hidden />
                              )}
                              {agregadoOkId === item.id ? "Agregado" : "Agregar a pedido"}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        {importAbierto ? (
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                cerrarImport();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="import-compras-title"
              className="flex max-h-[min(92dvh,42rem)] w-full max-w-lg flex-col rounded-t-2xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:max-h-[min(88vh,38rem)] sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                <div className="min-w-0 pr-2">
                  <h2 id="import-compras-title" className="text-sm font-semibold text-white">
                    Importar albarán
                  </h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                    Elegí proveedor y fecha, y pegá las líneas del albarán. Los ítems que no
                    existan en Stock se crean automáticamente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => cerrarImport()}
                  className="shrink-0 rounded-lg border border-zinc-700 p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="import-proveedor"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Proveedor
                    </label>
                    <select
                      id="import-proveedor"
                      value={importProveedor}
                      onChange={(e) => setImportProveedor(e.target.value as Proveedor)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                    >
                      <option value="">Elegir...</option>
                      {PROVEEDORES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="import-fecha"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Fecha del albarán
                    </label>
                    <input
                      id="import-fecha"
                      type="date"
                      value={importFecha}
                      onChange={(e) => setImportFecha(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="import-unidad-default"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Unidad por defecto
                    </label>
                    <select
                      id="import-unidad-default"
                      value={importUnidadDefault}
                      onChange={(e) => setImportUnidadDefault(e.target.value as UnidadMedida)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                    >
                      {UNIDADES.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="import-tipo-precio"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      La 4ta columna del precio es
                    </label>
                    <select
                      id="import-tipo-precio"
                      value={importTipoPrecio}
                      onChange={(e) => setImportTipoPrecio(e.target.value as "unitario" | "total")}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                    >
                      <option value="unitario">Precio unitario</option>
                      <option value="total">Total de la línea</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="import-textarea"
                    className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                  >
                    Pegá las líneas del albarán
                  </label>
                  <textarea
                    id="import-textarea"
                    value={importTexto}
                    onChange={(e) => setImportTexto(e.target.value)}
                    rows={10}
                    autoFocus
                    spellCheck={false}
                    className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-[13px] leading-relaxed text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500"
                    placeholder={`Salmón: 8 Kilo\nAtún: 5 Kilo\nAguacate | 2 | Caja | 12.50`}
                  />
                  <p className="mt-1 text-[11px] text-zinc-600">
                    El precio (opcional) solo se reconoce con formato{" "}
                    <span className="font-mono text-zinc-500">nombre | cantidad | unidad | precio</span>{" "}
                    o separado por tabs.
                  </p>
                </div>
                {importError ? (
                  <p className="rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-xs text-red-200">
                    {importError}
                  </p>
                ) : null}
                <p className="text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-200">{importLineasPreview.length}</span>{" "}
                  línea(s) reconocida(s)
                </p>
                {importLineasPreview.length > 0 ? (
                  <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/60 px-3 py-2">
                    <ul className="max-h-40 space-y-0.5 overflow-y-auto text-[11px] text-zinc-300">
                      {importLineasPreview.slice(0, 20).map((l, i) => (
                        <li key={i} className="truncate">
                          <span className="text-zinc-600">·</span>{" "}
                          <span className="font-medium text-zinc-100">{l.item}</span>
                          <span className="text-zinc-500">
                            {" "}
                            → {l.cantidad || "—"} {l.unidad}
                            {l.precio ? ` · ${l.precio}€` : ""}
                          </span>
                          {l.existente ? (
                            <span className="text-emerald-400"> (vinculado)</span>
                          ) : (
                            <span className="text-amber-400"> (nuevo en Stock)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {importLineasPreview.length > 20 ? (
                      <p className="mt-1.5 text-[10px] text-zinc-600">
                        … y {importLineasPreview.length - 20} más
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2 border-t border-zinc-800 bg-zinc-900/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3">
                <button
                  type="button"
                  onClick={() => cerrarImport()}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 sm:flex-initial sm:px-4"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={importIsSaving || importLineasPreview.length === 0}
                  onClick={() => void confirmarImport()}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-800/80 bg-emerald-900/50 px-3 py-2.5 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-800/50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial sm:px-4"
                >
                  {importIsSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Importar {importLineasPreview.length > 0 ? importLineasPreview.length : ""}{" "}
                  línea(s)
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
