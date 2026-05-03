"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = {
  href: string;
  label: string;
  /** Texto más corto en móvil (evita scroll en el nav) */
  labelCorto?: string;
};

const LINKS: NavLink[] = [
  { href: "/", label: "Menú" },
  { href: "/inventario", label: "Ingredientes", labelCorto: "Ingred." },
  { href: "/platos", label: "Platos" },
  { href: "/receta", label: "Receta" },
  { href: "/historial", label: "Historial", labelCorto: "Hist." },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full max-w-full border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="box-border w-full min-w-0 max-w-full px-2 py-2 sm:mx-auto sm:max-w-6xl sm:px-6 sm:py-3">
        <div className="nav-x-scroll-touch flex w-full min-w-0 flex-nowrap items-stretch justify-start gap-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:justify-end sm:gap-2 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
          {LINKS.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg border px-2 py-2 text-xs leading-none transition sm:px-3 sm:py-1.5 sm:text-sm ${
                  isActive
                    ? "border-zinc-200 bg-zinc-100 text-zinc-900"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                }`}
              >
                <span className="sm:hidden">{link.labelCorto ?? link.label}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
