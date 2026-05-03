"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Menú" },
  { href: "/inventario", label: "Ingredientes" },
  { href: "/platos", label: "Platos" },
  { href: "/receta", label: "Receta" },
  { href: "/historial", label: "Historial" },
] as const;

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full max-w-full border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="box-border w-full min-w-0 max-w-full px-2 py-2 sm:mx-auto sm:max-w-6xl sm:px-6 sm:py-3">
        {/* Móvil: varias filas (wrap). Desktop: una fila a la derecha. */}
        <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-1.5 sm:flex-nowrap sm:justify-end sm:gap-2">
          {LINKS.map((link) => {
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
          })}
        </div>
      </div>
    </nav>
  );
}
