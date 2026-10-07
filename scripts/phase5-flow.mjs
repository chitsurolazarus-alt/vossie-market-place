// Phase 5 end-to-end flow at 360px in a real browser, with a separate session per person:
// role gating -> admin approves a seller -> seller sees approval -> buyers report a listing -> auto-hide -> admin restores,
// suspension, mentor view, Hub Growth, and POPIA (privacy page, export, delete account). Screenshots go to shots/phase5.
// Usage: node --env-file=.env.local scripts/phase5-flow.mjs   (server on BASE_URL, default http://localhost:3111)
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = process.env.SHOTS_DIR ?? "shots/phase5";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "Vossie-Demo-2026!";
fs.mkdirSync(OUT, { recursive: true });
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let pass = 0, fail = 0;
const check = (n, ok, x = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); };
const one = async (q) => { const { data, error } = await q; if (error) throw new Error(error.message); return data; };

// ---------- fixtures
const sellerBy = async (slug) => one(db.from("seller_profiles").select("id,user_id").eq("slug", slug).single());
const aishaS = await sellerBy("aishas-bakes");
const thandiS = await sellerBy("thandis-kitchen");
const aishaListing = await one(db.from("listings").select("id,title").eq("seller_id", aishaS.id).single());
const kota = await one(db.from("listings").select("id,title").eq("seller_id", thandiS.id).eq("title", "Chicken kota with atchar").single());
const users = (await db.auth.admin.listUsers({ perPage: 1000 })).data.users;
const uid = (email) => users.find((u) => u.email === email)?.id;
const ayanda = uid("20250109@vossie.net");
const reporters = ["20250202@vossie.net", "20250203@vossie.net"].map((e) => ({ email: e, id: uid(e) }));

async function resetState() {
  await db.from("seller_profiles").update({ status: "pending", verified: false, review_reason: null, reviewed_at: null, reviewed_by: null, approved_at: null, mentor_id: null }).eq("id", aishaS.id);
  await db.from("profiles").update({ role: "buyer" }).eq("id", aishaS.user_id);
  await db.from("reports").delete().eq("target_id", aishaListing.id);
  await db.from("listings").update({ hidden_by_moderation: false }).eq("id", aishaListing.id);
  await db.from("profiles").update({ suspended_until: null, suspension_reason: null }).eq("id", ayanda);
  await db.from("hub_rsvps").delete().eq("user_id", ayanda);
  await db.from("hub_bookings").delete().eq("user_id", thandiS.user_id);
  await db.from("hub_posts").delete().like("title", "ZZ flow%");
  await db.from("notifications").delete().in("user_id", [aishaS.user_id]);
}
await resetState();

// ---------- browser helpers
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const newCtx = () => (browser.createBrowserContext ?? browser.createIncognitoBrowserContext).call(browser);
async function phone(ctx, width = 360) {
  const page = await ctx.newPage();
  await page.setViewport({ width, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_ABORTED|net::|Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  page.on("pageerror", (e) => page.errors.push(String(e)));
  return page;
}
/** Sign a page in without the demo buttons: build the same chunked cookie @supabase/ssr writes. */
async function signIn(page, email) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  const key = `sb-${new globalThis.URL(URL_).hostname.split(".")[0]}-auth-token`;
  const value = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
  const parts = value.match(/.{1,3180}/g);
  await page.setCookie(...parts.map((v, i) => ({ name: parts.length === 1 ? key : `${key}.${i}`, value: v, url: BASE })));
  return data.user.id;
}
const shot = (p, name, full = false) => p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
const go = (p, path) => p.goto(BASE + path, { waitUntil: "networkidle0", timeout: 45000 });
const text = (p) => p.evaluate(() => document.body.innerText);
const waitText = (p, t, timeout = 15000) => p.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
const clickText = (p, sel, t) => p.$$eval(sel, (els, x) => { const el = els.find((e) => e.textContent.trim().includes(x)); if (!el) throw new Error("no element with text " + x); el.click(); }, t);
async function audit(p, name) {
  const r = await p.evaluate(() => {
    const vw = window.innerWidth;
    const small = [...document.querySelectorAll("a, button, input:not([type=hidden]), select, textarea, summary")].filter((el) => {
      const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (b.width === 0 || b.height === 0 || cs.visibility === "hidden" || el.className?.toString().includes("sr-only") || el.getAttribute("aria-hidden") === "true") return false;
      if (el.type === "checkbox" || el.type === "radio" || el.type === "file") return false;
      if (el.tagName === "A" && cs.display === "inline" && [...el.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 3)) return false;
      if (el.closest("pre, code")) return false;
      return b.height < 43.5 || b.width < 43.5;
    }).slice(0, 5).map((el) => `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 24)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
    return { vw, sw: document.documentElement.scrollWidth, small };
  });
  check(`${name}: no horizontal scroll at 360px`, r.sw <= r.vw + 1, `${r.sw} > ${r.vw}`);
  check(`${name}: tap targets >= 44px`, r.small.length === 0, r.small.join(" | "));
  check(`${name}: no console errors`, p.errors.length === 0, p.errors.slice(0, 2).join(" || ").slice(0, 200));
  p.errors.length = 0;
}
async function section(name, fn) {
  console.log(`\n--- ${name}`);
  try { await fn(); } catch (e) { fail++; console.log(`FAIL  ${name} aborted: ${e?.message ?? e}`); }
}

const anonP = await phone(await newCtx());
const buyerP = await phone(await newCtx());
const sellerP = await phone(await newCtx());
const adminP = await phone(await newCtx());
const aishaP = await phone(await newCtx());
const mentorP = await phone(await newCtx());
let thandiId;

try {
  // ============================================================ A. role gating
  await section("A. who can reach /admin and /mentor", async () => {
    await anonP.goto(`${BASE}/admin`, { waitUntil: "networkidle0" });
    check("signed out: /admin sends you to sign in", new globalThis.URL(anonP.url()).pathname === "/login", anonP.url());
    await signIn(buyerP, "20250109@vossie.net");
    thandiId = await signIn(sellerP, "20250101@vossie.net");
    for (const [who, p] of [["a buyer", buyerP], ["a seller", sellerP]]) {
      for (const path of ["/admin", "/admin/reports", "/admin/manage", "/admin/audit", "/mentor"]) {
        const r = await p.goto(BASE + path, { waitUntil: "networkidle0" });
        check(`${who} cannot open ${path} (404)`, r.status() === 404, `status ${r.status()}`);
      }
      const csv = await p.evaluate(async () => (await fetch("/mentor/export")).status);
      check(`${who} cannot download the mentor CSV`, csv === 404, `status ${csv}`);
    }
    await go(buyerP, "/account");
    check("a buyer's account page shows no admin or mentor links", !/Admin panel|Mentor view/.test(await text(buyerP)));
    const anonExport = await anonP.evaluate(async () => (await fetch("/settings/privacy/export")).status);
    check("the data export needs a signed-in user", anonExport === 401, `status ${anonExport}`);
  });

  // ============================================================ B. admin approves a seller; seller sees it
  await section("B. admin approves, seller sees the approval", async () => {
    await signIn(adminP, "admin.demo@eduvos.com");
    await go(adminP, "/admin");
    check("the admin dashboard shows the queue and counts", /Sellers waiting/.test(await text(adminP)) && /Open reports/.test(await text(adminP)) && /Active users/.test(await text(adminP)));
    await shot(adminP, "01-admin-dashboard", true); await audit(adminP, "admin dashboard");
    await go(adminP, "/admin/sellers");
    check("Aisha's Bakes is waiting for approval", (await text(adminP)).includes("Aisha's Bakes"));
    await adminP.$$eval("a", (as) => as.find((a) => a.textContent.includes("Aisha's Bakes")).click());
    await adminP.waitForFunction(() => location.pathname.startsWith("/admin/sellers/") && location.pathname.length > 20, { timeout: 15000 });
    await waitText(adminP, "Decision");
    await shot(adminP, "02-admin-seller-review", true); await audit(adminP, "seller review");
    await adminP.type("#reason", "x");
    await clickText(adminP, "button", "Reject");
    await waitText(adminP, "at least 3 characters");
    check("rejecting without a proper reason is refused", true);
    await adminP.$eval("#reason", (t) => { t.value = ""; });
    await clickText(adminP, "button", "Approve");
    await waitText(adminP, "isn't waiting for review");
    const s = await one(db.from("seller_profiles").select("status").eq("id", aishaS.id).single());
    check("approving makes the seller live", s.status === "approved");

    await signIn(aishaP, "20250110@vossie.net");
    await go(aishaP, "/sell");
    await aishaP.$eval("button[aria-label^='Notifications']", (b) => b.click());
    await aishaP.waitForSelector("[role=region][aria-label='Notifications'] a", { timeout: 10000 });
    check("the seller's bell shows the approval", /approved/i.test(await text(aishaP)));
    await shot(aishaP, "03-seller-sees-approval"); await audit(aishaP, "seller bell");
    const pub = await anonP.goto(`${BASE}/s/aishas-bakes`, { waitUntil: "networkidle0" });
    check("the approved profile is public", pub.status() === 200 && (await text(anonP)).includes("Aisha's Bakes"));
    const lst = await anonP.goto(`${BASE}/l/${aishaListing.id}`, { waitUntil: "networkidle0" });
    check("her listing is public", lst.status() === 200);
  });

  // ============================================================ C. reports and auto-hide
  await section("C. buyers report a listing; it auto-hides at 3", async () => {
    await go(buyerP, `/l/${aishaListing.id}`);
    await clickText(buyerP, "button", "Report this listing");
    await buyerP.waitForSelector("[role=dialog][aria-label^='Report']");
    await shot(buyerP, "04-report-dialog"); await audit(buyerP, "report dialog");
    await clickText(buyerP, "[role=dialog] label", "Scam or fraud");
    await buyerP.type("[role=dialog] textarea", "Asked for money before showing the item.");
    await clickText(buyerP, "[role=dialog] button[type=submit]", "Send report");
    await waitText(buyerP, "Thanks for telling us");
    check("a buyer can report a listing in two taps", true);
    await shot(buyerP, "05-report-sent");
    let l = await one(db.from("listings").select("hidden_by_moderation").eq("id", aishaListing.id).single());
    check("1 report: the listing stays visible", l.hidden_by_moderation === false);
    await buyerP.reload({ waitUntil: "networkidle0" });
    await clickText(buyerP, "button", "Report this listing");
    await buyerP.waitForSelector("[role=dialog][aria-label^='Report']");
    await clickText(buyerP, "[role=dialog] label", "Scam or fraud");
    await clickText(buyerP, "[role=dialog] button[type=submit]", "Send report");
    await waitText(buyerP, "already reported");
    check("reporting the same thing twice is refused politely", true);

    for (const r of reporters) {
      const c = createClient(URL_, ANON, { auth: { persistSession: false } });
      await c.auth.signInWithPassword({ email: r.email, password: PASSWORD });
      const ins = await c.from("reports").insert({ reporter_id: r.id, target_type: "listing", target_id: aishaListing.id, reason: "fake_profile" });
      if (ins.error) throw new Error("reporter insert failed: " + ins.error.message);
    }
    l = await one(db.from("listings").select("hidden_by_moderation,moderation_hidden_reason").eq("id", aishaListing.id).single());
    check("3 unique reporters auto-hide the listing", l.hidden_by_moderation && l.moderation_hidden_reason === "auto");
    const gone = await anonP.goto(`${BASE}/l/${aishaListing.id}`, { waitUntil: "networkidle0" });
    check("the hidden listing is gone from public view (404)", gone.status() === 404, `status ${gone.status()}`);
    await go(aishaP, "/sell/listings");
    check("the seller sees 'Under review' on their listing", (await text(aishaP)).includes("Under review by the Hub team"));
    await shot(aishaP, "06-seller-listing-under-review", true);
    await aishaP.$eval("button[aria-label^='Notifications']", (b) => b.click());
    await aishaP.waitForSelector("[role=region][aria-label='Notifications'] a", { timeout: 10000 });
    const bell = await text(aishaP);
    check("the seller's notification says 'under review' and names nobody", /Your listing is under review/.test(bell) && !/Ayanda|Siyabonga|Palesa|Dube|Nkosi|reported by/i.test(bell));
    await shot(aishaP, "07-seller-notified-under-review");
  });

  // ============================================================ D. admin restores
  await section("D. admin reviews and restores", async () => {
    await go(adminP, "/admin/reports");
    check("the open reports queue lists the reported listing", (await text(adminP)).includes("Birthday cupcake box"));
    await shot(adminP, "08-admin-reports-queue", true); await audit(adminP, "reports queue");
    await adminP.$$eval("a", (as) => as.find((a) => a.textContent.includes("Birthday cupcake box")).click());
    await adminP.waitForFunction(() => /^\/admin\/reports\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 15000 });
    await waitText(adminP, "Take action");
    const detail = await text(adminP);
    check("the report detail shows the listing, reasons and reporters", /Reports on this listing \(3\)/.test(detail) && /Hidden \(auto\)/.test(detail));
    await shot(adminP, "09-admin-report-detail", true); await audit(adminP, "report detail");
    await clickText(adminP, "button", "Dismiss");
    await adminP.waitForSelector("[role=dialog]");
    await shot(adminP, "10-admin-dismiss-dialog"); await audit(adminP, "dismiss dialog");
    await adminP.type("#note", "Checked the item, all fine.");
    await clickText(adminP, "[role=dialog] button[type=submit]", "Confirm");
    await waitText(adminP, "Resolution");
    check("the admin dismisses the report", true);
    const l = await one(db.from("listings").select("hidden_by_moderation").eq("id", aishaListing.id).single());
    check("the auto-hidden listing is restored", l.hidden_by_moderation === false);
    const back = await anonP.goto(`${BASE}/l/${aishaListing.id}`, { waitUntil: "networkidle0" });
    check("the listing is public again", back.status() === 200);
    const upd = await one(db.from("notifications").select("user_id").eq("type", "report_update").in("user_id", [ayanda, ...reporters.map((r) => r.id)]));
    check("all three reporters were told it was resolved", new Set(upd.map((n) => n.user_id)).size >= 3);

    await go(adminP, "/admin/audit");
    const a = await text(adminP);
    check("the audit log shows the approval, auto-hide and dismissal", /seller\.approve/.test(a) && /listing\.auto_hide/.test(a) && /report\.dismiss/.test(a));
    await shot(adminP, "11-admin-audit-log", true); await audit(adminP, "audit log");
    await go(adminP, "/admin/manage?s=trust_tiers");
    await clickText(adminP, "summary", "Top Hustler");
    check("trust tier thresholds are editable in Manage", /Top Hustler/.test(await text(adminP)) && /Min confirmed sales/.test(await text(adminP)) && /Min response rate/.test(await text(adminP)));
    await shot(adminP, "12-admin-manage-tiers", true); await audit(adminP, "manage tiers");
    await go(adminP, "/admin/manage?s=settings");
    check("Manage > Settings holds the auto-hide threshold and Information Officer", /auto-hide a listing after/i.test(await text(adminP)) && /Information Officer/.test(await text(adminP)));
    await go(adminP, "/admin/users?q=ayanda");
    check("admins can search users", (await text(adminP)).includes("Ayanda"));
    await shot(adminP, "13-admin-users"); await audit(adminP, "admin users");
    await go(adminP, "/admin/listings?q=cupcake");
    check("admins can search listings", (await text(adminP)).includes("Birthday cupcake box"));
    await audit(adminP, "admin listings");
  });

  // ============================================================ E. a suspended user can browse but not message
  await section("E. suspension", async () => {
    await db.from("profiles").update({ suspended_until: new Date(Date.now() + 864e5).toISOString(), suspension_reason: "Flow test" }).eq("id", ayanda);
    await go(buyerP, `/l/${kota.id}`);
    check("a suspended user sees a clear notice", /Your account is suspended/.test(await text(buyerP)));
    await shot(buyerP, "14-suspended-notice"); await audit(buyerP, "suspended notice");
    await clickText(buyerP, "button", "Message on HustleHub");
    await buyerP.waitForSelector("[role=dialog][aria-label^='Message']");
    await clickText(buyerP, "[role=dialog] button[type=submit]", "Send message");
    await waitText(buyerP, "account is suspended");
    check("a suspended user cannot send a message and is told why", true);
    await shot(buyerP, "15-suspended-cannot-message");
    await db.from("profiles").update({ suspended_until: null, suspension_reason: null }).eq("id", ayanda);
    await go(buyerP, `/l/${kota.id}`);
    check("the notice disappears when the suspension ends", !/Your account is suspended/.test(await text(buyerP)));
  });

  // ============================================================ F. mentor view
  await section("F. mentor view", async () => {
    await signIn(mentorP, "mentor.demo@eduvos.com");
    await go(mentorP, "/mentor");
    const m = await text(mentorP);
    check("the mentor sees their sellers with activity numbers", /Mentor view/.test(m) && /Response rate/.test(m) && /Confirmed sales/.test(m));
    check("a seller with no enquiries for 14 days is flagged 'may need support'", /Lwazi Cuts/.test(m) && /No enquiries in 14 days/.test(m));
    check("the mentor page says message content is never shown", /never message content/i.test(m));
    await shot(mentorP, "16-mentor-dashboard", true); await audit(mentorP, "mentor dashboard");
    const csv = await mentorP.evaluate(async () => { const r = await fetch("/mentor/export"); return { status: r.status, type: r.headers.get("content-type"), body: await r.text() }; });
    check("the mentor can export a CSV of their sellers", csv.status === 200 && /text\/csv/.test(csv.type) && csv.body.includes("Seller,Campus,Trust tier") && csv.body.split("\r\n").length >= 9, JSON.stringify({ s: csv.status, t: csv.type }));
    check("the CSV holds stats only (no message text)", !/Hi! Is .* still available/.test(csv.body));
    await mentorP.$$eval("a", (as) => as.find((a) => a.textContent.includes("Lwazi Cuts")).click());
    await mentorP.waitForFunction(() => /^\/mentor\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 15000 });
    await waitText(mentorP, "Private notes");
    await mentorP.type("#note", "Follow up: WhatsApp leads are not turning into chats.");
    await clickText(mentorP, "button", "Add note");
    await waitText(mentorP, "WhatsApp leads are not turning");
    await clickText(mentorP, "button", "Log a check-in");
    await waitText(mentorP, "No check-ins logged yet").catch(() => {});
    await mentorP.waitForFunction(() => !document.body.innerText.includes("No check-ins logged yet"), { timeout: 10000 });
    check("a mentor can add a private note and log a check-in", true);
    await shot(mentorP, "17-mentor-seller", true); await audit(mentorP, "mentor seller");
    const adminTry = await mentorP.goto(`${BASE}/admin`, { waitUntil: "networkidle0" });
    check("a mentor cannot open /admin (404)", adminTry.status() === 404, `status ${adminTry.status()}`);
    const conv = await one(db.from("conversations").select("id").limit(1).single());
    const thread = await mentorP.goto(`${BASE}/messages/${conv.id}`, { waitUntil: "networkidle0" });
    check("a mentor cannot open a message thread (404)", thread.status() === 404, `status ${thread.status()}`);
    await db.from("mentor_notes").delete().like("body", "Follow up: WhatsApp leads%");
    await db.from("mentor_checkins").delete().is("note", null);
  });

  // ============================================================ G. Hub Growth
  await section("G. Hub Growth corner", async () => {
    await go(buyerP, "/growth");
    const g = await text(buyerP);
    check("the Hub Growth corner lists a tip, an event and office hours", /Pitch Night/.test(g) && /Price your hustle/.test(g) && /office hours/i.test(g));
    await shot(buyerP, "18-growth-list", true); await audit(buyerP, "growth list");
    await buyerP.$$eval("a", (as) => as.find((a) => a.textContent.includes("Pitch Night")).click());
    await buyerP.waitForFunction(() => /^\/growth\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 15000 });
    await waitText(buyerP, "RSVP");
    await clickText(buyerP, "button", "RSVP: I'm going");
    await waitText(buyerP, "You're going");
    await buyerP.reload({ waitUntil: "networkidle0" });
    check("an RSVP is saved and counted", /1 going/.test(await text(buyerP)));
    await shot(buyerP, "19-growth-event-rsvp", true); await audit(buyerP, "growth event");

    await go(sellerP, "/growth?k=office_hours");
    await sellerP.$$eval("a", (as) => as.find((a) => a.textContent.includes("office hours")).click());
    await sellerP.waitForFunction(() => /^\/growth\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 15000 });
    await waitText(sellerP, "Book a slot");
    await sellerP.type("#booking-msg", "Help me price my kotas. Thursday 3pm?");
    await clickText(sellerP, "button", "Request a slot");
    await waitText(sellerP, "Request sent");
    check("a seller can request an office-hours slot", true);
    await shot(sellerP, "20-growth-office-hours", true);

    await go(mentorP, "/growth/manage");
    check("the mentor sees the request", /Help me price my kotas/.test(await text(mentorP)));
    await shot(mentorP, "21-growth-manage", true); await audit(mentorP, "growth manage");
    await mentorP.type("input[id^='note-']", "Thursday 15:00, Block C");
    await clickText(mentorP, "button", "Confirm");
    await mentorP.waitForFunction(() => document.body.innerText.includes("No requests waiting"), { timeout: 15000 });
    const b = await one(db.from("hub_bookings").select("status,host_note").eq("user_id", thandiId));
    check("the mentor confirms and the booking is updated", b[0]?.status === "confirmed" && b[0].host_note?.includes("Block C"));
    const n = await one(db.from("notifications").select("title").eq("user_id", thandiId).eq("type", "hub_booking"));
    check("the seller is notified of the confirmation", n.some((x) => /confirmed/.test(x.title)));

    await go(mentorP, "/growth/new");
    await mentorP.type("#title", "ZZ flow tip");
    await mentorP.type("#body", "## Hello\n**Bold move** and a [link](https://example.com)\n- one\n- two");
    await shot(mentorP, "22-growth-new-post", true); await audit(mentorP, "growth new post");
    await clickText(mentorP, "button[type=submit]", "Publish");
    await mentorP.waitForFunction(() => /^\/growth\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 20000 });
    await waitText(mentorP, "ZZ flow tip");
    const html = await mentorP.content();
    check("a mentor can publish a post; markdown renders safely (no raw HTML)", html.includes("<strong>Bold move</strong>") && !html.includes("&lt;script") && /<h2[^>]*>Hello<\/h2>/.test(html));
    await go(mentorP, "/growth/new");
    await mentorP.type("#title", "ZZ flow xss");
    await mentorP.type("#body", "<script>window.__x=1</script><img src=x onerror=window.__x=1>");
    await clickText(mentorP, "button[type=submit]", "Publish");
    await mentorP.waitForFunction(() => /^\/growth\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 20000 });
    check("pasted HTML is shown as text, never executed", (await mentorP.evaluate(() => window.__x)) === undefined && (await text(mentorP)).includes("<script>"));
    await db.from("hub_posts").delete().like("title", "ZZ flow%");
  });

  // ============================================================ H. POPIA
  await section("H. privacy policy, export and delete", async () => {
    await go(anonP, "/privacy");
    const p = await text(anonP);
    check("the privacy policy covers collection, sharing, retention, rights and the Information Officer", /What we collect/.test(p) && /Who can see it/.test(p) && /How long we keep it/.test(p) && /Your rights/.test(p) && /Information Officer/.test(p));
    await shot(anonP, "23-privacy-policy", true); await audit(anonP, "privacy policy");
    await go(buyerP, "/settings/privacy");
    const s = await text(buyerP);
    check("privacy settings show the consent record, download and delete", /Your consent/.test(s) && /You accepted the privacy policy on/.test(s) && /Download my data/.test(s) && /Delete my account/.test(s));
    await shot(buyerP, "24-privacy-settings", true); await audit(buyerP, "privacy settings");
    const exp = await buyerP.evaluate(async () => { const r = await fetch("/settings/privacy/export"); return { status: r.status, disp: r.headers.get("content-disposition"), body: await r.text() }; });
    const data = JSON.parse(exp.body);
    check("the export is a JSON download", exp.status === 200 && /attachment/.test(exp.disp ?? ""));
    check("the export holds the user's profile, messages, enquiries and reports", data.account?.email === "20250109@vossie.net" && Array.isArray(data.messages_i_sent) && Array.isArray(data.enquiries_as_buyer) && Array.isArray(data.reports_i_made) && data.consent === undefined && !!data.account.popia_consent_at);
    check("the export never contains another person's messages", data.messages_i_sent.every((m) => typeof m.body === "string") && !JSON.stringify(data).includes("20250101@vossie.net"));
    const sellerExp = await sellerP.evaluate(async () => (await (await fetch("/settings/privacy/export")).json()));
    check("a seller's export includes their WhatsApp number (their own data)", JSON.stringify(sellerExp.seller_profile).includes("+27710000101"));

    // delete a throwaway account through the UI
    const email = `zz.flow.${Date.now()}@vossie.net`;
    const made = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { popia_consent: "true", display_name: "Zola Flowtest" } });
    const zid = made.data.user.id;
    const zc = createClient(URL_, ANON, { auth: { persistSession: false } }); await zc.auth.signInWithPassword({ email, password: PASSWORD });
    const cv = await zc.from("conversations").insert({ buyer_id: zid, seller_id: thandiS.id, listing_id: kota.id }).select("id").single();
    await zc.from("messages").insert({ conversation_id: cv.data.id, sender_id: zid, body: "Hello from a soon-to-be-deleted user" });
    const delP = await phone(await newCtx());
    await signIn(delP, email);
    await go(delP, "/settings/privacy");
    const btn = await delP.$("form button[type=submit]");
    check("the delete button is disabled until DELETE is typed", await btn.evaluate((b) => b.disabled));
    await delP.type("#del", "delete");
    check("lower-case 'delete' does not unlock it", await btn.evaluate((b) => b.disabled));
    await delP.$eval("#del", (i) => { i.value = ""; });
    await delP.type("#del", "DELETE");
    await shot(delP, "25-delete-confirm"); await audit(delP, "delete account");
    await clickText(delP, "button", "Delete my account");
    await delP.waitForFunction(() => location.pathname === "/goodbye", { timeout: 25000 });
    check("deleting lands on a goodbye page", /Your account has been deleted/.test(await text(delP)));
    await shot(delP, "26-goodbye");
    const prof = await one(db.from("profiles").select("display_name,email,deleted_at").eq("id", zid).single());
    check("personal details are gone immediately", prof.display_name === "Deleted user" && prof.email === null && !!prof.deleted_at);
    const cv2 = await one(db.from("conversations").select("buyer_name").eq("id", cv.data.id).single());
    check("the seller still sees the conversation, anonymised as 'Deleted user'", cv2.buyer_name === "Deleted user");
    const relog = await createClient(URL_, ANON, { auth: { persistSession: false } }).auth.signInWithPassword({ email, password: PASSWORD });
    check("the deleted user can no longer sign in", !!relog.error);
    await db.from("conversations").delete().eq("id", cv.data.id);
    await db.from("profiles").update({ deleted_at: null }).eq("id", zid);
    await db.auth.admin.deleteUser(zid);
  });
} catch (e) {
  fail++; console.log("FAIL  flow aborted: " + (e?.message ?? e));
} finally {
  await resetState();
  await browser.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
