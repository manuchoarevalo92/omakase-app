"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";

import {
  normalizarRubro,
  RUBROS_INGREDIENTE,
  RUBRO_SECTION_BORDER,
  type RubroIngrediente,
} from "@/src/lib/ingredientes-rubro";
import { BUFFER_PCT_DEFECTO } from "@/src/lib/compras-prediccion";
import { PROVEEDORES, UNIDADES, type Proveedor, type UnidadMedida } from "@/src/lib/proveedores";
import {
  STOCK_ITEM_SELECT,
  stockItemDesdeFila,
  type StockItem,
  type StockItemDbRow,
} from "@/src/lib/stock-items";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

/** Todas las secciones arrancan plegadas; el usuario abre las que necesite. */
const RUBRO_EXPANDIDO_INICIAL: Record<RubroIngrediente, boolean> =
  RUBROS_INGREDIENTE.reduce(
    (acc, r) => {
      acc[r] = false;
      return acc;
    },
    {} as Record<RubroIngrediente, boolean>
  );

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoRubro, setNuevoRubro] = useState<RubroIngrediente>("Despensa/Prep");
  const [rubroExpandido, setRubroExpandido] =
    useState<Record<RubroIngrediente, boolean>>(RUBRO_EXPANDIDO_INICIAL);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasItems = useMemo(() => items.length > 0, [items.length]);

  const porRubro = useMemo(() => {
    const map = new Map<RubroIngrediente, StockItem[]>();
    RUBROS_INGREDIENTE.forEach((r) => map.set(r, []));
    items.forEach((item) => {
      const r = normalizarRubro(item.rubro);
      const list = map.get(r) ?? [];
      list.push({ ...item, rubro: r });
      map.set(r, list);
    });
    RUBROS_INGREDIENTE.forEach((r) => {
      map.get(r)?.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    });
    return map;
  }, [items]);

  const cargarItems = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("stock_items")
        .select(STOCK_ITEM_SELECT)
        .order("nombre", { ascending: true });

      if (fetchError) {
        setError(formatPostgrestError(fetchError));
        return;
      }

      setItems(((data ?? []) as StockItemDbRow[]).map(stockItemDesdeFila));
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
      void cargarItems();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const actualizarCampo = async (
    id: string,
    patch: Partial<{
      rubro: RubroIngrediente;
      proveedor: Proveedor | null;
      unidad_compra: UnidadMedida;
      buffer_pct: number;
      activo: boolean;
    }>
  ) => {
    const previous = items;

    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item;
        }
        return {
          ...item,
          rubro: patch.rubro ?? item.rubro,
          proveedor: patch.proveedor !== undefined ? patch.proveedor : item.proveedor,
          unidadCompra: patch.unidad_compra ?? item.unidadCompra,
          bufferPct: patch.buffer_pct ?? item.bufferPct,
          activo: patch.activo ?? item.activo,
        };
      })
    );

    const { error: updateError } = await supabase
      .from("stock_items")
      .update(patch)
      .eq("id", id);

    if (updateError) {
      setItems(previous);
      setError(formatPostgrestError(updateError));
      return;
    }

    if (patch.rubro) {
      setRubroExpandido((prev) => ({ ...prev, [patch.rubro as RubroIngrediente]: true }));
    }
  };

  const agregarItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nombre = nuevoNombre.trim();

    if (!nombre) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("stock_items")
      .insert({
        nombre,
        rubro: nuevoRubro,
        unidad_compra: "Unidad",
        buffer_pct: BUFFER_PCT_DEFECTO,
        activo: true,
      })
      .select(STOCK_ITEM_SELECT)
      .single();

    if (insertError) {
      setError(formatPostgrestError(insertError));
      setIsSubmitting(false);
      return;
    }

    const nuevo = stockItemDesdeFila(data as StockItemDbRow);
    setItems((current) =>
      [...current, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    );
    setRubroExpandido((prev) => ({ ...prev, [nuevo.rubro]: true }));
    setNuevoNombre("");
    setIsSubmitting(false);
  };

  const eliminarItem = async (id: string) => {
    const previous = items;
    setError(null);
    setItems((current) => current.filter((item) => item.id !== id));

    const { error: deleteError } = await supabase
      .from("stock_items")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setItems(previous);
      setError(formatPostgrestError(deleteError));
    }
  };

  const selectClass =
    "rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500";

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6">
          <h1 className="font-display text-3xl font-medium tracking-tight text-ink">Stock</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Catálogo de materia prima que se compra a proveedores (distinto de{" "}
            <span className="text-zinc-300">Ingredientes</span>, que es solo disponibilidad de
            menú). Cada ítem define proveedor principal y unidad de compra; esto alimenta los
            recordatorios de <span className="text-zinc-300">Compras</span>.
          </p>
        </header>

        <form
          onSubmit={agregarItem}
          className="mb-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <div className="min-w-0 flex-1">
            <label
              htmlFor="nuevo-nombre-stock"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
            >
              Nombre
            </label>
            <input
              id="nuevo-nombre-stock"
              value={nuevoNombre}
              onChange={(event) => setNuevoNombre(event.target.value)}
              placeholder="Agregar nuevo ítem de stock"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
            />
          </div>
          <div className="w-full sm:w-48">
            <label
              htmlFor="nuevo-rubro-stock"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
            >
              Rubro
            </label>
            <select
              id="nuevo-rubro-stock"
              value={nuevoRubro}
              onChange={(e) => setNuevoRubro(normalizarRubro(e.target.value))}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            >
              {RUBROS_INGREDIENTE.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-100 px-4 py-2.5 text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 sm:mb-0.5"
            aria-label="Agregar ítem de stock"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
        </form>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando stock...
          </div>
        ) : !hasItems ? (
          <p className="text-sm text-zinc-500">
            No hay ítems de stock todavía. Agregá el primero.
          </p>
        ) : (
          <div className="space-y-8">
            {RUBROS_INGREDIENTE.map((rubro) => {
              const lista = porRubro.get(rubro) ?? [];
              const expandido = rubroExpandido[rubro];
              const listId = `stock-rubro-list-${rubro.replace(/\//g, "-")}`;

              const tituloRubro = (
                <>
                  {rubro}{" "}
                  <span className="font-normal text-zinc-500">({lista.length})</span>
                </>
              );

              return (
                <section
                  key={rubro}
                  className={`rounded-xl border border-zinc-800 border-l-4 ${RUBRO_SECTION_BORDER[rubro]} bg-zinc-950/35 p-4`}
                >
                  <button
                    type="button"
                    aria-expanded={expandido}
                    aria-controls={listId}
                    onClick={() =>
                      setRubroExpandido((prev) => ({ ...prev, [rubro]: !prev[rubro] }))
                    }
                    className="mb-3 flex w-full items-center gap-2 border-b border-zinc-800/80 pb-2 text-left text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300 transition hover:text-zinc-100"
                  >
                    <span className="inline-flex shrink-0 text-zinc-500" aria-hidden>
                      {expandido ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0">{tituloRubro}</span>
                  </button>

                  <div id={listId}>
                    {expandido ? (
                      lista.length === 0 ? (
                        <p className="text-sm text-zinc-600">Sin ítems en este rubro.</p>
                      ) : (
                        <ul className="space-y-2" role="list">
                          {lista.map((item) => (
                            <li
                              key={item.id}
                              className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0 flex-1 text-sm text-zinc-100">
                                  {item.nombre}
                                </span>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={item.activo}
                                  onClick={() =>
                                    void actualizarCampo(item.id, { activo: !item.activo })
                                  }
                                  title={
                                    item.activo
                                      ? "Activo: aparece en recordatorios de Compras"
                                      : "Inactivo: no aparece en recordatorios de Compras"
                                  }
                                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                                    item.activo ? "bg-zinc-100" : "bg-zinc-700"
                                  }`}
                                  aria-label={`Cambiar actividad de ${item.nombre}`}
                                >
                                  <span
                                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-zinc-950 transition ${
                                      item.activo ? "left-[22px]" : "left-0.5"
                                    }`}
                                  />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void eliminarItem(item.id)}
                                  className="rounded-lg border border-zinc-800 p-2 text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-100"
                                  aria-label={`Eliminar ${item.nombre}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="sr-only" htmlFor={`rubro-${item.id}`}>
                                  Rubro de {item.nombre}
                                </label>
                                <select
                                  id={`rubro-${item.id}`}
                                  value={item.rubro}
                                  onChange={(e) =>
                                    void actualizarCampo(item.id, {
                                      rubro: normalizarRubro(e.target.value),
                                    })
                                  }
                                  className={selectClass}
                                >
                                  {RUBROS_INGREDIENTE.map((r) => (
                                    <option key={r} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                </select>
                                <label className="sr-only" htmlFor={`proveedor-${item.id}`}>
                                  Proveedor de {item.nombre}
                                </label>
                                <select
                                  id={`proveedor-${item.id}`}
                                  value={item.proveedor ?? ""}
                                  onChange={(e) =>
                                    void actualizarCampo(item.id, {
                                      proveedor: (e.target.value || null) as Proveedor | null,
                                    })
                                  }
                                  className={selectClass}
                                >
                                  <option value="">Sin proveedor</option>
                                  {PROVEEDORES.map((p) => (
                                    <option key={p} value={p}>
                                      {p}
                                    </option>
                                  ))}
                                </select>
                                <label className="sr-only" htmlFor={`unidad-${item.id}`}>
                                  Unidad de compra de {item.nombre}
                                </label>
                                <select
                                  id={`unidad-${item.id}`}
                                  value={item.unidadCompra}
                                  onChange={(e) =>
                                    void actualizarCampo(item.id, {
                                      unidad_compra: e.target.value as UnidadMedida,
                                    })
                                  }
                                  className={selectClass}
                                >
                                  {UNIDADES.map((u) => (
                                    <option key={u} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                                <label
                                  className="flex items-center gap-1 text-[11px] text-zinc-500"
                                  htmlFor={`buffer-${item.id}`}
                                  title="Margen de seguridad: adelanta el aviso de compra este % del ciclo típico"
                                >
                                  Buffer
                                  <input
                                    id={`buffer-${item.id}`}
                                    type="number"
                                    min={0}
                                    max={90}
                                    value={item.bufferPct}
                                    onChange={(e) => {
                                      const n = Number(e.target.value);
                                      if (Number.isFinite(n)) {
                                        void actualizarCampo(item.id, {
                                          buffer_pct: Math.min(Math.max(Math.round(n), 0), 90),
                                        });
                                      }
                                    }}
                                    className="w-14 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-center text-xs text-zinc-200 outline-none focus:border-zinc-500"
                                  />
                                  %
                                </label>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )
                    ) : lista.length > 0 ? (
                      <p className="text-xs text-zinc-600">
                        {lista.length} {lista.length === 1 ? "ítem oculto" : "ítems ocultos"}.
                        Tocá el título para ver la lista.
                      </p>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
