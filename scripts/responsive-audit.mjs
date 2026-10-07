// Responsive audit: every route at 360/375/414/768/1024/1440 in light and dark.
// Reports horizontal overflow, clipped text, inputs under 16px, images with no reserved box, content hidden behind the bottom bar, small tap targets.
// Usage: node --env-file=.env.local scripts/responsive-audit.mjs   (server on BASE_URL, default http://localhost:3111)
// Env: SHOTS_DIR (default shots/audit), WIDTHS="360,768", ONLY="/browse" (substring filter)
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = process.env.SHOTS_DIR ?? "shots/audit";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "Vossie-Demo-2026!";
const WIDTHS = (process.env.WIDTHS ?? "360,375,414,768,1024,1440").split(",").map(Number);
fs.mkdirSync(OUT, { recursive: true });
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const one = async (q) => (await q).data;
const listing = await one(db.from("listings").select("id").is("deleted_at", null).limit(1).single());
const post = await one(db.from("hub_posts").select("id").limit(1).single());
const seller = await one(db.from("seller_profiles").select("id").eq("slug", "thandis-kitchen").single());
const conv = await one(db.from("conversations").select("id").limit(1).maybeSingle());
const PAGES = {
  anon: ["/", "/browse", "/browse?q=braids", `/l/${listing.id}`, "/s/thandis-kitchen", "/how-trust-works", "/how-featured-works", "/growth", `/growth/${post?.id}`, "/privacy", "/terms", "/seller-guidelines", "/login", "/settings", "/looking-for"],
  "20250109@vossie.net": ["/account", "/messages", "/saved", "/settings/privacy", "/sell"],
  "20250101@vossie.net": ["/sell", "/sell/enquiries", "/sell/listings", "/sell/listings/new", "/sell/profile/edit", ...(conv ? [`/messages/${conv.id}`] : [])],
  "admin.demo@eduvos.com": ["/admin", "/admin/sellers", `/admin/sellers/${seller.id}`, "/admin/reports", "/admin/listings", "/admin/users", "/admin/audit"],
  "mentor.demo@eduvos.com": ["/mentor", "/growth/manage"],
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const newCtx = () => (browser.createBrowserContext ?? browser.createIncognitoBrowserContext).call(browser);
async function signIn(page, email) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(error.message);
  const key = `sb-${new globalThis.URL(URL_).hostname.split(".")[0]}-auth-token`;
  const parts = ("base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url")).match(/.{1,3180}/g);
  await page.setCookie(...parts.map((v, i) => ({ name: parts.length === 1 ? key : `${key}.${i}`, value: v, url: BASE })));
}

const inspect = () => {
  const vw = window.innerWidth;
  const vis = (el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String(el.className).split(" ").filter(Boolean).slice(0, 3).join(".")}`.slice(0, 70);
  const inScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === "auto" || o === "scroll" || o === "hidden") && p.scrollWidth > p.clientWidth) return true; } return false; };
  const overflow = [...document.querySelectorAll("body *")].filter((el) => vis(el) && getComputedStyle(el).position !== "fixed" && !el.closest(".sr-only") && el.getBoundingClientRect().right > vw + 1 && !inScroller(el)).slice(0, 4).map(name);
  const clipped = [...document.querySelectorAll("h1,h2,h3,p,a,button,span,li,label")].filter((el) => {
    if (!vis(el) || el.closest(".sr-only")) return false;
    const cs = getComputedStyle(el);
    if (el.scrollWidth <= el.clientWidth + 1) return false;
    if (cs.overflowX === "visible" || cs.overflowX === "auto" || cs.overflowX === "scroll") return false;
    if (cs.textOverflow === "ellipsis" || (cs.webkitLineClamp && cs.webkitLineClamp !== "none")) return false;
    return (el.innerText || "").trim().length > 0 && cs.display !== "inline";
  }).slice(0, 4).map((el) => `${name(el)} "${el.innerText.trim().slice(0, 24)}"`);
  const smallInputs = [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea")].filter((el) => vis(el) && parseFloat(getComputedStyle(el).fontSize) < 16).slice(0, 4).map(name);
  const noBox = [...document.querySelectorAll("img")].filter((el) => {
    if (!vis(el)) return false;
    const cs = getComputedStyle(el);
    if (cs.position === "absolute" || (el.hasAttribute("width") && el.hasAttribute("height"))) return false;
    if (cs.aspectRatio !== "auto") return false;
    for (let p = el.parentElement, i = 0; p && i < 3; p = p.parentElement, i++) { const c = getComputedStyle(p); if (c.aspectRatio !== "auto" || /(^| )(h|size)-\d/.test(String(p.className))) return false; }
    return true;
  }).slice(0, 3).map(name);
  // Fixed bars: is the end of the page reachable above the bottom bar?
  const bar = [...document.querySelectorAll("nav")].find((n) => getComputedStyle(n).position === "fixed" && n.getBoundingClientRect().bottom >= innerHeight - 2 && vis(n));
  let covered = null;
  if (bar) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const top = bar.getBoundingClientRect().top;
    const last = [...document.querySelectorAll("main *")].filter((el) => vis(el) && getComputedStyle(el).position !== "fixed" && !el.closest(".sr-only") && !(el.closest("details:not([open])") && el.tagName !== "SUMMARY" && !el.closest("summary"))).map((el) => el.getBoundingClientRect().bottom).reduce((a, b) => Math.max(a, b), 0);
    if (last > top + 1) covered = Math.round(last - top);
    window.scrollTo(0, 0);
  }
  const small = vw <= 414 ? [...document.querySelectorAll("a, button, input:not([type=hidden]), select, textarea, summary")].filter((el) => {
    const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (b.width === 0 || b.height === 0 || cs.visibility === "hidden" || String(el.className).includes("sr-only") || el.type === "checkbox" || el.type === "radio") return false;
    if (el.tagName === "A" && cs.display === "inline" && [...el.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 3)) return false;
    return b.height < 43.5 || b.width < 43.5;
  }).slice(0, 3).map((el) => `${name(el)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`) : [];
  return { scrollW: document.documentElement.scrollWidth, vw, overflow, clipped, smallInputs, noBox, covered, small };
};

const issues = [];
const slug = (s) => s.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";
for (const scheme of ["light", "dark"]) {
  for (const w of WIDTHS) {
    for (const [who, paths] of Object.entries(PAGES)) {
      const page = await (await newCtx()).newPage();
      await page.setViewport({ width: w, height: w >= 768 ? 900 : 780, deviceScaleFactor: 1, isMobile: w < 768, hasTouch: w < 768 });
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
      if (who !== "anon") await signIn(page, who);
      for (const path of paths) {
        if (process.env.ONLY && !path.includes(process.env.ONLY)) continue;
        try { await page.goto(BASE + path, { waitUntil: "networkidle0", timeout: 45000 }); } catch (e) { issues.push({ path, w, scheme, kind: "load", detail: String(e).slice(0, 80) }); continue; }
        const r = await page.evaluate(inspect);
        if (r.scrollW > r.vw + 1) issues.push({ path, w, scheme, kind: "h-scroll", detail: `scrollWidth ${r.scrollW} > ${r.vw}; ${r.overflow.join(", ")}` });
        for (const k of ["clipped", "smallInputs", "noBox", "small"]) if (r[k].length) issues.push({ path, w, scheme, kind: k, detail: r[k].join(" | ") });
        if (r.covered) issues.push({ path, w, scheme, kind: "bottom-bar-covers", detail: `${r.covered}px of content under the bar` });
        if (scheme === "light" && (w === 360 || w === 1440) && who === "anon") await page.screenshot({ path: `${OUT}/${w}-${slug(path)}.png` });
      }
      await page.close();
    }
  }
}
await browser.close();
const byKind = {};
for (const i of issues) {
  const m = (byKind[i.kind] ??= new Map());
  const k = `${i.path} :: ${i.detail}`;
  m.set(k, [...(m.get(k) ?? []), `${i.w}${i.scheme[0]}`]);
}
for (const [k, m] of Object.entries(byKind)) { console.log(`\n## ${k} (${m.size})`); for (const [d, ws] of m) console.log(`- ${d}   [${[...new Set(ws)].join(" ")}]`); }
console.log(`\n${issues.length} issue instances`);
fs.writeFileSync(`${OUT}/issues.json`, JSON.stringify(issues, null, 1));
process.exit(issues.length ? 1 : 0);
