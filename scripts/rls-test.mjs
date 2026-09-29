// Automated RLS / security checks against the live project (uses seeded demo users).
// Usage: node --env-file=.env.local scripts/rls-test.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PASSWORD = "Vossie-Demo-2026!";

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`);
};

async function as(email) {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { c, uid: data.user.id };
}

const A = await as("20250101@vossie.net"); // Thandi's Kitchen
const B = await as("20250102@vossie.net"); // Lwazi Cuts
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const { data: bSeller } = await admin.from("seller_profiles").select("id,business_name").eq("user_id", B.uid).single();
const { data: bListing } = await admin.from("listings").select("id,title").eq("seller_id", bSeller.id).limit(1).single();
const { data: aSeller } = await admin.from("seller_profiles").select("id").eq("user_id", A.uid).single();

// 1. Cross-user writes
let r = await A.c.from("listings").update({ title: "HACKED by A" }).eq("id", bListing.id).select();
check("A cannot edit B's listing", (r.data ?? []).length === 0);
r = await A.c.from("listings").delete().eq("id", bListing.id).select();
check("A cannot delete B's listing", (r.data ?? []).length === 0);
r = await A.c.from("seller_profiles").update({ tagline: "HACKED" }).eq("id", bSeller.id).select();
check("A cannot edit B's seller profile", (r.data ?? []).length === 0);
r = await A.c.from("profiles").update({ display_name: "HACKED" }).eq("id", B.uid).select();
check("A cannot edit B's profile", (r.data ?? []).length === 0);
r = await A.c.from("listings").insert({ seller_id: bSeller.id, title: "Fake listing", kind: "product", pricing_mode: "cash", price_zar: 1 }).select();
check("A cannot create a listing under B's seller", !!r.error, "insert succeeded");
r = await A.c.from("listing_images").insert({ listing_id: bListing.id, path: "x/y.webp", alt: "x" }).select();
check("A cannot add images to B's listing", !!r.error);
const { data: still } = await admin.from("listings").select("title").eq("id", bListing.id).single();
check("B's listing is untouched", still.title === bListing.title);

// 2. Privilege escalation
r = await A.c.from("profiles").update({ role: "admin" }).eq("id", A.uid).select();
check("A cannot make self admin", !!r.error || (r.data ?? []).length === 0);
r = await A.c.from("seller_profiles").update({ verified: false }).eq("id", aSeller.id).select();
check("Seller cannot change own verified flag", !!r.error);
r = await A.c.from("seller_profiles").update({ status: "suspended" }).eq("id", aSeller.id).select();
check("Seller cannot change own approval status", !!r.error);
r = await A.c.from("seller_profiles").update({ mentor_id: A.uid }).eq("id", aSeller.id).select();
check("Seller cannot assign own mentor", !!r.error);
r = await A.c.from("listings").update({ hidden_by_moderation: true }).eq("id", (await admin.from("listings").select("id").eq("seller_id", aSeller.id).limit(1).single()).data.id).select();
check("Seller cannot toggle moderation flag", !!r.error);
r = await A.c.from("allowed_emails").insert({ email: "evil@example.com" }).select();
check("Non-admin cannot edit the sign-up allow-list", !!r.error);
r = await A.c.from("feature_flags").update({ enabled: true }).eq("key", "payments").select();
check("Non-admin cannot flip feature flags", (r.data ?? []).length === 0);

// 3. Private data
r = await A.c.from("seller_private").select("*").eq("seller_id", bSeller.id);
check("A cannot read B's WhatsApp number", (r.data ?? []).length === 0);
r = await anon.from("seller_private").select("*");
check("Anonymous cannot read WhatsApp numbers", (r.data ?? []).length === 0);
r = await A.c.from("seller_private").select("*").eq("seller_id", aSeller.id);
check("A can read own WhatsApp number", (r.data ?? []).length === 1);
r = await A.c.from("profiles").select("id").neq("id", A.uid);
check("A cannot read other users' profiles", (r.data ?? []).length === 0);
r = await anon.from("audit_log").select("*");
check("Anonymous cannot read audit log", (r.data ?? []).length === 0);

// 4. Public visibility
r = await anon.from("listings").select("id").limit(50);
check("Anonymous can browse approved listings", (r.data ?? []).length >= 30, `got ${(r.data ?? []).length}`);
await admin.from("seller_profiles").update({ status: "pending" }).eq("id", bSeller.id);
r = await anon.from("listings").select("id").eq("id", bListing.id);
check("Listings of a pending seller are hidden from public", (r.data ?? []).length === 0);
r = await B.c.from("listings").select("id").eq("id", bListing.id);
check("Pending seller can still see own listing", (r.data ?? []).length === 1);
await admin.from("seller_profiles").update({ status: "approved" }).eq("id", bSeller.id);

// 5. Sign-up gate + consent + phone format
let g = await admin.auth.admin.createUser({ email: "random.person@gmail.com", password: PASSWORD, email_confirm: true, user_metadata: { popia_consent: "true" } });
check("Sign-up blocked for non-Eduvos email", !!g.error);
g = await admin.auth.admin.createUser({ email: "20259999@vossie.net", password: PASSWORD, email_confirm: true });
check("Sign-up blocked without POPIA consent", !!g.error);
g = await admin.auth.admin.createUser({ email: "20259998@vossie.net", password: PASSWORD, email_confirm: true, user_metadata: { popia_consent: "true" } });
check("Sign-up allowed for @vossie.net with consent", !g.error);
if (g.data?.user) {
  const { data: p } = await admin.from("profiles").select("popia_consent_at").eq("id", g.data.user.id).single();
  check("Consent timestamp recorded", !!p?.popia_consent_at);
  await admin.auth.admin.deleteUser(g.data.user.id);
}
r = await A.c.from("seller_private").update({ whatsapp_e164: "0821234567" }).eq("seller_id", aSeller.id).select();
check("Non-+27 phone number rejected by database", !!r.error);

// 6. Storage isolation
const blob = new Blob([new Uint8Array([82, 73, 70, 70])], { type: "image/webp" });
let s = await A.c.storage.from("listing-images").upload(`${B.uid}/evil.webp`, blob);
check("A cannot upload into B's storage folder", !!s.error);
s = await A.c.storage.from("avatars").upload(`${A.uid}/test.webp`, blob);
check("A can upload into own avatars folder", !s.error, s.error?.message);
await A.c.storage.from("avatars").remove([`${A.uid}/test.webp`]);
s = await A.c.storage.from("listing-images").upload(`${A.uid}/big.gif`, new Blob([new Uint8Array(10)], { type: "image/gif" }));
check("Non-image mime types rejected", !!s.error);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
