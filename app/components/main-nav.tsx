"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, LogOut } from "lucide-react";

const ALL_LINKS = [
  { href: "/", label: "Menú" },
  { href: "/bebidas", label: "Bebidas" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/inventario", label: "Ingredientes" },
  { href: "/platos", label: "Platos" },
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

  /** En móvil la franja es scroll horizontal; acercamos la pestaña activa al viewport. */
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
      <div className="box-border flex w-full min-w-0 max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-3 px-3 py-4 sm:mx-auto sm:max-w-6xl sm:justify-between sm:gap-x-2 sm:gap-y-2 sm:px-6 sm:py-3">
        <div
          ref={navScrollRef}
          className="-mx-3 flex min-h-14 w-full min-w-0 flex-nowrap items-stretch gap-2.5 overflow-x-auto overflow-y-hidden overscroll-x-contain px-3 py-1 [scrollbar-width:none] snap-x snap-mandatory touch-pan-x [&::-webkit-scrollbar]:hidden sm:mx-0 sm:min-h-0 sm:w-auto sm:flex-1 sm:flex-wrap sm:items-center sm:justify-end sm:overflow-x-visible sm:overflow-y-visible sm:overscroll-auto sm:px-0 sm:py-0 sm:snap-none"
        >
          {session === undefined ? (
            <Loader2 className="mx-auto h-7 w-7 shrink-0 animate-spin text-zinc-500 sm:mx-0 sm:h-5 sm:w-5" aria-label="Cargando menú" />
          ) : (
            links.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  data-nav-active={isActive ? true : undefined}
                  className={`inline-flex min-h-14 shrink-0 snap-start items-center justify-center rounded-xl border px-5 py-3 text-base font-semibold leading-tight tracking-tight transition sm:snap-none sm:min-h-0 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-sm sm:font-medium ${
                    isActive
                      ? "border-zinc-200 bg-zinc-100 text-zinc-900"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })
          )}
        </div>
        {session ? (
          <div className="flex w-full shrink-0 flex-wrap items-center justify-center gap-2 sm:w-auto sm:justify-end">
            <span className="max-w-[14rem] truncate text-base text-zinc-500 sm:max-w-none sm:text-xs">
              {session.name}
              {session.role === "staff" ? (
                <span className="text-zinc-600"> · equipo</span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              className="inline-flex min-h-14 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-base font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50 sm:min-h-0 sm:rounded-lg sm:gap-1 sm:px-2 sm:py-1.5 sm:text-xs"
            >
              {loggingOut ? (
                <Loader2 className="h-5 w-5 animate-spin sm:h-3.5 sm:w-3.5" aria-hidden />
              ) : (
                <LogOut className="h-5 w-5 sm:h-3.5 sm:w-3.5" aria-hidden />
              )}
              Salir
            </button>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
