"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, History, Search, TriangleAlert } from "lucide-react";
import {
  Boton,
  Campo,
  EstadoVacio,
  EsqueletoLista,
  Pantalla,
  Seccion,
  Segmentado,
} from "@/app/ui";

import { BebidasServicioResumen } from "@/app/components/bebidas-servicio-resumen";
import { MenuGuardadoSecciones } from "@/app/components/menu-guardado-secciones";
import {
  fetchBebidasPorHistorial,
  type BebidaAsientoResumen,
} from "@/src/lib/bebidas-asientos";
import { partesDesdeMenuOmakaseGuardado } from "@/src/lib/menu-omakase-guardado";
import { formatPostgrestError } from "@/src/lib/supabase-errors";
import {
  formatearFechaServicio,
  formatearHoraServicio,
  sinMenu,
} from "@/src/lib/historial-servicios";
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

/** Cómo se muestra cada servicio (en la base queda "Mediodia", sin tilde). */
const NOMBRE_SERVICIO: Record<Servicio, string> = {
  Mediodia: "Mediodía",
  Noche: "Noche",
};

export default function HistorialPage() {
  const [historial, setHistorial] = useState<RegistroHistorial[]>([]);
  const [platos, setPlatos] = useState<PlatoLite[]>([]);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [filtroServicio, setFiltroServicio] = useState<"Todos" | Servicio>(
    "Todos",
  );
  const [bebidasPorServicio, setBebidasPorServicio] = useState<
    Map<string, BebidaAsientoResumen[]>
  >(() => new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advertenciaBebidas, setAdvertenciaBebidas] = useState<string | null>(
    null,
  );

  const platosMap = useMemo(() => {
    return new Map(platos.map((plato) => [plato.id, plato.nombre]));
  }, [platos]);

  const historialFiltrado = useMemo(() => {
    return historial.filter((registro) => {
      if (filtroServicio !== "Todos" && registro.servicio !== filtroServicio) {
        return false;
      }

      if (fechaDesde && registro.fecha.slice(0, 10) < fechaDesde) {
        return false;
      }

      if (fechaHasta && registro.fecha.slice(0, 10) > fechaHasta) {
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
          const indexA = SERVICE_ORDER.indexOf(
            (a.servicio ?? "Noche") as Servicio,
          );
          const indexB = SERVICE_ORDER.indexOf(
            (b.servicio ?? "Noche") as Servicio,
          );
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

      try {
        const bebidasMap = await fetchBebidasPorHistorial();
        setBebidasPorServicio(bebidasMap);
        setAdvertenciaBebidas(null);
      } catch (bebidasErr) {
        setBebidasPorServicio(new Map());
        setAdvertenciaBebidas(
          formatPostgrestError(
            bebidasErr as {
              message: string;
              code?: string;
              details?: string;
              hint?: string;
            },
          ),
        );
      }
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
      void cargarHistorial();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const hayFiltros =
    Boolean(fechaDesde) || Boolean(fechaHasta) || filtroServicio !== "Todos";

  return (
    <Pantalla
      titulo="Historial"
      ancho="amplio"
      subtitulo={
        isLoading
          ? "Cargando…"
          : `${historialFiltrado.length} ${
              historialFiltrado.length === 1 ? "servicio" : "servicios"
            }${hayFiltros ? " con estos filtros" : ""}`
      }
      ayuda={
        <>
          <p>
            Cada servicio guardado desde Omakase, con el menú que salió y las
            bebidas de cada asiento.
          </p>
          <p>
            Filtrá por fechas (desde / hasta, las dos opcionales) o por
            servicio.
          </p>
        </>
      }
    >
      <div className="space-y-3 rounded-card bg-surface-3 p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
        <div className="grid grid-cols-2 gap-2">
          <Campo
            type="date"
            label="Desde"
            value={fechaDesde}
            onChange={(event) => setFechaDesde(event.target.value)}
          />
          <Campo
            type="date"
            label="Hasta"
            value={fechaHasta}
            onChange={(event) => setFechaHasta(event.target.value)}
          />
        </div>
        <Segmentado<"Todos" | Servicio>
          etiqueta="Filtrar por servicio"
          valor={filtroServicio}
          onChange={setFiltroServicio}
          opciones={[
            { valor: "Todos", label: "Todos" },
            { valor: "Mediodia", label: NOMBRE_SERVICIO.Mediodia },
            { valor: "Noche", label: NOMBRE_SERVICIO.Noche },
          ]}
        />
        {hayFiltros ? (
          <Boton
            variante="terciario"
            ancho
            onClick={() => {
              setFechaDesde("");
              setFechaHasta("");
              setFiltroServicio("Todos");
            }}
          >
            Limpiar filtros
          </Boton>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 flex gap-3 rounded-card bg-danger-soft px-4 py-3 text-[0.94rem] text-danger"
        >
          <CircleAlert
            className="mt-0.5 h-[18px] w-[18px] shrink-0"
            aria-hidden
          />
          <p className="min-w-0 flex-1">{error}</p>
        </div>
      ) : null}

      {advertenciaBebidas ? (
        <div
          role="status"
          className="mt-4 flex gap-3 rounded-card bg-warning-soft px-4 py-3 text-[0.94rem] text-warning"
        >
          <TriangleAlert
            className="mt-0.5 h-[18px] w-[18px] shrink-0"
            aria-hidden
          />
          <p className="min-w-0 flex-1">
            No se pudieron cargar las bebidas: {advertenciaBebidas}
          </p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-6">
          <EsqueletoLista filas={6} />
        </div>
      ) : historialAgrupado.length === 0 ? (
        historial.length === 0 ? (
          <div className="mt-6 rounded-card bg-surface-3">
            <EstadoVacio
              icono={<History className="h-6 w-6" aria-hidden />}
              titulo="Todavía no hay registros"
              texto={
                <>
                  Si ya guardaste menús desde Omakase y sigue vacío, revisá en
                  Supabase que{" "}
                  <code className="text-label">historial_servicios</code> tenga
                  políticas de SELECT e INSERT para el rol{" "}
                  <code className="text-label">anon</code>.
                </>
              }
            />
          </div>
        ) : (
          <div className="mt-6 rounded-card bg-surface-3">
            <EstadoVacio
              icono={<Search className="h-6 w-6" aria-hidden />}
              titulo="Sin resultados"
              texto="No hay servicios con estos filtros."
            />
          </div>
        )
      ) : (
        historialAgrupado.map((grupo) => (
          <Seccion
            key={grupo.fecha}
            titulo={formatearFechaServicio(grupo.fecha)}
            className="mt-8"
          >
            <div className="space-y-8">
              {grupo.registros.map((registro) => (
                <article key={registro.id}>
                  <h3 className="px-1 text-[1.15rem] font-semibold text-label">
                    {registro.servicio
                      ? NOMBRE_SERVICIO[registro.servicio]
                      : "Servicio"}
                    {registro.hora ? (
                      <span className="font-normal text-label-2">
                        {" "}
                        · {formatearHoraServicio(registro.hora)}
                      </span>
                    ) : null}
                  </h3>
                  <div className="mt-3 grid gap-6 lg:grid-cols-[3fr_2fr]">
                    {sinMenu(registro) ? (
                      <p className="rounded-card bg-surface-3 px-4 py-3 text-[0.92rem] text-label-3">
                        Sin menú cargado: este servicio lo abrió Bebidas.
                      </p>
                    ) : (
                      <MenuGuardadoSecciones
                        {...partesDesdeMenuOmakaseGuardado(
                          registro.menu_omakase,
                        )}
                        extensiones={(registro.extensiones ?? []).filter((id) =>
                          String(id ?? "").trim(),
                        )}
                        nombrePlato={(id) =>
                          platosMap.get(id) ?? `Plato ${id.slice(0, 6)}…`
                        }
                      />
                    )}
                    <section>
                      <h3 className="mb-2 px-1 text-[0.8rem] font-semibold uppercase tracking-[0.07em] text-label-3">
                        Bebidas
                      </h3>
                      <BebidasServicioResumen
                        asientos={bebidasPorServicio.get(registro.id) ?? []}
                      />
                    </section>
                  </div>
                </article>
              ))}
            </div>
          </Seccion>
        ))
      )}
    </Pantalla>
  );
}
