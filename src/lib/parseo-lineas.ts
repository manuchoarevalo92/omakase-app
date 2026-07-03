import { normalizarUnidadDesdeTexto, type UnidadMedida } from "@/src/lib/proveedores";

export type LineaParseada = {
  item: string;
  cantidad: string;
  unidad: UnidadMedida;
  /** Solo se reconoce en formato pipe/tab (4ta columna): precio unitario o total de la línea. */
  precio?: string;
};

/**
 * Parsea muchas líneas para pegar listas (pedidos, albaranes, vinos, sake, etc.).
 * Formatos: una referencia por línea; `nombre: cantidad`; `nombre: cantidad Caja`;
 * `nombre | cantidad | Unidad | precio`; columnas con tab igual que pipes.
 */
export function parsearLineasMasivo(
  texto: string,
  unidadPorDefecto: UnidadMedida
): LineaParseada[] {
  const out: LineaParseada[] = [];
  for (const raw of texto.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      continue;
    }

    if (line.includes("|")) {
      const parts = line.split("|").map((p) => p.trim());
      const item = parts[0] ?? "";
      if (!item) {
        continue;
      }
      const cantidad = parts[1] ?? "";
      const u = parts[2] ? normalizarUnidadDesdeTexto(parts[2]) : null;
      const precio = parts[3] ? parts[3] : undefined;
      out.push({ item, cantidad, unidad: u ?? unidadPorDefecto, precio });
      continue;
    }

    if (line.includes("\t")) {
      const parts = line.split(/\t/).map((p) => p.trim());
      const item = parts[0] ?? "";
      if (!item) {
        continue;
      }
      const cantidad = parts[1] ?? "";
      const u = parts[2] ? normalizarUnidadDesdeTexto(parts[2]) : null;
      const precio = parts[3] ? parts[3] : undefined;
      out.push({ item, cantidad, unidad: u ?? unidadPorDefecto, precio });
      continue;
    }

    const colon = line.indexOf(":");
    if (colon !== -1) {
      const left = line.slice(0, colon).trim();
      const rest = line.slice(colon + 1).trim();
      if (!left) {
        continue;
      }
      if (!rest) {
        out.push({ item: left, cantidad: "", unidad: unidadPorDefecto });
        continue;
      }
      const tokens = rest.split(/\s+/).filter(Boolean);
      const lastTok = tokens[tokens.length - 1] ?? "";
      const maybeUnit = normalizarUnidadDesdeTexto(lastTok);
      if (maybeUnit && tokens.length >= 1) {
        const qtyTokens = tokens.slice(0, -1);
        out.push({
          item: left,
          cantidad: qtyTokens.join(" ").trim(),
          unidad: maybeUnit,
        });
      } else {
        out.push({
          item: left,
          cantidad: tokens.join(" ").trim(),
          unidad: unidadPorDefecto,
        });
      }
      continue;
    }

    out.push({ item: line, cantidad: "", unidad: unidadPorDefecto });
  }
  return out;
}
