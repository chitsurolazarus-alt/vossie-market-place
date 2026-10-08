// Stage 6: nationwide campuses (province-first picker, inactive campuses "coming soon").
// Usage: node --env-file=.env.local scripts/campuses-check.mjs   (server on BASE_URL, default http://localhost:3111)
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "Vossie-Demo-2026!", EMAIL = "20250109@vossie.net";
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const check = (n, ok, x = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { data: camps } = await db.from("campuses").select("id,name,slug,province,active");
check("12 Eduvos campuses are seeded", camps.length === 12, String(camps.length));
check("every campus has a province", camps.every((c) => c.province));
check("only Midrand and Durban are active", camps.filter((c) => c.active).map((c) => c.slug).sort().join() === "durban,midrand");
const { data: pps } = await db.from("pickup_points").select("campus_id");
check("every campus has pickup points", camps.every((c) => pps.some((p) => p.campus_id === c.id)));

const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
const uid = list.users.find((u) => u.email === EMAIL).id;
await db.from("profiles").update({ campus_id: null, onboarding_seen: true, tours_seen: ["home", "browse", "messages", "seller"] }).eq("id", uid);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
try {
  const page = await (await (browser.createBrowserContext ?? browser.createIncognitoBrowserContext).call(browser)).newPage();
  await page.setViewport({ width: 360, height: 780, isMobile: true, hasTouch: true });
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) throw new Error(error.message);
  const key = `sb-${new globalThis.URL(URL_).hostname.split(".")[0]}-auth-token`;
  const parts = ("base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url")).match(/.{1,3180}/g);
  await page.setCookie(...parts.map((v, i) => ({ name: parts.length === 1 ? key : `${key}.${i}`, value: v, url: BASE })));

  await page.goto(BASE + "/settings", { waitUntil: "networkidle0", timeout: 45000 });
  const provinces = await page.$$eval("#my-campus-province option", (o) => o.map((x) => x.textContent));
  check("province list has all 7 provinces", provinces.length === 8 && provinces.includes("Western Cape") && provinces.includes("KwaZulu-Natal"), provinces.join("|"));
  check("campus select is disabled until a province is chosen", await page.$eval("#my-campus", (s) => s.disabled));
  await page.select("#my-campus-province", "Western Cape");
  const wc = await page.$$eval("#my-campus option", (o) => o.map((x) => ({ t: x.textContent, d: x.disabled })));
  check("Western Cape campuses show as coming soon and cannot be chosen", wc.filter((o) => o.t.includes("coming soon")).length === 2 && wc.filter((o) => o.t.includes("coming soon")).every((o) => o.d), JSON.stringify(wc));
  await page.select("#my-campus-province", "Gauteng");
  const gp = await page.$$eval("#my-campus option", (o) => o.map((x) => ({ t: x.textContent, d: x.disabled })));
  check("Midrand is selectable, Pretoria is not", gp.some((o) => o.t === "Midrand" && !o.d) && gp.some((o) => o.t.startsWith("Pretoria") && o.d), JSON.stringify(gp));
  const mid = camps.find((x) => x.slug === "midrand").id;
  await page.select("#my-campus", mid);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Save campus"))?.click());
  await wait(2500);
  const { data: p } = await db.from("profiles").select("campus_id").eq("id", uid).single();
  check("saving stores the chosen campus", p.campus_id === mid);
  await page.reload({ waitUntil: "networkidle0" });
  check("picker reopens on the saved province and campus", (await page.$eval("#my-campus-province", (s) => s.value)) === "Gauteng" && (await page.$eval("#my-campus", (s) => s.value)) === mid);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check("no horizontal scroll at 360px", w <= 360, String(w));
} finally {
  await db.from("profiles").update({ campus_id: null }).eq("id", uid);
  await browser.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
