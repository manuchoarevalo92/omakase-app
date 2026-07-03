/**
 * Agregación de gasto real (histórico) y proyectado (futuro) por período, a
 * partir de compras_historial (importe_total) y del motor de predicción de
 * compras-prediccion.ts.
 */
import type { CompraHistorialRow } from "@/src/lib/compras-historial";
import {
  fechaISOaEpoch,
  proyectarProximasCompras,
  type PuntoCompra,
} from "@/src/lib/compras-prediccion";
import type { Proveedor } from "@/src/lib/proveedores";
import type { StockItem } from "@/src/lib/stock-items";

export type PeriodoGasto = "dia" | "semana" | "mes" | "anio";

export type PuntoGasto = {
  clave: string;
  etiqueta: string;
  real: number | null;
  proyectado: number | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function fechaUTC(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** Año y número de semana ISO-8601 (semanas de lunes a domingo, 1ra semana = la del primer jueves del año). */
function semanaISO(date: Date): { anio: number; semana: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const diaNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diaNum + 3);
  const primerJueves = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const primerDiaNum = (primerJueves.getUTCDay() + 6) % 7;
  primerJueves.setUTCDate(primerJueves.getUTCDate() - primerDiaNum + 3);
  const semana =
    1 + Math.round((d.getTime() - primerJueves.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return { anio: d.getUTCFullYear(), semana };
}

export function clavePeriodo(fecha: string, periodo: PeriodoGasto): string {
  const d = fechaUTC(fecha);
  if (periodo === "dia") {
    return fecha;
  }
  if (periodo === "mes") {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
  }
  if (periodo === "anio") {
    return String(d.getUTCFullYear());
  }
  const { anio, semana } = semanaISO(d);
  return `${anio}-W${pad2(semana)}`;
}

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export function etiquetaPeriodo(clave: string, periodo: PeriodoGasto): string {
  if (periodo === "anio") {
    return clave;
  }
  if (periodo === "mes") {
    const [y, m] = clave.split("-");
    return `${MESES_CORTOS[Number(m) - 1]} ${y}`;
  }
  if (periodo === "semana") {
    const [y, w] = clave.split("-W");
    return `Sem ${w} '${y.slice(2)}`;
  }
  const d = fechaUTC(clave);
  return `${d.getUTCDate()} ${MESES_CORTOS[d.getUTCMonth()]}`;
}

/** Suma importe_total agrupado por período (clave → total). Ignora líneas sin importe. */
export function agruparGastoPorPeriodo(
  compras: CompraHistorialRow[],
  periodo: PeriodoGasto
): Map<string, number> {
  const map = new Map<string, number>();
  compras.forEach((c) => {
    if (c.importeTotal == null || c.importeTotal <= 0) {
      return;
    }
    const clave = clavePeriodo(c.fecha, periodo);
    map.set(clave, (map.get(clave) ?? 0) + c.importeTotal);
  });
  return map;
}

export type GastoProveedor = { proveedor: Proveedor | "Sin proveedor"; total: number };

/** Gasto total por proveedor, opcionalmente filtrado desde una fecha (YYYY-MM-DD). */
export function gastoPorProveedor(
  compras: CompraHistorialRow[],
  desdeFecha?: string
): GastoProveedor[] {
  const map = new Map<string, number>();
  compras.forEach((c) => {
    if (c.importeTotal == null || c.importeTotal <= 0) {
      return;
    }
    if (desdeFecha && c.fecha < desdeFecha) {
      return;
    }
    const clave = c.proveedor ?? "Sin proveedor";
    map.set(clave, (map.get(clave) ?? 0) + c.importeTotal);
  });
  return [...map.entries()]
    .map(([proveedor, total]) => ({ proveedor: proveedor as GastoProveedor["proveedor"], total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Proyecta el gasto futuro por período: para cada ítem activo con precio
 * conocido, proyecta sus próximas compras (cantidad × último precio unitario)
 * y las agrupa por período. Solo cuenta eventos estrictamente futuros (no
 * duplica lo que ya está en el gasto real).
 */
export function proyectarGastoPorPeriodo(
  stockItems: StockItem[],
  comprasPorStockItem: Map<string, CompraHistorialRow[]>,
  precioPorStockItem: Map<string, number>,
  periodo: PeriodoGasto,
  horizonteDias: number = 120,
  hoy: Date = new Date()
): Map<string, number> {
  const hoyEpoch = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const map = new Map<string, number>();

  stockItems
    .filter((item) => item.activo)
    .forEach((item) => {
      const precio = precioPorStockItem.get(item.id);
      if (precio == null) {
        return;
      }
      const puntos: PuntoCompra[] = (comprasPorStockItem.get(item.id) ?? []).map((c) => ({
        fecha: c.fecha,
        cantidad: c.cantidad,
      }));
      const eventos = proyectarProximasCompras(puntos, item.bufferPct, horizonteDias, hoy);
      eventos
        .filter((ev) => fechaISOaEpoch(ev.fecha) > hoyEpoch)
        .forEach((ev) => {
          const cantidad = ev.cantidad ?? 0;
          const clave = clavePeriodo(ev.fecha, periodo);
          map.set(clave, (map.get(clave) ?? 0) + cantidad * precio);
        });
    });

  return map;
}

/** Une real + proyectado en filas ordenadas cronológicamente, listas para graficar. */
export function combinarSeriesGasto(
  real: Map<string, number>,
  proyectado: Map<string, number>,
  periodo: PeriodoGasto
): PuntoGasto[] {
  const claves = new Set([...real.keys(), ...proyectado.keys()]);
  return [...claves]
    .sort()
    .map((clave) => ({
      clave,
      etiqueta: etiquetaPeriodo(clave, periodo),
      real: real.get(clave) ?? null,
      proyectado: proyectado.get(clave) ?? null,
    }));
}
