// Theme checks at 360px: behaviour (device default, no flash, toggle, persistence, Auto) and a WCAG AA contrast audit
// of every visible text element, in light AND dark, across public and signed-in pages. Screenshots go to shots/theme.
// Usage: node --env-file=.env.local scripts/theme-check.mjs   (server on BASE_URL, default http://localhost:3111)
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = process.env.SHOTS_DIR ?? "shots/theme";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "Vossie-Demo-2026!";
fs.mkdirSync(OUT, { recursive: true });
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let pass = 0, fail = 0;
const check = (n, ok, x = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const newCtx = () => (browser.createBrowserContext ?? browser.createIncognitoBrowserContext).call(browser);
async function phone(scheme) {
  const page = await (await newCtx()).newPage();
  await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  return page;
}
async function signIn(page, email) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(error.message);
  const key = `sb-${new globalThis.URL(URL_).hostname.split(".")[0]}-auth-token`;
  const value = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
  const parts = value.match(/.{1,3180}/g);
  await page.setCookie(...parts.map((v, i) => ({ name: parts.length === 1 ? key : `${key}.${i}`, value: v, url: BASE })));
}
const go = (p, path, wait = "networkidle0") => p.goto(BASE + path, { waitUntil: wait, timeout: 45000 });
const attr = (p) => p.evaluate(() => ({ theme: document.documentElement.dataset.theme, choice: document.documentElement.dataset.themeChoice, cookie: document.cookie }));

// ---------------------------------------------------------------- contrast audit (runs in the page)
async function contrast(page) {
  return page.evaluate(() => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 1;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    const rgba = (css) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
    const blend = (top, bottom) => { const a = top[3]; return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1]; };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    const rootBg = rgba(getComputedStyle(document.body).backgroundColor);
    const base = rootBg[3] === 0 ? [255, 255, 255, 1] : blend(rootBg, [255, 255, 255, 1]);
    const bgOf = (el) => {
      const layers = [];
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage !== "none") return null; // gradient or image behind the text: can't judge
        const c = rgba(cs.backgroundColor);
        if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
      }
      let out = base;
      for (let i = layers.length - 1; i >= 0; i--) out = blend(layers[i], out);
      return out;
    };
    const fails = []; let checked = 0;
    for (const el of document.body.querySelectorAll("*")) {
      if (el.closest("svg, script, style, noscript, pre")) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
      if (!own.length) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || cs.visibility === "hidden" || cs.display === "none") continue;
      if (el.closest("[disabled], [aria-disabled=true]") || el.matches(":disabled")) continue;
      let op = 1; for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity); if (op < 0.99) continue;
      const bg = bgOf(el); if (!bg) continue;
      const fg = rgba(cs.color);
      const text = fg[3] < 1 ? blend(fg, bg) : fg;
      const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
      const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
      const ratioV = ratio(text, bg); checked++;
      if (ratioV < need) fails.push({ t: own[0].textContent.trim().slice(0, 28), cls: String(el.className).slice(0, 60), r: Math.round(ratioV * 100) / 100, need, fg: cs.color, bg: `rgb(${bg.slice(0, 3).map(Math.round)})` });
    }
    const uniq = new Map(); for (const f of fails) uniq.set(`${f.cls}|${f.fg}|${f.bg}`, f);
    return { checked, fails: [...uniq.values()] };
  });
}

// ---------------------------------------------------------------- behaviour
console.log("--- behaviour");
{
  const dark = await phone("dark");
  await go(dark, "/", "domcontentloaded");
  let a = await attr(dark);
  check("device is dark and no choice saved: dark theme is set before first paint", a.theme === "dark" && a.choice === "auto", JSON.stringify(a));
  await dark.waitForNetworkIdle({ timeout: 8000 }).catch(() => {});
  const bg = await dark.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check("the page background is the dark surface", bg === "rgb(11, 19, 34)", bg);

  const light = await phone("light");
  await go(light, "/", "domcontentloaded");
  a = await attr(light);
  check("device is light and no choice saved: light theme", a.theme === "light" && a.choice === "auto", JSON.stringify(a));
  await light.waitForNetworkIdle({ timeout: 8000 }).catch(() => {});
  const lbg = await light.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check("light mode background is unchanged (white)", lbg === "rgb(255, 255, 255)", lbg);

  // header toggle
  const btn = "header button[title='Dark mode']";
  check("the header has a dark mode toggle, at least 44px, not pressed in light", await light.$eval(btn, (b) => { const r = b.getBoundingClientRect(); return r.width >= 43.5 && r.height >= 43.5 && b.getAttribute("aria-pressed") === "false"; }));
  const headerFits = await light.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check("the header still fits at 360px with the toggle", headerFits);
  await light.$eval(btn, (b) => b.click());
  await light.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  a = await attr(light);
  check("tapping the toggle switches to dark and saves the choice", a.theme === "dark" && a.choice === "dark" && /vossie_theme=dark/.test(a.cookie), JSON.stringify(a));
  check("the toggle reports pressed", await light.$eval(btn, (b) => b.getAttribute("aria-pressed") === "true"));
  await light.reload({ waitUntil: "domcontentloaded" });
  a = await attr(light);
  check("the choice survives a reload even though the device is light", a.theme === "dark" && a.choice === "dark", JSON.stringify(a));
  await go(light, "/browse", "domcontentloaded");
  check("and applies on other pages", (await attr(light)).theme === "dark");

  // settings chooser
  await go(light, "/settings");
  const radios = await light.$$eval("input[name=theme]", (r) => r.map((x) => ({ v: x.value, c: x.checked })));
  check("Settings has Match my device / Light / Dark, with the saved choice selected", radios.length === 3 && radios.find((r) => r.c)?.v === "dark", JSON.stringify(radios));
  await light.evaluate(() => document.querySelector("input[name=theme][value=light]").click());
  await light.waitForFunction(() => document.documentElement.dataset.theme === "light");
  check("choosing Light overrides a dark choice", (await attr(light)).choice === "light");
  await light.evaluate(() => document.querySelector("input[name=theme][value=auto]").click());
  a = await attr(light);
  check("choosing 'Match my device' clears the saved choice and follows the device (light here)", a.choice === "auto" && a.theme === "light" && !/vossie_theme=(light|dark)/.test(a.cookie), JSON.stringify(a));
  await light.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await light.waitForFunction(() => document.documentElement.dataset.theme === "dark", { timeout: 5000 });
  check("in Auto the theme follows the device when it changes", true);
  const tap = await light.evaluate(() => [...document.querySelectorAll("input[name=theme]")].every((i) => i.closest("label").getBoundingClientRect().height >= 43.5));
  check("theme options are at least 44px tall", tap);
}

// ---------------------------------------------------------------- contrast audit
console.log("--- contrast (WCAG AA, 4.5:1 text, 3:1 large text)");
const sellerThandi = (await db.from("seller_profiles").select("id").eq("slug", "thandis-kitchen").single()).data;
const kota = (await db.from("listings").select("id").eq("seller_id", sellerThandi.id).eq("title", "Chicken kota with atchar").single()).data;
const conv = (await db.from("conversations").select("id").eq("seller_id", sellerThandi.id).not("last_message_at", "is", null).limit(1).single()).data;
const post = (await db.from("hub_posts").select("id").eq("kind", "event").limit(1).single()).data;
const report = (await db.from("reports").select("id").eq("status", "pending").limit(1).maybeSingle()).data;
const aishaSeller = (await db.from("seller_profiles").select("id").eq("slug", "aishas-bakes").single()).data;
const mentorSeller = (await db.from("seller_profiles").select("id").eq("slug", "lwazi-cuts").single()).data;

const PAGES = {
  anon: ["/", "/browse", `/l/${kota.id}`, "/s/thandis-kitchen", "/how-trust-works", "/growth", `/growth/${post.id}`, "/privacy", "/login", "/settings", "/looking-for", "/saved"],
  "20250109@vossie.net": ["/account", "/messages", "/settings/privacy", "/saved?tab=sellers"],
  "20250101@vossie.net": ["/sell", "/sell/enquiries", "/sell/listings", `/messages/${conv.id}`],
  "admin.demo@eduvos.com": ["/admin", "/admin/sellers", `/admin/sellers/${aishaSeller.id}`, report ? `/admin/reports/${report.id}` : "/admin/reports", "/admin/listings", "/admin/users", "/admin/manage?s=trust_tiers", "/admin/manage?s=settings", "/admin/audit"],
  "mentor.demo@eduvos.com": ["/mentor", `/mentor/${mentorSeller.id}`, "/growth/manage"],
};
const seen = {};
for (const scheme of ["light", "dark"]) {
  for (const [who, paths] of Object.entries(PAGES)) {
    const page = await phone(scheme);
    if (who !== "anon") await signIn(page, who);
    for (const path of paths) {
      await go(page, path);
      const r = await contrast(page);
      const name = `${scheme} ${path}`;
      seen[name] = r;
      check(`${scheme}: ${path} meets AA contrast (${r.checked} text elements)`, r.fails.length === 0, r.fails.slice(0, 4).map((f) => `"${f.t}" ${f.r}:1 (need ${f.need}) ${f.fg} on ${f.bg} [${f.cls.slice(0, 40)}]`).join(" | "));
      if (scheme === "dark" && ["/", "/browse", `/l/${kota.id}`, "/s/thandis-kitchen", "/settings", "/sell/enquiries", "/admin", "/mentor", "/account"].includes(path)) {
        await page.screenshot({ path: `${OUT}/dark-${path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}.png`, fullPage: false });
      }
    }
    await page.close();
  }
}
await browser.close();

// summary: compare against light so pre-existing light issues are visible
const lightFails = Object.entries(seen).filter(([k, v]) => k.startsWith("light") && v.fails.length).length;
const darkFails = Object.entries(seen).filter(([k, v]) => k.startsWith("dark") && v.fails.length).length;
console.log(`\nPages with contrast failures: light ${lightFails}, dark ${darkFails}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
