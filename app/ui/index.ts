/**
 * Sistema de diseño de Omakase. Toda pantalla nueva (o migrada) usa estas piezas y
 * los tokens semánticos de globals.css (bg-surface, text-label-2, text-danger…).
 * Muestrario en /ui.
 */
export { AvisosProvider, useAvisos } from "./avisos";
export {
  AreaTexto,
  Boton,
  BotonIcono,
  Campo,
  CampoBusqueda,
  Contador,
  Fecha,
  HojaOpciones,
  Interruptor,
  Segmentado,
  Selector,
  type OpcionSelector,
} from "./controles";
export {
  EstadoVacio,
  Esqueleto,
  EsqueletoLista,
  Etiqueta,
  Fila,
  Lista,
  Pantalla,
  Seccion,
  type AccionFila,
} from "./estructura";
export { cx, vibrar } from "./haptica";
export { Hoja, useMontado } from "./hoja";
