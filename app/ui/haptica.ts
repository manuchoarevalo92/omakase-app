/**
 * Respuesta háptica corta donde el navegador la permite (Android/Chrome).
 * En iOS Safari no hay API: no hace nada y no rompe.
 */
export function vibrar(tipo: "toque" | "exito" | "alerta" = "toque"): void {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.vibrate !== "function"
  ) {
    return;
  }
  try {
    navigator.vibrate(
      tipo === "toque" ? 8 : tipo === "exito" ? [10, 40, 14] : [24, 50, 24],
    );
  } catch {
    /* sin permiso o sin hardware */
  }
}

/** Une clases condicionales sin dependencias. */
export function cx(...clases: (string | false | null | undefined)[]): string {
  return clases.filter(Boolean).join(" ");
}
