/** Mapa de pantallas de la app: lo comparten la barra inferior (celular) y el menú superior (escritorio). */

export const ALL_LINKS = [
  { href: "/", label: "Omakase" },
  { href: "/bebidas", label: "Bebidas" },
  { href: "/guia-bebidas", label: "Guía de bebidas" },
  { href: "/mep-deli", label: "MEP Deli" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/avisos", label: "Avisos" },
  { href: "/platos", label: "Platos" },
  { href: "/mep-cortes", label: "Catálogo MEP" },
  { href: "/inventario", label: "Ingredientes" },
  { href: "/stock", label: "Stock" },
  { href: "/receta", label: "Recetas y procesos" },
  { href: "/historial", label: "Historial" },
  { href: "/mep-historial", label: "MEP Historial" },
  { href: "/estadisticas", label: "Stats" },
  { href: "/compras", label: "Compras" },
  { href: "/produccion", label: "Producción" },
  { href: "/produccion-tiempos", label: "Tiempos prep" },
  { href: "/produccion-plan", label: "Plan semanal" },
  { href: "/eventos", label: "Eventos" },
  { href: "/personal", label: "Personal" },
  { href: "/consumo", label: "Consumo" },
  { href: "/gasto", label: "Gasto" },
] as const;

export type Href = (typeof ALL_LINKS)[number]["href"];

/** Agrupación de las páginas en el menú. */
export const GRUPOS: { titulo: string; hrefs: Href[] }[] = [
  {
    titulo: "Servicio",
    hrefs: [
      "/",
      "/bebidas",
      "/guia-bebidas",
      "/mep-deli",
      "/mep-historial",
      "/platos",
      "/mep-cortes",
      "/receta",
      "/historial",
      "/produccion-tiempos",
      "/produccion-plan",
      "/eventos",
    ],
  },
  {
    titulo: "Compras",
    hrefs: ["/pedidos", "/avisos", "/compras", "/stock", "/inventario"],
  },
  {
    titulo: "Análisis",
    hrefs: ["/consumo", "/gasto", "/estadisticas", "/produccion", "/personal"],
  },
];

export const STAFF_HREFS = new Set<string>([
  "/",
  "/bebidas",
  "/guia-bebidas",
  "/mep-deli",
  "/mep-cortes",
  "/mep-historial",
  "/pedidos",
  "/avisos",
  "/inventario",
  "/stock",
  "/historial",
  "/produccion-tiempos",
  "/produccion-plan",
  "/eventos",
]);

/** Pestañas fijas de la barra inferior; el resto queda en "Más". */
export const PESTANAS: { href: Href; label: string }[] = [
  { href: "/", label: "Omakase" },
  { href: "/mep-deli", label: "MEP" },
  { href: "/bebidas", label: "Bebidas" },
  { href: "/guia-bebidas", label: "Guía" },
];

export type SessionInfo = { id: string; name: string; role: "admin" | "staff" };

export function puedeVerHref(
  session: SessionInfo | null | undefined,
  href: string,
): boolean {
  if (session === undefined) return false;
  if (session === null || session.role === "staff")
    return STAFF_HREFS.has(href);
  return true;
}

export function esHrefActivo(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

/** Rutas sin navegación (login y widgets embebidos). */
export function sinNavegacion(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/widget");
}
