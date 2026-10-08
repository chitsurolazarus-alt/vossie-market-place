// Downloads real photos (Unsplash, or Pexels as a fallback) for every seeded listing and the landing page, converts them to WebP, and records credits.
// Usage: node --env-file=.env.local scripts/fetch-photos.mjs [--only "<key substring>"] [--refresh]
//   Needs UNSPLASH_ACCESS_KEY (free: https://unsplash.com/developers) or PEXELS_API_KEY in .env.local. Keys are read from the environment only and never written anywhere.
//   Unsplash demo apps allow 50 requests/hour (a search + a download ping per photo), so a full run takes a few hours; the script stops cleanly on the limit and a re-run resumes.
//   Output: scripts/photos/files/*.webp (listings, uploaded to Storage by the seed), public/photos/*.webp (site), scripts/photos/manifest.json,
//   docs/IMAGE_CREDITS.md. Photos already in the manifest are kept unless --refresh is given.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { COMMONS_QUERIES, LISTING_QUERIES, SITE_QUERIES } from "./photos/queries.mjs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

// Providers: Unsplash or Pexels (free key) or, with --openverse, Openverse (no key; CC0 / public domain / CC BY only; poor relevance, see below).
const UNSPLASH = process.env.UNSPLASH_ACCESS_KEY, PEXELS = process.env.PEXELS_API_KEY;
const PROVIDER = process.argv.includes("--commons") ? "commons" : UNSPLASH ? "unsplash" : PEXELS ? "pexels" : process.argv.includes("--openverse") ? "openverse" : null;
if (!PROVIDER) {
  console.error("Add UNSPLASH_ACCESS_KEY or PEXELS_API_KEY to .env.local. (Openverse works without a key via --openverse, but its search is loosely matched: a trial gave off-topic, historical and branded photos, so it is opt-in and every photo needs a by-eye check.)");
  process.exit(1);
}
const LICENCE = { commons: "", unsplash: "Unsplash License (free to use, credit appreciated)", pexels: "Pexels License (free to use, no attribution required)", openverse: "" }[PROVIDER];
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
// Wikimedia Commons: no key. Keeps CC0, public domain, CC BY and CC BY-SA photos only (commercial use allowed, credit required).
const strip = (h) => String(h ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim();
const BAD_TITLE = /logo|icon|diagram|map of|flag of|coat of arms|poster|stamp|painting|drawing|illustration|svg|screenshot|portrait of|bust of|statue/i;
async function searchCommons(query) {
  const u = "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=30&gsrsearch=" +
    encodeURIComponent(query + " filetype:bitmap") + "&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=2000";
  const r = await fetch(u, { headers: { "User-Agent": "HustleHub-seed-script/1.0 (student marketplace demo)" } });
  if (r.status === 429) throw new RateLimited("Wikimedia rate limit reached.");
  if (!r.ok) throw new Error("Commons " + r.status);
  const pages = Object.values((await r.json()).query?.pages ?? {}).sort((a, b) => a.index - b.index);
  const out = [];
  for (const pg of pages) {
    const ii = pg.imageinfo?.[0]; if (!ii) continue;
    const md = ii.extmetadata ?? {};
    const lic = strip(md.LicenseShortName?.value);
    const title = pg.title.replace(/^File:/, "");
    if (!/^(CC0|CC BY(-SA)? [0-9.]+|Public domain|PD)/i.test(lic)) continue;
    if (!["image/jpeg", "image/png", "image/webp"].includes(ii.mime) || ii.width < 1000 || ii.width / ii.height < 1.15 || ii.width / ii.height > 2.1) continue;
    if (BAD_TITLE.test(title)) continue;
    out.push({
      id: String(pg.pageid), pageUrl: ii.descriptionurl, photographer: strip(md.Artist?.value) || "Unknown", photographerUrl: ii.descriptionurl,
      alt: strip(md.ImageDescription?.value).slice(0, 160) || title.replace(/\.[a-z]+$/i, "").replace(/_/g, " "),
      imageUrl: ii.thumburl || ii.url, licence: lic + (md.LicenseUrl?.value ? " (" + md.LicenseUrl.value + ")" : ""), source: "Wikimedia Commons",
    });
  }
  return out;
}

async function search(query) {
  if (PROVIDER === "commons") return searchCommons(query);
  if (PROVIDER === "openverse") {
    const u = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license=cc0,pdm,by&license_type=commercial&mature=false&page_size=20`;
    const r = await fetch(u, { headers: { "User-Agent": "HustleHub-seed-script" } });
    if (r.status === 429 || r.status === 403) throw new RateLimited("Openverse rate limit reached (20/min, 200/day without a key).");
    if (!r.ok) throw new Error(`Openverse ${r.status}`);
    const ok = ((await r.json()).results ?? []).filter((p) => p.width >= 1000 && p.width / p.height >= 1.2 && p.width / p.height <= 2.1);
    return ok.map((p) => ({
      id: p.id, pageUrl: p.foreign_landing_url, photographer: p.creator || "Unknown", photographerUrl: p.creator_url || p.foreign_landing_url,
      alt: p.title || "", imageUrl: p.url, licence: `${p.license.toUpperCase()}${p.license_version ? " " + p.license_version : ""} (${p.license_url})`, source: p.source,
    }));
  }
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
].filter((j) => !(process.argv.includes("--no-site") && j.key.startsWith("site:")) && (!only || j.key.toLowerCase().includes(only.toLowerCase())) && (refresh || !manifest[j.key]));

console.log(`${jobs.length} photo(s) to fetch via ${PROVIDER}`);
try {
  for (const j of jobs) {
    const results = await search(PROVIDER === "commons" ? COMMONS_QUERIES[j.key] ?? j.q : j.q);
    let pick = null, buf = null;
    for (const cand of results.filter((p) => !used.has(`${PROVIDER}:${p.id}`) && !used.has(p.id)).slice(0, 4)) {
      if (cand.ping) await fetch(cand.ping, { headers: { Authorization: `Client-ID ${UNSPLASH}` } }); // Unsplash API guideline: report the download
      const img = await fetch(cand.imageUrl, { headers: { "User-Agent": "HustleHub-seed-script" } }).catch(() => null);
      if (img?.ok && (img.headers.get("content-type") ?? "").startsWith("image/")) { pick = cand; buf = Buffer.from(await img.arrayBuffer()); break; }
    }
    if (!pick) { console.warn(`  nothing usable for "${j.key}" (${j.q})`); continue; }
    const out = await toWebp(buf, j.width, j.max);
    fs.writeFileSync(path.join(j.dir, j.file), out);
    used.add(`${PROVIDER}:${pick.id}`);
    manifest[j.key] = {
      file: path.relative(ROOT, path.join(j.dir, j.file)).replaceAll("\\", "/"), bytes: out.length, query: j.q, provider: PROVIDER, source: pick.source,
      photoId: pick.id, pageUrl: pick.pageUrl, photographer: pick.photographer, photographerUrl: pick.photographerUrl, alt: pick.alt, licence: pick.licence ?? LICENCE,
    };
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    console.log(`  ok  ${j.key.padEnd(42)} ${(out.length / 1024).toFixed(0)}KB  ${pick.photographer}`);
    await new Promise((r) => setTimeout(r, PROVIDER === "openverse" ? 3500 : PROVIDER === "commons" ? 1200 : 400));
  }
} catch (e) {
  if (!(e instanceof RateLimited)) throw e;
  console.warn(`\n${e.message} Finished photos are kept; run again in about an hour to continue.`);
}

// docs/IMAGE_CREDITS.md
const rows = Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b));
const name = (m) => (m.provider === "commons" ? "Wikimedia Commons" : m.provider === "pexels" ? "Pexels" : m.provider === "unsplash" ? "Unsplash" : `Openverse / ${m.source ?? "web"}`);
const md = [
  "# Image credits",
  "",
  "Photos come from [Wikimedia Commons](https://commons.wikimedia.org) (openly licensed: CC0, public domain, CC BY and CC BY-SA, all of which allow commercial use with credit). Each photo links to its source page, author and licence below.",
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
