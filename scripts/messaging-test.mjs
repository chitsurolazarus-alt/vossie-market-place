// Phase 4 access-control and rule checks for messaging, enquiries and trust.
// Usage: node --env-file=.env.local scripts/messaging-test.mjs
// Signs in as real demo users with the anon key (RLS applies) and uses the service role only to set up and clean up.
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "Vossie-Demo-2026!";
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`); };
const msgOf = (e) => (e?.message ?? "") + " " + (e?.code ?? "");

async function login(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { c, id: data.user.id };
}
const one = async (q) => { const { data, error } = await q; if (error) throw new Error(error.message); return data; };

const buyer = await login("20250206@vossie.net");      // Dineo (demo buyer used for the main flow)
const rateBuyer = await login("20250205@vossie.net");  // Zinhle (rate-limit tests)
const convBuyer = await login("20250204@vossie.net");  // Thabo (conversation rate-limit test)
const sipho = await login("20250107@vossie.net");      // seller (Sipho Sneaker Spot)
const thandi = await login("20250101@vossie.net");     // seller, not part of the test conversation
const mentor = await login("mentor.demo@eduvos.com");
const adminU = await login("admin.demo@eduvos.com");
const anon = createClient(URL, ANON, { auth: { persistSession: false } });

const siphoSeller = await one(admin.from("seller_profiles").select("id,user_id").eq("user_id", sipho.id).single());
const thandiSeller = await one(admin.from("seller_profiles").select("id").eq("user_id", thandi.id).single());
const siphoListings = await one(admin.from("listings").select("id,title,pricing_mode").eq("seller_id", siphoSeller.id).order("title"));
const cashListing = siphoListings.find((l) => l.pricing_mode === "cash");
const swapListing = siphoListings.find((l) => l.pricing_mode === "both");
const created = []; // conversation ids to delete afterwards

// Clean slate for the test buyers
for (const b of [buyer, rateBuyer, convBuyer]) await admin.from("conversations").delete().eq("buyer_id", b.id).eq("seller_id", siphoSeller.id);

// ---------------------------------------------------------------- conversations & enquiries
const ins = await buyer.c.from("conversations").insert({ buyer_id: buyer.id, seller_id: siphoSeller.id, listing_id: cashListing.id }).select("*").single();
check("buyer can start a conversation", !ins.error, msgOf(ins.error));
const conv = ins.data; created.push(conv.id);
check("conversation snapshots the listing title and seller name", conv.listing_title === cashListing.title && !!conv.seller_name);
check("buyer name is shown as first name + initial", /^\w+ \w\.$/.test(conv.buyer_name ?? ""), conv.buyer_name);
const enq = await one(admin.from("enquiries").select("*").eq("conversation_id", conv.id).single());
check("an enquiry row is created automatically with status 'new'", enq.status === "new" && enq.source === "in_app");

const dup = await buyer.c.from("conversations").insert({ buyer_id: buyer.id, seller_id: siphoSeller.id, listing_id: cashListing.id });
check("one conversation per (buyer, seller, listing): duplicate rejected", !!dup.error && dup.error.code === "23505", msgOf(dup.error));

const own = await sipho.c.from("conversations").insert({ buyer_id: sipho.id, seller_id: siphoSeller.id, listing_id: cashListing.id });
check("sellers cannot enquire on their own listings", !!own.error && /own_listing/.test(own.error.message), msgOf(own.error));

const spoofConv = await buyer.c.from("conversations").insert({ buyer_id: rateBuyer.id, seller_id: siphoSeller.id, listing_id: swapListing.id });
check("a buyer cannot create a conversation as someone else", !!spoofConv.error, "insert succeeded");

const wrongListing = await buyer.c.from("conversations").insert({ buyer_id: buyer.id, seller_id: siphoSeller.id, listing_id: (await one(admin.from("listings").select("id").eq("seller_id", thandiSeller.id).limit(1)))[0].id });
check("a listing must belong to the conversation's seller", !!wrongListing.error, "insert succeeded");

// ---------------------------------------------------------------- messages
const m1 = await buyer.c.from("messages").insert({ conversation_id: conv.id, sender_id: buyer.id, body: "Hi! Is it still available?" }).select("*").single();
check("buyer can send a message", !m1.error, msgOf(m1.error));
const spoofMsg = await buyer.c.from("messages").insert({ conversation_id: conv.id, sender_id: sipho.id, body: "I am the seller" });
check("cannot send a message as another user", !!spoofMsg.error);
const long = await buyer.c.from("messages").insert({ conversation_id: conv.id, sender_id: buyer.id, body: "x".repeat(1001) });
check("messages over 1000 characters are rejected", !!long.error);
const risky = await buyer.c.from("messages").insert({ conversation_id: conv.id, sender_id: buyer.id, body: "Please pay a deposit first" }).select("risk_flag").single();
check("'pay deposit first' is flagged (warn, not blocked)", risky.data?.risk_flag === "payment", JSON.stringify(risky));
const bank = await buyer.c.from("messages").insert({ conversation_id: conv.id, sender_id: buyer.id, body: "My account number is 1234567890" }).select("risk_flag").single();
check("bank details are flagged (warn, not blocked)", bank.data?.risk_flag === "bank", JSON.stringify(bank));
const dupId = await buyer.c.from("messages").insert({ id: m1.data.id, conversation_id: conv.id, sender_id: buyer.id, body: "retry" });
check("re-sending the same message id is rejected (retries are idempotent)", dupId.error?.code === "23505", msgOf(dupId.error));
const swapMsgCash = await buyer.c.from("messages").insert({ conversation_id: conv.id, sender_id: buyer.id, kind: "swap_offer", body: "I offer airtime" });
check("swap offers are refused on cash-only listings", !!swapMsgCash.error && /cash only/.test(swapMsgCash.error.message), msgOf(swapMsgCash.error));
const noContent = await buyer.c.from("messages").insert({ conversation_id: conv.id, sender_id: buyer.id, body: "   " });
check("an empty message is rejected", !!noContent.error);

// ---------------------------------------------------------------- who can read
const read = async (who) => (await who.c.from("messages").select("id").eq("conversation_id", conv.id)).data?.length ?? 0;
check("buyer can read the thread", (await read(buyer)) >= 1);
check("seller can read the thread", (await read(sipho)) >= 1);
check("a non-participant seller cannot read the thread", (await read(thandi)) === 0);
check("another buyer cannot read the thread", (await read(rateBuyer)) === 0);
check("a mentor cannot read message content", (await read(mentor)) === 0);
check("an admin can read the thread (moderation)", (await read(adminU)) >= 1);
check("anonymous visitors cannot read conversations, messages or enquiries",
  (await anon.from("messages").select("id").limit(1)).data?.length !== 1 && (await anon.from("conversations").select("id").limit(1)).data?.length !== 1 && (await anon.from("enquiries").select("id").limit(1)).data?.length !== 1);
const nonParticipantSend = await thandi.c.from("messages").insert({ conversation_id: conv.id, sender_id: thandi.id, body: "hello?" });
check("a non-participant cannot post into the thread", !!nonParticipantSend.error);
check("a non-participant cannot read the conversation row", ((await thandi.c.from("conversations").select("id").eq("id", conv.id)).data ?? []).length === 0);
check("a non-participant cannot read the enquiry", ((await thandi.c.from("enquiries").select("id").eq("conversation_id", conv.id)).data ?? []).length === 0);

// ---------------------------------------------------------------- message edits & read receipts
const edit = await sipho.c.from("messages").update({ body: "tampered" }).eq("id", m1.data.id).select();
check("the recipient cannot edit a message body", !!edit.error || (edit.data ?? []).length === 0, JSON.stringify(edit.data));
const selfEdit = await buyer.c.from("messages").update({ body: "edited" }).eq("id", m1.data.id).select();
check("the sender cannot edit their own message", (selfEdit.data ?? []).length === 0 || !!selfEdit.error);
const seen = await sipho.c.from("messages").update({ read_at: new Date().toISOString() }).eq("conversation_id", conv.id).neq("sender_id", sipho.id).is("read_at", null).select("id");
check("the recipient can mark messages as seen", !seen.error && (seen.data ?? []).length >= 1, msgOf(seen.error));
const unseen = await sipho.c.from("messages").update({ read_at: null }).eq("id", m1.data.id).select();
check("a seen receipt cannot be reverted", !!unseen.error || (unseen.data ?? []).length === 0);
const selfSeen = await buyer.c.from("messages").update({ read_at: new Date().toISOString() }).eq("id", m1.data.id).select();
check("a sender cannot mark their own message as seen by the other side", !!selfSeen.error || (selfSeen.data ?? []).length === 0);
const del = await buyer.c.from("messages").delete().eq("id", m1.data.id).select();
check("messages cannot be deleted", (del.data ?? []).length === 0);

// ---------------------------------------------------------------- reply clock + enquiry rules
const reply = await sipho.c.from("messages").insert({ conversation_id: conv.id, sender_id: sipho.id, body: "Yes it is! Collect at the library entrance?" });
check("seller can reply", !reply.error, msgOf(reply.error));
const enq2 = await one(admin.from("enquiries").select("*").eq("id", enq.id).single());
check("the seller's first reply sets first_response_at", !!enq2.first_response_at);

const buyerStatus = await buyer.c.from("enquiries").update({ status: "completed", sale_happened: true }).eq("id", enq.id).select();
check("a buyer cannot change an enquiry's status", !!buyerStatus.error || (buyerStatus.data ?? []).length === 0, JSON.stringify(buyerStatus.data));
const buyerEarly = await buyer.c.from("enquiries").update({ buyer_confirmed_at: new Date().toISOString() }).eq("id", enq.id).select();
check("a buyer cannot confirm before the seller completes it", !!buyerEarly.error || (buyerEarly.data ?? []).length === 0);
const skip = await sipho.c.from("enquiries").update({ status: "completed", sale_happened: true }).eq("id", enq.id).select();
check("a seller cannot jump new -> completed", !!skip.error, JSON.stringify(skip.data));
const sellerField = await sipho.c.from("enquiries").update({ first_response_at: new Date(Date.now() - 3600e3).toISOString() }).eq("id", enq.id).select();
check("a seller cannot rewrite first_response_at", !!sellerField.error || (sellerField.data ?? []).length === 0);
const sellerConfirm = await sipho.c.from("enquiries").update({ status: "in_progress", buyer_confirmed_at: new Date().toISOString() }).eq("id", enq.id).select();
check("a seller cannot confirm a sale on the buyer's behalf", !!sellerConfirm.error);
const start = await sipho.c.from("enquiries").update({ status: "in_progress" }).eq("id", enq.id).select().single();
check("seller can move new -> in progress", !start.error && start.data?.status === "in_progress", msgOf(start.error));
const noAnswer = await sipho.c.from("enquiries").update({ status: "completed" }).eq("id", enq.id).select();
check("completing requires saying whether the sale happened", !!noAnswer.error, JSON.stringify(noAnswer.data));
const otherSeller = await thandi.c.from("enquiries").update({ status: "declined" }).eq("id", enq.id).select();
check("another seller cannot change this enquiry", (otherSeller.data ?? []).length === 0 || !!otherSeller.error);

const before = (await one(admin.from("seller_trust").select("confirmed_sales").eq("seller_id", siphoSeller.id).single())).confirmed_sales;
const done = await sipho.c.from("enquiries").update({ status: "completed", sale_happened: true }).eq("id", enq.id).select().single();
check("seller completes with 'yes, it happened' and a confirmation request is created", !done.error && !!done.data?.completion_requested_at, msgOf(done.error));
const midTrust = (await one(admin.from("seller_trust").select("confirmed_sales").eq("seller_id", siphoSeller.id).single())).confirmed_sales;
check("an unconfirmed sale does NOT count toward trust", midTrust === before, `${before} -> ${midTrust}`);
const prompt = await one(admin.from("notifications").select("type").eq("user_id", buyer.id).eq("enquiry_id", enq.id));
check("the buyer is notified to confirm", prompt.some((n) => n.type === "completion_request"));
const dispute = await buyer.c.from("enquiries").update({ buyer_confirmed_at: new Date().toISOString(), buyer_disputed_at: new Date().toISOString() }).eq("id", enq.id).select();
check("a buyer cannot confirm and dispute at once", !!dispute.error);
const confirm = await buyer.c.from("enquiries").update({ buyer_confirmed_at: new Date().toISOString() }).eq("id", enq.id).select().single();
check("buyer can confirm completion", !confirm.error && !!confirm.data?.buyer_confirmed_at, msgOf(confirm.error));
const after = (await one(admin.from("seller_trust").select("confirmed_sales").eq("seller_id", siphoSeller.id).single())).confirmed_sales;
check("a buyer-confirmed sale counts toward trust", after === before + 1, `${before} -> ${after}`);
const twice = await buyer.c.from("enquiries").update({ buyer_disputed_at: new Date().toISOString() }).eq("id", enq.id).select();
check("a buyer cannot change their answer afterwards", !!twice.error || (twice.data ?? []).length === 0);
const reopenStatus = await sipho.c.from("enquiries").update({ status: "in_progress" }).eq("id", enq.id).select();
check("a completed enquiry cannot be moved back", !!reopenStatus.error);

// decline + reopen on a fresh general conversation
const g = await buyer.c.from("conversations").insert({ buyer_id: buyer.id, seller_id: siphoSeller.id, listing_id: null }).select("id").single();
created.push(g.data.id);
await buyer.c.from("messages").insert({ conversation_id: g.data.id, sender_id: buyer.id, body: "Do you do custom orders?" });
const gEnq = await one(admin.from("enquiries").select("id").eq("conversation_id", g.data.id).single());
const decl = await sipho.c.from("enquiries").update({ status: "declined" }).eq("id", gEnq.id).select().single();
check("seller can decline a new enquiry", !decl.error && decl.data?.status === "declined", msgOf(decl.error));
const dupGeneral = await buyer.c.from("conversations").insert({ buyer_id: buyer.id, seller_id: siphoSeller.id, listing_id: null });
check("seller-level chats are also one per (buyer, seller)", dupGeneral.error?.code === "23505", msgOf(dupGeneral.error));
await buyer.c.from("messages").insert({ conversation_id: g.data.id, sender_id: buyer.id, body: "Following up!" });
const reopened = await one(admin.from("enquiries").select("status").eq("id", gEnq.id).single());
check("re-enquiring on a declined conversation reopens it as 'new'", reopened.status === "new", reopened.status);

// ---------------------------------------------------------------- trust cannot be written
const tierBefore = (await one(admin.from("seller_trust").select("tier").eq("seller_id", siphoSeller.id).single())).tier;
const forge = await sipho.c.from("seller_trust").update({ tier: "top_hustler", confirmed_sales: 99 }).eq("seller_id", siphoSeller.id).select();
check("a seller cannot update their own trust score", !!forge.error || (forge.data ?? []).length === 0);
const forgeIns = await sipho.c.from("seller_trust").insert({ seller_id: thandiSeller.id, tier: "top_hustler" });
check("nobody can insert trust rows through the API", !!forgeIns.error);
const forgeDel = await sipho.c.from("seller_trust").delete().eq("seller_id", siphoSeller.id).select();
check("nobody can delete trust rows through the API", !!forgeDel.error || (forgeDel.data ?? []).length === 0);
check("the forged update changed nothing", (await one(admin.from("seller_trust").select("tier").eq("seller_id", siphoSeller.id).single())).tier === tierBefore);
const forgeTier = await sipho.c.from("trust_tiers").update({ min_confirmed: 0 }).eq("tier", "top_hustler").select();
check("a seller cannot edit the tier rules", !!forgeTier.error || (forgeTier.data ?? []).length === 0);
check("tier rules are publicly readable", ((await anon.from("trust_tiers").select("tier")).data ?? []).length === 4);
check("trust scores of approved sellers are publicly readable", ((await anon.from("seller_trust").select("tier")).data ?? []).length >= 8);
check("seeded tiers: 1 Top Hustler, 2 Trusted, 3 Responsive, 2 New",
  await (async () => { const t = await one(admin.from("seller_trust").select("tier")); const n = (k) => t.filter((r) => r.tier === k).length; return n("top_hustler") === 1 && n("trusted") === 2 && n("responsive") === 3 && n("new") === 2; })());
const thandiTrust = await one(admin.from("seller_trust").select("tier").eq("seller_id", thandiSeller.id).single());
check("Thandi's Kitchen is the Top Hustler", thandiTrust.tier === "top_hustler", thandiTrust.tier);

// ---------------------------------------------------------------- notifications
const seenNotifs = await one(sipho.c.from("notifications").select("id,title,user_id"));
check("sellers only see their own notifications", seenNotifs.length > 0 && seenNotifs.every((n) => n.user_id === sipho.id));
const forgeNotif = await sipho.c.from("notifications").insert({ user_id: buyer.id, type: "new_message", title: "forged" });
check("clients cannot create notifications", !!forgeNotif.error);
const mine = seenNotifs[0];
const edited = await sipho.c.from("notifications").update({ title: "changed" }).eq("id", mine.id).select();
check("notification content cannot be edited", !!edited.error || (edited.data ?? []).length === 0);
const readOne = await sipho.c.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", mine.id).select();
check("a user can mark their own notification read", !readOne.error && (readOne.data ?? []).length === 1, msgOf(readOne.error));
const others = await thandi.c.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", sipho.id).select();
check("a user cannot touch another user's notifications", (others.data ?? []).length === 0);
const batch = await one(admin.from("notifications").select("id,count").eq("user_id", sipho.id).eq("type", "new_message").eq("conversation_id", conv.id));
check("message notifications are batched: at most one per conversation per 15 min", batch.length <= 1, `${batch.length} rows`);

// ---------------------------------------------------------------- quick replies
await admin.from("quick_replies").delete().eq("seller_id", siphoSeller.id);
let qrOk = 0; for (let i = 0; i < 5; i++) if (!(await sipho.c.from("quick_replies").insert({ seller_id: siphoSeller.id, body: `Reply ${i}`, position: i })).error) qrOk++;
const qr6 = await sipho.c.from("quick_replies").insert({ seller_id: siphoSeller.id, body: "one too many", position: 5 });
check("a seller can save 5 quick replies but not a 6th", qrOk === 5 && !!qr6.error, `${qrOk}, ${msgOf(qr6.error)}`);
check("other sellers cannot read someone's quick replies", ((await thandi.c.from("quick_replies").select("id").eq("seller_id", siphoSeller.id)).data ?? []).length === 0);
await admin.from("quick_replies").delete().eq("seller_id", siphoSeller.id);

// ---------------------------------------------------------------- private images
const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#16305E" } }).webp().toBuffer();
const path = `${conv.id}/${buyer.id}/test-${Date.now()}.webp`;
const up = await buyer.c.storage.from("message-images").upload(path, png, { contentType: "image/webp" });
check("a participant can upload a chat photo", !up.error, msgOf(up.error));
const upBad = await thandi.c.storage.from("message-images").upload(`${conv.id}/${thandi.id}/x.webp`, png, { contentType: "image/webp" });
check("a non-participant cannot upload into someone else's conversation", !!upBad.error);
const upSpoof = await buyer.c.storage.from("message-images").upload(`${conv.id}/${sipho.id}/x.webp`, png, { contentType: "image/webp" });
check("you cannot upload into another user's folder", !!upSpoof.error);
check("the other participant can open the photo via a signed URL", !(await sipho.c.storage.from("message-images").createSignedUrl(path, 60)).error);
const stranger = await thandi.c.storage.from("message-images").createSignedUrl(path, 60);
check("a non-participant cannot get a signed URL", !!stranger.error || !stranger.data?.signedUrl);
check("chat photos are not publicly reachable", (await fetch(`${URL}/storage/v1/object/public/message-images/${path}`)).status >= 400);
const withImage = await buyer.c.from("messages").insert({ conversation_id: conv.id, sender_id: buyer.id, body: "", image_path: path }).select("id").single();
check("a message can carry just a photo", !withImage.error, msgOf(withImage.error));
const wrongPath = await buyer.c.from("messages").insert({ conversation_id: conv.id, sender_id: buyer.id, body: "x", image_path: `${conv.id}/${sipho.id}/y.webp` });
check("a message cannot reference someone else's photo path", !!wrongPath.error);
await admin.storage.from("message-images").remove([path]);

// ---------------------------------------------------------------- swap offers
const swapConv = await rateBuyer.c.from("conversations").insert({ buyer_id: rateBuyer.id, seller_id: siphoSeller.id, listing_id: swapListing.id }).select("id").single();
created.push(swapConv.data.id);
const swapOffer = await rateBuyer.c.from("messages").insert({ conversation_id: swapConv.data.id, sender_id: rateBuyer.id, kind: "swap_offer", body: "R50 airtime" }).select("kind").single();
check("swap offers are allowed on swap listings", swapOffer.data?.kind === "swap_offer", msgOf(swapOffer.error));
const swapOther = await rateBuyer.c.from("messages").insert({ conversation_id: swapConv.data.id, sender_id: rateBuyer.id, kind: "swap_offer", body: "x", swap_listing_id: cashListing.id });
check("you can only offer your own listings in a swap", !!swapOther.error, "accepted someone else's listing");
const swapMine = await sipho.c.from("messages").insert({ conversation_id: swapConv.data.id, sender_id: sipho.id, kind: "swap_offer", body: "", swap_listing_id: cashListing.id }).select("swap_listing_title").single();
check("a seller can offer one of their own listings (title snapshotted)", swapMine.data?.swap_listing_title === cashListing.title, msgOf(swapMine.error));

// ---------------------------------------------------------------- rate limits (last: they lock the test accounts for a minute)
let sent = 0, limited = null;
for (let i = 0; i < 34; i++) {
  const r = await rateBuyer.c.from("messages").insert({ conversation_id: swapConv.data.id, sender_id: rateBuyer.id, body: `spam ${i}` });
  if (r.error) { limited = r.error; break; }
  sent++;
}
check(`message rate limit: 30 a minute (stopped after ${sent + 3} incl. earlier)`, !!limited && /rate_limit_messages/.test(limited.message) && sent <= 30, msgOf(limited));

const allListings = await one(admin.from("listings").select("id,seller_id").is("deleted_at", null));
const mineExisting = new Set((await one(admin.from("conversations").select("listing_id").eq("buyer_id", convBuyer.id))).map((c) => c.listing_id));
const targets = allListings.filter((l) => !mineExisting.has(l.id) && l.seller_id !== (null)).slice(0, 14);
let convs = 0, convLimited = null;
for (const l of targets) {
  const r = await convBuyer.c.from("conversations").insert({ buyer_id: convBuyer.id, seller_id: l.seller_id, listing_id: l.id }).select("id").single();
  if (r.error) { if (/rate_limit_conversations/.test(r.error.message)) { convLimited = r.error; break; } continue; }
  created.push(r.data.id); convs++;
}
check("conversation rate limit: 10 new conversations an hour", !!convLimited && convs <= 10, `${convs} created, ${msgOf(convLimited)}`);

// ---------------------------------------------------------------- cleanup (service role)
await admin.from("conversations").delete().in("id", created);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
