"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type UnidadMedida = "Caja" | "Kilo" | "Unidad";

type PedidoItem = {
  id: string;
  item: string;
  cantidad: string;
  unidad: UnidadMedida;
};

const PROVEEDORES = [
  "Cominport",
  "Arrom",
  "García de Pou",
  "Verdulería",
  "Supermercado",
] as const;

const UNIDADES: UnidadMedida[] = ["Caja", "Kilo", "Unidad"];
const STORAGE_KEY = "omakase_pedidos_v1";

const crearItem = (): PedidoItem => ({
  id: crypto.randomUUID(),
  item: "",
  cantidad: "",
  unidad: "Unidad",
});

const crearEstadoVacio = (): Record<(typeof PROVEEDORES)[number], PedidoItem[]> =>
  PROVEEDORES.reduce(
    (acc, proveedor) => {
      acc[proveedor] = [crearItem()];
      return acc;
    },
    {} as Record<(typeof PROVEEDORES)[number], PedidoItem[]>
  );

const cargarEstadoInicial = (): Record<(typeof PROVEEDORES)[number], PedidoItem[]> => {
  const vacio = crearEstadoVacio();
  if (typeof window === "undefined") {
    return vacio;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return vacio;
    }
    const parsed = JSON.parse(raw) as Partial<
      Record<(typeof PROVEEDORES)[number], PedidoItem[]>
    >;
    return PROVEEDORES.reduce(
      (acc, proveedor) => {
        const filas = Array.isArray(parsed?.[proveedor]) ? parsed[proveedor] : [];
        const normalizadas = filas
          .map((fila) => {
            const unidad = UNIDADES.includes(fila.unidad) ? fila.unidad : "Unidad";
            return {
              id: fila.id || crypto.randomUUID(),
              item: typeof fila.item === "string" ? fila.item : "",
              cantidad: typeof fila.cantidad === "string" ? fila.cantidad : "",
              unidad,
            } satisfies PedidoItem;
          })
          .filter((fila) => fila.item.trim() || fila.cantidad.trim());
        acc[proveedor] = normalizadas.length > 0 ? normalizadas : [crearItem()];
        return acc;
      },
      {} as Record<(typeof PROVEEDORES)[number], PedidoItem[]>
    );
  } catch {
    return vacio;
  }
};

export default function PedidosPage() {
  const [pedidosPorProveedor, setPedidosPorProveedor] = useState<
    Record<(typeof PROVEEDORES)[number], PedidoItem[]>
  >(cargarEstadoInicial);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pedidosPorProveedor));
    } catch {
      // Ignora errores de almacenamiento para no bloquear la carga de pedidos.
    }
  }, [pedidosPorProveedor]);

  const totalItemsCargados = useMemo(() => {
    return PROVEEDORES.reduce(
      (acc, proveedor) =>
        acc +
        pedidosPorProveedor[proveedor].filter((fila) => fila.item.trim().length > 0)
          .length,
      0
    );
  }, [pedidosPorProveedor]);

  const actualizarFila = (
    proveedor: (typeof PROVEEDORES)[number],
    itemId: string,
    patch: Partial<PedidoItem>
  ) => {
    setPedidosPorProveedor((actual) => ({
      ...actual,
      [proveedor]: actual[proveedor].map((fila) =>
        fila.id === itemId ? { ...fila, ...patch } : fila
      ),
    }));
  };

  const agregarFila = (proveedor: (typeof PROVEEDORES)[number]) => {
    setPedidosPorProveedor((actual) => ({
      ...actual,
      [proveedor]: [...actual[proveedor], crearItem()],
    }));
  };

  const quitarFila = (proveedor: (typeof PROVEEDORES)[number], itemId: string) => {
    setPedidosPorProveedor((actual) => {
      const filas = actual[proveedor];
      return {
        ...actual,
        [proveedor]: filas.length <= 1 ? [crearItem()] : filas.filter((f) => f.id !== itemId),
      };
    });
  };

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Pedidos</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Carga rápida de pedidos por proveedor: item, cantidad y unidad.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Ítems cargados: <span className="font-medium text-zinc-300">{totalItemsCargados}</span>
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {PROVEEDORES.map((proveedor) => (
            <section
              key={proveedor}
              className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm uppercase tracking-[0.14em] text-zinc-400">
                  {proveedor}
                </h2>
                <button
                  type="button"
                  onClick={() => agregarFila(proveedor)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir
                </button>
              </div>

              <div className="space-y-2">
                {pedidosPorProveedor[proveedor].map((fila) => (
                  <div
                    key={fila.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-2"
                  >
                    <input
                      value={fila.item}
                      onChange={(e) =>
                        actualizarFila(proveedor, fila.id, { item: e.target.value })
                      }
                      placeholder="Item"
                      className="min-w-[10rem] flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                    />
                    <input
                      value={fila.cantidad}
                      onChange={(e) =>
                        actualizarFila(proveedor, fila.id, { cantidad: e.target.value })
                      }
                      placeholder="Cantidad"
                      inputMode="decimal"
                      className="w-24 shrink-0 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                    />
                    <select
                      value={fila.unidad}
                      onChange={(e) =>
                        actualizarFila(proveedor, fila.id, {
                          unidad: e.target.value as UnidadMedida,
                        })
                      }
                      className="w-24 shrink-0 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                    >
                      {UNIDADES.map((unidad) => (
                        <option key={unidad} value={unidad}>
                          {unidad}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => quitarFila(proveedor, fila.id)}
                      className="inline-flex shrink-0 items-center justify-center rounded-md border border-transparent p-2 text-zinc-500 transition hover:border-zinc-700 hover:text-red-300"
                      aria-label="Eliminar fila de pedido"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
