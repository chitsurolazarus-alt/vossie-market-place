// Smoke test for Phase 2 against a running server (default http://localhost:3111).
// 1) Authenticated page renders using real Supabase auth cookies.
// 2) Replays the DB calls the seller/listing server actions make, as a brand-new student.
// Usage: node --env-file=.env.local scripts/smoke.mjs
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PASSWORD = "Vossie-Demo-2026!";
let pass = 0, fail = 0;
const check = (n, ok, x = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + x}`); };

async function session(email) {
  const jar = new Map();
  const sb = createServerClient(url, anon, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return { sb, uid: data.user.id, cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") };
}
const get = (path, cookie) => fetch(BASE + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });

// ---------- 1. page renders ----------
const seller = await session("20250101@vossie.net");
const buyer = await session("20250109@vossie.net");
for (const [path, needle] of [
  ["/sell", "Thandi"], ["/sell/listings", "Chicken kota"], ["/sell/listings/new", "Publish listing"],
  ["/sell/profile/edit", "Edit your profile"], ["/account", "Signed in as"], ["/s/thandis-kitchen", "Verified Incubation Hub member"],
]) {
  const r = await get(path, seller.cookie); const t = await r.text();
  check(`seller GET ${path}`, r.status === 200 && t.includes(needle), `status ${r.status}`);
}
let r = await get("/sell", buyer.cookie); let t = await r.text();
check("new student sees 'Become a seller' CTA", r.status === 200 && t.includes("Become a seller"));
r = await get("/sell/onboarding", buyer.cookie); t = await r.text();
check("onboarding wizard renders for new student", r.status === 200 && t.includes("Business basics"));
r = await get("/s/thandis-kitchen"); t = await r.text();
check("public profile shows no WhatsApp number in HTML", r.status === 200 && !t.includes("27710000101") && t.includes("/go/whatsapp/thandis-kitchen"));
r = await get("/go/whatsapp/thandis-kitchen");
check("WhatsApp redirect requires sign-in", r.status >= 300 && r.status < 400 && (r.headers.get("location") ?? "").includes("/login"));
r = await get("/go/whatsapp/thandis-kitchen", buyer.cookie);
const loc = r.headers.get("location") ?? "";
check("WhatsApp redirect builds wa.me link for signed-in user", loc.startsWith("https://wa.me/27710000101?text="), loc);
r = await get("/s/does-not-exist"); check("unknown seller shows not-found page", (await r.text()).includes("find that page") || r.status === 404);
r = await get("/login", seller.cookie); check("signed-in user is bounced from /login", r.status >= 300 && r.status < 400 || (await r.text()).includes("NEXT_REDIRECT"));
r = await get("/sell/listings"); t = await r.text();
check("unauthenticated /sell/listings redirects to login", r.status >= 300 || t.includes("/login?next="));

// ---------- 2. replay action DB calls as a brand-new student ----------
const { data: campus } = await admin.from("campuses").select("id").eq("slug", "midrand").single();
const { data: cat } = await admin.from("categories").select("id").eq("slug", "food").single();
const { data: pps } = await admin.from("pickup_points").select("id").eq("campus_id", campus.id).limit(4);
await admin.from("seller_profiles").delete().eq("user_id", buyer.uid); // clean slate

const ins = await buyer.sb.from("seller_profiles").insert({ user_id: buyer.uid, campus_id: campus.id, category_id: cat.id, business_name: "Ayanda Bakes", slug: "ayanda-bakes", contact_pref: "both", status: "pending" }).select("id,status").single();
check("new student can submit seller profile as pending", !ins.error && ins.data?.status === "pending", ins.error?.message);
const sid = ins.data?.id;
const dup = await buyer.sb.from("seller_profiles").insert({ user_id: buyer.uid, campus_id: campus.id, business_name: "x", slug: "x" });
check("second seller profile for same user rejected", !!dup.error);
const priv = await buyer.sb.from("seller_private").upsert({ seller_id: sid, whatsapp_e164: "+27821234567" });
check("seller can store private WhatsApp number", !priv.error, priv.error?.message);
const p4 = await buyer.sb.from("seller_pickup_points").insert(pps.map((p) => ({ seller_id: sid, pickup_point_id: p.id })));
check("4 pickup points rejected (max 3)", !!p4.error);
await buyer.sb.from("seller_pickup_points").delete().eq("seller_id", sid);
const p2 = await buyer.sb.from("seller_pickup_points").insert(pps.slice(0, 2).map((p) => ({ seller_id: sid, pickup_point_id: p.id })));
check("2 pickup points accepted", !p2.error, p2.error?.message);

const lid = crypto.randomUUID();
const l = await buyer.sb.from("listings").insert({ id: lid, seller_id: sid, campus_id: "00000000-0000-0000-0000-000000000000", category_id: cat.id, kind: "product", title: "Red velvet cupcakes", description: "Box of 6", pricing_mode: "both", price_zar: 90, swap_for: "Poster design", pickup_point_id: pps[0].id });
check("pending seller can draft a listing (campus set by trigger)", !l.error, l.error?.message);
const { data: lrow } = await admin.from("listings").select("campus_id").eq("id", lid).single();
check("listing campus matches seller campus", lrow?.campus_id === campus.id);
const bad = await buyer.sb.from("listings").insert({ seller_id: sid, campus_id: campus.id, kind: "product", title: "Bad price", pricing_mode: "cash", price_zar: null });
check("cash listing without price rejected", !!bad.error);
const badPickup = await buyer.sb.from("listings").insert({ seller_id: sid, campus_id: campus.id, kind: "product", title: "Bad pickup", pricing_mode: "cash", price_zar: 5, pickup_point_id: pps[3].id });
check("listing with pickup point outside seller's list rejected", !!badPickup.error);

const path = `${buyer.uid}/${lid}/a.webp`;
const up = await buyer.sb.storage.from("listing-images").upload(path, new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }));
check("owner uploads listing image to own folder", !up.error, up.error?.message);
const im = await buyer.sb.from("listing_images").insert({ listing_id: lid, path, alt: "Cupcakes", position: 0 });
check("listing image row inserted", !im.error, im.error?.message);
const tg = await buyer.sb.from("tags").upsert([{ name: "baking" }, { name: "cupcakes-test" }], { onConflict: "name", ignoreDuplicates: true });
check("tags upsert with ignoreDuplicates works for existing + new tags", !tg.error, tg.error?.message);
const { data: tagRows } = await buyer.sb.from("tags").select("id").in("name", ["baking", "cupcakes-test"]);
const lt = await buyer.sb.from("listing_tags").insert(tagRows.map((x) => ({ listing_id: lid, tag_id: x.id })));
check("listing tags linked", !lt.error && tagRows.length === 2, lt.error?.message);

r = await get(`/sell/listings/${lid}/edit`, buyer.cookie); t = await r.text();
check("edit page loads the new listing with tags and image", r.status === 200 && t.includes("Red velvet cupcakes") && t.includes("cupcakes-test"));
const pub = await createClient(url, anon).from("listings").select("id").eq("id", lid);
check("pending seller's listing is hidden from public", (pub.data ?? []).length === 0);
const sd = await buyer.sb.from("listings").update({ deleted_at: new Date().toISOString() }).eq("id", lid).select("id");
check("soft delete works for owner", !sd.error && sd.data?.length === 1);

// ---------- rate limit ----------
let limited = false;
for (let i = 0; i < 21 && !limited; i++) {
  const x = await buyer.sb.from("listings").insert({ seller_id: sid, campus_id: campus.id, kind: "service", title: `Rate test ${i}`, pricing_mode: "cash", price_zar: 10 });
  if (x.error?.message.includes("Daily listing limit")) limited = true;
}
check("21st listing in a day is rate limited", limited);

// cleanup
await admin.from("listings").delete().eq("seller_id", sid);
await admin.storage.from("listing-images").remove([path]);
await admin.from("tags").delete().eq("name", "cupcakes-test");
await admin.from("seller_profiles").delete().eq("id", sid);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
