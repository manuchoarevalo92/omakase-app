"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, LogOut, Menu, X } from "lucide-react";

import { fetchMepCargasSinCerrarRecientes } from "@/src/lib/mep-deli";

const ALL_LINKS = [
  { href: "/", label: "Omakase" },
  { href: "/bebidas", label: "Bebidas" },
  { href: "/mep-deli", label: "MEP Deli" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/avisos", label: "Avisos" },
  { href: "/platos", label: "Platos" },
  { href: "/mep-cortes", label: "Catálogo MEP" },
  { href: "/inventario", label: "Ingredientes" },
  { href: "/stock", label: "Stock" },
  { href: "/receta", label: "Receta" },
  { href: "/historial", label: "Historial" },
  { href: "/mep-historial", label: "MEP Historial" },
  { href: "/estadisticas", label: "Stats" },
  { href: "/compras", label: "Compras" },
  { href: "/produccion", label: "Producción" },
  { href: "/produccion-tiempos", label: "Tiempos prep" },
  { href: "/consumo", label: "Consumo" },
  { href: "/gasto", label: "Gasto" },
] as const;

type Href = (typeof ALL_LINKS)[number]["href"];

/** Agrupación de las páginas en el menú desplegable. */
const GRUPOS: { titulo: string; hrefs: Href[] }[] = [
  { titulo: "Servicio", hrefs: ["/", "/bebidas", "/mep-deli", "/mep-historial", "/platos", "/mep-cortes", "/receta", "/historial", "/produccion-tiempos"] },
  { titulo: "Compras", hrefs: ["/pedidos", "/avisos", "/compras", "/stock", "/inventario"] },
  { titulo: "Análisis", hrefs: ["/consumo", "/gasto", "/estadisticas", "/produccion"] },
];

const STAFF_HREFS = new Set<string>([
  "/",
  "/bebidas",
  "/mep-deli",
  "/mep-cortes",
  "/mep-historial",
  "/pedidos",
  "/avisos",
  "/inventario",
  "/stock",
  "/historial",
  "/produccion-tiempos",
]);

type SessionInfo = { id: string; name: string; role: "admin" | "staff" };

export function MainNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [mepSinCerrar, setMepSinCerrar] = useState(0);

  const loadSession = useCallback(async () => {
    if (pathname === "/login" || pathname.startsWith("/widget")) {
      setSession(null);
      return;
    }
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = (await res.json()) as {
        session: SessionInfo | null;
      };
      setSession(data.session ?? null);
    } catch {
      setSession(null);
    }
  }, [pathname]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSession();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSession]);

  const puedeVer = useCallback(
    (href: string) => {
      if (session === undefined) {
        return false;
      }
      if (session === null || session.role === "staff") {
        return STAFF_HREFS.has(href);
      }
      return true;
    },
    [session]
  );

  useEffect(() => {
    if (pathname === "/login" || pathname.startsWith("/widget")) {
      return;
    }
    if (session === undefined || session === null) {
      setMepSinCerrar(0);
      return;
    }
    if (!puedeVer("/mep-deli")) {
      setMepSinCerrar(0);
      return;
    }
    let cancelled = false;
    void fetchMepCargasSinCerrarRecientes()
      .then((lista) => {
        if (!cancelled) {
          setMepSinCerrar(lista.length);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMepSinCerrar(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, session, puedeVer]);

  const labelPorHref = useMemo(() => {
    const map = new Map<string, string>();
    ALL_LINKS.forEach((l) => map.set(l.href, l.label));
    return map;
  }, []);

  /** Grupos filtrados por rol (se ocultan los que quedan vacíos). */
  const gruposVisibles = useMemo(() => {
    return GRUPOS.map((g) => ({
      titulo: g.titulo,
      hrefs: g.hrefs.filter((h) => puedeVer(h)),
    })).filter((g) => g.hrefs.length > 0);
  }, [puedeVer]);

  const esActivo = useCallback(
    (href: string) =>
      pathname === href || (href !== "/" && pathname.startsWith(href)),
    [pathname]
  );

  /** Título de la página actual para mostrarlo en el botón del menú. */
  const paginaActual = useMemo(() => {
    const match = ALL_LINKS.filter((l) => esActivo(l.href)).sort(
      (a, b) => b.href.length - a.href.length
    )[0];
    return match ? match.label : "Omakase";
  }, [esActivo]);

  // Cerrar el menú al navegar.
  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  // Cerrar con Escape.
  useEffect(() => {
    if (!menuAbierto) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuAbierto(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuAbierto]);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  if (pathname === "/login" || pathname.startsWith("/widget")) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 w-full max-w-full border-b border-zinc-800 bg-zinc-950/95 pt-[calc(env(safe-area-inset-top,0px)+2rem)] backdrop-blur sm:pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
      <div className="box-border w-full min-w-0 max-w-full px-3 py-3 sm:mx-auto sm:max-w-6xl sm:px-6">
        {session === undefined ? (
          <div className="flex w-full justify-center py-2">
            <Loader2
              className="h-7 w-7 shrink-0 animate-spin text-zinc-500 sm:h-6 sm:w-6"
              aria-label="Cargando menú"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-expanded={menuAbierto}
              aria-controls="nav-menu-panel"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500"
            >
              {menuAbierto ? (
                <X className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Menu className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span className="max-w-[9rem] truncate sm:max-w-none">{paginaActual}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-zinc-500 transition ${
                  menuAbierto ? "rotate-180" : ""
                }`}
                aria-hidden
              />
            </button>

            {session ? (
              <div className="flex min-w-0 items-center gap-2 text-zinc-500">
                <p className="min-w-0 max-w-[9rem] truncate text-right text-sm font-medium sm:max-w-[14rem]">
                  {session.name}
                  {session.role === "staff" ? (
                    <span className="text-zinc-600"> · equipo</span>
                  ) : null}
                </p>
                <button
                  type="button"
                  onClick={() => void logout()}
                  disabled={loggingOut}
                  title="Salir"
                  aria-label="Cerrar sesión"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
                >
                  {loggingOut ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <LogOut className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {menuAbierto ? (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMenuAbierto(false)}
            className="fixed inset-0 z-40 cursor-default bg-black/40"
          />
          <div
            id="nav-menu-panel"
            className="absolute inset-x-0 top-full z-50 max-h-[70vh] overflow-y-auto overscroll-contain border-b border-zinc-800 bg-zinc-950/98 shadow-2xl backdrop-blur"
          >
            <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6">
              <div className="grid gap-5 sm:grid-cols-3">
                {gruposVisibles.map((grupo) => (
                  <section key={grupo.titulo}>
                    <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      {grupo.titulo}
                    </h2>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                      {grupo.hrefs.map((href) => {
                        const activo = esActivo(href);
                        const badgeMep =
                          href === "/mep-deli" && mepSinCerrar > 0 ? mepSinCerrar : null;
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setMenuAbierto(false)}
                            aria-current={activo ? "page" : undefined}
                            className={`inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                              activo
                                ? "border-zinc-200 bg-zinc-100 text-zinc-900"
                                : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
                            }`}
                          >
                            <span>{labelPorHref.get(href) ?? href}</span>
                            {badgeMep !== null ? (
                              <span
                                className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                  activo
                                    ? "bg-amber-500 text-zinc-900"
                                    : "bg-amber-500/90 text-zinc-950"
                                }`}
                                title={`${badgeMep} MEP sin cerrar`}
                              >
                                {badgeMep}
                              </span>
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </nav>
  );
}
