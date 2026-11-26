"use client";

import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ChefHat,
  ClipboardList,
  Clock,
  Coins,
  Factory,
  History,
  LayoutGrid,
  LogOut,
  NotebookText,
  Package,
  PieChart,
  Scissors,
  ShoppingCart,
  Soup,
  UserRound,
  Users,
  Wine,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useTema } from "@/app/components/tema-provider";
import {
  CampoBusqueda,
  Etiqueta,
  Fila,
  Hoja,
  Lista,
  Seccion,
  Segmentado,
  cx,
  vibrar,
} from "@/app/ui";
import { fetchMepCargasSinCerrarRecientes } from "@/src/lib/mep-deli";
import type { TemaPreferencia } from "@/src/lib/tema";

import {
  ALL_LINKS,
  GRUPOS,
  PESTANAS,
  esHrefActivo,
  puedeVerHref,
  sinNavegacion,
  type Href,
  type SessionInfo,
} from "./navegacion";

const ICONOS: Record<Href, LucideIcon> = {
  "/": ChefHat,
  "/bebidas": Wine,
  "/guia-bebidas": BookOpen,
  "/mep-deli": ClipboardList,
  "/pedidos": ShoppingCart,
  "/avisos": Bell,
  "/platos": Soup,
  "/mep-cortes": Scissors,
  "/inventario": Package,
  "/stock": Package,
  "/receta": NotebookText,
  "/historial": History,
  "/mep-historial": History,
  "/estadisticas": BarChart3,
  "/compras": ShoppingCart,
  "/produccion": Factory,
  "/produccion-tiempos": Clock,
  "/produccion-plan": CalendarDays,
  "/eventos": CalendarDays,
  "/personal": Users,
  "/consumo": PieChart,
  "/gasto": Coins,
};

const LABEL = new Map<string, string>(ALL_LINKS.map((l) => [l.href, l.label]));

function normalizar(t: string) {
  return t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Navegación en celular: barra de pestañas fija abajo (las 4 pantallas de servicio
 * más usadas) y "Más" con todo lo demás, un buscador, el tema y la sesión.
 * En tablet y escritorio (sm+), la misma navegación es una barra lateral fija.
 */
export function BarraInferior() {
  const pathname = usePathname();
  const router = useRouter();
  const { preferencia, setPreferencia } = useTema();
  const [session, setSession] = useState<SessionInfo | null | undefined>(
    undefined,
  );
  const [mas, setMas] = useState(false);
  const [q, setQ] = useState("");
  const [mepSinCerrar, setMepSinCerrar] = useState(0);
  const oculta = sinNavegacion(pathname);

  useEffect(() => {
    if (oculta) return;
    let cancelado = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { session: SessionInfo | null }) => {
        if (!cancelado) setSession(d.session ?? null);
      })
      .catch(() => {
        if (!cancelado) setSession(null);
      });
    fetchMepCargasSinCerrarRecientes()
      .then((lista) => {
        if (!cancelado) setMepSinCerrar(lista.length);
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [oculta, pathname]);

  const grupos = useMemo(() => {
    const n = normalizar(q.trim());
    return GRUPOS.map((g) => ({
      titulo: g.titulo,
      hrefs: g.hrefs.filter(
        (h) =>
          puedeVerHref(session, h) &&
          (!n || normalizar(LABEL.get(h) ?? "").includes(n)),
      ),
    })).filter((g) => g.hrefs.length > 0);
  }, [session, q]);

  if (oculta) return null;

  const enPestana = PESTANAS.some((p) => esHrefActivo(pathname, p.href));
  const cerrarMas = () => {
    setMas(false);
    setQ("");
  };

  const salir = async () => {
    cerrarMas();
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <>
      {/* Franja bajo la barra de estado del teléfono (PWA a pantalla completa). */}
      <div
        aria-hidden
        style={{ viewTransitionName: "barra-estado" }}
        className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[env(safe-area-inset-top,0px)] bg-material backdrop-blur-xl sm:hidden"
      />
      <div
        aria-hidden
        className="h-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] shrink-0 sm:hidden"
      />

      {/* Tablet y escritorio: barra lateral con todas las pantallas. */}
      <aside
        aria-label="Navegación"
        style={{ viewTransitionName: "barra-lateral" }}
        className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-separator bg-surface-2 sm:flex"
      >
        <div className="flex items-center gap-3 px-5 pb-3 pt-6">
          <p className="font-display text-[1.35rem] font-semibold tracking-[0.12em] text-label">
            OMAKASE
          </p>
          <span className="h-px flex-1 bg-accent/50" aria-hidden />
        </div>
        <div className="px-3 pb-2">
          <CampoBusqueda
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar pantalla"
            etiqueta="Buscar pantalla"
          />
        </div>
        <nav className="ui-sin-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {grupos.map((g) => (
            <div key={g.titulo} className="mt-4 first:mt-2">
              <p className="mb-1 px-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-label-3">
                {g.titulo}
              </p>
              <ul className="space-y-0.5">
                {g.hrefs.map((h) => {
                  const Icono = ICONOS[h];
                  const activa = esHrefActivo(pathname, h);
                  const badge =
                    h === "/mep-deli" && mepSinCerrar > 0 ? mepSinCerrar : 0;
                  return (
                    <li key={h}>
                      <Link
                        href={h}
                        transitionTypes={["tab"]}
                        aria-current={activa ? "page" : undefined}
                        className={cx(
                          "flex min-h-10 items-center gap-2.5 rounded-[0.6rem] px-2 text-[0.94rem] transition-colors",
                          activa
                            ? "bg-accent-soft font-semibold text-accent"
                            : "text-label-2 hover:bg-fill hover:text-label",
                        )}
                      >
                        <Icono
                          className="h-[18px] w-[18px] shrink-0"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {LABEL.get(h)}
                        </span>
                        {badge ? (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[0.7rem] font-bold text-on-accent">
                            {badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {grupos.length === 0 ? (
            <p className="px-2 py-6 text-[0.9rem] text-label-3">
              Ninguna pantalla se llama así.
            </p>
          ) : null}
        </nav>
        <div className="space-y-3 border-t border-separator px-3 py-3">
          <Segmentado<TemaPreferencia>
            etiqueta="Tema"
            valor={preferencia}
            onChange={setPreferencia}
            opciones={[
              { valor: "auto", label: "Auto" },
              { valor: "dia", label: "Día" },
              { valor: "noche", label: "Noche" },
            ]}
          />
          {session ? (
            <div className="flex items-center gap-2 px-1">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-label-2">
                <UserRound className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[0.9rem] text-label">
                  {session.name}
                </span>
                <span className="block text-[0.75rem] text-label-3">
                  {session.role === "admin" ? "Administración" : "Equipo"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void salir()}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="inline-flex size-10 items-center justify-center rounded-full text-label-3 transition hover:bg-danger-soft hover:text-danger"
              >
                <LogOut className="h-[18px] w-[18px]" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <nav
        aria-label="Navegación principal"
        style={{ viewTransitionName: "barra-inferior" }}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-separator bg-material pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl backdrop-saturate-150 sm:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {PESTANAS.map((p) => {
            const Icono = ICONOS[p.href];
            const activa = esHrefActivo(pathname, p.href);
            const badge =
              p.href === "/mep-deli" && mepSinCerrar > 0 ? mepSinCerrar : 0;
            return (
              <li key={p.href}>
                <Link
                  href={p.href}
                  transitionTypes={["tab"]}
                  onClick={() => vibrar()}
                  aria-current={activa ? "page" : undefined}
                  className={cx(
                    "relative flex h-[3.4rem] flex-col items-center justify-center gap-[3px] text-[0.66rem] font-medium tracking-[0.01em] transition-colors active:opacity-60",
                    activa ? "text-accent" : "text-label-3",
                  )}
                >
                  <span className="relative">
                    <Icono
                      className="h-[23px] w-[23px]"
                      strokeWidth={activa ? 2.3 : 1.8}
                      aria-hidden
                    />
                    {badge ? (
                      <span className="absolute -right-2.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-accent px-1 text-[0.62rem] font-bold text-on-accent ring-2 ring-surface">
                        {badge}
                      </span>
                    ) : null}
                  </span>
                  {p.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => {
                vibrar();
                setMas(true);
              }}
              aria-haspopup="dialog"
              className={cx(
                "flex h-[3.4rem] w-full flex-col items-center justify-center gap-[3px] text-[0.66rem] font-medium transition-colors active:opacity-60",
                !enPestana ? "text-accent" : "text-label-3",
              )}
            >
              <LayoutGrid
                className="h-[23px] w-[23px]"
                strokeWidth={!enPestana ? 2.3 : 1.8}
                aria-hidden
              />
              <span className="max-w-full truncate px-1">
                {!enPestana
                  ? (LABEL.get(
                      ALL_LINKS.find((l) => esHrefActivo(pathname, l.href))
                        ?.href ?? "",
                    ) ?? "Más")
                  : "Más"}
              </span>
            </button>
          </li>
        </ul>
      </nav>

      <Hoja abierta={mas} onCerrar={cerrarMas} titulo="Todo" alto="alta">
        <div className="sticky top-0 z-10 -mx-4 bg-surface-2 px-4 pb-1">
          <CampoBusqueda
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar pantalla"
            etiqueta="Buscar pantalla"
          />
        </div>

        {grupos.map((g) => (
          <Seccion key={g.titulo} titulo={g.titulo}>
            <div onClickCapture={cerrarMas}>
              <Lista>
                {g.hrefs.map((h) => {
                  const Icono = ICONOS[h];
                  const activa = esHrefActivo(pathname, h);
                  return (
                    <Fila
                      key={h}
                      href={h}
                      transicion="nav-forward"
                      icono={
                        <span
                          className={cx(
                            "flex size-8 items-center justify-center rounded-[0.6rem]",
                            activa
                              ? "bg-accent text-on-accent"
                              : "bg-fill text-label-2",
                          )}
                        >
                          <Icono className="h-[18px] w-[18px]" aria-hidden />
                        </span>
                      }
                      titulo={
                        <span className={activa ? "font-semibold" : ""}>
                          {LABEL.get(h)}
                        </span>
                      }
                      valor={
                        h === "/mep-deli" && mepSinCerrar > 0 ? (
                          <Etiqueta tono="acento">
                            {mepSinCerrar} sin cerrar
                          </Etiqueta>
                        ) : undefined
                      }
                    />
                  );
                })}
              </Lista>
            </div>
          </Seccion>
        ))}
        {grupos.length === 0 ? (
          <p className="py-10 text-center text-label-3">
            Ninguna pantalla se llama así.
          </p>
        ) : null}

        {!q ? (
          <>
            <Seccion
              titulo="Apariencia"
              pie="Auto: día de 7 a 20 h, noche el resto."
            >
              <Segmentado<TemaPreferencia>
                etiqueta="Tema"
                valor={preferencia}
                onChange={setPreferencia}
                opciones={[
                  { valor: "auto", label: "Auto" },
                  { valor: "dia", label: "Día" },
                  { valor: "noche", label: "Noche" },
                ]}
              />
            </Seccion>
            {session ? (
              <Seccion titulo="Sesión">
                <Lista>
                  <Fila
                    icono={
                      <span className="flex size-8 items-center justify-center rounded-full bg-fill text-label-2">
                        <UserRound className="h-[18px] w-[18px]" aria-hidden />
                      </span>
                    }
                    titulo={session.name}
                    detalle={
                      session.role === "admin" ? "Administración" : "Equipo"
                    }
                    chevron={false}
                  />
                  <Fila
                    icono={
                      <span className="flex size-8 items-center justify-center rounded-full bg-danger-soft text-danger">
                        <LogOut className="h-[18px] w-[18px]" aria-hidden />
                      </span>
                    }
                    titulo={<span className="text-danger">Cerrar sesión</span>}
                    onClick={() => void salir()}
                    chevron={false}
                  />
                </Lista>
              </Seccion>
            ) : null}
          </>
        ) : null}
      </Hoja>
    </>
  );
}
