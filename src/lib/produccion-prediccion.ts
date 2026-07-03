/**
 * Recordatorio de rehacer preparaciones según duración aproximada del lote.
 */
import {
  BUFFER_PCT_DEFECTO,
  DIAS_UMBRAL_PEDIR_PRONTO,
  epochAFechaISO,
  fechaISOaEpoch,
  MS_POR_DIA,
} from "@/src/lib/compras-prediccion";

export type EstadoProduccion =
  | "Hacer ahora"
  | "Atrasado"
  | "Rehacer pronto"
  | "OK"
  | "Sin datos"
  | "Inactiva";

export const ESTADO_PRODUCCION_ORDEN: Record<EstadoProduccion, number> = {
  "Hacer ahora": 0,
  Atrasado: 1,
  "Rehacer pronto": 2,
  OK: 3,
  "Sin datos": 4,
  Inactiva: 5,
};

export const ESTADO_PRODUCCION_BADGE: Record<EstadoProduccion, string> = {
  "Hacer ahora": "border-orange-900/70 bg-orange-950/50 text-orange-200",
  Atrasado: "border-red-900/70 bg-red-950/50 text-red-200",
  "Rehacer pronto": "border-amber-900/60 bg-amber-950/40 text-amber-200",
  OK: "border-emerald-900/60 bg-emerald-950/40 text-emerald-200",
  "Sin datos": "border-zinc-700 bg-zinc-900 text-zinc-500",
  Inactiva: "border-zinc-800 bg-zinc-950/60 text-zinc-600",
};

export type PrediccionProduccion = {
  proximaFechaSugerida: string | null;
  diasParaProxima: number | null;
  /** Días estimados según último lote (cantidad escala duracion_dias). */
  duracionEfectivaDias: number | null;
  estado: EstadoProduccion;
};

/** Escala la duración según cuánto se hizo vs el lote de referencia. */
export function calcularDuracionEfectivaDias(
  duracionDias: number,
  cantidadReferencia: number,
  ultimaCantidad: number | null
): number {
  const ref = cantidadReferencia > 0 ? cantidadReferencia : 1;
  const cant =
    ultimaCantidad != null && ultimaCantidad > 0 ? ultimaCantidad : ref;
  return Math.max(1, Math.round(duracionDias * (cant / ref)));
}

export function calcularPrediccionProduccion(
  input: {
    seguimientoActivo: boolean;
    pendiente: boolean;
    fechaUltimaProduccion: string | null;
    duracionDias: number;
    cantidadReferencia?: number;
    ultimaCantidad?: number | null;
    bufferPct?: number;
  },
  hoy: Date = new Date()
): PrediccionProduccion {
  const { seguimientoActivo, pendiente, fechaUltimaProduccion, duracionDias } = input;
  const bufferPct = input.bufferPct ?? BUFFER_PCT_DEFECTO;
  const cantidadReferencia = input.cantidadReferencia ?? 1;

  if (!seguimientoActivo) {
    return {
      proximaFechaSugerida: null,
      diasParaProxima: null,
      duracionEfectivaDias: null,
      estado: "Inactiva",
    };
  }

  if (pendiente) {
    return {
      proximaFechaSugerida: null,
      diasParaProxima: null,
      duracionEfectivaDias: null,
      estado: "Hacer ahora",
    };
  }

  if (!fechaUltimaProduccion?.trim()) {
    return {
      proximaFechaSugerida: null,
      diasParaProxima: null,
      duracionEfectivaDias: null,
      estado: "Sin datos",
    };
  }

  const duracionEfectivaDias = calcularDuracionEfectivaDias(
    duracionDias,
    cantidadReferencia,
    input.ultimaCantidad ?? null
  );

  const bufferSeguro = Math.min(Math.max(bufferPct, 0), 90) / 100;
  const intervaloObjetivo = duracionEfectivaDias * (1 - bufferSeguro);
  const proximaEpoch =
    fechaISOaEpoch(fechaUltimaProduccion) + Math.round(intervaloObjetivo) * MS_POR_DIA;
  const hoyEpoch = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const diasParaProxima = Math.round((proximaEpoch - hoyEpoch) / MS_POR_DIA);

  let estado: EstadoProduccion;
  if (diasParaProxima <= 0) {
    estado = "Atrasado";
  } else if (diasParaProxima <= DIAS_UMBRAL_PEDIR_PRONTO) {
    estado = "Rehacer pronto";
  } else {
    estado = "OK";
  }

  return {
    proximaFechaSugerida: epochAFechaISO(proximaEpoch),
    diasParaProxima,
    duracionEfectivaDias,
    estado,
  };
}

export function compararPorUrgenciaProduccion(
  a: PrediccionProduccion,
  b: PrediccionProduccion
): number {
  const orden = ESTADO_PRODUCCION_ORDEN[a.estado] - ESTADO_PRODUCCION_ORDEN[b.estado];
  if (orden !== 0) {
    return orden;
  }
  const da = a.diasParaProxima ?? 9999;
  const db = b.diasParaProxima ?? 9999;
  return da - db;
}
