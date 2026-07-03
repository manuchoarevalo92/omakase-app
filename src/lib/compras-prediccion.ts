/**
 * Modelo de predicción de compras: sin conteo de stock real, se basa en la
 * cadencia histórica de compras de cada ítem (fecha + cantidad) para proyectar
 * cuándo conviene volver a pedirlo.
 *
 * Idea central: en vez de esperar a que se cumpla el intervalo típico entre
 * compras, el aviso sale un poco antes (según `bufferPct`, 10-20%). Como no hay
 * stock real que medir, el margen de seguridad se aplica al tiempo: se avisa al
 * 80-85% del ciclo habitual en vez de al 100%.
 */

export type EstadoCompra = "Atrasado" | "Pedir pronto" | "OK" | "Sin datos";

export const ESTADO_COMPRA_ORDEN: Record<EstadoCompra, number> = {
  Atrasado: 0,
  "Pedir pronto": 1,
  OK: 2,
  "Sin datos": 3,
};

export const ESTADO_COMPRA_BADGE: Record<EstadoCompra, string> = {
  Atrasado: "border-red-900/70 bg-red-950/50 text-red-200",
  "Pedir pronto": "border-amber-900/60 bg-amber-950/40 text-amber-200",
  OK: "border-emerald-900/60 bg-emerald-950/40 text-emerald-200",
  "Sin datos": "border-zinc-700 bg-zinc-900 text-zinc-500",
};

export const DIAS_UMBRAL_PEDIR_PRONTO = 3;
export const BUFFER_PCT_DEFECTO = 15;
export const MAX_INTERVALOS_CONSIDERADOS = 6;

export type PuntoCompra = {
  fecha: string;
  cantidad: number | null;
};

export type PrediccionCompra = {
  ultimaCompra: string | null;
  cantidadCompras: number;
  intervaloTipicoDias: number | null;
  proximaFechaSugerida: string | null;
  diasParaProxima: number | null;
  cantidadSugerida: number | null;
  estado: EstadoCompra;
  /** true si intervaloTipicoDias viene de un valor cargado a mano (intervaloEstimadoDias),
   * no de 2+ compras reales. Se usa para aclarar en la UI que es una estimación. */
  esEstimado: boolean;
};

export const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Parsea "YYYY-MM-DD" a epoch UTC en ms; evita corrimientos por huso horario. */
export function fechaISOaEpoch(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

export function epochAFechaISO(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function mediana(valores: number[]): number {
  const ordenado = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(ordenado.length / 2);
  if (ordenado.length % 2 === 0) {
    return (ordenado[mid - 1] + ordenado[mid]) / 2;
  }
  return ordenado[mid];
}

function promedio(valores: number[]): number {
  return valores.reduce((acc, v) => acc + v, 0) / valores.length;
}

/**
 * Calcula la predicción de recompra de un ítem a partir de su historial de
 * compras. `bufferPct` (10-20, default 15) adelanta el aviso ese % del ciclo
 * típico para dejar margen de seguridad.
 */
export function calcularPrediccionCompra(
  compras: PuntoCompra[],
  bufferPct: number = BUFFER_PCT_DEFECTO,
  intervaloEstimadoDias: number | null = null,
  hoy: Date = new Date()
): PrediccionCompra {
  const ordenadas = [...compras]
    .filter((c) => c.fecha?.trim())
    .sort((a, b) => fechaISOaEpoch(a.fecha) - fechaISOaEpoch(b.fecha));

  if (ordenadas.length === 0) {
    return {
      ultimaCompra: null,
      cantidadCompras: 0,
      intervaloTipicoDias: null,
      proximaFechaSugerida: null,
      diasParaProxima: null,
      cantidadSugerida: null,
      estado: "Sin datos",
      esEstimado: false,
    };
  }

  const ultima = ordenadas[ordenadas.length - 1];
  const cantidades = ordenadas
    .slice(-MAX_INTERVALOS_CONSIDERADOS)
    .map((c) => c.cantidad)
    .filter((c): c is number => c != null && Number.isFinite(c) && c > 0);
  const cantidadSugerida = cantidades.length > 0 ? promedio(cantidades) : null;

  const hoyEpoch = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const bufferSeguro = Math.min(Math.max(bufferPct, 0), 90) / 100;

  // Con una sola compra registrada no hay ciclo real que medir. Si se cargó a
  // mano una frecuencia estimada (para ítems sin albarán, ej. Amazon), se usa
  // esa como aproximación en vez de dejar el ítem sin estado indefinidamente.
  if (ordenadas.length < 2) {
    if (intervaloEstimadoDias != null && intervaloEstimadoDias > 0) {
      const intervaloObjetivo = intervaloEstimadoDias * (1 - bufferSeguro);
      const proximaEpoch =
        fechaISOaEpoch(ultima.fecha) + Math.round(intervaloObjetivo) * MS_POR_DIA;
      const diasParaProxima = Math.round((proximaEpoch - hoyEpoch) / MS_POR_DIA);
      let estado: EstadoCompra;
      if (diasParaProxima <= 0) {
        estado = "Atrasado";
      } else if (diasParaProxima <= DIAS_UMBRAL_PEDIR_PRONTO) {
        estado = "Pedir pronto";
      } else {
        estado = "OK";
      }
      return {
        ultimaCompra: ultima.fecha,
        cantidadCompras: ordenadas.length,
        intervaloTipicoDias: intervaloEstimadoDias,
        proximaFechaSugerida: epochAFechaISO(proximaEpoch),
        diasParaProxima,
        cantidadSugerida,
        estado,
        esEstimado: true,
      };
    }
    return {
      ultimaCompra: ultima.fecha,
      cantidadCompras: ordenadas.length,
      intervaloTipicoDias: null,
      proximaFechaSugerida: null,
      diasParaProxima: null,
      cantidadSugerida,
      estado: "Sin datos",
      esEstimado: false,
    };
  }

  const intervalosDias: number[] = [];
  for (let i = 1; i < ordenadas.length; i++) {
    const dias =
      (fechaISOaEpoch(ordenadas[i].fecha) - fechaISOaEpoch(ordenadas[i - 1].fecha)) /
      MS_POR_DIA;
    if (dias > 0) {
      intervalosDias.push(dias);
    }
  }

  if (intervalosDias.length === 0) {
    return {
      ultimaCompra: ultima.fecha,
      cantidadCompras: ordenadas.length,
      intervaloTipicoDias: null,
      proximaFechaSugerida: null,
      diasParaProxima: null,
      cantidadSugerida,
      estado: "Sin datos",
      esEstimado: false,
    };
  }

  const intervaloTipico = mediana(intervalosDias.slice(-MAX_INTERVALOS_CONSIDERADOS));
  const intervaloObjetivo = intervaloTipico * (1 - bufferSeguro);
  const proximaEpoch =
    fechaISOaEpoch(ultima.fecha) + Math.round(intervaloObjetivo) * MS_POR_DIA;
  const diasParaProxima = Math.round((proximaEpoch - hoyEpoch) / MS_POR_DIA);

  let estado: EstadoCompra;
  if (diasParaProxima <= 0) {
    estado = "Atrasado";
  } else if (diasParaProxima <= DIAS_UMBRAL_PEDIR_PRONTO) {
    estado = "Pedir pronto";
  } else {
    estado = "OK";
  }

  return {
    ultimaCompra: ultima.fecha,
    cantidadCompras: ordenadas.length,
    intervaloTipicoDias: Math.round(intervaloTipico * 10) / 10,
    proximaFechaSugerida: epochAFechaISO(proximaEpoch),
    diasParaProxima,
    cantidadSugerida: cantidadSugerida != null ? Math.round(cantidadSugerida * 10) / 10 : null,
    estado,
    esEstimado: false,
  };
}

export type EventoCompraProyectado = {
  fecha: string;
  cantidad: number | null;
};

/**
 * Proyecta las próximas compras esperadas de un ítem hacia adelante (más allá de
 * la primera), repitiendo el intervalo típico desde la próxima fecha sugerida
 * hasta cubrir `horizonteDias`. Se usa para estimar gasto futuro, no solo el
 * próximo recordatorio.
 */
export function proyectarProximasCompras(
  compras: PuntoCompra[],
  bufferPct: number = BUFFER_PCT_DEFECTO,
  horizonteDias: number = 90,
  hoy: Date = new Date(),
  intervaloEstimadoDias: number | null = null
): EventoCompraProyectado[] {
  const prediccion = calcularPrediccionCompra(compras, bufferPct, intervaloEstimadoDias, hoy);
  if (!prediccion.proximaFechaSugerida || prediccion.intervaloTipicoDias == null) {
    return [];
  }

  const hoyEpoch = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const limiteEpoch = hoyEpoch + horizonteDias * MS_POR_DIA;
  const pasoMs = Math.max(1, Math.round(prediccion.intervaloTipicoDias)) * MS_POR_DIA;

  const eventos: EventoCompraProyectado[] = [];
  let epoch = fechaISOaEpoch(prediccion.proximaFechaSugerida);
  while (epoch <= limiteEpoch) {
    eventos.push({ fecha: epochAFechaISO(epoch), cantidad: prediccion.cantidadSugerida });
    epoch += pasoMs;
  }
  return eventos;
}

/** Orden de urgencia ascendente (Atrasado primero); a igual estado, menos días primero. */
export function compararPorUrgencia(
  a: { estado: EstadoCompra; diasParaProxima: number | null },
  b: { estado: EstadoCompra; diasParaProxima: number | null }
): number {
  const ordenEstado = ESTADO_COMPRA_ORDEN[a.estado] - ESTADO_COMPRA_ORDEN[b.estado];
  if (ordenEstado !== 0) {
    return ordenEstado;
  }
  if (a.diasParaProxima == null || b.diasParaProxima == null) {
    return 0;
  }
  return a.diasParaProxima - b.diasParaProxima;
}
