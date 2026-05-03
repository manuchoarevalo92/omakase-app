"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { MenuGuardadoSecciones } from "@/app/components/menu-guardado-secciones";
import { partesDesdeMenuOmakaseGuardado } from "@/src/lib/menu-omakase-guardado";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
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
        setError(formatPostgrestError(historialResponse.error));
        return;
      }

      if (platosResponse.error) {
        setError(formatPostgrestError(platosResponse.error));
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

  return (
    <main className="min-h-screen min-w-0 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Historial de Servicios</h1>
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
          historial.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-4 text-sm leading-relaxed text-zinc-400">
              <p className="font-medium text-zinc-200">Todavía no hay registros</p>
              <p className="mt-2">
                Si ya guardaste menús desde la página principal y acá sigue vacío, lo
                habitual es que en Supabase la tabla{" "}
                <code className="text-zinc-300">historial_servicios</code> tenga RLS
                activado sin una política de{" "}
                <code className="text-zinc-300">SELECT</code> para el rol{" "}
                <code className="text-zinc-300">anon</code> (la app usa la anon key).
              </p>
              <p className="mt-2">
                Si nunca se guardó bien, revisá también políticas de{" "}
                <code className="text-zinc-300">INSERT</code> en esa misma tabla.
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              No hay resultados para los filtros seleccionados.
            </p>
          )
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
                      <div className="mt-3 border-t border-zinc-800/80 pt-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                          Menú guardado
                        </p>
                        <MenuGuardadoSecciones
                          {...partesDesdeMenuOmakaseGuardado(registro.menu_omakase)}
                          extensiones={(registro.extensiones ?? []).filter((id) =>
                            String(id ?? "").trim()
                          )}
                          nombrePlato={(id) =>
                            platosMap.get(id) ?? `Plato ${id.slice(0, 6)}…`
                          }
                        />
                      </div>
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
