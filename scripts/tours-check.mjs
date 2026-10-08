// Stage 5: spotlight coach-mark tours (Home, Browse, Messages, Seller dashboard).
// Usage: node --env-file=.env.local scripts/tours-check.mjs   (server on BASE_URL, default http://localhost:3111)
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "Vossie-Demo-2026!";
const EMAIL = "20250107@vossie.net"; // Sipho: approved seller with listings and conversations
const ALL = ["home", "browse", "messages", "seller"];
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const check = (n, ok, x = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); };

const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
const uid = list.users.find((u) => u.email === EMAIL).id;
const setSeen = (tours_seen, onboarding_seen = true) => db.from("profiles").update({ tours_seen, onboarding_seen }).eq("id", uid);
const seenNow = async () => (await db.from("profiles").select("tours_seen").eq("id", uid).single()).data.tours_seen;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const ctx = await (browser.createBrowserContext ?? browser.createIncognitoBrowserContext).call(browser);
const page = await ctx.newPage();
await page.setViewport({ width: 360, height: 780, isMobile: true, hasTouch: true });
{
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) throw new Error(error.message);
  const key = `sb-${new globalThis.URL(URL_).hostname.split(".")[0]}-auth-token`;
  const parts = ("base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url")).match(/.{1,3180}/g);
  await page.setCookie(...parts.map((v, i) => ({ name: parts.length === 1 ? key : `${key}.${i}`, value: v, url: BASE })));
}
const go = (path) => page.goto(BASE + path, { waitUntil: "networkidle0", timeout: 45000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tour = () => page.$("[role=dialog][aria-modal=true]");
const title = () => page.$eval("[role=dialog] h2", (h) => h.textContent);
const clickBtn = (text) => page.evaluate((t) => { [...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.trim() === t)?.click(); }, text);

try {
  // Nothing shows once every tour is seen
  await setSeen(ALL);
  await go("/"); await wait(1200);
  check("no tour when all are seen", !(await tour()));

  // Welcome slides come first: no coach mark while onboarding is unseen
  await setSeen([], false);
  await go("/"); await wait(1200);
  check("no coach mark while the welcome slides are pending", (await page.$eval("[role=dialog]", (d) => d.getAttribute("aria-label")).catch(() => "")) === "Welcome tour");

  // Home tour
  await setSeen([]);
  await go("/"); await wait(1200);
  check("home tour opens for a first-time visit", !!(await tour()));
  check("first step is search", (await title()) === "Search anything");
  const spot = await page.$eval("[role=dialog] [aria-hidden=true].border-sand", (e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; }).catch(() => null);
  check("spotlight box surrounds the target", !!spot && spot.w > 100 && spot.h > 30, JSON.stringify(spot));
  const pop = await page.$eval("[role=dialog] h2", (h) => { const r = h.parentElement.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
  check("popover stays inside a 360px viewport", pop.l >= 0 && pop.r <= 360 && pop.t >= 0 && pop.b <= 780, JSON.stringify(pop));
  const btn = await page.$$eval("[role=dialog] button", (bs) => bs.map((b) => b.getBoundingClientRect().height));
  check("tour buttons are 44px+ tall", btn.length >= 2 && btn.every((h) => h >= 44), JSON.stringify(btn));
  check("keyboard focus is inside the tour", await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]")));
  await clickBtn("Next"); await wait(300);
  check("Next moves to the campus step", (await title()) === "Pick your campus");
  await clickBtn("Next"); await wait(300); await clickBtn("Next"); await wait(500);
  check("last step points at the bottom nav", (await title()) === "Get around");
  const navSpot = await page.$eval("[role=dialog] [aria-hidden=true].border-sand", (e) => e.getBoundingClientRect().top);
  check("nav spotlight sits at the bottom of the screen", navSpot > 600, String(navSpot));
  await clickBtn("Done"); await wait(900);
  check("tour closes on Done", !(await tour()));
  check("home saved to tours_seen", (await seenNow()).includes("home"));
  await go("/"); await wait(1200);
  check("home tour does not return", !(await tour()));

  // Skip + Escape
  await setSeen(["home", "messages", "seller"]);
  await go("/browse"); await wait(1200);
  check("browse tour opens", (await tour()) && (await title()) === "Search listings");
  await page.keyboard.press("Escape"); await wait(900);
  check("Escape closes the tour", !(await tour()));
  check("Escape counts as seen", (await seenNow()).includes("browse"));

  // Messages + Seller
  await setSeen(["home", "browse", "seller"]);
  await go("/messages"); await wait(1200);
  check("messages tour opens when there are conversations", !!(await tour()) && (await title()) === "Your conversations");
  await clickBtn("Skip"); await wait(900);
  await setSeen(["home", "browse", "messages"]);
  await go("/sell"); await wait(1200);
  check("seller tour opens with three steps", !!(await tour()) && (await page.$eval("[role=dialog]", (d) => d.textContent.includes("1 of 3"))));
  await clickBtn("Skip"); await wait(900);
  check("seller saved to tours_seen", (await seenNow()).includes("seller"));

  // Replay from Settings
  await go("/settings");
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Replay app tour"))?.click());
  await wait(2500);
  check("Replay clears tours_seen", (await seenNow()).length === 0);
} finally {
  await setSeen(ALL);
  await db.from("profiles").update({ seller_tour_seen: true }).eq("id", uid);
  await browser.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
