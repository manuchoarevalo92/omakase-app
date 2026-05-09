"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, LogOut } from "lucide-react";

const ALL_LINKS = [
  { href: "/", label: "Menú" },
  { href: "/bebidas", label: "Bebidas" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/platos", label: "Platos" },
  { href: "/inventario", label: "Ingredientes" },
  { href: "/receta", label: "Receta" },
  { href: "/historial", label: "Historial" },
] as const;

const STAFF_HREFS = new Set<string>([
  "/",
  "/bebidas",
  "/pedidos",
  "/inventario",
  "/historial",
]);

type SessionInfo = { id: string; name: string; role: "admin" | "staff" };

export function MainNav() {
  const pathname = usePathname();
  const router = useRouter();
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadSession = useCallback(async () => {
    if (pathname === "/login") {
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

  const links = useMemo(() => {
    if (session === undefined) {
      return [];
    }
    if (session === null) {
      return ALL_LINKS.filter((link) => STAFF_HREFS.has(link.href));
    }
    if (session.role === "staff") {
      return ALL_LINKS.filter((link) => STAFF_HREFS.has(link.href));
    }
    return [...ALL_LINKS];
  }, [session]);

  /**
   * Misma lógica de rejilla en móvil y laptop: 7→4+3, 5–6→3 celdas, ≤4→2.
   * En pantallas muy anchas (xl) todas las pestañas en una fila con admin.
   */
  const navGridColsClass = useMemo(() => {
    const n = links.length;
    if (n <= 4) {
      return "grid-cols-2 md:grid-cols-4";
    }
    if (n === 5) {
      return "grid-cols-3 lg:grid-cols-5";
    }
    if (n === 6) {
      return "grid-cols-3 lg:grid-cols-6";
    }
    return "grid-cols-4 xl:grid-cols-7";
  }, [links.length]);

  /** Acerca la pestaña activa en el viewport (scroll horizontal dentro de la grilla si hace falta). */
  useEffect(() => {
    if (session === undefined) {
      return;
    }
    const el = navScrollRef.current?.querySelector<HTMLElement>("[data-nav-active]");
    el?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [pathname, session, links]);

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

  if (pathname === "/login") {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 w-full max-w-full border-b border-zinc-800 bg-zinc-950/95 pt-[calc(env(safe-area-inset-top,0px)+2rem)] backdrop-blur sm:pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
      <div className="box-border w-full min-w-0 max-w-full px-3 py-4 sm:mx-auto sm:max-w-6xl sm:px-6 sm:py-3">
        {session === undefined ? (
          <div className="flex w-full justify-center py-3">
            <Loader2 className="h-7 w-7 shrink-0 animate-spin text-zinc-500 sm:h-6 sm:w-6" aria-label="Cargando menú" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div
              ref={navScrollRef}
              className={`-mx-3 grid min-h-14 min-w-0 w-full flex-1 touch-pan-x gap-2 overflow-x-auto overflow-y-visible overscroll-x-contain px-3 py-1 sm:-mx-0 sm:overflow-x-visible sm:px-0 sm:py-0 ${navGridColsClass}`}
            >
              {links.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/" && pathname.startsWith(link.href));
                const tabSizing =
                  link.href === "/inventario"
                    ? "hyphens-auto px-3 py-2.5 leading-snug tracking-normal sm:py-2.5"
                    : "px-3 py-2.5 leading-tight tracking-tight min-h-[2.85rem] sm:min-h-11";

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-nav-active={isActive ? true : undefined}
                    className={`inline-flex min-h-12 min-w-0 w-full max-w-none items-center justify-center whitespace-normal rounded-xl border text-center text-pretty text-sm font-semibold transition sm:min-h-11 sm:max-w-none sm:rounded-xl sm:text-sm sm:font-semibold md:rounded-xl ${tabSizing} ${
                      isActive
                        ? "border-zinc-200 bg-zinc-100 text-zinc-900"
                        : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
            {session ? (
              <div className="flex min-h-12 w-full shrink-0 items-center justify-center gap-2 px-1 text-zinc-500 sm:w-auto sm:min-h-11 sm:max-w-none sm:justify-end sm:self-center sm:border-0 md:pl-2">
                <p className="min-w-0 max-w-[12rem] text-center text-sm font-medium leading-snug sm:max-w-[14rem] sm:text-right md:text-right">
                  <span className="line-clamp-2 text-pretty break-words">{session.name}</span>
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
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50 sm:size-10"
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
    </nav>
  );
}
