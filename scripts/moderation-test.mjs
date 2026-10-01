// Phase 5 access-control and rule checks: reports, auto-hide, suspension, audit log, admin/mentor isolation, Hub, POPIA.
// Usage: node --env-file=.env.local scripts/moderation-test.mjs
// Signs in as real demo users with the anon key (RLS applies); the service role is used only for setup and cleanup.
// Admin actions are logged permanently (the audit log is append-only), so test reasons are prefixed "[automated test]".
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "Vossie-Demo-2026!";
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const T = "[automated test] ";

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`); };
const msg = (e) => (e?.message ?? "") + " " + (e?.code ?? "");
const one = async (q) => { const { data, error } = await q; if (error) throw new Error(error.message); return data; };

async function login(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { c, id: data.user.id };
}

const adminU = await login("admin.demo@eduvos.com");
const mentor = await login("mentor.demo@eduvos.com");
const ayanda = await login("20250109@vossie.net");
const aisha = await login("20250110@vossie.net");
const thandi = await login("20250101@vossie.net");
const sipho = await login("20250107@vossie.net");
const ethan = await login("20250106@vossie.net");
const rep = await Promise.all(["20250202", "20250203", "20250204", "20250205", "20250206"].map((n) => login(`${n}@vossie.net`)));
const [r1, r2, r3, r4, r5] = rep;
const anon = createClient(URL, ANON, { auth: { persistSession: false } });

const sellerOf = async (u) => one(admin.from("seller_profiles").select("id,user_id,status").eq("user_id", u.id).single());
const thandiS = await sellerOf(thandi), siphoS = await sellerOf(sipho), ethanS = await sellerOf(ethan), aishaS = await sellerOf(aisha);
const listingsOf = (sid) => one(admin.from("listings").select("id,title").eq("seller_id", sid).order("title"));
const thandiL = await listingsOf(thandiS.id), siphoL = await listingsOf(siphoS.id), ethanL = await listingsOf(ethanS.id);
const rpc = (u, fn, args) => (u.c ?? u).rpc(fn, args);

const cleanup = { reports: [], conv: [], hub: [], users: [] };
const resetAisha = () => admin.from("seller_profiles").update({ status: "pending", verified: false, review_reason: null, reviewed_at: null, reviewed_by: null, approved_at: null }).eq("id", aishaS.id);
const resetModeration = async (ids) => { for (const id of ids) await admin.from("profiles").update({ suspended_until: null, suspension_reason: null, banned_at: null, ban_reason: null }).eq("id", id); };
await resetAisha();
await admin.from("reports").delete().in("reporter_id", rep.map((r) => r.id));
await admin.from("listings").update({ hidden_by_moderation: false }).in("id", [...thandiL, ...siphoL, ...ethanL].map((l) => l.id));
await resetModeration([...rep.map((r) => r.id), ethan.id, adminU.id, ayanda.id]);
await admin.from("profiles").update({ role: "admin" }).eq("id", adminU.id);
await admin.from("profiles").update({ role: "buyer" }).eq("id", ayanda.id);
await admin.from("conversations").delete().in("buyer_id", [r2.id, r3.id, r4.id]).eq("seller_id", siphoS.id);

const report = (u, type, id, reason = "scam", note) => u.c.from("reports").insert({ reporter_id: u.id, target_type: type, target_id: id, reason, note }).select("id").single();

// ============================================================= 1. reporting rules
const first = await report(r1, "listing", thandiL[0].id, "scam", "Test report");
check("a signed-in user can report a listing", !first.error, msg(first.error));
const dup = await report(r1, "listing", thandiL[0].id);
check("only one open report per reporter per target", dup.error?.code === "23505", msg(dup.error));
const own = await report(thandi, "listing", thandiL[0].id);
check("you cannot report your own listing", !!own.error && /report_own_content/.test(own.error.message), msg(own.error));
check("an unknown reason is rejected", !!(await report(r1, "listing", thandiL[1].id, "made_up")).error);
check("a note over 500 characters is rejected", !!(await report(r1, "listing", thandiL[1].id, "scam", "x".repeat(501))).error);
check("reporting something that does not exist is rejected", !!(await report(r1, "listing", "00000000-0000-0000-0000-000000000001")).error);
check("anonymous visitors cannot report", !!(await anon.from("reports").insert({ target_type: "listing", target_id: thandiL[0].id, reason: "scam" })).error);
const spoof = await r1.c.from("reports").insert({ reporter_id: r2.id, target_type: "listing", target_id: thandiL[2].id, reason: "scam" });
check("you cannot file a report as someone else", !!spoof.error);

// reporter identity is hidden from the reported person
const seenBy = async (u) => ((await u.c.from("reports").select("id,reporter_id").eq("target_id", thandiL[0].id)).data ?? []).length;
check("the reported seller cannot see reports against them (reporter identity hidden)", (await seenBy(thandi)) === 0);
check("another user cannot see someone else's report", (await seenBy(r2)) === 0);
check("the reporter can see their own report", (await seenBy(r1)) === 1);
check("an admin can see the report", (await seenBy(adminU)) >= 1);
check("a mentor cannot see reports", (await seenBy(mentor)) === 0);
const edit = await r1.c.from("reports").update({ status: "dismissed" }).eq("id", first.data.id).select();
check("a reporter cannot resolve their own report", !!edit.error || (edit.data ?? []).length === 0);
const noteLeak = await thandi.c.from("notifications").select("title,body").in("type", ["moderation", "report_update"]).order("created_at", { ascending: false }).limit(20);
check("the seller's notifications never name a reporter", (noteLeak.data ?? []).every((n) => !/Siyabonga|Dube|Palesa|reported by/i.test(`${n.title} ${n.body}`)));
cleanup.reports.push(first.data.id);

// ============================================================= 2. auto-hide at N = 3 unique reporters
const target = ethanL[0];
const isVisible = async () => ((await anon.from("browse_listings").select("id").eq("id", target.id)).data ?? []).length === 1;
check("before reports the listing is publicly visible", await isVisible());
await report(r1, "listing", target.id, "scam");
await report(r2, "listing", target.id, "prohibited_item");
const dupReporter = await report(r2, "listing", target.id, "scam");
check("the same person reporting again does not add to the count", dupReporter.error?.code === "23505");
check("2 unique reporters: still visible", await isVisible());
await report(r3, "listing", target.id, "fake_profile", "Looks fake");
const hidden = await one(admin.from("listings").select("hidden_by_moderation,moderation_hidden_reason,moderation_hidden_at").eq("id", target.id).single());
check("3 unique reporters auto-hide the listing", hidden.hidden_by_moderation && hidden.moderation_hidden_reason === "auto" && !!hidden.moderation_hidden_at);
check("an auto-hidden listing disappears from public browse", !(await isVisible()));
const ownSee = await ethan.c.from("listings").select("id,hidden_by_moderation").eq("id", target.id).single();
check("the seller can still see and edit their hidden listing", ownSee.data?.hidden_by_moderation === true);
const sellerNote = await one(admin.from("notifications").select("title,body,type").eq("user_id", ethan.id).eq("type", "moderation").order("created_at", { ascending: false }).limit(1));
check("the seller is told it is under review, without naming anyone", sellerNote[0]?.title === "Your listing is under review" && !/Lerato|Siyabonga|Palesa|Dube|reporter/i.test(sellerNote[0]?.body ?? ""));
const hideSelf = await ethan.c.from("listings").update({ hidden_by_moderation: false }).eq("id", target.id).select();
check("the seller cannot un-hide it themselves", !!hideSelf.error || (hideSelf.data ?? []).length === 0, JSON.stringify(hideSelf.data));
const autoLog = await one(admin.from("audit_log").select("action,detail").eq("action", "listing.auto_hide").eq("target_id", target.id));
check("the auto-hide is written to the audit log", autoLog.length >= 1 && autoLog[0].detail?.unique_reporters >= 3);

// ============================================================= 3. admin functions: authorisation + resolution
const pendingRows = await one(admin.from("reports").select("id,reporter_id").eq("target_id", target.id).eq("status", "pending"));
const rid = pendingRows[0].id;
for (const [who, u] of [["a seller", thandi], ["a buyer", r4], ["a mentor", mentor]]) {
  const r = await rpc(u, "admin_resolve_report", { p_report: rid, p_action: "dismiss" });
  check(`${who} cannot resolve a report`, !!r.error && /Admins only/.test(r.error.message), msg(r.error));
}
check("a seller cannot review seller applications", !!(await rpc(thandi, "admin_review_seller", { p_seller: aishaS.id, p_decision: "approve" })).error);
check("a seller cannot set roles", !!(await rpc(thandi, "admin_set_role", { p_user: thandi.id, p_role: "admin" })).error);
check("anonymous visitors cannot call admin functions", !!(await rpc(anon, "admin_set_role", { p_user: thandi.id, p_role: "admin" })).error);
const dis = await rpc(adminU, "admin_resolve_report", { p_report: rid, p_action: "dismiss", p_note: T + "false alarm" });
check("an admin can dismiss a report", !dis.error, msg(dis.error));
const after = await one(admin.from("listings").select("hidden_by_moderation").eq("id", target.id).single());
check("dismissing restores an auto-hidden listing", after.hidden_by_moderation === false);
check("the listing is public again", await isVisible());
const allResolved = await one(admin.from("reports").select("status,resolution").eq("target_id", target.id));
check("every open report on that target is resolved together", allResolved.every((x) => x.status === "dismissed"));
const upd = await one(admin.from("notifications").select("user_id,type,body").eq("type", "report_update").in("user_id", [r1.id, r2.id, r3.id]).order("created_at", { ascending: false }).limit(6));
check("each reporter gets a resolution update", new Set(upd.map((n) => n.user_id)).size === 3);
check("the update reveals nothing about the other party", upd.every((n) => !/Ethan|CodeCraft|Naidoo/i.test(n.body ?? "")));
const again = await rpc(adminU, "admin_resolve_report", { p_report: rid, p_action: "dismiss" });
check("a resolved report cannot be resolved twice", !!again.error);
const restoreLog = await one(admin.from("audit_log").select("actor_id,action,reason,before,after").eq("target_id", rid).eq("action", "report.dismiss"));
check("the resolution is audited with actor, reason, before and after", restoreLog.length === 1 && restoreLog[0].actor_id === adminU.id && restoreLog[0].reason === T + "false alarm" && !!restoreLog[0].before && !!restoreLog[0].after);

// ============================================================= 4. hide / warn / suspend / ban and suspension enforcement
const rHide = await report(r4, "listing", siphoL[0].id, "inappropriate");
const hideRes = await rpc(adminU, "admin_resolve_report", { p_report: rHide.data.id, p_action: "hide", p_note: T + "hide test" });
check("an admin can hide reported content", !hideRes.error && (await one(admin.from("listings").select("hidden_by_moderation,moderation_hidden_reason").eq("id", siphoL[0].id).single())).moderation_hidden_reason === "admin", msg(hideRes.error));
await rpc(adminU, "admin_moderate_listing", { p_listing: siphoL[0].id, p_action: "restore", p_reason: T + "restore" });
check("an admin can restore a listing", !(await one(admin.from("listings").select("hidden_by_moderation").eq("id", siphoL[0].id).single())).hidden_by_moderation);

const rMsgUser = await report(r5, "user", r4.id, "harassment", "Test");
const warn0 = await rpc(adminU, "admin_resolve_report", { p_report: rMsgUser.data.id, p_action: "warn" });
check("a warning needs a message", !!warn0.error);
const warn = await rpc(adminU, "admin_resolve_report", { p_report: rMsgUser.data.id, p_action: "warn", p_note: T + "please be respectful" });
check("an admin can warn a user", !warn.error, msg(warn.error));
const gotWarn = await r4.c.from("user_warnings").select("message").limit(5);
check("the user can read their own warning", (gotWarn.data ?? []).some((w) => w.message.includes("be respectful")));
check("other users cannot read someone's warnings", ((await r5.c.from("user_warnings").select("id")).data ?? []).length === 0);

const rSus = await report(r5, "user", r4.id, "harassment", "Again");
const sus0 = await rpc(adminU, "admin_resolve_report", { p_report: rSus.data.id, p_action: "suspend", p_days: 0 });
check("a suspension needs a duration of 1 to 365 days", !!sus0.error);
const sus = await rpc(adminU, "admin_resolve_report", { p_report: rSus.data.id, p_action: "suspend", p_days: 7, p_note: T + "suspend test" });
check("an admin can suspend a user for a duration", !sus.error, msg(sus.error));
const prof = await one(admin.from("profiles").select("suspended_until").eq("id", r4.id).single());
check("the suspension has an end date about 7 days away", prof.suspended_until && Math.abs(new Date(prof.suspended_until) - Date.now() - 7 * 864e5) < 36e5);
const bConv = await r4.c.from("conversations").insert({ buyer_id: r4.id, seller_id: siphoS.id, listing_id: siphoL[2].id });
check("a suspended user cannot start a conversation", !!bConv.error && /account_suspended/.test(bConv.error.message), msg(bConv.error));
const sNote = await one(admin.from("notifications").select("title").eq("user_id", r4.id).eq("type", "moderation").limit(5));
check("the suspended user is notified", sNote.some((n) => /suspended/i.test(n.title)));
check("a suspended user can still sign in and read public pages", ((await r4.c.from("browse_listings").select("id").limit(1)).data ?? []).length === 1);

// an existing conversation: a suspended participant cannot post
const live = await r2.c.from("conversations").insert({ buyer_id: r2.id, seller_id: siphoS.id, listing_id: siphoL[3].id }).select("id").single();
cleanup.conv.push(live.data.id);
await admin.from("profiles").update({ suspended_until: new Date(Date.now() + 864e5).toISOString() }).eq("id", r2.id);
const postWhileSus = await r2.c.from("messages").insert({ conversation_id: live.data.id, sender_id: r2.id, body: "hello" });
check("a suspended user cannot send messages", !!postWhileSus.error && /account_suspended/.test(postWhileSus.error.message), msg(postWhileSus.error));
await resetModeration([r2.id]);
check("after the suspension ends they can message again", !(await r2.c.from("messages").insert({ conversation_id: live.data.id, sender_id: r2.id, body: "hello again" })).error);

// suspension hides a seller's profile and listings; lifting it brings them back
const rSel = await report(r1, "seller", ethanS.id, "fake_profile");
await rpc(adminU, "admin_resolve_report", { p_report: rSel.data.id, p_action: "suspend", p_days: 1, p_note: T + "seller suspend" });
const ethanVisible = async () => ((await anon.from("seller_profiles").select("id").eq("id", ethanS.id)).data ?? []).length === 1;
const ethanListings = async () => ((await anon.from("browse_listings").select("id").eq("seller_id", ethanS.id)).data ?? []).length;
check("a suspended seller's profile is hidden from the public", !(await ethanVisible()));
check("a suspended seller's listings are hidden from the public", (await ethanListings()) === 0);
check("a suspended seller can still see their own dashboard data", ((await ethan.c.from("seller_profiles").select("id").eq("user_id", ethan.id)).data ?? []).length === 1);
check("a suspended seller cannot edit listings", !!(await ethan.c.from("listings").update({ title: "tamper" }).eq("id", ethanL[1].id).select()).error);
const rest = await rpc(adminU, "admin_unsuspend", { p_user: ethan.id, p_reason: T + "restore" });
check("an admin can lift a suspension", !rest.error && (await ethanVisible()) && (await ethanListings()) > 0, msg(rest.error));

const rBan = await report(r1, "user", r5.id, "scam");
await rpc(adminU, "admin_resolve_report", { p_report: rBan.data.id, p_action: "ban", p_note: T + "ban test" });
check("an admin can ban a user", !!(await one(admin.from("profiles").select("banned_at").eq("id", r5.id).single())).banned_at);
check("a banned user cannot message", !!(await r5.c.from("conversations").insert({ buyer_id: r5.id, seller_id: siphoS.id, listing_id: siphoL[1].id })).error);
await rpc(adminU, "admin_unsuspend", { p_user: r5.id, p_reason: T + "restore" });
const rAdm = await report(r1, "user", adminU.id, "scam");
check("an admin cannot be acted against until demoted", !!(await rpc(adminU, "admin_resolve_report", { p_report: rAdm.data.id, p_action: "ban" })).error);
await admin.from("reports").delete().eq("id", rAdm.data.id);

// ============================================================= 5. message reports: context only
const mc = await r3.c.from("conversations").insert({ buyer_id: r3.id, seller_id: siphoS.id, listing_id: siphoL[1].id }).select("id").single();
cleanup.conv.push(mc.data.id);
const sent = [];
for (let i = 1; i <= 8; i++) {
  const sender = i % 2 ? r3 : sipho;
  const m = await sender.c.from("messages").insert({ conversation_id: mc.data.id, sender_id: sender.id, body: `ctx message ${i}` }).select("id,created_at").single();
  sent.push(m.data); await new Promise((r) => setTimeout(r, 15));
}
const reportedMsg = sent[3]; // message 4, sent by the seller
const own4 = await report(sipho, "message", reportedMsg.id, "harassment");
check("you cannot report your own message", !!own4.error);
const stranger = await report(r4, "message", reportedMsg.id, "harassment");
check("a non-participant cannot report a message", !!stranger.error && /report_target_missing/.test(stranger.error.message), msg(stranger.error));
const mrep = await report(r3, "message", reportedMsg.id, "harassment", "Rude");
check("a participant can report the other person's message", !mrep.error, msg(mrep.error));
const ctx = await one(admin.from("report_context").select("body,is_reported,sender_is_reported").eq("report_id", mrep.data.id).order("position"));
check("the snapshot is the reported message plus up to 5 around it (3 before, 2 after)", ctx.length === 6 && ctx.filter((x) => x.is_reported).length === 1 && ctx[3].body === "ctx message 4" && ctx[0].body === "ctx message 1" && ctx[5].body === "ctx message 6", JSON.stringify(ctx.map((c) => c.body)));
check("the reported person is identified in the snapshot", ctx.find((x) => x.is_reported).sender_is_reported === true);
check("an admin can read the snapshot", ((await adminU.c.from("report_context").select("id").eq("report_id", mrep.data.id)).data ?? []).length === 6);
check("the reporter and others cannot read the snapshot table", ((await r3.c.from("report_context").select("id")).data ?? []).length === 0 && ((await sipho.c.from("report_context").select("id")).data ?? []).length === 0);
check("admins can't read the rest of the conversation", ((await adminU.c.from("messages").select("id").eq("conversation_id", mc.data.id)).data ?? []).length === 0);
await rpc(adminU, "admin_resolve_report", { p_report: mrep.data.id, p_action: "dismiss", p_note: T });

// ============================================================= 6. rate limit: 10 reports a day
await admin.from("reports").delete().eq("reporter_id", r5.id);
const pool = (await listingsOf(thandiS.id)).concat(await listingsOf(siphoS.id)).concat(await listingsOf(ethanS.id));
let made = 0, limited = null;
for (const l of pool) { const r = await report(r5, "listing", l.id, "other"); if (r.error) { limited = r.error; break; } made++; }
check("report rate limit: 10 a day", !!limited && /rate_limit_reports/.test(limited.message) && made === 10, `${made} created, ${msg(limited)}`);
await admin.from("reports").delete().eq("reporter_id", r5.id);

// ============================================================= 7. audit log is append-only
const aud = await one(admin.from("audit_log").select("id,action").limit(1));
check("sellers cannot read the audit log", ((await thandi.c.from("audit_log").select("id").limit(1)).data ?? []).length === 0);
check("mentors cannot read the audit log", ((await mentor.c.from("audit_log").select("id").limit(1)).data ?? []).length === 0);
check("anonymous visitors cannot read the audit log", ((await anon.from("audit_log").select("id").limit(1)).data ?? []).length === 0);
check("an admin can read the audit log", ((await adminU.c.from("audit_log").select("id").limit(1)).data ?? []).length === 1);
check("a non-admin cannot write audit entries", !!(await thandi.c.from("audit_log").insert({ actor_id: thandi.id, action: "forged" })).error);
check("an admin cannot forge an entry as someone else", !!(await adminU.c.from("audit_log").insert({ actor_id: thandi.id, action: "forged" })).error);
const updA = await adminU.c.from("audit_log").update({ reason: "tampered" }).eq("id", aud[0].id).select();
check("an admin cannot update audit entries", !!updA.error || (updA.data ?? []).length === 0, JSON.stringify(updA.data));
const delA = await adminU.c.from("audit_log").delete().eq("id", aud[0].id).select();
check("an admin cannot delete audit entries", !!delA.error || (delA.data ?? []).length === 0);
const svcUpd = await admin.from("audit_log").update({ reason: "tampered" }).eq("id", aud[0].id);
check("even the service role cannot update audit entries", !!svcUpd.error && /append-only/.test(svcUpd.error.message), msg(svcUpd.error));
const svcDel = await admin.from("audit_log").delete().eq("id", aud[0].id);
check("even the service role cannot delete audit entries", !!svcDel.error && /append-only/.test(svcDel.error.message), msg(svcDel.error));
const cat = await one(admin.from("categories").select("id,name,sort_order").eq("slug", "other").single());
await adminU.c.from("categories").update({ sort_order: cat.sort_order + 1 }).eq("id", cat.id);
const catLog = await one(admin.from("audit_log").select("action,before,after,actor_id").eq("target_type", "categories").eq("target_id", cat.id).order("id", { ascending: false }).limit(1));
check("config changes are audited automatically with before and after", catLog[0]?.action === "categories.update" && catLog[0].before?.sort_order === cat.sort_order && catLog[0].after?.sort_order === cat.sort_order + 1 && catLog[0].actor_id === adminU.id);
await adminU.c.from("categories").update({ sort_order: cat.sort_order }).eq("id", cat.id);
check("non-admins cannot edit categories", ((await thandi.c.from("categories").update({ name: "hacked" }).eq("id", cat.id).select()).data ?? []).length === 0);
check("non-admins cannot edit feature flags", ((await thandi.c.from("feature_flags").update({ enabled: true }).eq("key", "payments").select()).data ?? []).length === 0);
check("non-admins cannot edit allowed email domains", !!(await thandi.c.from("allowed_email_domains").insert({ domain: "evil.test" })).error);
check("non-admins cannot edit site settings", ((await thandi.c.from("site_settings").update({ value: { n: 1 } }).eq("key", "auto_hide_threshold").select()).data ?? []).length === 0);
check("site settings are readable (Information Officer is public)", ((await anon.from("site_settings").select("key")).data ?? []).length >= 3);

// ============================================================= 8. roles and the last admin
const own2 = await ayanda.c.from("profiles").update({ role: "admin" }).eq("id", ayanda.id);
check("a user cannot promote themselves", !!own2.error && /admin/.test(own2.error.message), msg(own2.error));
const self = await rpc(adminU, "admin_set_role", { p_user: adminU.id, p_role: "buyer" });
check("the last admin cannot demote themselves", !!self.error && /last_admin/.test(self.error.message), msg(self.error));
check("the role was not changed", (await one(admin.from("profiles").select("role").eq("id", adminU.id).single())).role === "admin");
const promo = await rpc(adminU, "admin_set_role", { p_user: ayanda.id, p_role: "admin", p_reason: T + "second admin" });
check("an admin can promote another user", !promo.error, msg(promo.error));
const demoteSelf = await rpc(adminU, "admin_set_role", { p_user: adminU.id, p_role: "mentor", p_reason: T + "two admins" });
check("with two admins one may step down", !demoteSelf.error, msg(demoteSelf.error));
const lastAgain = await rpc(ayanda, "admin_set_role", { p_user: ayanda.id, p_role: "buyer" });
check("the remaining admin is protected as the last admin", !!lastAgain.error && /last_admin/.test(lastAgain.error.message), msg(lastAgain.error));
const svcLast = await admin.from("profiles").update({ role: "buyer" }).eq("id", ayanda.id);
check("even the service role cannot remove the last admin", !!svcLast.error && /last_admin/.test(svcLast.error.message), msg(svcLast.error));
await admin.from("profiles").update({ role: "admin" }).eq("id", adminU.id);
await admin.from("profiles").update({ role: "buyer" }).eq("id", ayanda.id);
check("roles restored after the test", (await one(admin.from("profiles").select("role").in("id", [adminU.id, ayanda.id]))).map((p) => p.role).sort().join() === "admin,buyer");

// ============================================================= 9. seller approvals and the Verified badge
check("a seller cannot approve themselves", !!(await aisha.c.from("seller_profiles").update({ status: "approved" }).eq("id", aishaS.id)).error);
check("a seller cannot grant themselves the Verified badge", !!(await aisha.c.from("seller_profiles").update({ verified: true }).eq("id", aishaS.id)).error);
check("a seller cannot edit the review reason", !!(await aisha.c.from("seller_profiles").update({ review_reason: "all good" }).eq("id", aishaS.id)).error);
check("a pending seller is not public", ((await anon.from("seller_profiles").select("id").eq("id", aishaS.id)).data ?? []).length === 0);
check("rejecting needs a reason", !!(await rpc(adminU, "admin_review_seller", { p_seller: aishaS.id, p_decision: "reject" })).error);
const chg = await rpc(adminU, "admin_review_seller", { p_seller: aishaS.id, p_decision: "request_changes", p_reason: T + "add a clearer photo" });
check("an admin can request changes (reason required)", !chg.error && (await one(admin.from("seller_profiles").select("status,review_reason").eq("id", aishaS.id).single())).status === "draft", msg(chg.error));
const n1 = await one(admin.from("notifications").select("title,body").eq("user_id", aisha.id).eq("type", "seller_review").order("created_at", { ascending: false }).limit(1));
check("the seller is notified with the reason", /Changes needed/.test(n1[0]?.title ?? "") && /clearer photo/.test(n1[0]?.body ?? ""));
check("a draft profile cannot be approved directly", !!(await rpc(adminU, "admin_review_seller", { p_seller: aishaS.id, p_decision: "approve" })).error);
await resetAisha();
const rej = await rpc(adminU, "admin_review_seller", { p_seller: aishaS.id, p_decision: "reject", p_reason: T + "not enough detail" });
check("an admin can reject with a reason", !rej.error && (await one(admin.from("seller_profiles").select("status").eq("id", aishaS.id).single())).status === "rejected", msg(rej.error));
await resetAisha();
const apr = await rpc(adminU, "admin_review_seller", { p_seller: aishaS.id, p_decision: "approve" });
check("an admin can approve a pending seller", !apr.error && (await one(admin.from("seller_profiles").select("status,approved_at").eq("id", aishaS.id).single())).status === "approved", msg(apr.error));
check("approval promotes the user to seller", (await one(admin.from("profiles").select("role").eq("id", aisha.id).single())).role === "seller");
check("an approved seller is public", ((await anon.from("seller_profiles").select("id").eq("id", aishaS.id)).data ?? []).length === 1);
const n2 = await one(admin.from("notifications").select("title").eq("user_id", aisha.id).eq("type", "seller_review").order("created_at", { ascending: false }).limit(1));
check("the seller is notified of the approval", /approved/i.test(n2[0]?.title ?? ""));
const ver = await rpc(adminU, "admin_set_verified", { p_seller: aishaS.id, p_verified: true, p_reason: T });
check("an admin can grant the Verified badge", !ver.error && (await one(admin.from("seller_profiles").select("verified").eq("id", aishaS.id).single())).verified === true, msg(ver.error));
await rpc(adminU, "admin_set_verified", { p_seller: aishaS.id, p_verified: false, p_reason: T });
check("an admin can revoke the Verified badge", (await one(admin.from("seller_profiles").select("verified").eq("id", aishaS.id).single())).verified === false);
const mentors = await one(admin.from("profiles").select("id").eq("role", "mentor"));
check("an admin can assign a seller to a mentor", !(await rpc(adminU, "admin_assign_mentor", { p_seller: aishaS.id, p_mentor: mentor.id, p_reason: T })).error);
check("only a mentor can be assigned", !!(await rpc(adminU, "admin_assign_mentor", { p_seller: aishaS.id, p_mentor: ayanda.id })).error);
await rpc(adminU, "admin_assign_mentor", { p_seller: aishaS.id, p_mentor: null, p_reason: T });
check("a mentor can be unassigned", (await one(admin.from("seller_profiles").select("mentor_id").eq("id", aishaS.id).single())).mentor_id === null && mentors.length >= 1);
await resetAisha();

// ============================================================= 10. mentor isolation and notes
const assigned = await one(admin.from("seller_profiles").select("id").eq("mentor_id", mentor.id).limit(1));
const mSellers = (await mentor.c.from("seller_profiles").select("id,mentor_id")).data ?? [];
check("a mentor sees only sellers assigned to them (plus public approved profiles)", mSellers.length >= 1);
check("a mentor cannot read an unassigned, unapproved seller", ((await mentor.c.from("seller_profiles").select("id").eq("id", aishaS.id)).data ?? []).length === 0);
check("a mentor cannot read their trust activity either", ((await mentor.c.from("seller_trust").select("seller_id").eq("seller_id", aishaS.id)).data ?? []).length === 0);
for (const t of ["messages", "conversations", "enquiries"]) check(`a mentor cannot read ${t}`, ((await mentor.c.from(t).select("id").limit(1)).data ?? []).length === 0);
const note = await mentor.c.from("mentor_notes").insert({ seller_id: assigned[0].id, mentor_id: mentor.id, body: T + "private note" }).select("id").single();
check("a mentor can add a private note on an assigned seller", !note.error, msg(note.error));
check("a mentor cannot add a note on an unassigned seller", !!(await mentor.c.from("mentor_notes").insert({ seller_id: aishaS.id, mentor_id: mentor.id, body: "x" })).error);
check("a mentor cannot write a note as someone else", !!(await mentor.c.from("mentor_notes").insert({ seller_id: assigned[0].id, mentor_id: adminU.id, body: "x" })).error);
check("the seller cannot read mentor notes", ((await thandi.c.from("mentor_notes").select("id")).data ?? []).length === 0);
check("buyers cannot read mentor notes", ((await r1.c.from("mentor_notes").select("id")).data ?? []).length === 0);
check("an admin can read mentor notes", ((await adminU.c.from("mentor_notes").select("id").eq("id", note.data.id)).data ?? []).length === 1);
check("a seller cannot create a mentor note", !!(await thandi.c.from("mentor_notes").insert({ seller_id: thandiS.id, mentor_id: thandi.id, body: "x" })).error);
const ck = await mentor.c.from("mentor_checkins").insert({ seller_id: assigned[0].id, mentor_id: mentor.id, note: T + "chat" }).select("id").single();
check("a mentor can log a check-in", !ck.error, msg(ck.error));
check("the seller cannot read check-ins", ((await thandi.c.from("mentor_checkins").select("id")).data ?? []).length === 0);
check("a mentor cannot edit notes (only add or delete)", !!(await mentor.c.from("mentor_notes").update({ body: "edited" }).eq("id", note.data.id)).error);
await mentor.c.from("mentor_notes").delete().eq("id", note.data.id);
await admin.from("mentor_checkins").delete().eq("id", ck.data.id);
const tr = await one(admin.from("seller_trust").select("enquiries_14d,enquiries_30d,whatsapp_30d,listing_views_30d,last_listing_update_at,hidden_listings_14d").eq("seller_id", thandiS.id).single());
check("mentor stats exist as aggregates (enquiries, handoffs, views, last update)", tr.enquiries_30d >= 0 && tr.last_listing_update_at !== null && "hidden_listings_14d" in tr);
const lw = await one(admin.from("seller_trust").select("enquiries_14d, seller_profiles!inner(slug)").eq("seller_profiles.slug", "lwazi-cuts").single());
check("a seller with no activity in 14 days shows zero (support flag input)", lw.enquiries_14d === 0);

// ============================================================= 11. Hub Growth
const post = await mentor.c.from("hub_posts").insert({ kind: "event", title: T + "Test event", body: "## Hello\n- one", event_at: new Date(Date.now() + 864e5).toISOString(), capacity: 1, author_id: mentor.id }).select("id,rsvp_count").single();
check("a mentor can publish a Hub post", !post.error, msg(post.error));
cleanup.hub.push(post.data.id);
check("a buyer cannot publish a Hub post", !!(await r1.c.from("hub_posts").insert({ kind: "tip", title: "Buyer post", author_id: r1.id })).error);
check("a seller cannot publish a Hub post", !!(await thandi.c.from("hub_posts").insert({ kind: "tip", title: "Seller post", author_id: thandi.id })).error);
check("a published post is public", ((await anon.from("hub_posts").select("id").eq("id", post.data.id)).data ?? []).length === 1);
const draft = await mentor.c.from("hub_posts").insert({ kind: "tip", title: T + "Draft", published: false, author_id: mentor.id }).select("id").single();
cleanup.hub.push(draft.data.id);
check("a draft is hidden from the public and from other users", ((await anon.from("hub_posts").select("id").eq("id", draft.data.id)).data ?? []).length === 0 && ((await r1.c.from("hub_posts").select("id").eq("id", draft.data.id)).data ?? []).length === 0);
check("a draft is visible to its author", ((await mentor.c.from("hub_posts").select("id").eq("id", draft.data.id)).data ?? []).length === 1);
check("a buyer cannot edit another person's post", ((await r1.c.from("hub_posts").update({ title: "hacked" }).eq("id", post.data.id).select()).data ?? []).length === 0);
const rs1 = await r1.c.from("hub_rsvps").insert({ post_id: post.data.id, user_id: r1.id });
check("a user can RSVP to an event", !rs1.error, msg(rs1.error));
check("the RSVP count updates", (await one(admin.from("hub_posts").select("rsvp_count").eq("id", post.data.id).single())).rsvp_count === 1);
const rs2 = await r2.c.from("hub_rsvps").insert({ post_id: post.data.id, user_id: r2.id });
check("a full event refuses more RSVPs", !!rs2.error && /event_full/.test(rs2.error.message), msg(rs2.error));
check("you cannot RSVP as someone else", !!(await r3.c.from("hub_rsvps").insert({ post_id: post.data.id, user_id: r2.id })).error);
const setCount = await mentor.c.from("hub_posts").update({ rsvp_count: 99 }).eq("id", post.data.id).select("rsvp_count").single();
check("the RSVP count cannot be edited by hand", setCount.data?.rsvp_count === 1, JSON.stringify(setCount.data));
await r1.c.from("hub_rsvps").delete().eq("post_id", post.data.id).eq("user_id", r1.id);
check("cancelling an RSVP lowers the count", (await one(admin.from("hub_posts").select("rsvp_count").eq("id", post.data.id).single())).rsvp_count === 0);

const oh = await mentor.c.from("hub_posts").insert({ kind: "office_hours", title: T + "Office hours", author_id: mentor.id }).select("id").single();
cleanup.hub.push(oh.data.id);
const bk = await thandi.c.from("hub_bookings").insert({ post_id: oh.data.id, user_id: thandi.id, message: "Help with pricing" }).select("id").single();
check("a seller can request an office-hours slot", !bk.error, msg(bk.error));
check("the host is notified of the request", (await one(admin.from("notifications").select("type").eq("user_id", mentor.id).eq("type", "hub_booking"))).length >= 1);
check("a duplicate open request is refused", (await thandi.c.from("hub_bookings").insert({ post_id: oh.data.id, user_id: thandi.id })).error?.code === "23505");
check("a user cannot book an event (only office hours)", !!(await thandi.c.from("hub_bookings").insert({ post_id: post.data.id, user_id: thandi.id })).error);
check("the requester cannot confirm their own booking", ((await thandi.c.from("hub_bookings").update({ status: "confirmed" }).eq("id", bk.data.id).select()).data ?? []).length === 0);
check("other users cannot read the booking", ((await r1.c.from("hub_bookings").select("id").eq("id", bk.data.id)).data ?? []).length === 0);
const ans = await mentor.c.from("hub_bookings").update({ status: "confirmed", host_note: "Thursday 14:30" }).eq("id", bk.data.id).select().single();
check("the host can confirm a request", !ans.error && ans.data?.status === "confirmed", msg(ans.error));
check("the requester is notified of the answer", (await one(admin.from("notifications").select("title").eq("user_id", thandi.id).eq("type", "hub_booking"))).some((n) => /confirmed/.test(n.title)));
const rewrite = await mentor.c.from("hub_bookings").update({ message: "rewritten" }).eq("id", bk.data.id);
check("a booking's original message cannot be rewritten", !!rewrite.error);

// ============================================================= 12. POPIA: delete my account
const email = `zz.delete.${Date.now()}@vossie.net`;
const made2 = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { popia_consent: "true", display_name: "Zola Deletetest" } });
const del = { id: made2.data.user.id }; cleanup.users.push(del.id);
const delC = createClient(URL, ANON, { auth: { persistSession: false } }); await delC.auth.signInWithPassword({ email, password: PASSWORD });
const dc = await delC.from("conversations").insert({ buyer_id: del.id, seller_id: thandiS.id, listing_id: thandiL[3].id }).select("id").single();
cleanup.conv.push(dc.data.id);
await delC.from("messages").insert({ conversation_id: dc.data.id, sender_id: del.id, body: "Hi, is this still available?" });
await delC.from("saved_listings").insert({ user_id: del.id, listing_id: thandiL[0].id });
const before = await one(admin.from("profiles").select("display_name,email").eq("id", del.id).single());
check("the account starts with a name and email", before.display_name === "Zola Deletetest" && before.email === email.toLowerCase());
const un = await delC.from("profiles").update({ deleted_at: null, role: "admin" }).eq("id", del.id);
check("a user cannot self-promote while deleting", !!un.error);
const soft = await delC.from("profiles").update({ deleted_at: new Date().toISOString() }).eq("id", del.id);
check("a user can soft-delete their own account", !soft.error, msg(soft.error));
const scrubbed = await one(admin.from("profiles").select("display_name,email,avatar_url,phone,deleted_at").eq("id", del.id).single());
check("personal details are scrubbed immediately", scrubbed.display_name === "Deleted user" && scrubbed.email === null && scrubbed.phone === null && !!scrubbed.deleted_at);
check("their saved items are cleared", ((await admin.from("saved_listings").select("listing_id").eq("user_id", del.id)).data ?? []).length === 0);
const conv2 = await one(admin.from("conversations").select("buyer_name").eq("id", dc.data.id).single());
check("the conversation shows them as 'Deleted user'", conv2.buyer_name === "Deleted user");
const survive = await thandi.c.from("messages").select("body").eq("conversation_id", dc.data.id);
check("the seller still sees the message history (anonymised, not erased)", (survive.data ?? []).length === 1);
check("a deleted user cannot message any more", !!(await delC.from("messages").insert({ conversation_id: dc.data.id, sender_id: del.id, body: "still here?" })).error);
check("a deleted user cannot reverse the deletion", !!(await delC.from("profiles").update({ deleted_at: null }).eq("id", del.id)).error || (await one(admin.from("profiles").select("deleted_at").eq("id", del.id).single())).deleted_at !== null);
check("the deletion is audited without identifying the person", (await one(admin.from("audit_log").select("actor_id").eq("action", "account.deleted").eq("target_id", del.id)))[0]?.actor_id === null);

// ============================================================= cleanup
await admin.from("conversations").delete().in("id", cleanup.conv);
await admin.from("hub_posts").delete().in("id", cleanup.hub);
await admin.from("reports").delete().in("reporter_id", rep.map((r) => r.id));
await admin.from("user_warnings").delete().eq("user_id", r4.id);
await resetModeration([r2.id, r4.id, r5.id, ethan.id]);
await resetAisha();
await admin.from("profiles").update({ role: "buyer" }).eq("id", aisha.id);
for (const id of cleanup.users) { await admin.from("profiles").update({ deleted_at: null }).eq("id", id); await admin.auth.admin.deleteUser(id); }
// put the seeded demo report back for the admin queue
await admin.from("reports").insert({ reporter_id: (await login("20250201@vossie.net")).id, target_type: "listing", target_id: siphoL.find((l) => l.title.includes("Air Force")).id, reason: "scam", note: "Asked me to pay a deposit before I could see the sneakers." });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
