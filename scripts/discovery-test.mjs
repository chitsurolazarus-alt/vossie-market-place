// Phase 3 checks: search visibility, filters, rotation job (eligibility, no-repeat, override, fairness, new-seller
// boost), view tracking, saved/follow RLS, low-data, share/OG, real 404s.
// Needs a running server (default http://localhost:3111) and DATABASE_URL for the rotation tests.
// Usage: DATABASE_URL=... node --env-file=.env.local scripts/discovery-test.mjs
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const q = async (sql, params) => (await db.query(sql, params)).rows;

let pass = 0, fail = 0;
const check = (n, ok, x = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); };
const PASSWORD = "Vossie-Demo-2026!";
async function login(email) {
  const jar = new Map();
  const sb = createServerClient(url, anonKey, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return { sb, uid: data.user.id, cookie: () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ") };
}
const search = async (client, args = {}) => {
  const { data, error } = await client.rpc("search_listings", { p_limit: 100, ...args });
  if (error) throw error;
  return data ?? [];
};
const titlesOf = async (rows) => {
  if (!rows.length) return [];
  const { data } = await admin.from("listings").select("id,title").in("id", rows.map((r) => r.listing_id));
  const m = new Map(data.map((d) => [d.id, d.title]));
  return rows.map((r) => m.get(r.listing_id));
};

// ------------------------------------------------------------------ search visibility
const { data: seller } = await admin.from("seller_profiles").select("id,user_id,campus_id").eq("slug", "lwazi-cuts").single();
const { data: lst } = await admin.from("listings").select("id,title").eq("seller_id", seller.id);
const target = lst[0];
const owner = await login("20250102@vossie.net");
const ids = async (client) => (await search(client)).map((r) => r.listing_id);

check("anon search returns all seeded listings", (await ids(anon)).length >= 32);
await admin.from("seller_profiles").update({ status: "pending" }).eq("id", seller.id);
check("pending seller's listings are hidden from anon search", !(await ids(anon)).includes(target.id));
check("pending seller's listings are hidden from search even for the owner", !(await ids(owner.sb)).includes(target.id));
await admin.from("seller_profiles").update({ status: "approved" }).eq("id", seller.id);
check("approved again: listing visible", (await ids(anon)).includes(target.id));

await admin.from("listings").update({ hidden_by_moderation: true }).eq("id", target.id);
check("moderator-hidden listing excluded from search", !(await ids(anon)).includes(target.id));
await admin.from("listings").update({ hidden_by_moderation: false }).eq("id", target.id);

await admin.from("listings").update({ deleted_at: new Date().toISOString() }).eq("id", target.id);
check("soft-deleted listing excluded from search", !(await ids(anon)).includes(target.id));
await admin.from("listings").update({ deleted_at: null }).eq("id", target.id);

await admin.from("listings").update({ availability: "paused" }).eq("id", target.id);
check("paused listing excluded from search (even with available_only off)", !(await ids(anon)).includes(target.id)
  && !(await search(anon, { p_available_only: false })).map((r) => r.listing_id).includes(target.id));
await admin.from("listings").update({ availability: "sold_out" }).eq("id", target.id);
check("sold-out listing hidden when 'available only' is on", !(await ids(anon)).includes(target.id));
check("sold-out listing shown when 'available only' is off", (await search(anon, { p_available_only: false })).map((r) => r.listing_id).includes(target.id));
await admin.from("listings").update({ availability: "available" }).eq("id", target.id);

const { data: direct } = await anon.from("browse_listings").select("id").limit(1000);
check("browse_listings view itself only exposes public rows", direct.length === (await ids(anon)).length);
await admin.from("seller_profiles").update({ status: "suspended" }).eq("id", seller.id);
const { data: viewRows } = await anon.from("browse_listings").select("id").eq("id", target.id);
check("view (not just the function) hides a suspended seller's listings", viewRows.length === 0);
await admin.from("seller_profiles").update({ status: "approved" }).eq("id", seller.id);

// ------------------------------------------------------------------ relevance, typos, filters, paging
let t = await titlesOf(await search(anon, { p_q: "braids", p_sort: "relevance" }));
check("title matches found and ranked (braids)", t.length >= 2 && /braids/i.test(t[0]), t.join(" | "));
t = await titlesOf(await search(anon, { p_q: "airtime" }));
check("tag/description match found (airtime)", t.some((x) => /airtime/i.test(x)));
t = await titlesOf(await search(anon, { p_q: "kotta" }));
check("typo tolerance: 'kotta' finds the kota", t.some((x) => /kota/i.test(x)), t.join(" | "));
t = await titlesOf(await search(anon, { p_q: "hair cut" }));
check("typo tolerance: 'hair cut' finds haircut listings", t.some((x) => /haircut/i.test(x)));
check("gibberish returns no results", (await search(anon, { p_q: "zzqxv" })).length === 0);

const cat = (await admin.from("categories").select("id").eq("slug", "food").single()).data.id;
check("category filter", (await search(anon, { p_category: cat })).length === 4);
const durban = (await admin.from("campuses").select("id").eq("slug", "durban").single()).data.id;
const dRows = await search(anon, { p_campus: durban });
check("campus filter returns only that campus", dRows.length === 16, `got ${dRows.length}`);
const cheap = await admin.from("listings").select("price_zar").in("id", (await search(anon, { p_min: 100, p_max: 300 })).map((r) => r.listing_id));
check("price range filter (R100-R300)", cheap.data.length > 0 && cheap.data.every((r) => r.price_zar >= 100 && r.price_zar <= 300));
const swapModes = await admin.from("listings").select("pricing_mode").in("id", (await search(anon, { p_mode: "swap" })).map((r) => r.listing_id));
check("payment filter 'swap' = swap or both only", swapModes.data.length > 0 && swapModes.data.every((r) => r.pricing_mode !== "cash"));
const bothModes = await admin.from("listings").select("pricing_mode").in("id", (await search(anon, { p_mode: "both" })).map((r) => r.listing_id));
check("payment filter 'both' = both only", bothModes.data.length > 0 && bothModes.data.every((r) => r.pricing_mode === "both"));
const svc = await admin.from("listings").select("kind").in("id", (await search(anon, { p_kind: "service" })).map((r) => r.listing_id));
check("type filter 'service'", svc.data.length > 0 && svc.data.every((r) => r.kind === "service"));
const asc = await admin.from("listings").select("id,price_zar").in("id", (await search(anon, { p_sort: "price_asc" })).map((r) => r.listing_id));
const ascOrder = (await search(anon, { p_sort: "price_asc" })).map((r) => asc.data.find((a) => a.id === r.listing_id).price_zar).filter((p) => p !== null);
check("sort price low to high", ascOrder.every((p, i) => i === 0 || p >= ascOrder[i - 1]));
const p1 = await search(anon, { p_limit: 10, p_offset: 0 }), p2 = await search(anon, { p_limit: 10, p_offset: 10 });
check("pagination: pages don't overlap and total is stable", p1.length === 10 && p2.length === 10 && !p2.some((r) => p1.find((x) => x.listing_id === r.listing_id)) && p1[0].total_count === p2[0].total_count);

// ------------------------------------------------------------------ Featured rotation
const day = (n) => new Date(Date.UTC(2100, 0, 1 + n)).toISOString().slice(0, 10);
const clean = async () => {
  await q("delete from public.featured_slots where slot_date >= '2100-01-01'");
  await q("delete from public.listing_views where view_date >= '2099-01-01'");
};
await clean();

const midrand = (await admin.from("campuses").select("id").eq("slug", "midrand").single()).data.id;
await q("select private.rotate_featured(4, $1::date)", [day(0)]);
let rows = await q("select f.campus_id, f.seller_id, sp.status from public.featured_slots f join public.seller_profiles sp on sp.id = f.seller_id where slot_date = $1", [day(0)]);
check("rotation fills 4 slots per campus", rows.filter((r) => r.campus_id === midrand).length === 4 && rows.filter((r) => r.campus_id === durban).length === 4);
check("only approved sellers are featured", rows.every((r) => r.status === "approved"));
check("no seller is featured twice on one day", new Set(rows.map((r) => r.seller_id)).size === rows.length);
await q("select private.rotate_featured(4, $1::date)", [day(0)]);
check("rotation is idempotent (re-run keeps 4 per campus)", (await q("select count(*)::int c from public.featured_slots where slot_date=$1 and campus_id=$2", [day(0), midrand]))[0].c === 4);

await clean();
await q("select private.rotate_featured(2, $1::date)", [day(0)]);
const first = (await q("select seller_id from public.featured_slots where slot_date=$1 and campus_id=$2", [day(0), midrand])).map((r) => r.seller_id);
await q("select private.rotate_featured(2, $1::date)", [day(1)]);
const second = (await q("select seller_id from public.featured_slots where slot_date=$1 and campus_id=$2", [day(1), midrand])).map((r) => r.seller_id);
check("no repeats within 7 days when others are available", second.length === 2 && !second.some((s) => first.includes(s)), `${first} / ${second}`);
await q("select private.rotate_featured(4, $1::date)", [day(2)]);
check("fallback: if too few eligible sellers, recent ones fill the gap", (await q("select count(*)::int c from public.featured_slots where slot_date=$1 and campus_id=$2", [day(2), midrand]))[0].c === 4);

await clean();
const someSeller = (await q("select id from public.seller_profiles where campus_id=$1 and status='approved' limit 1", [midrand]))[0].id;
await q("insert into public.featured_slots (seller_id, campus_id, slot_date, position, is_override) values ($1,$2,$3,1,true)", [someSeller, midrand, day(0)]);
await q("select private.rotate_featured(4, $1::date)", [day(0)]);
rows = await q("select seller_id, is_override from public.featured_slots where slot_date=$1 and campus_id=$2", [day(0), midrand]);
check("admin override slot is kept and counted", rows.length === 4 && rows.filter((r) => r.is_override).length === 1 && rows.filter((r) => r.seller_id === someSeller).length === 1);

await q("update public.seller_profiles set status='pending' where campus_id=$1", [midrand]);
await clean();
await q("select private.rotate_featured(4, $1::date)", [day(0)]);
check("campus with no approved sellers gets no featured slots", (await q("select count(*)::int c from public.featured_slots where slot_date=$1 and campus_id=$2", [day(0), midrand]))[0].c === 0);
await q("update public.seller_profiles set status='approved' where campus_id=$1", [midrand]);

// Fairness: heavy-view seller vs. others (1 slot per run, 120 runs on dates 10 days apart)
await clean();
const mSellers = (await q("select id from public.seller_profiles where campus_id=$1 and status='approved' order by id", [midrand])).map((r) => r.id);
const heavy = mSellers[0];
const RUNS = 120;
let heavyWins = 0;
for (let i = 0; i < RUNS; i++) {
  const d = new Date(Date.UTC(2100, 0, 1 + i * 10)).toISOString().slice(0, 10);
  await q(`insert into public.listing_views (listing_id, anon_hash, view_date)
           select l.id, 'fair-' || g, ($1::date - 1) from public.listings l, generate_series(1, 50) g
           where l.seller_id = $2 and l.availability='available' limit 50`, [d, heavy]);
  await q("select private.rotate_featured(1, $1::date)", [d]);
  const r = await q("select seller_id from public.featured_slots where slot_date=$1 and campus_id=$2", [d, midrand]);
  if (r[0]?.seller_id === heavy) heavyWins++;
}
check(`fairness: seller with many views is featured less than uniform (${heavyWins}/${RUNS}, uniform would be ~${RUNS / 4})`, heavyWins < RUNS / 8, `wins ${heavyWins}`);
await clean();

// New-seller boost (weight x2 within 14 days of approval): expected share 40% vs 25%
const boosted = mSellers[1];
let boostWins = 0; const BRUNS = 300;
for (let i = 0; i < BRUNS; i++) {
  const d = new Date(Date.UTC(2100, 0, 1 + i * 10)).toISOString().slice(0, 10);
  await q("update public.seller_profiles set approved_at = $1::timestamptz - interval '3 days' where id=$2", [d, boosted]);
  await q("select private.rotate_featured(1, $1::date)", [d]);
  const r = await q("select seller_id from public.featured_slots where slot_date=$1 and campus_id=$2", [d, midrand]);
  if (r[0]?.seller_id === boosted) boostWins++;
}
await q("update public.seller_profiles set approved_at = now() where id=$1", [boosted]);
check(`new-seller boost: newly approved seller featured more than uniform (${boostWins}/${BRUNS}, uniform ~${BRUNS / 4}, boosted ~${Math.round(BRUNS * 0.4)})`, boostWins / BRUNS > 0.325, `share ${(boostWins / BRUNS).toFixed(3)}`);
await clean();
check("pg_cron job is scheduled daily", (await q("select 1 from cron.job where jobname='featured-daily' and schedule='5 0 * * *'")).length === 1);

// ------------------------------------------------------------------ view tracking (over HTTP)
const { data: vl } = await admin.from("listings").select("id,seller_id").eq("seller_id", seller.id).limit(1).single();
const buyer = await login("20250109@vossie.net");
const viewCount = async (where, params = []) => (await q(`select count(*)::int c from public.listing_views where listing_id=$1 and view_date=current_date ${where}`, [vl.id, ...params]))[0].c;
await q("delete from public.listing_views where listing_id=$1", [vl.id]);
const hit = (cookie) => fetch(`${BASE}/l/${vl.id}`, { headers: { cookie } });
let r = await hit("vossie_vid=test-visitor-1"); await r.text();
await new Promise((res) => setTimeout(res, 1500));
check("anonymous view is recorded once", (await viewCount("and anon_hash is not null")) === 1);
await (await hit("vossie_vid=test-visitor-1")).text(); await new Promise((res) => setTimeout(res, 1000));
check("same visitor, same day: still one row", (await viewCount("and anon_hash is not null")) === 1);
await (await hit("vossie_vid=test-visitor-2")).text(); await new Promise((res) => setTimeout(res, 1000));
check("different visitor adds a row", (await viewCount("and anon_hash is not null")) === 2);
const rows2 = await q("select anon_hash from public.listing_views where listing_id=$1", [vl.id]);
check("anonymous ids are stored hashed, never the raw cookie", rows2.every((x) => !x.anon_hash.includes("test-visitor") && x.anon_hash.length === 32));
await (await hit(buyer.cookie())).text(); await new Promise((res) => setTimeout(res, 1000));
check("signed-in view recorded against the user", (await viewCount("and viewer_id = $2", [buyer.uid])) === 1);
await (await hit(`${owner.cookie()}; vossie_vid=owner-visit`)).text(); await new Promise((res) => setTimeout(res, 1000));
check("seller's own views are excluded", (await viewCount("and viewer_id = $2", [owner.uid])) === 0 && (await viewCount("and anon_hash is not null")) === 2);
const cols = await q("select column_name from information_schema.columns where table_name='listing_views'");
check("no IP address column exists on listing_views", !cols.some((c) => /ip/i.test(c.column_name.replace("viewer_key", ""))));
await q("delete from public.listing_views where listing_id=$1", [vl.id]);

// ------------------------------------------------------------------ saved / follow (RLS as action would)
const sv = await buyer.sb.from("saved_listings").upsert({ user_id: buyer.uid, listing_id: vl.id }, { onConflict: "user_id,listing_id", ignoreDuplicates: true });
check("signed-in user can save a listing", !sv.error, sv.error?.message);
const sv2 = await buyer.sb.from("saved_listings").upsert({ user_id: buyer.uid, listing_id: vl.id }, { onConflict: "user_id,listing_id", ignoreDuplicates: true });
check("saving twice is harmless", !sv2.error);
const svOther = await buyer.sb.from("saved_listings").insert({ user_id: owner.uid, listing_id: vl.id });
check("cannot save on behalf of another user", !!svOther.error);
const seen = await owner.sb.from("saved_listings").select("*").eq("listing_id", vl.id);
check("users can't read each other's saved items", (seen.data ?? []).length === 0);
const fo = await buyer.sb.from("follows").upsert({ user_id: buyer.uid, seller_id: seller.id }, { onConflict: "user_id,seller_id", ignoreDuplicates: true });
check("signed-in user can follow a seller", !fo.error, fo.error?.message);
r = await fetch(`${BASE}/saved`, { headers: { cookie: buyer.cookie() } }); let html = (await r.text()).replace(/<!-- -->/g, "");
check("/saved shows saved listing and follow counts", r.status === 200 && html.includes("Listings (1)") && html.includes("Sellers (1)"));
r = await fetch(`${BASE}/saved?tab=sellers`, { headers: { cookie: buyer.cookie() } }); html = await r.text();
check("/saved sellers tab lists followed seller", html.includes("Lwazi Cuts"));
await buyer.sb.from("saved_listings").delete().eq("user_id", buyer.uid);
await buyer.sb.from("follows").delete().eq("user_id", buyer.uid);
r = await fetch(`${BASE}/saved`, { redirect: "manual" });
check("/saved requires sign-in", r.status >= 300 && r.status < 400 && (r.headers.get("location") ?? "").includes("/login"));

// ------------------------------------------------------------------ pages, 404s, low-data, share/OG
r = await fetch(`${BASE}/`); html = await r.text();
check("home renders hero, featured, new-this-week, categories, Looking For teaser",
  r.status === 200 && html.includes("Featured Hustles") && /New this week|Latest listings/.test(html) && html.includes("Shop by category") && html.includes("Looking For"));
r = await fetch(`${BASE}/browse?category=food`); html = await r.text();
check("browse filter in URL (category=food)", html.includes("Chicken kota") && !html.includes("Skin fade"));
r = await fetch(`${BASE}/browse?q=zzqxv`); html = await r.text();
check("browse empty state offers Looking For", html.includes("No matches") && html.includes("Looking For"));
r = await fetch(`${BASE}/browse?n=1`); html = await r.text();
check("Load more appears when results exceed a page", (html.match(/Load more/g) ?? []).length >= 1 || (await ids(anon)).length <= 24);
r = await fetch(`${BASE}/l/${target.id}`); html = await r.text();
check("listing page renders price, share and seller card", r.status === 200 && html.includes(target.title) && html.includes("Share") && html.includes("Lwazi Cuts") && html.includes("More from"));
check("listing page has an OG image tag", /property="og:image"/.test(html));
r = await fetch(`${BASE}/l/${target.id}/opengraph-image`);
const buf = Buffer.from(await r.arrayBuffer());
check("OG image is a PNG for a real listing", r.status === 200 && r.headers.get("content-type") === "image/png" && buf.length > 5000 && buf.subarray(1, 4).toString() === "PNG", `${r.status} ${buf.length}`);
r = await fetch(`${BASE}/l/00000000-0000-4000-8000-000000000000/opengraph-image`);
check("OG image falls back to a branded card for unknown ids", r.status === 200 && r.headers.get("content-type") === "image/png");
r = await fetch(`${BASE}/l/00000000-0000-4000-8000-000000000000`); check("unknown listing is a real 404", r.status === 404);
r = await fetch(`${BASE}/l/not-a-uuid`); check("malformed listing id is a real 404", r.status === 404);
r = await fetch(`${BASE}/s/no-such-seller`); check("unknown seller is a real 404", r.status === 404);
await admin.from("listings").update({ hidden_by_moderation: true }).eq("id", target.id);
r = await fetch(`${BASE}/l/${target.id}`); check("moderator-hidden listing is a 404 for the public", r.status === 404);
await admin.from("listings").update({ hidden_by_moderation: false }).eq("id", target.id);
r = await fetch(`${BASE}/how-featured-works`); html = await r.text();
check("/how-featured-works explains the weighting", r.status === 200 && html.includes("14 days") && html.includes("7 days"));

r = await fetch(`${BASE}/browse`, { headers: { cookie: "vossie_lowdata=1" } }); html = await r.text();
check("low-data cookie sets the html attribute", html.includes('data-lowdata="true"'));
check("low-data browse uses list layout with tap-to-load photos", html.includes("Tap to load") && !html.includes("aspect-square"));
r = await fetch(`${BASE}/browse`); html = await r.text();
check("normal mode uses card grid", html.includes('data-lowdata="false"') && html.includes("aspect-square"));
const sellerSess = await login("20250101@vossie.net");
await admin.from("profiles").update({ low_data_mode: true }).eq("id", sellerSess.uid);
r = await fetch(`${BASE}/browse`, { headers: { cookie: sellerSess.cookie() } }); html = await r.text();
check("signed-in low-data preference from profile applies without a cookie", html.includes('data-lowdata="true"'));
await admin.from("profiles").update({ low_data_mode: false }).eq("id", sellerSess.uid);

// ------------------------------------------------------------------ hygiene
await clean();
await db.end();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
