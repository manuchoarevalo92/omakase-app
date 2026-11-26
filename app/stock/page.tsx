"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Package,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  Boton,
  Campo,
  CampoBusqueda,
  EstadoVacio,
  EsqueletoLista,
  Etiqueta,
  Fila,
  Hoja,
  Interruptor,
  Lista,
  Pantalla,
  Seccion,
  Selector,
  vibrar,
} from "@/app/ui";

import {
  normalizarRubro,
  RUBROS_INGREDIENTE,
  type RubroIngrediente,
} from "@/src/lib/ingredientes-rubro";
import { BUFFER_PCT_DEFECTO } from "@/src/lib/compras-prediccion";
import {
  PROVEEDORES,
  UNIDADES,
  fetchProveedores,
  type Proveedor,
  type UnidadMedida,
} from "@/src/lib/proveedores";
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
    {} as Record<RubroIngrediente, boolean>,
  );

/** A partir de cuántos ítems se muestra el buscador. */
const MINIMO_PARA_BUSCAR = 8;

/** Valor del Selector de proveedor que representa "Sin proveedor". */
const SIN_PROVEEDOR = "__sin__";

function normalizarBusqueda(t: string): string {
  return t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([...PROVEEDORES]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoRubro, setNuevoRubro] =
    useState<RubroIngrediente>("Despensa/Prep");
  const [rubroExpandido, setRubroExpandido] = useState<
    Record<RubroIngrediente, boolean>
  >(RUBRO_EXPANDIDO_INICIAL);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);

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

  const editando = useMemo(
    () => items.find((i) => i.id === editandoId) ?? null,
    [items, editandoId],
  );

  const clave = normalizarBusqueda(busqueda);
  const buscando = clave.length > 0;
  const inactivos = items.filter((i) => !i.activo).length;

  const cargarItems = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [{ data, error: fetchError }, listaProveedores] = await Promise.all(
        [
          supabase
            .from("stock_items")
            .select(STOCK_ITEM_SELECT)
            .order("nombre", { ascending: true }),
          fetchProveedores().catch(() => [...PROVEEDORES]),
        ],
      );

      if (fetchError) {
        setError(formatPostgrestError(fetchError));
        return;
      }

      setItems(((data ?? []) as StockItemDbRow[]).map(stockItemDesdeFila));
      setProveedores(listaProveedores);
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
    }>,
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
          proveedor:
            patch.proveedor !== undefined ? patch.proveedor : item.proveedor,
          unidadCompra: patch.unidad_compra ?? item.unidadCompra,
          bufferPct: patch.buffer_pct ?? item.bufferPct,
          activo: patch.activo ?? item.activo,
        };
      }),
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
      setRubroExpandido((prev) => ({
        ...prev,
        [patch.rubro as RubroIngrediente]: true,
      }));
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
      [...current, nuevo].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es"),
      ),
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

  const opcionesRubro = RUBROS_INGREDIENTE.map((r) => ({
    valor: r,
    label: r,
  }));

  const opcionesProveedor = [
    { valor: SIN_PROVEEDOR, label: "Sin proveedor" },
    ...proveedores.map((p) => ({ valor: p as string, label: p })),
  ];

  const opcionesUnidad = UNIDADES.map((u) => ({ valor: u, label: u }));

  const secciones = RUBROS_INGREDIENTE.map((rubro) => {
    const lista = porRubro.get(rubro) ?? [];
    const visibles = buscando
      ? lista.filter((i) =>
          normalizarBusqueda(`${i.nombre} ${i.proveedor ?? ""}`).includes(
            clave,
          ),
        )
      : lista;
    return { rubro, lista, visibles };
  }).filter((s) => !buscando || s.visibles.length > 0);

  return (
    <Pantalla
      titulo="Stock"
      subtitulo={
        isLoading
          ? "Cargando…"
          : !hasItems
            ? "Sin ítems"
            : `${items.length} ítems${
                inactivos > 0
                  ? ` · ${inactivos} ${inactivos === 1 ? "inactivo" : "inactivos"}`
                  : ""
              }`
      }
      ayuda={
        <>
          <p>
            Catálogo de materia prima que se compra a proveedores. Es distinto
            de <strong className="text-label">Ingredientes</strong>, que es solo
            la disponibilidad para el menú.
          </p>
          <p>
            Cada ítem tiene proveedor principal y unidad de compra: con eso se
            arman los recordatorios de{" "}
            <strong className="text-label">Compras</strong>.
          </p>
          <p>
            Tocá un ítem para editarlo. Si lo desactivás, deja de aparecer en
            los recordatorios. El buffer adelanta el aviso de compra ese % del
            ciclo típico.
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
      ) : !hasItems ? (
        <div className="rounded-card bg-surface-3">
          <EstadoVacio
            icono={<Package className="h-6 w-6" aria-hidden />}
            titulo="Todavía no hay ítems de stock"
            texto="Agregá el primero abajo."
          />
        </div>
      ) : (
        <>
          {items.length > MINIMO_PARA_BUSCAR ? (
            <CampoBusqueda
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar ítem o proveedor"
              etiqueta="Buscar ítem o proveedor"
            />
          ) : null}

          {secciones.length === 0 ? (
            <div className="mt-6 rounded-card bg-surface-3">
              <EstadoVacio
                icono={<Search className="h-6 w-6" aria-hidden />}
                titulo="Sin resultados"
                texto={`No hay ítems con «${busqueda.trim()}».`}
              />
            </div>
          ) : (
            secciones.map(({ rubro, lista, visibles }) => {
              const expandido = buscando || rubroExpandido[rubro];
              const listId = `stock-rubro-list-${rubro.replace(/\//g, "-")}`;

              return (
                <section key={rubro} className="mt-6">
                  <button
                    type="button"
                    aria-expanded={expandido}
                    aria-controls={listId}
                    disabled={buscando}
                    onClick={() => {
                      vibrar();
                      setRubroExpandido((prev) => ({
                        ...prev,
                        [rubro]: !prev[rubro],
                      }));
                    }}
                    className="mb-2 flex min-h-11 w-full items-center gap-2 rounded-control px-1 text-left transition active:bg-fill disabled:active:bg-transparent"
                  >
                    <span className="min-w-0 flex-1 text-[0.8rem] font-semibold uppercase tracking-[0.07em] text-label-3">
                      {rubro}{" "}
                      <span className="font-mono font-normal tabular-nums">
                        {buscando
                          ? `${visibles.length}/${lista.length}`
                          : lista.length}
                      </span>
                    </span>
                    {buscando ? null : expandido ? (
                      <ChevronDown
                        className="h-[18px] w-[18px] shrink-0 text-label-3"
                        aria-hidden
                      />
                    ) : (
                      <ChevronRight
                        className="h-[18px] w-[18px] shrink-0 text-label-3"
                        aria-hidden
                      />
                    )}
                  </button>

                  <div id={listId}>
                    {expandido ? (
                      visibles.length === 0 ? (
                        <p className="rounded-card bg-surface-3 px-4 py-3 text-[0.94rem] text-label-3">
                          Sin ítems en este rubro.
                        </p>
                      ) : (
                        <Lista>
                          {visibles.map((item) => (
                            <Fila
                              key={item.id}
                              titulo={
                                <span
                                  className={
                                    item.activo ? undefined : "text-label-3"
                                  }
                                >
                                  {item.nombre}
                                </span>
                              }
                              detalle={`${item.proveedor ?? "Sin proveedor"} · ${item.unidadCompra} · buffer ${item.bufferPct}%`}
                              valor={
                                item.activo ? undefined : (
                                  <Etiqueta>Inactivo</Etiqueta>
                                )
                              }
                              onClick={() => setEditandoId(item.id)}
                            />
                          ))}
                        </Lista>
                      )
                    ) : null}
                  </div>
                </section>
              );
            })
          )}
        </>
      )}

      {!isLoading ? (
        <Seccion titulo="Agregar ítem" className="mt-8">
          <form
            onSubmit={agregarItem}
            className="space-y-3 rounded-card bg-surface-3 p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
          >
            <Campo
              aria-label="Nombre del ítem de stock"
              value={nuevoNombre}
              onChange={(event) => setNuevoNombre(event.target.value)}
              placeholder="Nombre del ítem"
              enterKeyHint="done"
            />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Selector
                titulo="Rubro"
                valor={nuevoRubro}
                opciones={opcionesRubro}
                onChange={(v) => setNuevoRubro(normalizarRubro(v))}
              />
              <Boton
                type="submit"
                cargando={isSubmitting}
                disabled={!nuevoNombre.trim()}
                icono={<Plus className="h-[18px] w-[18px]" aria-hidden />}
                className="min-h-12"
              >
                Agregar
              </Boton>
            </div>
          </form>
        </Seccion>
      ) : null}

      <Hoja
        abierta={editando !== null}
        onCerrar={() => setEditandoId(null)}
        titulo={editando?.nombre ?? "Ítem"}
      >
        {editando ? (
          <div className="space-y-4 pb-2">
            <label className="flex min-h-14 items-center gap-3 rounded-card bg-surface-3 px-4">
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] text-label">Activo</span>
                <span className="block text-[0.82rem] text-label-3">
                  {editando.activo
                    ? "Aparece en los recordatorios de Compras"
                    : "No aparece en los recordatorios de Compras"}
                </span>
              </span>
              <Interruptor
                etiqueta={`${editando.nombre} activo`}
                activo={editando.activo}
                onChange={(v) =>
                  void actualizarCampo(editando.id, { activo: v })
                }
              />
            </label>

            <Selector
              label="Rubro"
              valor={editando.rubro}
              opciones={opcionesRubro}
              onChange={(v) =>
                void actualizarCampo(editando.id, {
                  rubro: normalizarRubro(v),
                })
              }
            />
            <Selector
              label="Proveedor"
              valor={editando.proveedor ?? SIN_PROVEEDOR}
              opciones={opcionesProveedor}
              buscar={opcionesProveedor.length > 10}
              onChange={(v) =>
                void actualizarCampo(editando.id, {
                  proveedor: (v === SIN_PROVEEDOR
                    ? null
                    : v) as Proveedor | null,
                })
              }
            />
            <Selector
              label="Unidad de compra"
              valor={editando.unidadCompra}
              opciones={opcionesUnidad}
              onChange={(v) =>
                void actualizarCampo(editando.id, {
                  unidad_compra: v as UnidadMedida,
                })
              }
            />

            <div className="flex min-h-14 items-center gap-3 rounded-card bg-surface-3 py-2 pl-4 pr-2">
              <label
                htmlFor={`buffer-${editando.id}`}
                className="min-w-0 flex-1"
              >
                <span className="block text-[1rem] text-label">Buffer</span>
                <span className="block text-[0.82rem] text-label-3">
                  Adelanta el aviso de compra (0 a 90 %)
                </span>
              </label>
              <input
                id={`buffer-${editando.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={90}
                value={editando.bufferPct}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) {
                    void actualizarCampo(editando.id, {
                      buffer_pct: Math.min(Math.max(Math.round(n), 0), 90),
                    });
                  }
                }}
                className="h-11 w-20 rounded-[0.65rem] bg-fill text-center font-mono text-[1.05rem] tabular-nums text-label outline-none ring-accent/60 focus:ring-2"
              />
              <span className="w-5 text-[0.9rem] text-label-3">%</span>
            </div>

            <Boton
              variante="peligro"
              ancho
              icono={<Trash2 className="h-[18px] w-[18px]" aria-hidden />}
              onClick={() => {
                const id = editando.id;
                setEditandoId(null);
                void eliminarItem(id);
              }}
            >
              Eliminar ítem
            </Boton>
          </div>
        ) : null}
      </Hoja>
    </Pantalla>
  );
}
