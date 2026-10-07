// Stage 4: Settings page, data saver moved out of the header, five-item bottom nav.
// Usage: node --env-file=.env.local scripts/settings-check.mjs   (server on BASE_URL, default http://localhost:3111)
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "Vossie-Demo-2026!";
const EMAIL = "20250109@vossie.net";
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const check = (n, ok, x = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); };

const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
const uid = list.users.find((u) => u.email === EMAIL).id;
const { data: campuses } = await db.from("campuses").select("id,name").eq("active", true).order("name");
const reset = () => Promise.all([
  db.from("notification_prefs").delete().eq("user_id", uid),
  db.from("profiles").update({ campus_id: null, onboarding_seen: true, seller_tour_seen: true, low_data_mode: false }).eq("id", uid),
]);
await reset();

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const ctx = () => (browser.createBrowserContext ?? browser.createIncognitoBrowserContext).call(browser);
async function phone(email) {
  const page = await (await ctx()).newPage();
  await page.setViewport({ width: 360, height: 780, isMobile: true, hasTouch: true });
  if (email) {
    const c = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
    if (error) throw new Error(error.message);
    const key = `sb-${new globalThis.URL(URL_).hostname.split(".")[0]}-auth-token`;
    const parts = ("base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url")).match(/.{1,3180}/g);
    await page.setCookie(...parts.map((v, i) => ({ name: parts.length === 1 ? key : `${key}.${i}`, value: v, url: BASE })));
  }
  return page;
}
const go = (p, path) => p.goto(BASE + path, { waitUntil: "networkidle0", timeout: 45000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ navigation
const page = await phone(EMAIL);
await go(page, "/");
const nav = await page.$$eval("nav[aria-label=Primary] a", (as) => as.map((a) => ({ t: a.innerText.trim().split(/\s*\n\s*/).pop().trim(), href: a.getAttribute("href"), cur: a.getAttribute("aria-current"), h: a.getBoundingClientRect().height, icon: !!a.querySelector("svg") })));
check("bottom nav has exactly five items", nav.length === 5, JSON.stringify(nav.map((n) => n.t)));
check("order is Home, Browse, Sell, Messages, Account", nav.map((n) => n.t).join("|") === "Home|Browse|Sell|Messages|Account", nav.map((n) => n.t).join("|"));
check("each item has an icon and a 44px+ tap target", nav.every((n) => n.icon && n.h >= 44), JSON.stringify(nav));
check("Home is marked as the current page on /", nav[0].cur === "page" && nav.filter((n) => n.cur).length === 1);
await go(page, "/browse");
check("Browse is current on /browse", (await page.$eval("nav[aria-label=Primary] a[aria-current=page]", (a) => a.innerText.trim())) === "Browse");
await go(page, "/sell/listings");
check("Sell stays current on a /sell sub page", (await page.$eval("nav[aria-label=Primary] a[aria-current=page]", (a) => a.innerText.trim())) === "Sell");
check("the header has no data-saver toggle", (await page.$("header button[title^='Low-data']")) === null && !(await page.$eval("header", (h) => h.innerText)).includes("Data saver"));
check("the header shows only the logo mark, no text name", (await page.$eval("header a[aria-label='HustleHub home']", (a) => a.innerText.trim())) === "");

// Settings reachable from Account; saved + looking for too
await go(page, "/account");
const acct = await page.$$eval("main a", (as) => as.map((a) => a.getAttribute("href")));
check("Account links to Settings, Saved and Looking For", ["/settings", "/saved", "/looking-for"].every((h) => acct.includes(h)), acct.join(","));
await page.$eval("main a[href='/settings']", (a) => a.click());
await page.waitForFunction(() => location.pathname === "/settings", { timeout: 10000 });

// ------------------------------------------------------------------ settings sections
await go(page, "/settings");
const heads = await page.$$eval("main h2", (hs) => hs.map((h) => h.innerText.trim()));
for (const h of ["Appearance", "Data saver", "Notifications", "Location", "Help", "Privacy & data", "About & legal"]) check(`Settings has a "${h}" section`, heads.includes(h), heads.join("|"));
check("the 'Built for the Eduvos Incubation Hub' credit is in About", (await page.$eval("#about", (s) => s.innerText)).includes("Built for the Eduvos Incubation Hub"));
const about = await page.$$eval("#about a", (as) => as.map((a) => a.getAttribute("href")));
for (const need of ["/privacy", "/terms", "/seller-guidelines", "/how-trust-works", "/how-featured-works"]) check(`About links to ${need}`, about.includes(need));
const codes = await Promise.all(about.map(async (h) => (await fetch(BASE + h.split("#")[0])).status));
check("every About link opens (200)", codes.every((c) => c === 200), codes.join(","));
const hasSizes = await page.$$eval("main select, main input", (els) => els.every((e) => parseFloat(getComputedStyle(e).fontSize) >= 16));
check("settings inputs are 16px or larger", hasSizes);

// data saver
await page.$eval("#data-saver button[role=switch]", (b) => b.click());
await page.waitForFunction(() => document.documentElement.dataset.lowdata === "true", { timeout: 10000 });
await wait(500);
check("data saver in Settings turns low-data mode on and saves it to the profile", (await db.from("profiles").select("low_data_mode").eq("id", uid).single()).data.low_data_mode === true);
await page.$eval("#data-saver button[role=switch]", (b) => b.click());
await page.waitForFunction(() => document.documentElement.dataset.lowdata === "false", { timeout: 10000 });

// notification prefs
await page.$$eval("#notifications button[role=switch]", (bs) => bs[1].click()); // daily digest
await wait(1500);
let prefs = (await db.from("notification_prefs").select("*").eq("user_id", uid).maybeSingle()).data;
check("turning on the daily summary is saved", prefs?.email_daily_digest === true && prefs?.email_new_enquiry === true, JSON.stringify(prefs));
check("the push switch is disabled (coming soon)", await page.$eval("#notifications button[role=switch]:nth-of-type(3), #notifications [role=switch][disabled]", (b) => b.disabled));
await go(page, "/settings");
check("the saved choice shows again after reload", (await page.$$eval("#notifications button[role=switch]", (bs) => bs[1].getAttribute("aria-checked"))) === "true");

// campus
const campus = campuses[0];
await page.select("#my-campus", campus.id);
await page.$$eval("#location button", (bs) => bs.find((b) => b.innerText.includes("Save campus")).click());
await wait(1500);
check("choosing a campus saves it to the profile", (await db.from("profiles").select("campus_id").eq("id", uid).single()).data.campus_id === campus.id);

// replay tour
await db.from("profiles").update({ onboarding_seen: true }).eq("id", uid);
await go(page, "/settings");
await page.$$eval("#help button", (bs) => bs.find((b) => b.innerText.includes("Replay app tour")).click());
await page.waitForFunction(() => location.pathname === "/", { timeout: 15000 });
await page.waitForSelector("[role=dialog]", { timeout: 15000 }).catch(() => {});
check("Replay app tour brings the welcome tour back", await page.evaluate(() => !!document.querySelector("[role=dialog]")));

// FAQ
await go(page, "/faq");
check("FAQ page lists questions that open and close", (await page.$$eval("main details", (d) => d.length)) >= 8);

// ------------------------------------------------------------------ signed out
const anon = await phone();
await go(anon, "/settings");
const txt = await anon.$eval("main", (m) => m.innerText);
check("signed-out Settings still shows appearance, data saver and About", txt.includes("Appearance") && txt.includes("Data saver") && txt.includes("About & legal"));
check("signed-out Settings asks for sign-in on account-only sections", (await anon.$$eval("#notifications a, #location a", (a) => a.length)) === 2);

await reset();
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
