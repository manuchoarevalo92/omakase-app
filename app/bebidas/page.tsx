"use client";

import { FilePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatPostgrestError } from "@/src/lib/supabase-errors";
import {
  etiquetaServicioHistorial,
  fetchUltimoHistorialServicio,
  type HistorialServicioRow,
} from "@/src/lib/historial-servicios";
import { supabase } from "@/src/lib/supabase";

type BebidaItem = {
  id: string;
  bebida: string;
  cantidad: string;
};

/** Números de asiento en orden de visualización. Los dos primeros (-2, -1) son
 * los asientos extra habilitados; luego siguen 1..8. Se usan como valor real de
 * la columna `asiento` en la base. */
const ASIENTOS_NUMEROS = [-2, -1, 1, 2, 3, 4, 5, 6, 7, 8] as const;
const TOTAL_ASIENTOS = ASIENTOS_NUMEROS.length;
const STORAGE_KEY = "omakase_bebidas_v3";

type BebidaAsientoRow = {
  historial_servicio_id: string;
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

const hayConsumosCargados = (asientos: BebidaItem[][]): boolean =>
  asientos.some((items) => items.some((item) => item.bebida.trim().length > 0));

export default function BebidasPage() {
  const [bebidasPorAsiento, setBebidasPorAsiento] = useState<BebidaItem[][]>(crearEstadoVacio);
  const [servicioActivo, setServicioActivo] = useState<HistorialServicioRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncLabel, setLastSyncLabel] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const cargadoRemotoRef = useRef(false);
  const timerSyncRef = useRef<number | null>(null);
  const servicioActivoIdRef = useRef<string | null>(null);

  servicioActivoIdRef.current = servicioActivo?.id ?? null;

  const cargarBebidasParaServicio = useCallback(async (historialId: string) => {
    const { data, error } = await supabase
      .from("bebidas_asientos")
      .select("historial_servicio_id, asiento, consumos")
      .eq("historial_servicio_id", historialId)
      .order("asiento", { ascending: true });

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as BebidaAsientoRow[];
    return Array.from({ length: TOTAL_ASIENTOS }, (_, i) => {
      const row = rows.find((r) => r.asiento === ASIENTOS_NUMEROS[i]);
      return normalizarConsumos(row?.consumos);
    });
  }, []);

  const activarServicio = useCallback(
    async (row: HistorialServicioRow, opts?: { limpiarSiSinDatosEnNube?: boolean }) => {
      setSyncError(null);
      let asientos = crearEstadoVacio();
      try {
        asientos = await cargarBebidasParaServicio(row.id);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "No se pudieron cargar las bebidas del servicio.";
        if (msg.includes("historial_servicio_id") || msg.includes("column")) {
          setSyncError(
            `${msg} — Ejecutá en Supabase el script supabase/bebidas-asientos-historial-servicio.sql`
          );
        } else {
          setSyncError(formatPostgrestError(err as { message: string }));
        }
        setServicioActivo(row);
        setBebidasPorAsiento(crearEstadoVacio());
        cargadoRemotoRef.current = true;
        return;
      }

      if (opts?.limpiarSiSinDatosEnNube && !hayConsumosCargados(asientos)) {
        asientos = crearEstadoVacio();
      }

      setServicioActivo(row);
      setBebidasPorAsiento(asientos);
      cargadoRemotoRef.current = true;
    },
    [cargarBebidasParaServicio]
  );

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setSyncError(null);
      try {
        const ultimo = await fetchUltimoHistorialServicio();
        if (!ultimo) {
          setServicioActivo(null);
          setBebidasPorAsiento(crearEstadoVacio());
          cargadoRemotoRef.current = true;
          return;
        }
        await activarServicio(ultimo);
        setInfoMessage(
          `Bebidas asociadas al último menú guardado (${etiquetaServicioHistorial(ultimo)}).`
        );
      } catch (err) {
        setSyncError(
          err instanceof Error
            ? formatPostgrestError(err as { message: string })
            : "Error al cargar el último servicio."
        );
        cargadoRemotoRef.current = true;
      } finally {
        setIsLoading(false);
      }
    };
    void init();
  }, [activarServicio]);

  useEffect(() => {
    if (!servicioActivo?.id) {
      return;
    }
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ historialServicioId: servicioActivo.id, asientos: bebidasPorAsiento })
      );
    } catch {
      // Ignora fallos de almacenamiento local.
    }
  }, [bebidasPorAsiento, servicioActivo?.id]);

  useEffect(() => {
    if (!cargadoRemotoRef.current || !servicioActivoIdRef.current) {
      return;
    }

    if (timerSyncRef.current) {
      window.clearTimeout(timerSyncRef.current);
    }

    const historialId = servicioActivoIdRef.current;

    timerSyncRef.current = window.setTimeout(() => {
      const sync = async () => {
        setIsSyncing(true);
        const payload = bebidasPorAsiento.map((consumos, index) => ({
          historial_servicio_id: historialId,
          asiento: ASIENTOS_NUMEROS[index],
          consumos,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase
          .from("bebidas_asientos")
          .upsert(payload, { onConflict: "historial_servicio_id,asiento" });

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

  const limpiarAsientosActuales = () => {
    setBebidasPorAsiento(crearEstadoVacio());
  };

  const iniciarNuevoServicio = async () => {
    setInfoMessage(null);
    setSyncError(null);
    setIsLoading(true);
    try {
      const ultimo = await fetchUltimoHistorialServicio();
      if (!ultimo) {
        setSyncError(
          "No hay ningún menú guardado en historial. Cerrá un menú en la página principal antes de tomar bebidas."
        );
        return;
      }

      const mismoServicio = servicioActivo?.id === ultimo.id;
      if (mismoServicio && hayConsumosCargados(bebidasPorAsiento)) {
        const ok = window.confirm(
          `¿Empezar de cero las bebidas para ${etiquetaServicioHistorial(ultimo)}? Se borrarán las líneas actuales de este servicio.`
        );
        if (!ok) {
          return;
        }
        await activarServicio(ultimo, { limpiarSiSinDatosEnNube: true });
        setBebidasPorAsiento(crearEstadoVacio());
        setInfoMessage(`Toma de bebidas reiniciada para ${etiquetaServicioHistorial(ultimo)}.`);
        return;
      }

      if (!mismoServicio) {
        await activarServicio(ultimo, { limpiarSiSinDatosEnNube: true });
        setInfoMessage(
          `Ahora las bebidas quedan ligadas a ${etiquetaServicioHistorial(ultimo)} (último menú guardado).`
        );
        return;
      }

      await activarServicio(ultimo, { limpiarSiSinDatosEnNube: true });
      setInfoMessage(`Servicio activo: ${etiquetaServicioHistorial(ultimo)}.`);
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? formatPostgrestError(err as { message: string })
          : "No se pudo actualizar el servicio activo."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const sinServicio = !isLoading && !servicioActivo;

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-white">Bebidas</h1>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void iniciarNuevoServicio()}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-900/50 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-900/35 disabled:opacity-50"
              >
                <FilePlus className="h-3.5 w-3.5" aria-hidden />
                Nuevo servicio
              </button>
              {servicioActivo ? (
                <button
                  type="button"
                  onClick={() => {
                    if (hayConsumosCargados(bebidasPorAsiento)) {
                      const ok = window.confirm(
                        "¿Vaciar todos los asientos de este servicio?"
                      );
                      if (!ok) {
                        return;
                      }
                    }
                    limpiarAsientosActuales();
                  }}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-1.5 text-xs text-red-200 transition hover:bg-red-950/70 disabled:opacity-50"
                >
                  Limpiar asientos
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Las bebidas se guardan ligadas al <span className="text-zinc-300">último menú cerrado</span>{" "}
            en historial. Usá <span className="text-zinc-300">Nuevo servicio</span> cuando cerraste otro
            menú y querés una toma en blanco para ese servicio.
          </p>
          {servicioActivo ? (
            <div className="mt-3 rounded-lg border border-zinc-600/80 bg-zinc-950/80 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Servicio activo
              </p>
              <p className="mt-0.5 text-sm font-medium text-zinc-100">
                {etiquetaServicioHistorial(servicioActivo)}
              </p>
            </div>
          ) : null}
          <p className="mt-1 text-xs text-zinc-500">
            Ítems cargados: <span className="font-medium text-zinc-300">{totalItemsCargados}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {isLoading
              ? "Cargando servicio y bebidas..."
              : isSyncing
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

        {infoMessage ? (
          <p className="mb-4 rounded-lg border border-emerald-900/70 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
            {infoMessage}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : sinServicio ? (
          <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-6 text-sm text-zinc-400">
            Todavía no hay menús en historial. Andá a la página{" "}
            <span className="text-zinc-200">Menú</span>, cerrá un servicio con{" "}
            <span className="text-zinc-200">Cerrar Menú y Guardar</span>, y volvé acá para tomar
            bebidas.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {bebidasPorAsiento.map((items, asientoIndex) => (
              <section
                key={asientoIndex}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm uppercase tracking-[0.14em] text-zinc-400">
                    Asiento {ASIENTOS_NUMEROS[asientoIndex]}
                  </h2>
                  <button
                    type="button"
                    onClick={() => agregarItem(asientoIndex)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                    aria-label={`Agregar bebida en asiento ${ASIENTOS_NUMEROS[asientoIndex]}`}
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
        )}
      </section>
    </main>
  );
}
