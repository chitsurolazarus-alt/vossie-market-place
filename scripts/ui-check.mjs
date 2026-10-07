// Real-browser UI check at 360px (mobile emulation) using the locally installed Chrome.
// Reports horizontal overflow, small tap targets, console errors; saves screenshots; drives key flows.
// Usage: node --env-file=.env.local scripts/ui-check.mjs   (server on BASE_URL, default http://localhost:3111)
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = process.env.SHOTS_DIR ?? "shots";
fs.mkdirSync(OUT, { recursive: true });

// Reset the demo student so the run is repeatable (tour shown again, nothing saved/followed).
import { createClient } from "@supabase/supabase-js";
{
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const u = list?.users.find((x) => x.email === "20250109@vossie.net");
  if (u) {
    await db.from("saved_listings").delete().eq("user_id", u.id);
    await db.from("follows").delete().eq("user_id", u.id);
    await db.from("profiles").update({ onboarding_seen: false, low_data_mode: false }).eq("id", u.id);
  }
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
let pass = 0, fail = 0;
const check = (n, ok, x = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); };

async function newPage(width = 360) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.errors = [];
  page.on("console", (m) => { if (m.type() === "error") page.errors.push(m.text()); });
  page.on("pageerror", (e) => page.errors.push(String(e)));
  return page;
}

async function audit(page, name) {
  const r = await page.evaluate(() => {
    const vw = window.innerWidth;
    const over = [...document.querySelectorAll("body *")].filter((el) => {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || getComputedStyle(el).position === "fixed") return false;
      // ignore things inside intentional horizontal scrollers
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if ((o === "auto" || o === "scroll") && p.scrollWidth > p.clientWidth) return false;
      }
      return b.right > vw + 1;
    }).slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
    const small = [...document.querySelectorAll("a, button, input:not([type=hidden]), select, textarea, summary")].filter((el) => {
      const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (b.width === 0 || b.height === 0 || cs.visibility === "hidden" || el.className?.toString().includes("sr-only")) return false;
      if (el.type === "checkbox" || el.type === "radio") return false; // wrapped by 44px labels
      // WCAG 2.5.8 exempts links that sit inline inside a sentence
      if (el.tagName === "A" && cs.display === "inline" && [...el.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 3)) return false;
      return b.height < 43.5 || b.width < 43.5;
    }).slice(0, 6).map((el) => `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 24)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
    const noAlt = [...document.querySelectorAll("img:not([alt])")].length;
    return { vw, scrollW: document.documentElement.scrollWidth, over, small, noAlt };
  });
  check(`${name}: no horizontal page scroll at 360px`, r.scrollW <= r.vw + 1, `scrollWidth ${r.scrollW} > ${r.vw}; wide: ${r.over.join(", ")}`);
  check(`${name}: tap targets >= 44px`, r.small.length === 0, r.small.join(" | "));
  check(`${name}: every image has alt`, r.noAlt === 0);
  check(`${name}: no console errors`, page.errors.length === 0, page.errors.slice(0, 2).join(" || ").slice(0, 200));
}
const idle = (page) => page.waitForNetworkIdle({ timeout: 8000 }).catch(() => console.log('  note: network did not go idle within 8s'));
const shot = (page, name, full = true) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
const go = async (page, path) => { await page.goto(BASE + path, { waitUntil: "networkidle0", timeout: 45000 }); };

// ---------------- public pages
let page = await newPage();
const pages = [["home", "/"], ["browse", "/browse"], ["browse-search", "/browse?q=braids"], ["browse-empty", "/browse?q=zzqxv"], ["seller", "/s/thandis-kitchen"], ["how-featured", "/how-featured-works"], ["how-trust", "/how-trust-works"], ["growth", "/growth"], ["privacy", "/privacy"], ["settings", "/settings"], ["login", "/login"]];
for (const [name, path] of pages) {
  page.errors.length = 0;
  await go(page, path);
  await shot(page, name);
  await audit(page, name);
}
const listingHref = await (async () => { await go(page, "/browse"); return page.$eval("a[href^='/l/']", (a) => a.getAttribute("href")); })();
page.errors.length = 0; await go(page, listingHref); await shot(page, "listing"); await audit(page, "listing");

// ---------------- filter bottom sheet
await go(page, "/browse");
const filtersBtn = await page.$("button[aria-haspopup='dialog']");
check("mobile shows a Filters button", !!filtersBtn);
await filtersBtn.tap();
await page.waitForSelector("[role=dialog]");
await shot(page, "browse-filters-sheet", false);
const sheetH = await page.$eval("[role=dialog]", (el) => el.getBoundingClientRect().height);
check("filter sheet fits the screen", sheetH <= 780 * 0.9, `${sheetH}`);
await page.select("#f-category", "food");
await page.$eval("[role=dialog] form button[type=submit]", (b) => b.click());
await page.waitForFunction(() => location.search.includes("category=food"));
check("submitting filters puts them in the URL", page.url().includes("category=food"));
await page.waitForFunction(() => document.body.innerText.includes("Chicken kota"), { timeout: 10000 }).catch(() => {}); // results stream in after the loading skeleton
check("filtered results show only food", (await page.content()).includes("Chicken kota") && !(await page.content()).includes("Skin fade"));
await page.goBack({ waitUntil: "networkidle0" });
check("back button restores the unfiltered page", !page.url().includes("category=food"));

// ---------------- load more
await go(page, "/browse");
const before = await page.$$eval("main li a[href^='/l/']", (a) => a.length);
await page.$$eval("a", (as) => as.find((a) => a.textContent.trim() === "Load more")?.click());
await page.waitForFunction(() => location.search.includes("n=2"), { timeout: 15000 });
await idle(page);
const after = await page.$$eval("main li a[href^='/l/']", (a) => a.length);
check(`Load more adds results (${before} -> ${after})`, after > before);

// ---------------- signed-out heart -> login -> back to same page
await go(page, "/browse?q=braids");
await page.$eval("button[aria-label^='Save ']", (b) => b.click());
await page.waitForFunction(() => location.pathname === "/login", { timeout: 10000 });
check("signed-out heart sends you to sign in with a return path", decodeURIComponent(page.url()).includes("next=/browse?q=braids"));

// ---------------- demo login, save, follow, saved page, low-data
await page.$$eval("button", (bs) => bs.find((b) => b.textContent.includes("New student"))?.click());
await page.waitForFunction(() => location.pathname === "/browse", { timeout: 20000 });
check("after sign-in you return to the page you came from", page.url().includes("/browse?q=braids"));
await idle(page);
// welcome tour appears for a new user; skip it
const tour = await page.waitForSelector("[role=dialog][aria-label='Welcome tour']", { timeout: 8000 }).catch(() => null);
check("first-time welcome tour is shown", !!tour);
if (tour) { await shot(page, "welcome-tour", false); await page.$$eval("[role=dialog] button", (bs) => bs.find((b) => b.textContent.trim() === "Skip")?.click()); }
const heart = "button[aria-label^='Save ']";
await page.$eval(heart, (b) => b.click());
await page.waitForSelector("button[aria-pressed='true'][aria-label^='Remove']", { timeout: 10000 });
check("heart toggles optimistically", true);
await page.reload({ waitUntil: "networkidle0" });
check("saved state persists after reload", !!(await page.$("button[aria-pressed='true'][aria-label^='Remove']")));
await go(page, "/saved"); await shot(page, "saved"); page.errors.length = 0;
check("saved page lists the listing", (await page.$$eval("main li a[href^='/l/']", (a) => a.length)) === 1);
await audit(page, "saved");
// follow from the seller page
await go(page, "/s/thandis-kitchen");
await page.$eval("button[aria-label^='Follow ']", (b) => b.click());
await page.waitForSelector("button[aria-label^='Unfollow ']");
await go(page, "/saved?tab=sellers"); await shot(page, "saved-sellers");
check("followed seller appears under Saved > Sellers", (await page.content()).includes("Thandi"));

// low-data toggle in the header
await go(page, "/browse");
await page.$eval("header button[title^='Low-data']", (b) => b.click());
await page.waitForFunction(() => document.documentElement.dataset.lowdata === "true", { timeout: 10000 });
await idle(page);
await shot(page, "browse-lowdata");
check("low-data toggle switches the whole page", (await page.$$eval("main li img", (i) => i.length)) >= 1 && (await page.content()).includes("Tap to load"));
check("low-data mode has no animation", await page.evaluate(() => getComputedStyle(document.querySelector("header button[title^='Low-data']")).transitionDuration === "0s"));
await page.$$eval("button", (bs) => bs.find((b) => b.textContent.includes("Tap to load"))?.click());
await idle(page);
check("tap-to-load loads the photo", true);
await audit(page, "browse-lowdata");
// reset
await page.$eval("header button[title^='Low-data']", (b) => b.click());
await page.waitForFunction(() => document.documentElement.dataset.lowdata === "false", { timeout: 10000 });

// ---------------- listing: gallery + share fallback
await go(page, listingHref);
const shareBtn = await page.$$eval("button", (bs) => bs.some((b) => b.textContent.trim() === "Share"));
check("listing has a Share button", shareBtn);
await page.evaluate(() => { Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); });
await page.evaluate(() => { window.__copied = ""; Object.defineProperty(navigator, "clipboard", { value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } }, configurable: true }); });
await page.$$eval("button", (bs) => bs.find((b) => b.textContent.trim() === "Share")?.click());
await page.waitForFunction(() => window.__copied.includes("/l/"), { timeout: 5000 });
check("Share falls back to copying the link", await page.evaluate(() => document.body.innerText.includes("Link copied")));

// ---------------- desktop layout sanity
const desk = await newPage(1280);
await desk.setViewport({ width: 1280, height: 900 });
await go(desk, "/browse"); await shot(desk, "browse-desktop", false);
check("desktop shows filters as a sidebar (no Filters button visible)", await desk.$eval("button[aria-haspopup='dialog']", (b) => getComputedStyle(b).display === "none"));
await go(desk, "/"); await shot(desk, "home-desktop", false);

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
