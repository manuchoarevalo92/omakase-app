/** Rubros de almacén para la pantalla Ingredientes. */
export const RUBROS_INGREDIENTE = [
  "Pescado/Marisco",
  "Fruta/Vegetal",
  "Despensa/Prep",
] as const;

export type RubroIngrediente = (typeof RUBROS_INGREDIENTE)[number];

const CANON = new Set<string>(RUBROS_INGREDIENTE);

/** Borde izquierdo por rubro (pantalla Inventario). */
export const RUBRO_SECTION_BORDER: Record<RubroIngrediente, string> = {
  "Pescado/Marisco": "border-l-sky-500/75",
  "Fruta/Vegetal": "border-l-emerald-500/75",
  "Despensa/Prep": "border-l-amber-500/65",
};

/**
 * Convierte lo que venga de la DB al rubro canónico de la app.
 * Si no coincide (espacios, guiones, sin barra, sinonimos), cae en Despensa/Prep.
 */
export function normalizarRubro(
  valor: string | null | undefined
): RubroIngrediente {
  const raw = (valor ?? "").trim();
  if (!raw) {
    return "Despensa/Prep";
  }
  if (CANON.has(raw)) {
    return raw as RubroIngrediente;
  }

  const spaced = raw.replace(/\s+/g, " ");
  if (CANON.has(spaced)) {
    return spaced as RubroIngrediente;
  }

  const key = spaced.toLowerCase();
  const slashKey = key.replace(/\s*\/\s*/g, "/").replace(/\s*-\s*/g, "/");

  const alias: Record<string, RubroIngrediente> = {
    "pescado/marisco": "Pescado/Marisco",
    "pescado y marisco": "Pescado/Marisco",
    pescado: "Pescado/Marisco",
    marisco: "Pescado/Marisco",
    fish: "Pescado/Marisco",
    seafood: "Pescado/Marisco",
    "fruta/vegetal": "Fruta/Vegetal",
    "fruta y vegetal": "Fruta/Vegetal",
    "vegetal/fruta": "Fruta/Vegetal",
    fruta: "Fruta/Vegetal",
    vegetal: "Fruta/Vegetal",
    verdura: "Fruta/Vegetal",
    vegetable: "Fruta/Vegetal",
    fruit: "Fruta/Vegetal",
    "despensa/prep": "Despensa/Prep",
    "despensa prep": "Despensa/Prep",
    despensa: "Despensa/Prep",
    prep: "Despensa/Prep",
    pantry: "Despensa/Prep",
  };

  const resolved = alias[key] ?? alias[slashKey];
  if (resolved) {
    return resolved;
  }
  return "Despensa/Prep";
}
