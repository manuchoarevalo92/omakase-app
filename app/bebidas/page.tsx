"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatPostgrestError } from "@/src/lib/supabase-errors";
import { supabase } from "@/src/lib/supabase";

type BebidaItem = {
  id: string;
  bebida: string;
  cantidad: string;
};

const TOTAL_ASIENTOS = 8;
const STORAGE_KEY = "omakase_bebidas_v1";

type BebidaAsientoRow = {
  asiento: number;
  consumos: BebidaItem[] | null;
};

const crearItem = (): BebidaItem => ({
  id: crypto.randomUUID(),
  bebida: "",
  cantidad: "",
});

const crearEstadoVacio = (): BebidaItem[][] =>
  Array.from({ length: TOTAL_ASIENTOS }, () => [crearItem()]);

const normalizarConsumos = (consumos: BebidaItem[] | null | undefined): BebidaItem[] => {
  const lista = Array.isArray(consumos) ? consumos : [];
  const normalizados = lista
    .map((item) => ({
      id: item.id || crypto.randomUUID(),
      bebida: typeof item.bebida === "string" ? item.bebida : "",
      cantidad: typeof item.cantidad === "string" ? item.cantidad : "",
    }))
    .filter((item) => item.bebida.trim() || item.cantidad.trim());
  return normalizados.length > 0 ? normalizados : [crearItem()];
};

const cargarEstadoLocal = (): BebidaItem[][] => {
  const vacio = crearEstadoVacio();
  if (typeof window === "undefined") {
    return vacio;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return vacio;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== TOTAL_ASIENTOS) {
      return vacio;
    }
    return parsed.map((consumos) => normalizarConsumos(consumos as BebidaItem[]));
  } catch {
    return vacio;
  }
};

export default function BebidasPage() {
  const [bebidasPorAsiento, setBebidasPorAsiento] = useState<BebidaItem[][]>(cargarEstadoLocal);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncLabel, setLastSyncLabel] = useState<string | null>(null);
  const cargadoRemotoRef = useRef(false);
  const timerSyncRef = useRef<number | null>(null);

  useEffect(() => {
    const cargarDesdeNube = async () => {
      const { data, error } = await supabase
        .from("bebidas_asientos")
        .select("asiento, consumos")
        .order("asiento", { ascending: true });

      if (error) {
        setSyncError(formatPostgrestError(error));
        cargadoRemotoRef.current = true;
        return;
      }

      const rows = (data ?? []) as BebidaAsientoRow[];
      if (rows.length > 0) {
        const merged = Array.from({ length: TOTAL_ASIENTOS }, (_, i) => {
          const row = rows.find((r) => r.asiento === i + 1);
          return normalizarConsumos(row?.consumos);
        });
        setBebidasPorAsiento(merged);
      }
      setSyncError(null);
      cargadoRemotoRef.current = true;
    };
    void cargarDesdeNube();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bebidasPorAsiento));
    } catch {
      // Ignora fallos de almacenamiento local.
    }
  }, [bebidasPorAsiento]);

  useEffect(() => {
    if (!cargadoRemotoRef.current) {
      return;
    }

    if (timerSyncRef.current) {
      window.clearTimeout(timerSyncRef.current);
    }

    timerSyncRef.current = window.setTimeout(() => {
      const sync = async () => {
        setIsSyncing(true);
        const payload = bebidasPorAsiento.map((consumos, index) => ({
          asiento: index + 1,
          consumos,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase
          .from("bebidas_asientos")
          .upsert(payload, { onConflict: "asiento" });

        if (error) {
          setSyncError(formatPostgrestError(error));
          setIsSyncing(false);
          return;
        }

        setSyncError(null);
        setLastSyncLabel(
          new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
        );
        setIsSyncing(false);
      };
      void sync();
    }, 700);

    return () => {
      if (timerSyncRef.current) {
        window.clearTimeout(timerSyncRef.current);
      }
    };
  }, [bebidasPorAsiento]);

  const totalItemsCargados = useMemo(() => {
    return bebidasPorAsiento.reduce(
      (acc, asiento) =>
        acc + asiento.filter((item) => item.bebida.trim().length > 0).length,
      0
    );
  }, [bebidasPorAsiento]);

  const actualizarItem = (
    asientoIndex: number,
    itemId: string,
    patch: Partial<BebidaItem>
  ) => {
    setBebidasPorAsiento((actual) =>
      actual.map((items, i) =>
        i !== asientoIndex
          ? items
          : items.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
      )
    );
  };

  const agregarItem = (asientoIndex: number) => {
    setBebidasPorAsiento((actual) =>
      actual.map((items, i) => (i === asientoIndex ? [...items, crearItem()] : items))
    );
  };

  const quitarItem = (asientoIndex: number, itemId: string) => {
    setBebidasPorAsiento((actual) =>
      actual.map((items, i) => {
        if (i !== asientoIndex) {
          return items;
        }
        if (items.length <= 1) {
          return [crearItem()];
        }
        return items.filter((item) => item.id !== itemId);
      })
    );
  };

  const limpiarTodo = () => {
    setSyncError(null);
    setBebidasPorAsiento(crearEstadoVacio());
  };

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-white">Bebidas</h1>
            <button
              type="button"
              onClick={limpiarTodo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-1.5 text-xs text-red-200 transition hover:bg-red-950/70"
            >
              Limpiar todo
            </button>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Registro rápido por asiento (1 al 8): bebida y cantidad.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Ítems cargados: <span className="font-medium text-zinc-300">{totalItemsCargados}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {isSyncing
              ? "Sincronizando con Supabase..."
              : lastSyncLabel
                ? `Sincronizado a las ${lastSyncLabel}`
                : "Sin cambios sincronizados todavía"}
          </p>
        </header>

        {syncError ? (
          <p className="mb-4 rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {syncError}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {bebidasPorAsiento.map((items, asientoIndex) => (
            <section
              key={asientoIndex}
              className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm uppercase tracking-[0.14em] text-zinc-400">
                  Asiento {asientoIndex + 1}
                </h2>
                <button
                  type="button"
                  onClick={() => agregarItem(asientoIndex)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                  aria-label={`Agregar bebida en asiento ${asientoIndex + 1}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir
                </button>
              </div>

              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-2"
                  >
                    <input
                      value={item.bebida}
                      onChange={(e) =>
                        actualizarItem(asientoIndex, item.id, { bebida: e.target.value })
                      }
                      placeholder="Qué tomó..."
                      className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                    />
                    <input
                      value={item.cantidad}
                      onChange={(e) =>
                        actualizarItem(asientoIndex, item.id, { cantidad: e.target.value })
                      }
                      placeholder="Cant."
                      inputMode="decimal"
                      className="w-20 shrink-0 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={() => quitarItem(asientoIndex, item.id)}
                      className="inline-flex shrink-0 items-center justify-center rounded-md border border-transparent p-2 text-zinc-500 transition hover:border-zinc-700 hover:text-red-300"
                      aria-label="Eliminar fila de bebida"
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
