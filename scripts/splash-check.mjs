// Splash behaviour: installed-app launch only, once per session, short, never blocks, honours reduced motion.
// Usage: node --env-file=.env.local scripts/splash-check.mjs   (server on BASE_URL, default http://localhost:3111)
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
let pass = 0, fail = 0;
const check = (n, ok, x = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const ctx = () => (browser.createBrowserContext ?? browser.createIncognitoBrowserContext).call(browser);
// Chrome cannot emulate display-mode, so the installed-app case answers matchMedia("(display-mode: standalone)") with true before any page script runs.
async function phone(features = []) {
  const page = await (await ctx()).newPage();
  await page.setViewport({ width: 360, height: 780, isMobile: true, hasTouch: true });
  const standalone = features.some((f) => f.name === "display-mode");
  const real = features.filter((f) => f.name !== "display-mode");
  if (real.length) await page.emulateMediaFeatures(real);
  if (standalone) await page.evaluateOnNewDocument(() => {
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q));
  });
  return page;
}
const state = (p) => p.evaluate(() => ({ attr: document.documentElement.getAttribute("data-splash"), shown: getComputedStyle(document.querySelector(".splash")).display !== "none" }));

// 1. normal browser tab: never
{
  const p = await phone();
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const s = await state(p);
  check("a normal browser visit has no splash", s.attr === null && !s.shown, JSON.stringify(s));
}
// 2. installed app: visible before hydration, gone quickly, not again in the same session
{
  const p = await phone([{ name: "display-mode", value: "standalone" }]);
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const early = await state(p);
  check("installed app: the splash is on screen at first paint", early.attr === "1" && early.shown, JSON.stringify(early));
  const t0 = Date.now();
  await p.waitForFunction(() => !document.documentElement.hasAttribute("data-splash"), { timeout: 4000 });
  const ms = Date.now() - t0;
  check("the splash goes away on its own in under 1.5s", ms < 1500, `${ms}ms`);
  check("the page underneath is usable (main content present)", await p.evaluate(() => !!document.querySelector("main h1")));
  await p.goto(BASE + "/browse", { waitUntil: "domcontentloaded" });
  const again = await state(p);
  check("not shown again in the same session", again.attr === null && !again.shown, JSON.stringify(again));
}
// 3. reduced motion: leaves even faster and the logo does not animate
{
  const p = await phone([{ name: "display-mode", value: "standalone" }, { name: "prefers-reduced-motion", value: "reduce" }]);
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const anim = await p.evaluate(() => getComputedStyle(document.querySelector(".splash-mark")).animationName);
  check("reduced motion: no logo animation", anim === "none", anim);
  const t0 = Date.now();
  await p.waitForFunction(() => !document.documentElement.hasAttribute("data-splash"), { timeout: 4000 });
  check("reduced motion: gone in under 800ms", Date.now() - t0 < 800, `${Date.now() - t0}ms`);
}
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
