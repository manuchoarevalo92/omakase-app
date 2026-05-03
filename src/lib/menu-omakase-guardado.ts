/**
 * Orden al guardar (app/page.tsx): otsumami base, nigiri, postre, regalo.
 * Los vacíos ya vienen filtrados en el array guardado; se asume base completa (17) + 0–2 regalos.
 */
export const MENU_GUARDADO_OTSUMAMI = 4;
export const MENU_GUARDADO_NIGIRI = 12;
export const MENU_GUARDADO_POSTRE = 1;

export type PartesMenuOmakase = {
  otsumami: string[];
  nigiri: string[];
  postre: string[];
  regalo: string[];
};

export function partesDesdeMenuOmakaseGuardado(
  menuOmakase: string[] | null
): PartesMenuOmakase {
  const ids = (menuOmakase ?? []).filter((id) => String(id).trim());
  let i = 0;
  const otsumami = ids.slice(i, i + MENU_GUARDADO_OTSUMAMI);
  i += MENU_GUARDADO_OTSUMAMI;
  const nigiri = ids.slice(i, i + MENU_GUARDADO_NIGIRI);
  i += MENU_GUARDADO_NIGIRI;
  const postre = ids.slice(i, i + MENU_GUARDADO_POSTRE);
  i += MENU_GUARDADO_POSTRE;
  const regalo = ids.slice(i);
  return { otsumami, nigiri, postre, regalo };
}
