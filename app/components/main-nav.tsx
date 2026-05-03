"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = {
  href: string;
  label: string;
  /** Texto en móvil (nav en varias filas) */
  labelCorto: string;
};

const LINKS: NavLink[] = [
  { href: "/", label: "Menú", labelCorto: "Menú" },
  { href: "/inventario", label: "Ingredientes", labelCorto: "Ing." },
  { href: "/platos", label: "Platos", labelCorto: "Plat." },
  { href: "/receta", label: "Receta", labelCorto: "Rec." },
  { href: "/historial", label: "Historial", labelCorto: "Hist." },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full max-w-full border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="box-border w-full min-w-0 max-w-full px-2 py-2 sm:mx-auto sm:max-w-6xl sm:px-6 sm:py-3">
        {/* Móvil: varias filas (wrap), sin scroll horizontal. Desktop: una fila a la derecha. */}
        <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-1.5 sm:flex-nowrap sm:justify-end sm:gap-2">
          {LINKS.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex min-h-[2.25rem] shrink-0 items-center justify-center rounded-lg border px-2.5 py-1.5 text-[11px] font-medium leading-tight transition sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-sm ${
                  isActive
                    ? "border-zinc-200 bg-zinc-100 text-zinc-900"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                }`}
              >
                <span className="sm:hidden">{link.labelCorto}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
