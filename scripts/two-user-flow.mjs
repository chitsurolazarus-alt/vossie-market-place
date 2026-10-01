// Two-user end-to-end flow at 360px in a real browser: demo buyer (Ayanda) <-> Thandi's Kitchen.
// Enquiry -> realtime reply -> status changes -> completion -> buyer confirmation -> trust score, plus WhatsApp handoff logging.
// Usage: node --env-file=.env.local scripts/two-user-flow.mjs   (server on BASE_URL, default http://localhost:3111)
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = process.env.SHOTS_DIR ?? "shots/flow";
fs.mkdirSync(OUT, { recursive: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let pass = 0, fail = 0;
const check = (n, ok, x = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- data setup: Thandi's kota listing, Ayanda's id, clean slate for this pair
const { data: seller } = await db.from("seller_profiles").select("id").eq("slug", "thandis-kitchen").single();
const { data: listing } = await db.from("listings").select("id,title").eq("seller_id", seller.id).eq("title", "Chicken kota with atchar").single();
const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
const ayanda = users.users.find((u) => u.email === "20250109@vossie.net").id;
await db.from("conversations").delete().eq("buyer_id", ayanda).eq("seller_id", seller.id).eq("listing_id", listing.id);
const trustBefore = (await db.from("seller_trust").select("confirmed_sales").eq("seller_id", seller.id).single()).data.confirmed_sales;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const ctxA = await (browser.createBrowserContext ?? browser.createIncognitoBrowserContext).call(browser); // buyer's phone
const ctxB = await (browser.createBrowserContext ?? browser.createIncognitoBrowserContext).call(browser); // seller's phone

async function phone(ctx) {
  const page = await ctx.newPage();
  await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_ABORTED|net::|Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  page.on("pageerror", (e) => page.errors.push(String(e)));
  return page;
}
const buyer = await phone(ctxA);
const sellerPg = await phone(ctxB);
const shot = (p, name, full = false) => p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
const go = (p, path) => p.goto(BASE + path, { waitUntil: "networkidle0", timeout: 45000 });
const clickText = (p, sel, text) => p.$$eval(sel, (els, t) => { const el = els.find((e) => e.textContent.trim().includes(t)); if (!el) throw new Error("no element with text " + t); el.click(); }, text);
const bodyText = (p) => p.evaluate(() => document.body.innerText);
const waitText = (p, t, timeout = 15000) => p.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
async function audit(p, name) {
  const r = await p.evaluate(() => {
    const vw = window.innerWidth;
    const small = [...document.querySelectorAll("a, button, input:not([type=hidden]):not(.sr-only), select, textarea")].filter((el) => {
      const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (b.width === 0 || b.height === 0 || cs.visibility === "hidden" || el.className?.toString().includes("sr-only") || el.getAttribute("aria-hidden") === "true") return false;
      if (el.type === "checkbox" || el.type === "radio") return false;
      if (el.tagName === "A" && cs.display === "inline" && [...el.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 3)) return false;
      return b.height < 43.5 || b.width < 43.5;
    }).slice(0, 5).map((el) => `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 24)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
    return { vw, sw: document.documentElement.scrollWidth, small };
  });
  check(`${name}: no horizontal scroll at 360px`, r.sw <= r.vw + 1, `${r.sw} > ${r.vw}`);
  check(`${name}: tap targets >= 44px`, r.small.length === 0, r.small.join(" | "));
  check(`${name}: no console errors`, p.errors.length === 0, p.errors.slice(0, 2).join(" || ").slice(0, 200));
  p.errors.length = 0;
}

try {
  // ===== 1. Buyer, signed out, taps Message on Vossie -> sign in -> back with the composer open and prefilled
  await go(buyer, `/l/${listing.id}`);
  await clickText(buyer, "button", "Message on Vossie");
  await buyer.waitForFunction(() => location.pathname === "/login", { timeout: 15000 });
  check("signed-out tap sends the buyer to sign in and remembers the page", decodeURIComponent(buyer.url()).includes(`next=/l/${listing.id}?compose=1`), buyer.url());
  await shot(buyer, "01-buyer-signin");
  await clickText(buyer, "button", "New student");
  await buyer.waitForFunction((id) => location.pathname === `/l/${id}`, { timeout: 25000 }, listing.id);
  const welcome = await buyer.waitForSelector("[role=dialog][aria-label='Welcome tour']", { timeout: 4000 }).catch(() => null);
  if (welcome) await clickText(buyer, "[role=dialog] button", "Skip");
  await buyer.waitForSelector("[role=dialog][aria-label^='Message']", { timeout: 10000 });
  const prefill = await buyer.$eval("#enq-body", (t) => t.value);
  check("after sign-in the composer opens on the same page, prefilled and editable", prefill === `Hi! Is ${listing.title} still available?`, prefill);
  await shot(buyer, "02-buyer-composer");
  await audit(buyer, "composer");

  // ===== 2. Buyer edits the message and sends -> thread opens
  await buyer.focus("#enq-body"); await buyer.keyboard.down("Control"); await buyer.keyboard.press("End"); await buyer.keyboard.up("Control");
  await buyer.keyboard.type(" I can collect at 1pm.");
  await clickText(buyer, "[role=dialog] button[type=submit]", "Send message");
  await buyer.waitForFunction(() => /^\/messages\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 20000 });
  const convId = buyer.url().split("/messages/")[1];
  await waitText(buyer, "I can collect at 1pm.");
  check("first message creates the conversation and opens the thread", true);
  await shot(buyer, "03-buyer-thread");
  await audit(buyer, "buyer thread");
  const { data: enq } = await db.from("enquiries").select("id,status,source").eq("conversation_id", convId).single();
  check("an enquiry row exists with status 'new'", enq.status === "new" && enq.source === "in_app");
  const { count: convCount } = await db.from("conversations").select("id", { count: "exact", head: true }).eq("buyer_id", ayanda).eq("seller_id", seller.id).eq("listing_id", listing.id);
  check("exactly ONE conversation per (buyer, seller, listing)", convCount === 1);

  // ===== 3. Seller (Thandi) signs in on another phone, sees the bell + dashboard
  await go(sellerPg, "/login?next=/sell/enquiries");
  await clickText(sellerPg, "button", "Thandi's Kitchen");
  await sellerPg.waitForFunction(() => location.pathname === "/sell/enquiries", { timeout: 25000 });
  await sellerPg.waitForNetworkIdle({ timeout: 6000 }).catch(() => {});
  await sellerPg.$eval("button[aria-label^='Notifications']", (b) => b.click());
  await sellerPg.waitForSelector("[role=region][aria-label='Notifications'] a", { timeout: 10000 });
  const bell = await bodyText(sellerPg);
  check("seller's bell lists the new enquiry", /New enquiry from Ayanda B\./.test(bell));
  await shot(sellerPg, "04-seller-bell");
  await audit(sellerPg, "seller bell");
  await sellerPg.keyboard.press("Escape");
  await go(sellerPg, "/sell/enquiries");
  const t1 = await bodyText(sellerPg);
  check("dashboard shows tabs with counts and the new enquiry", /New\s*\d+/.test(t1) && /In progress\s*\d+/.test(t1) && /Completed\s*\d+/.test(t1) && t1.includes("Ayanda B."));
  await shot(sellerPg, "05-seller-enquiries", true);
  await audit(sellerPg, "enquiries dashboard");

  // ===== 4. Seller opens the chat and replies; the buyer sees it live (no reload)
  await sellerPg.$$eval("li", (lis) => { const li = lis.find((l) => l.textContent.includes("Ayanda B.") && l.textContent.includes("kota")); li.querySelector("a[href^='/messages/']").click(); });
  await sellerPg.waitForFunction((id) => location.pathname === `/messages/${id}`, { timeout: 15000 }, convId);
  await waitText(sellerPg, "I can collect at 1pm.");
  await shot(sellerPg, "06-seller-thread");
  await audit(sellerPg, "seller thread");
  await sellerPg.type("#thread-text", "Hi Ayanda! Yes it is. 1pm at the library entrance works.");
  await clickText(sellerPg, "form button[type=submit]", "Send");
  await waitText(buyer, "1pm at the library entrance works.", 20000);
  check("the reply appears on the buyer's phone in realtime (no reload)", true);
  await waitText(sellerPg, "Seen", 20000).catch(() => {});
  check("the seller sees the message marked 'Seen' once the buyer has it open", (await bodyText(sellerPg)).includes("Seen"));
  await shot(buyer, "07-buyer-sees-reply");

  // buyer replies with a scam-pattern message: sender gets a warning, still delivered
  await buyer.type("#thread-text", "Ok, should I pay a deposit first?");
  await buyer.waitForSelector("[role=status]", { timeout: 5000 });
  check("typing 'pay a deposit first' shows a safety tip before sending", (await bodyText(buyer)).includes("never pay a deposit"));
  await shot(buyer, "08-buyer-safety-tip");
  await clickText(buyer, "form button[type=submit]", "Send");
  await waitText(sellerPg, "should I pay a deposit first?", 20000);
  check("the flagged message is warned about, not blocked", true);
  await sellerPg.waitForFunction(() => document.body.innerText.includes("Be careful with this message"), { timeout: 8000 }).catch(() => {});
  check("the recipient sees a warning on the flagged message", (await bodyText(sellerPg)).includes("Be careful with this message"));
  await shot(sellerPg, "09-seller-sees-warning");

  // ===== 5. Status flow: Start -> Mark completed -> yes
  await clickText(sellerPg, "button", "Start");
  await sellerPg.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Mark completed") && !b.disabled), { timeout: 15000 });
  check("seller moves the enquiry to In progress", true);
  await clickText(sellerPg, "button", "Mark completed");
  await sellerPg.waitForSelector("[role=dialog][aria-label='Did this sale or swap happen?']");
  await shot(sellerPg, "10-seller-did-it-happen");
  await audit(sellerPg, "completion dialog");
  await clickText(sellerPg, "[role=dialog] button", "Yes, it happened");
  await waitText(sellerPg, "Waiting for the buyer to confirm");
  const mid = (await db.from("seller_trust").select("confirmed_sales").eq("seller_id", seller.id).single()).data.confirmed_sales;
  check("completing does not raise the trust score until the buyer confirms", mid === trustBefore, `${trustBefore} -> ${mid}`);

  // ===== 6. Buyer gets the one-tap prompt (live) and confirms
  await waitText(buyer, "Did this go ahead?", 20000);
  check("the buyer's thread shows the one-tap completion prompt live", true);
  await shot(buyer, "11-buyer-confirm-prompt");
  await audit(buyer, "buyer confirm prompt");
  await clickText(buyer, "button", "Yes, it went ahead");
  await waitText(buyer, "Thanks, you confirmed this went ahead.");
  await waitText(sellerPg, "Sale confirmed by the buyer", 20000);
  check("the seller sees the sale confirmed live", true);
  await shot(sellerPg, "12-seller-confirmed");
  const after = (await db.from("seller_trust").select("confirmed_sales").eq("seller_id", seller.id).single()).data.confirmed_sales;
  check("the buyer-confirmed sale now counts toward trust", after === trustBefore + 1, `${trustBefore} -> ${after}`);

  // ===== 7. Inbox + badges
  await go(buyer, "/messages");
  check("buyer's inbox lists the conversation with preview", (await bodyText(buyer)).includes("Thandi's Kitchen"));
  await shot(buyer, "13-buyer-inbox");
  await audit(buyer, "inbox");

  // ===== 8. Non-participant gets a 404
  const stranger = await phone(await (browser.createBrowserContext ?? browser.createIncognitoBrowserContext).call(browser));
  await go(stranger, "/login?next=/");
  await clickText(stranger, "button", "Lwazi Cuts");
  await stranger.waitForFunction(() => location.pathname === "/", { timeout: 25000 });
  const resp = await stranger.goto(`${BASE}/messages/${convId}`, { waitUntil: "networkidle0" });
  check("a non-participant opening the thread gets a 404", resp.status() === 404, `status ${resp.status()}`);

  // ===== 9. WhatsApp handoff is logged as an event on the enquiry
  const { count: waBefore } = await db.from("enquiry_events").select("id", { count: "exact", head: true }).eq("type", "whatsapp_handoff").eq("enquiry_id", enq.id);
  await buyer.setRequestInterception(true);
  let waUrl = "";
  buyer.on("request", (r) => { if (r.url().startsWith("https://wa.me/")) { waUrl = r.url(); r.abort(); } else r.continue(); });
  await buyer.goto(`${BASE}/go/whatsapp/thandis-kitchen?listing=${listing.id}`).catch(() => {});
  await sleep(1500);
  check("the WhatsApp redirect still works and the number never appears in page HTML", waUrl.startsWith("https://wa.me/27710000101"));
  const { count: waAfter } = await db.from("enquiry_events").select("id", { count: "exact", head: true }).eq("type", "whatsapp_handoff").eq("enquiry_id", enq.id);
  check("the handoff is logged as a 'whatsapp_handoff' event on the enquiry", (waAfter ?? 0) === (waBefore ?? 0) + 1, `${waBefore} -> ${waAfter}`);
  const html = await (await fetch(`${BASE}/l/${listing.id}`)).text();
  check("no WhatsApp number in the listing page HTML", !html.includes("27710000101") && !html.includes("0710000101"));
} catch (e) {
  fail++; console.log("FAIL  flow aborted: " + (e?.message ?? e));
  console.log("  seller errors:", sellerPg.errors.slice(0, 3), "dialogs:", await sellerPg.evaluate(() => [...document.querySelectorAll("[role=dialog]")].map((d) => d.getAttribute("aria-label"))).catch(() => "?"));
  await shot(buyer, "zz-buyer-failure").catch(() => {}); await shot(sellerPg, "zz-seller-failure").catch(() => {});
} finally {
  // leave the demo data as we found it (conversation cascade removes enquiry, events, notifications; trust refreshes)
  await db.from("conversations").delete().eq("buyer_id", ayanda).eq("seller_id", seller.id).eq("listing_id", listing.id);
  await browser.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
