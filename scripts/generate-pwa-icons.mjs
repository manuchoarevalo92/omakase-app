import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const svgPath = path.join(root, "public/icons/app-icon.svg");
const outDir = path.join(root, "public/icons");

const svg = await readFile(svgPath);

const mk = (size, name) =>
  sharp(svg).resize(size, size).png().toFile(path.join(outDir, name));

await Promise.all([
  mk(192, "icon-192.png"),
  mk(512, "icon-512.png"),
  mk(512, "icon-512-maskable.png"),
  mk(180, "apple-touch-icon.png"),
]);

console.log("PWA icons written to public/icons/");
