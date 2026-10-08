// Stage 8: payment requests (MockPay flow, Paystack safeguards, RLS).
// Usage: node --env-file=.env.local scripts/payments-check.mjs   (server on BASE_URL, default http://localhost:3111)
import crypto from "node:crypto";
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "Vossie-Demo-2026!", SELLER_EMAIL = "20250107@vossie.net";
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const check = (n, ok, x = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
const sellerUser = users.users.find((u) => u.email === SELLER_EMAIL);
const { data: sp } = await db.from("seller_profiles").select("id").eq("user_id", sellerUser.id).single();
const { data: convs } = await db.from("conversations").select("id, buyer_id, listing_id, enquiries(status)").eq("seller_id", sp.id).not("buyer_id", "is", null);
let conv = null, buyerEmail = null;
for (const c of convs) {
  const st = (Array.isArray(c.enquiries) ? c.enquiries[0] : c.enquiries)?.status;
  if (!st || st === "declined" || st === "completed") continue;
  const email = users.users.find((u) => u.id === c.buyer_id)?.email;
  if (!email) continue;
  const probe = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error } = await probe.auth.signInWithPassword({ email, password: PASSWORD });
  if (!error) { conv = c; buyerEmail = email; break; }
}
if (!conv) { console.log("FAIL  no seller/buyer conversation with a known password"); process.exit(1); }
const { data: stranger } = { data: users.users.find((u) => u.email?.endsWith("@vossie.net") && u.id !== conv.buyer_id && u.id !== sellerUser.id) };

const cleanup = async () => {
  await db.from("payment_requests").delete().eq("conversation_id", conv.id);
  await db.from("site_settings").update({ value: { provider: "mockpay" } }).eq("key", "payment_provider");
  await db.from("feature_flags").update({ enabled: true }).eq("key", "payments");
  await db.from("notifications").delete().eq("conversation_id", conv.id).in("type", ["payment_request", "payment_received"]);
};
await cleanup();
for (const u of [sellerUser, users.users.find((x) => x.id === conv.buyer_id)]) {
  await db.from("profiles").update({ onboarding_seen: true, tours_seen: ["home", "browse", "messages", "seller"] }).eq("id", u.id);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
async function phone(email) {
  const page = await (await (browser.createBrowserContext ?? browser.createIncognitoBrowserContext).call(browser)).newPage();
  await page.setViewport({ width: 360, height: 780, isMobile: true, hasTouch: true });
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(error.message);
  const key = `sb-${new globalThis.URL(URL_).hostname.split(".")[0]}-auth-token`;
  const parts = ("base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url")).match(/.{1,3180}/g);
  await page.setCookie(...parts.map((v, i) => ({ name: parts.length === 1 ? key : `${key}.${i}`, value: v, url: BASE })));
  return { page, client: c };
}
const go = (p, path) => p.goto(BASE + path, { waitUntil: "networkidle0", timeout: 45000 });
const click = (p, text) => p.evaluate((t) => { [...document.querySelectorAll("button, a")].find((b) => b.textContent.trim().startsWith(t))?.click(); }, text);
const rows = async () => (await db.from("payment_requests").select("*").eq("conversation_id", conv.id).order("created_at")).data;

try {
  const seller = await phone(SELLER_EMAIL);
  const buyer = await phone(buyerEmail);

  // --- RLS: nobody writes payment rows from the client
  const ins = await buyer.client.from("payment_requests").insert({ conversation_id: conv.id, seller_id: sp.id, buyer_id: conv.buyer_id, item_zar: 1, reference: "HH-AAAAAAAAAAAAAAAA" });
  check("a buyer cannot insert a payment row directly", !!ins.error);

  // --- seller requests payment
  await go(seller.page, `/messages/${conv.id}`);
  check("seller sees the Request payment button", await seller.page.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Request payment")));
  await click(seller.page, "Request payment"); await wait(300);
  await seller.page.$eval("#pay-item", (el) => { el.value = ""; });
  await seller.page.type("#pay-item", "120");
  await seller.page.type("#pay-delivery", "30");
  await seller.page.type("#pay-note", "Collect at the library");
  await click(seller.page, "Send request"); await wait(3000);
  let r = (await rows())[0];
  check("request stored: R120 + R30 = R150, pending", r?.item_zar === 120 && r?.delivery_zar === 30 && r?.total_zar === 150 && r?.status === "pending", JSON.stringify(r) + " UI: " + (await seller.page.evaluate(() => [...document.querySelectorAll("[role=alert]")].map((e) => e.textContent).join("|"))));
  check("reference has the HH- format", /^HH-[A-F0-9]{16}$/.test(r?.reference ?? ""));
  const { data: n1 } = await db.from("notifications").select("type").eq("user_id", conv.buyer_id).eq("conversation_id", conv.id).eq("type", "payment_request");
  check("buyer got a payment_request notification", n1.length === 1);

  const upd = await buyer.client.from("payment_requests").update({ status: "paid" }).eq("id", r.id).select();
  check("a buyer cannot mark a request paid directly", !!upd.error || upd.data?.length === 0, JSON.stringify(upd));
  if (stranger) {
    const s = await phone(stranger.email).catch(() => null);
    if (s) {
      const { data: peek } = await s.client.from("payment_requests").select("id").eq("id", r.id);
      check("a stranger cannot read the request", (peek ?? []).length === 0);
      const resp = await go(s.page, `/pay/${r.reference}`);
      check("a stranger gets HTTP 404 on the pay page", resp.status() === 404, String(resp.status()));
    }
  }

  // --- buyer pays with MockPay
  await go(buyer.page, `/messages/${conv.id}`);
  check("buyer sees a Pay R150 button", await buyer.page.evaluate(() => [...document.querySelectorAll("a")].some((a) => a.textContent.trim() === "Pay R150")));
  await go(buyer.page, `/pay/${r.reference}`);
  const txt = await buyer.page.evaluate(() => document.body.innerText);
  check("pay page shows the breakdown and a test-payment notice", txt.includes("R150") && txt.includes("R30") && txt.includes("Test payment"));
  const h = await buyer.page.$$eval("button", (bs) => bs.map((b) => b.getBoundingClientRect().height));
  check("pay buttons are 44px+", h.every((x) => x >= 44), JSON.stringify(h));
  await click(buyer.page, "Approve test payment"); await wait(3000);
  r = (await rows())[0];
  check("approving records paid via mockpay", r.status === "paid" && r.provider === "mockpay" && !!r.paid_at && r.provider_ref?.startsWith("MOCK-"), JSON.stringify(r));
  check("pay page now shows Paid", (await buyer.page.evaluate(() => document.body.innerText)).includes("Paid."));
  const { data: n2 } = await db.from("notifications").select("type").eq("user_id", sellerUser.id).eq("conversation_id", conv.id).eq("type", "payment_received");
  check("seller got a payment_received notification", n2.length === 1);
  const { data: ev } = await db.from("payment_events").select("type").eq("request_id", r.id);
  check("one 'paid' event is logged", ev.length === 1 && ev[0].type === "paid");

  // idempotent: pay again does nothing
  await go(buyer.page, `/pay/${r.reference}`);
  check("a paid request offers no pay button", !(await buyer.page.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Approve")))));

  // seller sees paid state
  await go(seller.page, `/messages/${conv.id}`);
  check("seller sees the Paid badge", (await seller.page.$eval("[data-payment-status=paid]", (e) => e.textContent)).includes("Paid"));

  // --- second request: cancel
  await click(seller.page, "Request payment"); await wait(300);
  await seller.page.type("#pay-item", "50");
  await click(seller.page, "Send request"); await wait(3000);
  const open = (await rows()).find((x) => x.status === "pending");
  check("a second request can be created after the first is paid", !!open);
  await go(seller.page, `/messages/${conv.id}`);
  await click(seller.page, "Cancel request"); await wait(2500);
  check("seller can cancel an open request", (await rows()).find((x) => x.id === open.id)?.status === "cancelled");

  // --- Paystack safeguards
  const res401 = await fetch(`${BASE}/api/paystack/webhook`, { method: "POST", body: JSON.stringify({ event: "charge.success", data: { reference: open.reference } }), headers: { "x-paystack-signature": "bad" } });
  check("webhook rejects a bad signature (401)", res401.status === 401);
  await db.from("payment_requests").update({ status: "pending" }).eq("id", open.id);
  const body = JSON.stringify({ event: "charge.success", data: { reference: open.reference } });
  const sig = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(body).digest("hex");
  const resOk = await fetch(`${BASE}/api/paystack/webhook`, { method: "POST", body, headers: { "x-paystack-signature": sig } });
  await wait(1500);
  check("signed webhook is accepted (200)", resOk.status === 200);
  check("webhook does NOT mark paid when Paystack says the charge never happened", (await rows()).find((x) => x.id === open.id)?.status === "pending");
  const cb = await fetch(`${BASE}/api/paystack/callback?reference=${open.reference}`, { redirect: "manual" });
  check("callback verifies with Paystack, stays pending, redirects to the pay page", [302, 303, 307].includes(cb.status) && (cb.headers.get("location") ?? "").includes(`/pay/${open.reference}`) && (await rows()).find((x) => x.id === open.id)?.status === "pending");
  const bad = await fetch(`${BASE}/api/paystack/callback?reference=nonsense`, { redirect: "manual" });
  check("callback ignores a malformed reference", [302, 303, 307].includes(bad.status) && (bad.headers.get("location") ?? "").includes("/messages"));

  // paystack provider: buyer is sent to hosted checkout
  await db.from("site_settings").update({ value: { provider: "paystack" } }).eq("key", "payment_provider");
  await go(buyer.page, `/pay/${open.reference}`);
  check("pay page offers Paystack when it is the provider", (await buyer.page.evaluate(() => document.body.innerText)).includes("Pay with Paystack"));
  await click(buyer.page, "Pay with Paystack");
  await buyer.page.waitForFunction(() => location.hostname.includes("paystack"), { timeout: 20000 }).catch(() => {});
  check("Pay with Paystack redirects to checkout.paystack.com", new URL(buyer.page.url()).hostname.includes("paystack"), buyer.page.url());
  const paystackRef = (await rows()).find((x) => x.id === open.id);
  check("MockPay approve is refused while Paystack is the provider", await (async () => {
    await db.from("payment_requests").update({ status: "pending" }).eq("id", open.id);
    await go(buyer.page, `/pay/${open.reference}`);
    return !(await buyer.page.evaluate(() => document.body.innerText)).includes("Approve test payment");
  })(), JSON.stringify(paystackRef));

  // --- flag off hides the Request button
  await db.from("feature_flags").update({ enabled: false }).eq("key", "payments");
  await db.from("site_settings").update({ value: { provider: "mockpay" } }).eq("key", "payment_provider");
  await go(seller.page, `/messages/${conv.id}`);
  check("with the payments flag off the Request button is gone", !(await seller.page.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Request payment"))));
} finally {
  await cleanup();
  await browser.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
