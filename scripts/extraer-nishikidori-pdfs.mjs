#!/usr/bin/env node
/**
 * Extrae líneas de facturas Nishikidori (PDF) → JSON para importar-albaranes-nishikidori.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PDFS = [
  "/Users/manucho/Downloads/Facture mars 2026 FCW2601818-1.pdf",
  "/Users/manucho/Downloads/Facture mars 2026 FCW2602565-1.pdf",
  "/Users/manucho/Downloads/Facture avril 2026 FCS2601911-1.pdf",
  "/Users/manucho/Downloads/Facture avril 2026 FCS2602108-2.pdf",
  "/Users/manucho/Downloads/Facture avril 2026 FCS2602109-1.pdf",
  "/Users/manucho/Downloads/Facture mai 2026 FCS2602422-1.pdf",
  "/Users/manucho/Downloads/Facture mai 2026 FCW2603942-2.pdf",
  "/Users/manucho/Downloads/Facture juin 2026 FCS2603486.pdf",
];

/** Nombre en francés para pedir (prioridad sobre variantes EN del PDF). */
const NOMBRE_POR_REF = {
  NISBINL9:
    "KIRIWARISHOU, 10-20 cm, Ø 2,0-4,0 cm, 1/2 ou 1/4 de lune, colis 15 kg",
  NISHSHTR: "Sauce soja au sel truffé 180 ml",
  NISFCSYS: "Feuilles de cerisier sakura salées x 10, dim. 12/13 cm * 5,5/6,5 cm",
  "NISHK4P-S": "Fécule d'arrow-root Hon Kuzu (100% hon'kuzu) en poudre 100g",
  "NISHK4P-XL": "Fécule d'arrow-root Hon Kuzu (100% hon'kuzu) en poudre 1 kg",
  NISLI13: "Vinaigre de riz Junmai Fujisu Supérieur 1800ml",
  NISLI12: "Vinaigre de riz Junmai Fujisu Supérieur 900ml",
  NISLI5: "Vinaigre noir de riz Genmai 500ml",
  NISMK1: "Miso blanc SHIRO MISO 100g",
  NISSHM1: "Miso blanc vinaigré sumiso 300g",
  NISSHM2: "Miso blanc vinaigré et moutardé karashimiso 300g",
  NISSSG1BC: "Feuilles de cerisier sakura en fleur salées x50",
  NISYJ13: "Vinaigre rouge Kohaku 1800 ml",
  NISKOKO4: "Mirin blanc Shiro, vol. 14%, 1800 ml",
  NISYSB: "Saké à cuisiner IZUMO JIDENSHU 13% - 720 ml",
  NISZY7: "Honden Tohi Akazaké 12%, 300ml",
  NISAMNS4: "Rishiri kombu de Hokkaido 40g",
  "NISAE6-DOSHO": "Ma kombu de Shirokuchihama (Hokkaido) 22,5*10 cm 300g",
  NISKOB1: "Prunes umeboshi 100g",
  NISKOB3: "Prunes umeboshi 1000g",
  NISTFY1: "Prunes umeboshi bio, 120 g",
  "NISFPDT1-M": "Fécule de pomme de terre katakuriko 500g",
  NISDOSHO13: "Algue Ma kombu premium pour kombu-Jime 1kg",
  NISIHF1: "Ponzu Pon de Dore aux ciboules longues 200 ml",
  NISIHF3: "Okasumiso ciboule de Toyama 300g",
  NISIHF5: "Sauce tare Bannou vegan aux ciboules de Toyama 200 ml",
};

const UNIDAD_POR_REF = {
  NISBINL9: "Caja",
  NISDOSHO13: "Unidad",
  "NISFPDT1-M": "Unidad",
};

function parseFechaFactura(text) {
  const m = text.match(/\b(\d{2})\/(\d{2})\/(\d{2})\b/);
  if (!m) {
    return null;
  }
  const yy = Number(m[3]) + 2000;
  return `${yy}-${m[2]}-${m[1]}`;
}

function parseNumeroEu(s) {
  return parseFloat(s.replace(/\s/g, "").replace(",", "."));
}

function esPorte(ref, designation) {
  if (ref === "NISZZCR1") {
    return true;
  }
  const d = designation.toLowerCase();
  return d.includes("frais de port") || d.includes("shipping cost");
}

function inferirUnidad(ref, designation) {
  if (UNIDAD_POR_REF[ref]) {
    return UNIDAD_POR_REF[ref];
  }
  const d = designation.toLowerCase();
  if (d.includes("colis") && d.includes("kg")) {
    return "Caja";
  }
  return "Unidad";
}

function limpiarDesignacion(s) {
  return s.replace(/\s+/g, " ").trim();
}

const RE_REF = /NIS([A-Z0-9-]+)/;
const RE_NUMS_FIN =
  /(\d+[,.]\d+)\s+(\d+[,.]\d+)\s+(\d+[,.]\d+)\s+(\d+[,.]\d+)(?:\s+Japon)?\s*$/;

function extraerBloqueProducto(rawLines, startIdx) {
  let i = startIdx;
  const first = rawLines[i];
  const refMatch = first.match(RE_REF);
  if (!refMatch) {
    return null;
  }
  const ref = `NIS${refMatch[1]}`;
  let buffer = first.slice(first.indexOf(ref) + ref.length).trim();
  i += 1;

  const parsearNums = (line, prefix = "") => {
    const nums = line.match(RE_NUMS_FIN);
    if (!nums) {
      return null;
    }
    const designation = limpiarDesignacion(prefix + line.slice(0, nums.index).trim());
    return {
      ref,
      designation,
      importe: parseNumeroEu(nums[2]),
      cantidad: parseNumeroEu(nums[3]),
      precio: parseNumeroEu(nums[4]),
    };
  };

  const enPrimera = parsearNums(first.slice(first.indexOf(ref) + ref.length));
  if (enPrimera) {
    return { ...enPrimera, nextIdx: i };
  }

  while (i < rawLines.length) {
    const line = rawLines[i].trim();
    if (!line) {
      i += 1;
      continue;
    }
    if (RE_REF.test(line) && !RE_NUMS_FIN.test(line)) {
      break;
    }
    const parsed = parsearNums(line, buffer ? `${buffer} ` : "");
    if (parsed) {
      i += 1;
      return { ...parsed, nextIdx: i };
    }
    buffer += (buffer ? " " : "") + line;
    i += 1;
  }
  return null;
}

function parsearFactura(text, archivo) {
  const fecha = parseFechaFactura(text);
  if (!fecha) {
    throw new Error(`Sin fecha en ${archivo}`);
  }

  const lineas = [];
  const rawLines = text.split("\n");
  let i = 0;
  while (i < rawLines.length) {
    if (!RE_REF.test(rawLines[i])) {
      i += 1;
      continue;
    }
    const bloque = extraerBloqueProducto(rawLines, i);
    if (!bloque) {
      i += 1;
      continue;
    }
    i = bloque.nextIdx;
    const { ref, designation, importe, cantidad, precio } = bloque;
    if (esPorte(ref, designation)) {
      continue;
    }
    const producto = NOMBRE_POR_REF[ref] ?? designation;
    lineas.push({
      fecha,
      ref,
      producto,
      cantidad,
      precio,
      importe,
      unidad: inferirUnidad(ref, producto),
    });
  }

  return lineas;
}

async function main() {
  const todas = [];

  for (const pdfPath of PDFS) {
    const parser = new PDFParse({ data: readFileSync(pdfPath) });
    const { text } = await parser.getText();
    await parser.destroy();
    const archivo = path.basename(pdfPath);
    const lineas = parsearFactura(text, archivo);
    console.log(`${archivo}: ${lineas.length} líneas (${lineas[0]?.fecha ?? "?"})`);
    todas.push(...lineas);
  }

  todas.sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      a.producto.localeCompare(b.producto, "fr") ||
      a.cantidad - b.cantidad
  );

  const out = path.join(__dirname, "data/nishikidori-albaranes.json");
  const payload = todas.map(({ fecha, producto, cantidad, precio, importe, unidad }) => ({
    fecha,
    producto,
    cantidad,
    precio,
    importe,
    unidad,
  }));
  writeFileSync(out, JSON.stringify(payload, null, 2) + "\n");

  const productos = [...new Set(payload.map((l) => l.producto))].sort((a, b) =>
    a.localeCompare(b, "fr")
  );
  const total = payload.reduce((a, l) => a + l.importe, 0);
  console.log(`\nTotal líneas: ${payload.length}`);
  console.log(`Productos únicos: ${productos.length}`);
  console.log(`Importe total: ${total.toFixed(2)}€`);
  console.log(`Escrito: ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
