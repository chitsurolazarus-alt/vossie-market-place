// Downloads real photos (Unsplash, or Pexels as a fallback) for every seeded listing and the landing page, converts them to WebP, and records credits.
// Usage: node --env-file=.env.local scripts/fetch-photos.mjs [--only "<key substring>"] [--refresh]
//   Needs UNSPLASH_ACCESS_KEY (free: https://unsplash.com/developers) or PEXELS_API_KEY in .env.local. Keys are read from the environment only and never written anywhere.
//   Unsplash demo apps allow 50 requests/hour (a search + a download ping per photo), so a full run takes a few hours; the script stops cleanly on the limit and a re-run resumes.
//   Output: scripts/photos/files/*.webp (listings, uploaded to Storage by the seed), public/photos/*.webp (site), scripts/photos/manifest.json,
//   docs/IMAGE_CREDITS.md. Photos already in the manifest are kept unless --refresh is given.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { LISTING_QUERIES, SITE_QUERIES } from "./photos/queries.mjs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const UNSPLASH = process.env.UNSPLASH_ACCESS_KEY, PEXELS = process.env.PEXELS_API_KEY;
if (!UNSPLASH && !PEXELS) { console.error("Add UNSPLASH_ACCESS_KEY (https://unsplash.com/developers) or PEXELS_API_KEY to .env.local."); process.exit(1); }
const PROVIDER = UNSPLASH ? "unsplash" : "pexels";
const LICENCE = PROVIDER === "unsplash" ? "Unsplash License (free to use, credit appreciated)" : "Pexels License (free to use, no attribution required)";
class RateLimited extends Error {}
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const refresh = process.argv.includes("--refresh");

const ROOT = path.resolve(import.meta.dirname, "..");
const FILES = path.join(ROOT, "scripts/photos/files");
const SITE = path.join(ROOT, "public/photos");
const MANIFEST = path.join(ROOT, "scripts/photos/manifest.json");
fs.mkdirSync(FILES, { recursive: true }); fs.mkdirSync(SITE, { recursive: true });
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};
const used = new Set(Object.values(manifest).map((m) => (m.provider ? `${m.provider}:${m.photoId}` : String(m.pexelsId))));

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

// Both providers are normalised to { id, pageUrl, photographer, photographerUrl, alt, imageUrl, ping }.
async function search(query) {
  if (PROVIDER === "unsplash") {
    const u = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high&per_page=20`;
    const r = await fetch(u, { headers: { Authorization: `Client-ID ${UNSPLASH}`, "Accept-Version": "v1" } });
    if (r.status === 403 || r.status === 429) throw new RateLimited("Unsplash rate limit reached (50 requests/hour for demo apps).");
    if (!r.ok) throw new Error(`Unsplash ${r.status}: ${(await r.text()).slice(0, 120)}`);
    return ((await r.json()).results ?? []).map((p) => ({
      id: p.id, pageUrl: p.links.html, photographer: p.user.name, photographerUrl: p.user.links.html, alt: p.alt_description || p.description || "",
      imageUrl: `${p.urls.raw}&w=2000&q=80&fm=jpg`, ping: p.links.download_location,
    }));
  }
  const u = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&size=large&per_page=15`;
  const r = await fetch(u, { headers: { Authorization: PEXELS } });
  if (r.status === 429) throw new RateLimited("Pexels rate limit hit (200 requests/hour).");
  if (!r.ok) throw new Error(`Pexels ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return ((await r.json()).photos ?? []).map((p) => ({ id: p.id, pageUrl: p.url, photographer: p.photographer, photographerUrl: p.photographer_url, alt: p.alt || "", imageUrl: p.src.large2x ?? p.src.large }));
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
try {
  for (const j of jobs) {
    const results = await search(j.q);
    const pick = results.find((p) => !used.has(`${PROVIDER}:${p.id}`) && !used.has(p.id));
    if (!pick) { console.warn(`  no unused result for "${j.key}" (${j.q})`); continue; }
    if (pick.ping) await fetch(pick.ping, { headers: { Authorization: `Client-ID ${UNSPLASH}` } }); // Unsplash API guideline: report the download
    const img = await fetch(pick.imageUrl);
    if (!img.ok) { console.warn(`  download failed for "${j.key}"`); continue; }
    const out = await toWebp(Buffer.from(await img.arrayBuffer()), j.width, j.max);
    fs.writeFileSync(path.join(j.dir, j.file), out);
    used.add(`${PROVIDER}:${pick.id}`);
    manifest[j.key] = {
      file: path.relative(ROOT, path.join(j.dir, j.file)).replaceAll("\\", "/"), bytes: out.length, query: j.q, provider: PROVIDER,
      photoId: pick.id, pageUrl: pick.pageUrl, photographer: pick.photographer, photographerUrl: pick.photographerUrl, alt: pick.alt, licence: LICENCE,
    };
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    console.log(`  ok  ${j.key.padEnd(42)} ${(out.length / 1024).toFixed(0)}KB  ${pick.photographer}`);
    await new Promise((r) => setTimeout(r, 400));
  }
} catch (e) {
  if (!(e instanceof RateLimited)) throw e;
  console.warn(`\n${e.message} Finished photos are kept; run again in about an hour to continue.`);
}

// docs/IMAGE_CREDITS.md
const rows = Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b));
const name = (m) => (m.provider === "pexels" ? "Pexels" : "Unsplash");
const md = [
  "# Image credits",
  "",
  "Photos are from [Unsplash](https://unsplash.com/license) (Unsplash License) and [Pexels](https://www.pexels.com/license/) (Pexels License): both free for commercial use. Credit is given here for every photo.",
  "Downloaded with `scripts/fetch-photos.mjs`, converted to WebP, EXIF removed. Listing photos live in Supabase Storage (`listing-images`); site photos in `public/photos`.",
  "Each photo was checked by eye for identifiable brand logos or trademarks before use. Seller avatars are generated initials tiles, not photos of people.",
  "",
  "| Used for | Source page | Photographer | Licence | File |",
  "|---|---|---|---|---|",
  ...rows.map(([k, m]) => `| ${k} | [${name(m)}](${m.pageUrl}) | [${m.photographer}](${m.photographerUrl}) | ${m.licence} | \`${m.file}\` |`),
  "",
].join("\n");
fs.writeFileSync(path.join(ROOT, "docs/IMAGE_CREDITS.md"), md);
console.log(`\nmanifest: ${Object.keys(manifest).length} photos. Credits written to docs/IMAGE_CREDITS.md`);
