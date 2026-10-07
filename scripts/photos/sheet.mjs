// Contact sheet of the downloaded photos for a by-eye check (brand logos, relevance). Usage: node scripts/photos/sheet.mjs [out.png] [from] [count]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const ROOT = path.resolve(import.meta.dirname, "../..");
const m = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/photos/manifest.json"), "utf8"));
const from = Number(process.argv[3] ?? 0), count = Number(process.argv[4] ?? 12);
const keys = Object.keys(m).sort().slice(from, from + count);
const W = 400, H = 270, COLS = 4, rows = Math.ceil(keys.length / COLS);
const tiles = [];
for (const [i, k] of keys.entries()) {
  const img = await sharp(path.join(ROOT, m[k].file)).resize(W, H, { fit: "cover" }).toBuffer();
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="26"><rect width="${W}" height="26" fill="#000" opacity=".75"/><text x="6" y="18" font-size="14" fill="#fff" font-family="Arial">${from + i} ${k.replace(/&/g, "and").slice(0, 44)}</text></svg>`);
  const x = (i % COLS) * W, y = Math.floor(i / COLS) * H;
  tiles.push({ input: img, left: x, top: y }, { input: label, left: x, top: y });
}
await sharp({ create: { width: W * COLS, height: H * rows, channels: 3, background: "#fff" } }).composite(tiles).png().toFile(process.argv[2] ?? "shots/photo-sheet.png");
console.log("sheet for", keys.length, "photos");
