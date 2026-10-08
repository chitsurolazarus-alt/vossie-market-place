// Stage 9: signed-out landing page (home). Also saves screenshots to shots/landing-*.png.
// Usage: node --env-file=.env.local scripts/landing-check.mjs   (server on BASE_URL, default http://localhost:3111)
import fs from "node:fs";
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "Vossie-Demo-2026!", EMAIL = "20250109@vossie.net";
let pass = 0, fail = 0;
const check = (n, ok, x = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); };
fs.mkdirSync("shots", { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const newPage = async (w, h = 800, scheme = "light") => {
  const page = await (await (browser.createBrowserContext ?? browser.createIncognitoBrowserContext).call(browser)).newPage();
  await page.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  return page;
};
try {
  const page = await newPage(360);
  const resp = await page.goto(BASE + "/", { waitUntil: "networkidle0", timeout: 45000 });
  check("signed-out home returns 200", resp.status() === 200);
  const text = await page.evaluate(() => document.body.innerText);
  check("hero headline and tagline", text.includes("Student hustles. Nationwide."));
  for (const h of ["How it works", "One hub, every campus", "Got a hustle? Put it on the map.", "Featured Hustles", "Shop by category"]) check(`section: ${h}`, text.includes(h));
  check("stats band is present", text.includes("student sellers") && text.includes("campuses live"));
  check("hero search form is kept", !!(await page.$("form[role=search] #home-q")));
  const live = await page.$$eval("[aria-labelledby=campuses-h] a", (as) => as.map((a) => a.textContent.trim()));
  const total = await page.$$eval("[aria-labelledby=campuses-h] ul ul > li", (l) => l.length);
  check("campus grid shows all 12 campuses", total === 12, String(total));
  check("live campuses are links, coming-soon ones are not", live.some((t) => t.startsWith("Midrand")) && live.some((t) => t.startsWith("Durban")) && live.filter((t) => /Midrand|Durban|Pretoria|Mowbray/.test(t)).length === 2, live.join("|"));
  check("hero cards show real listings", (await page.$$("[aria-label='Live on HustleHub now'] img")).length >= 1);
  const small = await page.$$eval("main a, main button", (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5 && !e.closest("[class*=sr-only]") && getComputedStyle(e).display !== "inline"; }).map((e) => e.textContent.trim().slice(0, 30)));
  check("tap targets are 44px+ on the landing", small.length === 0, small.join(" | "));
  check("no leftover emoji icons", !/[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/u.test(text));
  await page.screenshot({ path: "shots/landing-360.png", fullPage: true });

  for (const [w, scheme] of [[360, "light"], [360, "dark"], [768, "light"], [1024, "light"], [1440, "light"], [1440, "dark"]]) {
    const p = await newPage(w, 900, scheme);
    await p.goto(BASE + "/", { waitUntil: "networkidle0", timeout: 45000 });
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    check(`no horizontal scroll at ${w}px ${scheme}`, sw <= w, String(sw));
    if (w === 1440 && scheme === "light") await p.screenshot({ path: "shots/landing-1440.png" });
    if (w === 360 && scheme === "dark") await p.screenshot({ path: "shots/landing-360-dark.png" });
    await p.close();
  }

  // signed-in users keep the marketplace home
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) throw new Error(error.message);
  const me = await newPage(360);
  const key = `sb-${new globalThis.URL(URL_).hostname.split(".")[0]}-auth-token`;
  const parts = ("base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url")).match(/.{1,3180}/g);
  await me.setCookie(...parts.map((v, i) => ({ name: parts.length === 1 ? key : `${key}.${i}`, value: v, url: BASE })));
  await me.goto(BASE + "/", { waitUntil: "networkidle0", timeout: 45000 });
  const t2 = await me.evaluate(() => document.body.innerText);
  check("signed-in home skips the landing sections", !t2.includes("How it works") && !t2.includes("One hub, every campus") && t2.includes("Shop by category"));
} finally {
  await browser.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
