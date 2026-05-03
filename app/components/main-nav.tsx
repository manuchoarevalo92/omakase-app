"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Menú" },
  { href: "/inventario", label: "Ingredientes" },
  { href: "/platos", label: "Platos" },
  { href: "/receta", label: "Receta" },
  { href: "/historial", label: "Historial" },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6 sm:py-3">
        <Link
          href="/"
          className="hidden shrink-0 text-sm font-semibold tracking-[0.14em] text-zinc-200 sm:block"
        >
          OMAKASE
        </Link>
        <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-1.5 sm:w-auto sm:justify-end sm:gap-2">
          {LINKS.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg border px-2 py-1 text-xs transition sm:px-3 sm:py-1.5 sm:text-sm ${
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
      </div>
    </nav>
  );
}
