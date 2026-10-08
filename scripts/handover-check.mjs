// Stage 7: per-listing handover options and delivery fee.
// Usage: node --env-file=.env.local scripts/handover-check.mjs   (server on BASE_URL, default http://localhost:3111)
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "Vossie-Demo-2026!", EMAIL = "20250107@vossie.net";
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const check = (n, ok, x = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
const uid = list.users.find((u) => u.email === EMAIL).id;
await db.from("profiles").update({ onboarding_seen: true, tours_seen: ["home", "browse", "messages", "seller"] }).eq("id", uid);
const { data: seller } = await db.from("seller_profiles").select("id").eq("user_id", uid).single();
const { data: l } = await db.from("listings").select("id,handover,pickup_point_id").eq("seller_id", seller.id).is("deleted_at", null).eq("kind", "product").limit(1).single();
const orig = { handover: l.handover, delivery_fee_zar: null };

// database rules
const bad = await db.from("listings").update({ handover: ["teleport"] }).eq("id", l.id);
check("database rejects an unknown handover option", !!bad.error);
const empty = await db.from("listings").update({ handover: [] }).eq("id", l.id);
check("database rejects an empty handover list", !!empty.error);

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

  await page.goto(`${BASE}/sell/listings/${l.id}/edit`, { waitUntil: "networkidle0", timeout: 45000 });
  const boxes = await page.$$eval("fieldset input[type=checkbox]", (bs) => bs.map((b) => ({ label: b.parentElement.textContent.trim(), on: b.checked, h: b.parentElement.getBoundingClientRect().height })));
  check("form lists the three handover options", boxes.length === 3, JSON.stringify(boxes));
  check("options have 44px+ tap targets", boxes.every((b) => b.h >= 44), JSON.stringify(boxes));
  check("existing listing has Campus pickup point ticked", boxes[0].on);
  check("fee field hidden for pickup only", (await page.$("#deliveryFeeZar")) === null);
  await page.evaluate(() => document.querySelectorAll("fieldset input[type=checkbox]")[2].click());
  await wait(300);
  check("ticking courier reveals the fee field", (await page.$("#deliveryFeeZar")) !== null);
  await page.type("#deliveryFeeZar", "35");
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /save|publish|update/i.test(b.textContent))?.click());
  await wait(3500);
  const { data: after } = await db.from("listings").select("handover,delivery_fee_zar").eq("id", l.id).single();
  check("saving stores pickup + courier and the R35 fee", after.handover.includes("courier") && after.handover.includes("pickup") && after.delivery_fee_zar === 35, JSON.stringify(after));

  await page.goto(`${BASE}/l/${l.id}`, { waitUntil: "networkidle0", timeout: 45000 });
  const text = await page.evaluate(() => document.body.innerText);
  check("listing page shows the handover options", text.includes("Courier (seller arranges)") && text.includes("Campus pickup point"));
  check("listing page shows the delivery fee", text.includes("Delivery fee: R35"));
} finally {
  await db.from("listings").update({ handover: orig.handover, delivery_fee_zar: null }).eq("id", l.id);
  await browser.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
