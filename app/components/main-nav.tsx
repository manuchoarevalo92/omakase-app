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

  /** Columnas en móvil para ~2 filas: 7→4+3, 5–6→3+2 / 3+3, ≤4→2+2. */
  const mobileNavGridClass = useMemo(() => {
    const n = links.length;
    if (n <= 4) {
      return "max-sm:grid-cols-2";
    }
    if (n <= 6) {
      return "max-sm:grid-cols-3";
    }
    return "max-sm:grid-cols-4";
  }, [links.length]);

  /** Acerca la pestaña activa al viewport (útil si hay overflow o al cambiar de ruta). */
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
      <div className="box-border flex w-full min-w-0 max-w-full flex-col gap-2 px-3 py-4 sm:mx-auto sm:max-w-6xl sm:flex-row sm:items-center sm:gap-2 sm:px-6 sm:py-3">
        <div
          ref={navScrollRef}
          className={`-mx-3 grid min-h-14 min-w-0 w-full flex-1 gap-2 px-3 py-1 sm:mx-0 sm:flex sm:min-h-0 sm:min-w-0 sm:flex-1 sm:flex-wrap sm:items-center sm:justify-end sm:gap-2.5 sm:px-0 sm:py-0 ${mobileNavGridClass}`}
        >
          {session === undefined ? (
            <Loader2
              className="col-span-full mx-auto h-7 w-7 shrink-0 animate-spin text-zinc-500 sm:mx-0 sm:h-5 sm:w-5"
              aria-label="Cargando menú"
            />
          ) : (
            <>
              {links.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/" && pathname.startsWith(link.href));
                const tabSizing =
                  link.href === "/inventario"
                    ? "px-3 py-3 leading-snug tracking-normal max-sm:hyphens-auto sm:px-3 sm:py-1.5 sm:leading-tight sm:tracking-tight"
                    : "px-3 py-2.5 leading-tight tracking-tight max-sm:min-h-[3rem] sm:py-1.5";

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-nav-active={isActive ? true : undefined}
                    className={`inline-flex min-h-12 min-w-0 w-full items-center justify-center whitespace-normal rounded-xl border text-center text-pretty text-sm font-semibold transition sm:w-auto sm:min-h-0 sm:shrink-0 sm:rounded-lg sm:text-sm sm:font-medium ${tabSizing} ${
                      isActive
                        ? "border-zinc-200 bg-zinc-100 text-zinc-900"
                        : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              {session ? (
                <div className="flex min-h-12 min-w-0 items-center justify-center gap-1 px-2 text-center text-xs leading-snug text-zinc-500 sm:min-h-0 sm:max-w-[12rem] sm:shrink-0 sm:px-2 sm:text-left">
                  <span className="line-clamp-2 break-words">{session.name}</span>
                  {session.role === "staff" ? (
                    <span className="shrink-0 text-zinc-600"> · equipo</span>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
        {session ? (
          <div className="flex shrink-0 justify-end sm:self-center">
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              title="Salir"
              aria-label="Cerrar sesión"
              className="inline-flex size-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50 sm:size-8"
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
    </nav>
  );
}
