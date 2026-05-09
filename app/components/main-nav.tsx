"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
    <nav className="sticky top-0 z-50 w-full max-w-full border-b border-zinc-800 bg-zinc-950/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="box-border flex w-full min-w-0 max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-2 px-2 py-2 sm:mx-auto sm:max-w-6xl sm:justify-between sm:px-6 sm:py-3">
        <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-1.5 sm:flex-1 sm:justify-end sm:gap-2">
          {session === undefined ? (
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" aria-label="Cargando menú" />
          ) : (
            links.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex min-h-[2.25rem] shrink-0 items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs font-medium leading-tight transition sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-sm ${
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
          <div className="flex shrink-0 items-center gap-2">
            <span className="max-w-[10rem] truncate text-xs text-zinc-500 sm:max-w-none">
              {session.name}
              {session.role === "staff" ? (
                <span className="text-zinc-600"> · equipo</span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
            >
              {loggingOut ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <LogOut className="h-3.5 w-3.5" aria-hidden />
              )}
              Salir
            </button>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
