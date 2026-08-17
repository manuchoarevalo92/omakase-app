export const TEMA_STORAGE_KEY = "omakase-tema";

export const TEMAS_PREFERENCIA = ["auto", "dia", "noche"] as const;
export type TemaPreferencia = (typeof TEMAS_PREFERENCIA)[number];
export type TemaResuelto = "dia" | "noche";

/** Día de cocina / oficina: 7:00–19:59. Noche de servicio: 20:00–6:59. */
export const HORA_DIA_DESDE = 7;
export const HORA_DIA_HASTA = 20;

export function esHoraDiurna(fecha: Date = new Date()): boolean {
  const h = fecha.getHours();
  return h >= HORA_DIA_DESDE && h < HORA_DIA_HASTA;
}

export function esTemaPreferencia(valor: string | null | undefined): valor is TemaPreferencia {
  return valor === "auto" || valor === "dia" || valor === "noche";
}

export function leerTemaPreferencia(): TemaPreferencia {
  if (typeof window === "undefined") {
    return "auto";
  }
  try {
    const raw = window.localStorage.getItem(TEMA_STORAGE_KEY);
    return esTemaPreferencia(raw) ? raw : "auto";
  } catch {
    return "auto";
  }
}

export function guardarTemaPreferencia(preferencia: TemaPreferencia): void {
  try {
    window.localStorage.setItem(TEMA_STORAGE_KEY, preferencia);
  } catch {
    /* private mode */
  }
}

export function resolverTema(preferencia: TemaPreferencia, fecha: Date = new Date()): TemaResuelto {
  if (preferencia === "dia") {
    return "dia";
  }
  if (preferencia === "noche") {
    return "noche";
  }
  return esHoraDiurna(fecha) ? "dia" : "noche";
}

export const TEMA_COLOR: Record<TemaResuelto, string> = {
  dia: "#f7f3ec",
  noche: "#0e0d0b",
};

export function aplicarTemaEnDocumento(tema: TemaResuelto): void {
  const root = document.documentElement;
  root.dataset.theme = tema;
  root.style.colorScheme = tema === "dia" ? "light" : "dark";
  const color = TEMA_COLOR[tema];
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", color);
    document.head.appendChild(meta);
    return;
  }
  metas.forEach((meta) => meta.setAttribute("content", color));
}

export const ETIQUETA_TEMA: Record<TemaPreferencia, string> = {
  auto: "Auto",
  dia: "Día",
  noche: "Noche",
};

export function siguienteTemaPreferencia(actual: TemaPreferencia): TemaPreferencia {
  if (actual === "auto") {
    return "dia";
  }
  if (actual === "dia") {
    return "noche";
  }
  return "auto";
}

/** Corre antes del paint para no parpadear el tema oscuro de día. */
export const TEMA_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(TEMA_STORAGE_KEY)};var m=localStorage.getItem(k);if(m!=="auto"&&m!=="dia"&&m!=="noche")m="auto";var h=new Date().getHours();var dia=m==="dia"||(m!=="noche"&&h>=${HORA_DIA_DESDE}&&h<${HORA_DIA_HASTA});var t=dia?"dia":"noche";var r=document.documentElement;r.setAttribute("data-theme",t);r.style.colorScheme=dia?"light":"dark";var c=dia?"#f7f3ec":"#0e0d0b";document.querySelectorAll('meta[name="theme-color"]').forEach(function(meta){meta.setAttribute("content",c);});}catch(e){}})();`;
