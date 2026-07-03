/**
 * Detección de cambios de precio unitario en compras_historial (€/kg, €/caja, €/ud).
 */
import type { CompraHistorialRow } from "@/src/lib/compras-historial";
import type { Proveedor, UnidadMedida } from "@/src/lib/proveedores";

export type CambioPrecio = {
  stockItemId: string | null;
  nombre: string;
  proveedor: Proveedor | null;
  unidad: UnidadMedida;
  fecha: string;
  precioAnterior: number;
  precioNuevo: number;
  /** Positivo = subió, negativo = bajó. */
  variacionPct: number;
};

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** Precio por unidad de compra (kg, caja o unidad) a partir de la línea de albarán. */
export function precioUnitarioEfectivo(c: CompraHistorialRow): number | null {
  if (c.precioUnitario != null && c.precioUnitario > 0) {
    return c.precioUnitario;
  }
  if (
    c.importeTotal != null &&
    c.importeTotal > 0 &&
    c.cantidad != null &&
    c.cantidad > 0
  ) {
    return c.importeTotal / c.cantidad;
  }
  return null;
}

export function etiquetaUnidadPrecio(unidad: UnidadMedida): string {
  if (unidad === "Kilo") {
    return "€/kg";
  }
  if (unidad === "Caja") {
    return "€/caja";
  }
  return "€/ud";
}

export function formatearPrecioUnitario(precio: number, unidad: UnidadMedida): string {
  const n = precio.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n} ${etiquetaUnidadPrecio(unidad)}`;
}

export function formatearFechaCorta(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return `${d} ${MESES_CORTOS[(m ?? 1) - 1]} ${y}`;
}

function claveSeguimiento(c: CompraHistorialRow): string {
  const item = c.stockItemId ?? `nombre:${c.stockItemNombre.trim().toLowerCase()}`;
  return `${item}|${c.proveedor ?? ""}|${c.unidad}`;
}

function esCambioSignificativo(anterior: number, nuevo: number): boolean {
  const diff = Math.abs(nuevo - anterior);
  if (diff < 0.02) {
    return false;
  }
  const pct = Math.abs((nuevo - anterior) / anterior);
  return pct >= 0.005;
}

/**
 * Recorre el historial y detecta cada vez que el precio unitario cambió respecto a la
 * compra anterior del mismo ítem + proveedor + unidad.
 */
export function detectarCambiosPrecio(compras: CompraHistorialRow[]): CambioPrecio[] {
  const porClave = new Map<string, CompraHistorialRow[]>();

  compras.forEach((c) => {
    const precio = precioUnitarioEfectivo(c);
    if (precio == null) {
      return;
    }
    const clave = claveSeguimiento(c);
    const lista = porClave.get(clave) ?? [];
    lista.push(c);
    porClave.set(clave, lista);
  });

  const cambios: CambioPrecio[] = [];

  porClave.forEach((lista) => {
    const ordenada = [...lista].sort((a, b) => a.fecha.localeCompare(b.fecha));
    let precioAnterior: number | null = null;

    ordenada.forEach((c) => {
      const precio = precioUnitarioEfectivo(c);
      if (precio == null) {
        return;
      }
      if (precioAnterior != null && esCambioSignificativo(precioAnterior, precio)) {
        cambios.push({
          stockItemId: c.stockItemId,
          nombre: c.stockItemNombre,
          proveedor: c.proveedor,
          unidad: c.unidad,
          fecha: c.fecha,
          precioAnterior,
          precioNuevo: precio,
          variacionPct: ((precio - precioAnterior) / precioAnterior) * 100,
        });
      }
      precioAnterior = precio;
    });
  });

  return cambios.sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || a.nombre.localeCompare(b.nombre, "es")
  );
}

/** Cambios desde una fecha (YYYY-MM-DD), más recientes primero. */
export function cambiosPrecioDesde(
  compras: CompraHistorialRow[],
  desdeFecha: string
): CambioPrecio[] {
  return detectarCambiosPrecio(compras).filter((c) => c.fecha >= desdeFecha);
}

export function fechaHaceDias(dias: number, hoy: Date = new Date()): string {
  const d = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  d.setUTCDate(d.getUTCDate() - dias);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}
