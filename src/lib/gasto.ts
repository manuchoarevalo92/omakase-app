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

export type PeriodoGasto = "semana" | "mes";

export type PuntoGasto = {
  clave: string;
  etiqueta: string;
  etiquetaLarga?: string;
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

/** Año y número de semana ISO-8601 (semanas de lunes a domingo). */
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

/** Lunes de la semana ISO (año + número de semana). */
export function inicioSemanaISO(anio: number, semana: number): Date {
  const jan4 = new Date(Date.UTC(anio, 0, 4));
  const dayOfWeek = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - dayOfWeek);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (semana - 1) * 7);
  return monday;
}

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** Etiqueta legible para una clave ISO `2026-W14` → "7–13 abr" o "28 abr – 4 may". */
export function etiquetaSemanaDesdeClave(clave: string, incluirAnio = false): string {
  const match = clave.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    return clave;
  }
  const anio = Number(match[1]);
  const semana = Number(match[2]);
  const inicio = inicioSemanaISO(anio, semana);
  const fin = new Date(inicio);
  fin.setUTCDate(inicio.getUTCDate() + 6);

  const di = inicio.getUTCDate();
  const df = fin.getUTCDate();
  const mi = MESES_CORTOS[inicio.getUTCMonth()];
  const mf = MESES_CORTOS[fin.getUTCMonth()];

  let texto =
    mi === mf ? `${di}–${df} ${mi}` : `${di} ${mi} – ${df} ${mf}`;
  if (incluirAnio) {
    texto += ` ${anio}`;
  }
  return texto;
}

export function clavePeriodo(fecha: string, periodo: PeriodoGasto): string {
  const d = fechaUTC(fecha);
  if (periodo === "mes") {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
  }
  const { anio, semana } = semanaISO(d);
  return `${anio}-W${pad2(semana)}`;
}

export function etiquetaPeriodo(clave: string, periodo: PeriodoGasto): string {
  if (periodo === "mes") {
    const [y, m] = clave.split("-");
    return `${MESES_CORTOS[Number(m) - 1]} ${y}`;
  }
  return etiquetaSemanaDesdeClave(clave);
}

/** Tooltip / detalle: rango completo con año. */
export function etiquetaPeriodoLarga(clave: string, periodo: PeriodoGasto): string {
  if (periodo === "mes") {
    const [y, m] = clave.split("-");
    return `${MESES_CORTOS[Number(m) - 1]} ${y}`;
  }
  return etiquetaSemanaDesdeClave(clave, true);
}

export type ConsumoIngredienteSemana = {
  claveSemana: string;
  etiquetaSemana: string;
  stockItemId: string | null;
  nombre: string;
  kilos: number;
  gasto: number;
};

/**
 * Consumo por ítem de Stock y semana: kilos (solo líneas en Kilo) y gasto (importe).
 */
export function agruparConsumoIngredientePorSemana(
  compras: CompraHistorialRow[]
): ConsumoIngredienteSemana[] {
  const map = new Map<string, ConsumoIngredienteSemana>();

  compras.forEach((c) => {
    const claveSem = clavePeriodo(c.fecha, "semana");
    const itemKey = c.stockItemId ?? c.stockItemNombre;
    const key = `${claveSem}|${itemKey}`;
    const kilos = c.unidad === "Kilo" && c.cantidad != null && c.cantidad > 0 ? c.cantidad : 0;
    const gasto = c.importeTotal != null && c.importeTotal > 0 ? c.importeTotal : 0;
    if (kilos <= 0 && gasto <= 0) {
      return;
    }

    const actual = map.get(key);
    if (actual) {
      actual.kilos += kilos;
      actual.gasto += gasto;
    } else {
      map.set(key, {
        claveSemana: claveSem,
        etiquetaSemana: etiquetaSemanaDesdeClave(claveSem),
        stockItemId: c.stockItemId,
        nombre: c.stockItemNombre,
        kilos,
        gasto,
      });
    }
  });

  return [...map.values()].sort(
    (a, b) =>
      b.claveSemana.localeCompare(a.claveSemana) ||
      a.nombre.localeCompare(b.nombre, "es")
  );
}

/** Últimas N semanas con datos, más reciente primero. */
export function semanasConConsumo(
  filas: ConsumoIngredienteSemana[],
  limite = 12
): { clave: string; etiqueta: string }[] {
  const visto = new Set<string>();
  const out: { clave: string; etiqueta: string }[] = [];
  for (const f of filas) {
    if (visto.has(f.claveSemana)) {
      continue;
    }
    visto.add(f.claveSemana);
    out.push({ clave: f.claveSemana, etiqueta: f.etiquetaSemana });
    if (out.length >= limite) {
      break;
    }
  }
  return out;
}

/** Kg comprados en un período (solo unidad Kilo). */
export function totalKilosEnPeriodo(
  compras: CompraHistorialRow[],
  periodo: PeriodoGasto,
  clave: string
): number {
  return compras.reduce((acc, c) => {
    if (clavePeriodo(c.fecha, periodo) !== clave) {
      return acc;
    }
    if (c.unidad !== "Kilo" || c.cantidad == null) {
      return acc;
    }
    return acc + c.cantidad;
  }, 0);
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
      etiquetaLarga: etiquetaPeriodoLarga(clave, periodo),
      real: real.get(clave) ?? null,
      proyectado: proyectado.get(clave) ?? null,
    }));
}
