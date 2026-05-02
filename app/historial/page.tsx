"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/src/lib/supabase";

type Servicio = "Mediodia" | "Noche";

type RegistroHistorial = {
  id: string;
  fecha: string;
  hora: string | null;
  servicio: Servicio | null;
  menu_omakase: string[] | null;
  extensiones: string[] | null;
};

type PlatoLite = {
  id: string;
  nombre: string;
};

const SERVICE_ORDER: Servicio[] = ["Mediodia", "Noche"];

export default function HistorialPage() {
  const [historial, setHistorial] = useState<RegistroHistorial[]>([]);
  const [platos, setPlatos] = useState<PlatoLite[]>([]);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [filtroServicio, setFiltroServicio] = useState<"Todos" | Servicio>("Todos");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const platosMap = useMemo(() => {
    return new Map(platos.map((plato) => [plato.id, plato.nombre]));
  }, [platos]);

  const historialFiltrado = useMemo(() => {
    return historial.filter((registro) => {
      if (filtroServicio !== "Todos" && registro.servicio !== filtroServicio) {
        return false;
      }

      if (fechaDesde && registro.fecha < fechaDesde) {
        return false;
      }

      if (fechaHasta && registro.fecha > fechaHasta) {
        return false;
      }

      return true;
    });
  }, [historial, filtroServicio, fechaDesde, fechaHasta]);

  const historialAgrupado = useMemo(() => {
    const grupos = new Map<string, RegistroHistorial[]>();

    historialFiltrado.forEach((registro) => {
      const key = registro.fecha;
      const current = grupos.get(key) ?? [];
      current.push(registro);
      grupos.set(key, current);
    });

    return [...grupos.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([fecha, registros]) => ({
        fecha,
        registros: [...registros].sort((a, b) => {
          const indexA = SERVICE_ORDER.indexOf((a.servicio ?? "Noche") as Servicio);
          const indexB = SERVICE_ORDER.indexOf((b.servicio ?? "Noche") as Servicio);
          if (indexA !== indexB) {
            return indexA - indexB;
          }
          return (a.hora ?? "").localeCompare(b.hora ?? "");
        }),
      }));
  }, [historialFiltrado]);

  const cargarHistorial = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [historialResponse, platosResponse] = await Promise.all([
        supabase
          .from("historial_servicios")
          .select("id, fecha, hora, servicio, menu_omakase, extensiones")
          .order("fecha", { ascending: false }),
        supabase.from("platos").select("id, nombre"),
      ]);

      if (historialResponse.error) {
        setError(historialResponse.error.message);
        return;
      }

      if (platosResponse.error) {
        setError(platosResponse.error.message);
        return;
      }

      setHistorial((historialResponse.data as RegistroHistorial[]) ?? []);
      setPlatos((platosResponse.data as PlatoLite[]) ?? []);
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
      void cargarHistorial();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const renderListaPlatos = (ids: string[] | null) => {
    const items = ids ?? [];
    if (items.length === 0) {
      return "Sin selección";
    }

    return items.map((id) => platosMap.get(id) ?? `Plato ${id.slice(0, 6)}`).join(" · ");
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Omakase</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Historial de Servicios</h1>
        </header>

        <section className="mb-6 grid gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 sm:grid-cols-3">
          <input
            type="date"
            value={fechaDesde}
            onChange={(event) => setFechaDesde(event.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
            aria-label="Fecha desde"
          />
          <input
            type="date"
            value={fechaHasta}
            onChange={(event) => setFechaHasta(event.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
            aria-label="Fecha hasta"
          />
          <select
            value={filtroServicio}
            onChange={(event) =>
              setFiltroServicio(event.target.value as "Todos" | Servicio)
            }
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
            aria-label="Filtrar por servicio"
          >
            <option value="Todos">Todos los servicios</option>
            <option value="Mediodia">Mediodia</option>
            <option value="Noche">Noche</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setFechaDesde("");
              setFechaHasta("");
              setFiltroServicio("Todos");
            }}
            className="sm:col-span-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-100"
          >
            Limpiar filtros
          </button>
        </section>

        {error ? (
          <p className="mb-5 rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando historial...
          </div>
        ) : historialAgrupado.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No hay resultados para los filtros seleccionados.
          </p>
        ) : (
          <div className="space-y-6">
            {historialAgrupado.map((grupo) => (
              <section key={grupo.fecha}>
                <h2 className="mb-3 text-sm uppercase tracking-[0.16em] text-zinc-500">
                  {grupo.fecha}
                </h2>
                <div className="space-y-2">
                  {grupo.registros.map((registro) => (
                    <article
                      key={registro.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-zinc-100">
                          {registro.servicio ?? "Servicio"}{" "}
                          <span className="text-zinc-500">
                            {registro.hora ? `· ${registro.hora}` : ""}
                          </span>
                        </p>
                      </div>
                      <p className="text-xs text-zinc-400">
                        <span className="text-zinc-500">Menú Omakase:</span>{" "}
                        {renderListaPlatos(registro.menu_omakase)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        <span className="text-zinc-500">Extensiones:</span>{" "}
                        {renderListaPlatos(registro.extensiones)}
                      </p>
                    </article>
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
