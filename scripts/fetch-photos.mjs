// Downloads real photos from Pexels for every seeded listing and the landing page, converts them to WebP, and records credits.
// Usage: node --env-file=.env.local scripts/fetch-photos.mjs [--only "<key substring>"] [--refresh]
//   Needs PEXELS_API_KEY in .env.local (free: https://www.pexels.com/api/). The key is read from the environment only and never written anywhere.
//   Output: scripts/photos/files/*.webp (listings, uploaded to Storage by the seed), public/photos/*.webp (site), scripts/photos/manifest.json,
//   docs/IMAGE_CREDITS.md. Photos already in the manifest are kept unless --refresh is given.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { LISTING_QUERIES, SITE_QUERIES } from "./photos/queries.mjs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const KEY = process.env.PEXELS_API_KEY;
if (!KEY) { console.error("PEXELS_API_KEY is missing from .env.local (free key: https://www.pexels.com/api/)."); process.exit(1); }
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const refresh = process.argv.includes("--refresh");

const ROOT = path.resolve(import.meta.dirname, "..");
const FILES = path.join(ROOT, "scripts/photos/files");
const SITE = path.join(ROOT, "public/photos");
const MANIFEST = path.join(ROOT, "scripts/photos/manifest.json");
fs.mkdirSync(FILES, { recursive: true }); fs.mkdirSync(SITE, { recursive: true });
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};
const used = new Set(Object.values(manifest).map((m) => m.pexelsId));

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

async function search(query) {
  const u = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&size=large&per_page=15`;
  const r = await fetch(u, { headers: { Authorization: KEY } });
  if (r.status === 429) throw new Error("Pexels rate limit hit (200 requests/hour). Wait and re-run: finished photos are kept.");
  if (!r.ok) throw new Error(`Pexels ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return (await r.json()).photos ?? [];
}

// Listing photos < 400KB (the app's upload limit); site photos can be a little larger but stay light.
async function toWebp(buf, width, maxBytes) {
  for (const q of [80, 72, 64, 56, 48]) {
    const out = await sharp(buf).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: q }).toBuffer(); // no metadata kept: EXIF stripped
    if (out.length <= maxBytes) return out;
  }
  return sharp(buf).rotate().resize({ width: Math.round(width * 0.75), withoutEnlargement: true }).webp({ quality: 48 }).toBuffer();
}

const jobs = [
  ...Object.entries(LISTING_QUERIES).map(([key, q]) => ({ key, q, dir: FILES, width: 1600, max: 380_000, file: `${slug(key)}.webp` })),
  ...Object.entries(SITE_QUERIES).map(([key, q]) => ({ key, q, dir: SITE, width: key === "site:hero" ? 1920 : 1280, max: key === "site:hero" ? 220_000 : 160_000, file: `${key.slice(5)}.webp` })),
].filter((j) => (!only || j.key.toLowerCase().includes(only.toLowerCase())) && (refresh || !manifest[j.key]));

console.log(`${jobs.length} photo(s) to fetch`);
for (const j of jobs) {
  const results = await search(j.q);
  const pick = results.find((p) => !used.has(p.id));
  if (!pick) { console.warn(`  no unused result for "${j.key}" (${j.q})`); continue; }
  const img = await fetch(pick.src.large2x ?? pick.src.large);
  if (!img.ok) { console.warn(`  download failed for "${j.key}"`); continue; }
  const out = await toWebp(Buffer.from(await img.arrayBuffer()), j.width, j.max);
  fs.writeFileSync(path.join(j.dir, j.file), out);
  used.add(pick.id);
  manifest[j.key] = {
    file: path.relative(ROOT, path.join(j.dir, j.file)).replaceAll("\\", "/"), bytes: out.length, query: j.q,
    pexelsId: pick.id, pageUrl: pick.url, photographer: pick.photographer, photographerUrl: pick.photographer_url, alt: pick.alt || "",
    licence: "Pexels License (free to use, no attribution required)",
  };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`  ok  ${j.key.padEnd(42)} ${(out.length / 1024).toFixed(0)}KB  ${pick.photographer}`);
  await new Promise((r) => setTimeout(r, 400));
}

// docs/IMAGE_CREDITS.md
const rows = Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b));
const md = [
  "# Image credits",
  "",
  "All photos are from [Pexels](https://www.pexels.com) under the [Pexels License](https://www.pexels.com/license/): free for commercial use, no attribution required (credit is given here anyway).",
  "Downloaded with `scripts/fetch-photos.mjs`, converted to WebP, EXIF removed. Listing photos live in Supabase Storage (`listing-images`); site photos in `public/photos`.",
  "Each photo was checked by eye for identifiable brand logos or trademarks before use. Seller avatars are generated initials tiles, not photos of people.",
  "",
  "| Used for | Photo (source page) | Photographer | Licence | File |",
  "|---|---|---|---|---|",
  ...rows.map(([k, m]) => `| ${k} | [Pexels #${m.pexelsId}](${m.pageUrl}) | [${m.photographer}](${m.photographerUrl}) | Pexels License | \`${m.file}\` |`),
  "",
].join("\n");
fs.writeFileSync(path.join(ROOT, "docs/IMAGE_CREDITS.md"), md);
console.log(`\nmanifest: ${Object.keys(manifest).length} photos. Credits written to docs/IMAGE_CREDITS.md`);
