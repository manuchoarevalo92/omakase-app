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
      <div className="mx-auto flex max-w-6xl items-stretch sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-3">
        <Link
          href="/"
          className="hidden shrink-0 self-center px-6 text-sm font-semibold tracking-[0.14em] text-zinc-200 sm:block"
        >
          OMAKASE
        </Link>
        {/* Móvil: una fila con scroll horizontal (evita desborde). Desktop: sin scroll, alineado a la derecha. */}
        <div className="min-w-0 flex-1 sm:flex-none sm:self-center">
          <div className="nav-x-scroll-touch flex flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain px-3 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:justify-end sm:gap-2 sm:overflow-visible sm:px-0 sm:py-0 [&::-webkit-scrollbar]:hidden">
            {LINKS.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs transition sm:px-3 sm:py-1.5 sm:text-sm ${
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
      </div>
    </nav>
  );
}
