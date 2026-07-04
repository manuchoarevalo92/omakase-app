import { type CompraHistorialRow } from "@/src/lib/compras-historial";
import {
  fechaISOaEpoch,
  MAX_INTERVALOS_CONSIDERADOS,
  MS_POR_DIA,
} from "@/src/lib/compras-prediccion";
import { type StockItem } from "@/src/lib/stock-items";
import { type Proveedor, type UnidadMedida } from "@/src/lib/proveedores";

export type ConsumoItem = {
  itemId: string;
  nombre: string;
  proveedor: Proveedor | null;
  unidad: UnidadMedida;
  cantidadCompras: number;
  primeraCompra: string | null;
  ultimaCompra: string | null;
  /** Intervalo típico (mediana de intervalos entre compras), en días. */
  intervaloTipicoDias: number | null;
  /** Promedio simple entre la primera y la última compra, en días. */
  intervaloPromedioDias: number | null;
  cantidadTotal: number;
  cantidadPromedio: number | null;
  /** Consumo estimado por 30 días (cantidadTotal / díasCubiertos * 30). */
  consumoMensual: number | null;
};

function mediana(valores: number[]): number {
  const ordenado = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(ordenado.length / 2);
  if (ordenado.length % 2 === 0) {
    return (ordenado[mid - 1] + ordenado[mid]) / 2;
  }
  return ordenado[mid];
}

function redondear(valor: number, decimales = 1): number {
  const f = 10 ** decimales;
  return Math.round(valor * f) / f;
}

/**
 * Calcula, por ítem de Stock, con qué frecuencia se compra y cuánto se consume,
 * a partir del historial real de compras. Solo considera compras vinculadas a un
 * ítem existente.
 */
export function calcularConsumoPorItem(
  items: StockItem[],
  compras: CompraHistorialRow[]
): ConsumoItem[] {
  const itemsPorId = new Map(items.map((it) => [it.id, it]));
  const comprasPorItem = new Map<string, CompraHistorialRow[]>();
  compras.forEach((c) => {
    if (!c.stockItemId || !itemsPorId.has(c.stockItemId)) {
      return;
    }
    const lista = comprasPorItem.get(c.stockItemId) ?? [];
    lista.push(c);
    comprasPorItem.set(c.stockItemId, lista);
  });

  const resultado: ConsumoItem[] = [];
  comprasPorItem.forEach((lista, itemId) => {
    const item = itemsPorId.get(itemId);
    if (!item) {
      return;
    }
    const ordenadas = [...lista]
      .filter((c) => c.fecha?.trim())
      .sort((a, b) => fechaISOaEpoch(a.fecha) - fechaISOaEpoch(b.fecha));
    if (ordenadas.length === 0) {
      return;
    }

    const primera = ordenadas[0].fecha;
    const ultima = ordenadas[ordenadas.length - 1].fecha;
    const cantidades = ordenadas
      .map((c) => c.cantidad)
      .filter((c): c is number => c != null && Number.isFinite(c) && c > 0);
    const cantidadTotal = cantidades.reduce((acc, v) => acc + v, 0);
    const cantidadPromedio =
      cantidades.length > 0 ? cantidadTotal / cantidades.length : null;

    const intervalos: number[] = [];
    for (let i = 1; i < ordenadas.length; i++) {
      const dias =
        (fechaISOaEpoch(ordenadas[i].fecha) - fechaISOaEpoch(ordenadas[i - 1].fecha)) /
        MS_POR_DIA;
      if (dias > 0) {
        intervalos.push(dias);
      }
    }
    const intervaloTipicoDias =
      intervalos.length > 0
        ? redondear(mediana(intervalos.slice(-MAX_INTERVALOS_CONSIDERADOS)))
        : null;

    const diasCubiertos =
      (fechaISOaEpoch(ultima) - fechaISOaEpoch(primera)) / MS_POR_DIA;
    const intervaloPromedioDias =
      ordenadas.length > 1 && diasCubiertos > 0
        ? redondear(diasCubiertos / (ordenadas.length - 1))
        : null;
    const consumoMensual =
      diasCubiertos > 0 && cantidadTotal > 0
        ? redondear((cantidadTotal / diasCubiertos) * 30)
        : null;

    resultado.push({
      itemId,
      nombre: item.nombre,
      proveedor: item.proveedor,
      unidad: item.unidadCompra,
      cantidadCompras: ordenadas.length,
      primeraCompra: primera,
      ultimaCompra: ultima,
      intervaloTipicoDias,
      intervaloPromedioDias,
      cantidadTotal: redondear(cantidadTotal),
      cantidadPromedio: cantidadPromedio != null ? redondear(cantidadPromedio) : null,
      consumoMensual,
    });
  });

  return resultado;
}
