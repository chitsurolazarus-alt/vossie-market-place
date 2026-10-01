// Demo seed: 2 staff, 8 approved sellers, 32 listings with generated images.
// Usage: node --env-file=.env.local scripts/seed.mjs
// Uses the service-role key (server-side script only). Idempotent: reruns skip existing users
// and replace the demo sellers' listings.
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env vars");
const db = createClient(url, key, { auth: { persistSession: false } });

export const DEMO_PASSWORD = "Vossie-Demo-2026!";

const STAFF = [
  { email: "admin.demo@eduvos.com", name: "Nomsa Dlamini (Admin)", role: "admin" },
  { email: "mentor.demo@eduvos.com", name: "Pieter van Wyk (Mentor)", role: "mentor" },
  { email: "20250109@vossie.net", name: "Ayanda Buthelezi (Buyer)", role: "buyer" },
];

const CATEGORY_COLOURS = {
  food: "#B4541A", beauty: "#8A3A6B", tutoring: "#1F6F5C", design: "#2352C4",
  tech: "#16305E", fashion: "#7A2E2E", events: "#5B4B8A", trading: "#3D5A2E", other: "#4A5468",
  construction: "#6B5B2E",
};

const SELLERS = [
  { email: "20250101@vossie.net", name: "Thandi Mokoena", biz: "Thandi's Kitchen", cat: "food", campus: "midrand", verified: true,
    tagline: "Kotas, gatsbys and fresh bakes between lectures.",
    bio: "Second-year BCom student cooking township-style favourites from my res kitchen. Pre-order by 10am and collect at the library entrance after your last class.",
    wa: "+27710000101", pref: "both", listings: [
      ["product","Chicken kota with atchar",45,"cash",null,"Crunchy quarter loaf stuffed with polony, chips, cheese and atchar. Pre-order by 10am for a 1pm collection.","kota,lunch,street food"],
      ["product","Vetkoek and mince (2 pack)",35,"cash",null,"Two golden vetkoek filled with spiced mince. Made fresh each morning.","vetkoek,mince,breakfast"],
      ["product","Weekend baking box",120,"both","Help with a poster or Instagram post","Six muffins, four rolls and a small loaf. Order by Thursday for Friday pickup.","baking,muffins,box"],
      ["product","Chilli bites tray (20)",90,"cash",null,"Spicy chicken and cheese bites, perfect for study group snacks or a res party.","snacks,party,spicy"]] },
  { email: "20250102@vossie.net", name: "Lwazi Ndlovu", biz: "Lwazi Cuts", cat: "beauty", campus: "midrand", verified: true,
    tagline: "Fresh fades on campus, no queue at the mall.",
    bio: "Barber for three years, now studying IT. I bring the clippers to you: res, library lawns or the student centre. Bookings only so you never wait.",
    wa: "+27710000102", pref: "whatsapp", listings: [
      ["service","Skin fade and line-up",60,"cash",null,"Clean fade with sharp line-up. Takes about 40 minutes. Booking required.","haircut,fade,barber"],
      ["service","Beard trim and shape",30,"cash",null,"Precise beard shaping with hot towel finish.","beard,grooming"],
      ["service","Res room haircut (2 friends)",100,"cash",null,"Bring a friend and split the cost. I come to your res common room.","haircut,res,group"],
      ["service","Haircut for data or airtime",0,"swap","R50 airtime or 1GB data bundle","Short on cash? Swap a haircut for airtime or data.","swap,airtime,haircut"]] },
  { email: "20250103@vossie.net", name: "Naledi Sithole", biz: "Naledi Notes", cat: "tutoring", campus: "midrand", verified: false,
    tagline: "Accounting and maths help that actually sticks.",
    bio: "Distinction in Financial Accounting and Maths 1. I explain things the way I wish someone explained them to me. One-on-one or small groups.",
    wa: "+27710000103", pref: "both", listings: [
      ["service","Financial Accounting tutoring (1 hour)",80,"cash",null,"One-on-one session covering journals, ledgers and trial balances. Past paper practice included.","accounting,tutor,exams"],
      ["service","Maths 1 exam crash course",250,"cash",null,"Three focused sessions before exams: limits, derivatives and integration.","maths,exam prep"],
      ["product","Summarised study notes bundle",60,"cash",null,"Clean, colour-coded PDF notes for first-year accounting and maths.","notes,pdf,study"],
      ["service","Tutoring for a design job",0,"swap","Logo or poster design","I tutor you, you design a poster for my study group.","swap,tutor,design"]] },
  { email: "20250104@vossie.net", name: "Kagiso Molefe", biz: "Pixel & Pen Studio", cat: "design", campus: "midrand", verified: true,
    tagline: "Logos and posters for student hustles that want to look pro.",
    bio: "Graphic design student building brands for other student businesses. Fast turnaround, unlimited tweaks on the first draft.",
    wa: "+27710000104", pref: "in_app", listings: [
      ["service","Logo design (2 concepts)",250,"cash",null,"Two logo concepts, one round of changes, delivered as PNG and PDF within 3 days.","logo,branding"],
      ["service","Instagram post pack (5 designs)",150,"cash",null,"Five matching post templates for your business page, editable in Canva.","instagram,social media"],
      ["service","Event poster or flyer",120,"both","Photography for my portfolio","A4 or Instagram size, ready for printing.","poster,flyer,event"],
      ["service","CV and LinkedIn makeover",90,"cash",null,"Modern CV layout plus profile tips so you stand out for internships.","cv,career"]] },
  { email: "20250105@vossie.net", name: "Zanele Khumalo", biz: "Zanele's Braids", cat: "beauty", campus: "durban", verified: true,
    tagline: "Neat knotless braids that last, done on campus.",
    bio: "Braider with five years of experience. I use quality hair, protect your edges and finish within a study-friendly time slot.",
    wa: "+27710000105", pref: "both", listings: [
      ["service","Knotless braids (medium)",450,"cash",null,"Medium knotless braids, waist length. Hair not included unless requested.","braids,knotless,hair"],
      ["service","Cornrows (straight back)",180,"cash",null,"Neat straight-back cornrows in about two hours.","cornrows,hair"],
      ["service","Take-down and wash",120,"cash",null,"Gentle take-down, detangle and wash to keep your hair healthy.","hair care,take down"],
      ["service","Braids for laptop repair",0,"swap","Laptop cleaning or software fix","Swap a braiding session for tech help.","swap,braids,tech"]] },
  { email: "20250106@vossie.net", name: "Ethan Naidoo", biz: "CodeCraft Fixers", cat: "tech", campus: "durban", verified: false,
    tagline: "Slow laptop? Cracked screen? Let's sort it.",
    bio: "IT student who fixes laptops, phones and Wi-Fi headaches. Honest quotes before I touch anything and 7-day guarantee on repairs.",
    wa: "+27710000106", pref: "whatsapp", listings: [
      ["service","Laptop clean-up and speed boost",150,"cash",null,"Remove junk, update drivers, dust the fans and refresh the system.","laptop,repair,speed"],
      ["service","Phone screen protector and setup",50,"cash",null,"Tempered glass fitted and phone set up with your accounts.","phone,screen,setup"],
      ["service","Simple website for your hustle",600,"cash",null,"One-page site with your products, prices and a WhatsApp button.","website,web design"],
      ["product","Refurbished 32GB flash drive",70,"cash",null,"Tested and formatted, ready for assignments and backups.","flash drive,storage"]] },
  { email: "20250107@vossie.net", name: "Sipho Zulu", biz: "Sipho Sneaker Spot", cat: "fashion", campus: "durban", verified: false,
    tagline: "Clean kicks, cleaned sneakers, fair prices.",
    bio: "I clean, restore and resell sneakers. Bring yours for a fresh look or browse pairs I have sourced.",
    wa: "+27710000107", pref: "both", listings: [
      ["service","Sneaker deep clean",80,"cash",null,"Full hand clean including laces and midsoles. Ready in two days.","sneakers,cleaning"],
      ["product","Pre-loved Air Force 1 (size 8)",650,"both","Gaming console accessory","Worn a handful of times, freshly cleaned, original box included.","sneakers,size 8,nike"],
      ["product","Custom laces set (3 pairs)",60,"cash",null,"Three pairs of quality flat laces in mixed colours.","laces,accessories"],
      ["service","Sole whitening and restoration",120,"cash",null,"Bring back the shine to yellowed soles.","restoration,sneakers"]] },
  { email: "20250108@vossie.net", name: "Amahle Cele", biz: "Amahle Events & Decor", cat: "events", campus: "durban", verified: true,
    tagline: "Birthdays, res parties and society events, styled.",
    bio: "Event planning student who styles balloon arches, tables and small gatherings on a student budget. Setup and pack-down included.",
    wa: "+27710000108", pref: "both", listings: [
      ["service","Balloon arch (small)",300,"cash",null,"Choose your colours. Setup and pack-down included on campus.","balloons,decor,birthday"],
      ["service","Res birthday setup",450,"cash",null,"Table decor, banner and balloons for up to 15 guests.","birthday,party,res"],
      ["service","Society event coordinator",800,"both","Photography or DJ services","Full coordination for your society launch or social.","event,society,planning"],
      ["product","Party props box",120,"cash",null,"Photo booth props, banners and confetti in one box to hire for the weekend.","props,hire,party"]] },
];

function wrap(text, n = 18) {
  const words = text.split(" "); const lines = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > n) { lines.push(cur.trim()); cur = w; } else cur += " " + w; }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 4);
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

async function tile(text, colour, sub, size = 900) {
  const lines = wrap(text);
  const tspans = lines.map((l, i) => `<text x="60" y="${330 + i * 90}" font-family="Georgia, serif" font-size="76" font-weight="700" fill="#fff">${esc(l)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 900 900">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colour}"/><stop offset="1" stop-color="#16305e"/></linearGradient></defs>
    <rect width="900" height="900" fill="url(#g)"/><rect x="60" y="120" width="120" height="8" fill="#cfae7e"/>${tspans}
    <text x="60" y="820" font-family="Arial, sans-serif" font-size="34" fill="#cfae7e">${esc(sub)}</text></svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 78 }).toBuffer();
}

const slugify = (s) => s.toLowerCase().replace(/['’]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const must = (r, ctx) => { if (r.error) throw new Error(`${ctx}: ${r.error.message}`); return r.data; };

async function ensureUser(email, name) {
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const hit = list?.users.find((u) => u.email === email);
  if (hit) return hit.id;
  const { data, error } = await db.auth.admin.createUser({
    email, password: DEMO_PASSWORD, email_confirm: true,
    user_metadata: { popia_consent: "true", display_name: name },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

const campuses = Object.fromEntries(must(await db.from("campuses").select("id,slug"), "campuses").map((c) => [c.slug, c.id]));
const cats = Object.fromEntries(must(await db.from("categories").select("id,slug"), "categories").map((c) => [c.slug, c.id]));
const pickups = must(await db.from("pickup_points").select("id,campus_id,name"), "pickups");

for (const s of STAFF) {
  const id = await ensureUser(s.email, s.name);
  must(await db.from("profiles").update({ role: s.role, display_name: s.name, onboarding_seen: true }).eq("id", id), "staff role");
  s.id = id;
}
const mentorId = STAFF.find((s) => s.role === "mentor").id;

for (const s of SELLERS) {
  const uid = await ensureUser(s.email, s.name);
  must(await db.from("profiles").update({ display_name: s.name, campus_id: campuses[s.campus], onboarding_seen: true, seller_tour_seen: true }).eq("id", uid), "profile");

  const photoPath = `${uid}/profile.webp`;
  must(await db.storage.from("avatars").upload(photoPath, await tile(s.biz, CATEGORY_COLOURS[s.cat], "Vossie Market Place", 512), { contentType: "image/webp", upsert: true }), "avatar");
  const photoUrl = db.storage.from("avatars").getPublicUrl(photoPath).data.publicUrl;

  const row = {
    user_id: uid, campus_id: campuses[s.campus], category_id: cats[s.cat], business_name: s.biz,
    slug: slugify(s.biz), tagline: s.tagline, bio: s.bio, photo_url: photoUrl, contact_pref: s.pref,
    status: "approved", verified: s.verified, mentor_id: mentorId,
  };
  const seller = must(await db.from("seller_profiles").upsert(row, { onConflict: "user_id" }).select("id").single(), "seller");
  must(await db.from("seller_private").upsert({ seller_id: seller.id, whatsapp_e164: s.wa }), "private");

  const mine = pickups.filter((p) => p.campus_id === campuses[s.campus]);
  await db.from("seller_pickup_points").delete().eq("seller_id", seller.id);
  for (const p of mine.slice(0, 2)) must(await db.from("seller_pickup_points").insert({ seller_id: seller.id, pickup_point_id: p.id }), "pickup");

  s.sellerId = seller.id; s.uid = uid; s.listingIds = [];
  // replace demo listings (images cascade); conversations/enquiries/messages go first so the rerun is clean
  must(await db.from("conversations").delete().eq("seller_id", seller.id), "wipe conversations");
  await db.from("quick_replies").delete().eq("seller_id", seller.id);
  await db.from("listings").delete().eq("seller_id", seller.id);
  for (const [kind, title, price, mode, swap, desc, tagStr] of s.listings) {
    const listing = must(await db.from("listings").insert({
      seller_id: seller.id, campus_id: campuses[s.campus], category_id: cats[s.cat], kind, title,
      description: desc, pricing_mode: mode, price_zar: mode === "swap" ? null : price,
      price_is_from: kind === "service" && mode !== "swap", swap_for: swap,
      pickup_point_id: kind === "product" ? mine[0].id : null, delivered_on_campus: kind === "service",
    }).select("id").single(), `listing ${title}`);

    s.listingIds.push(listing.id);
    const path = `${uid}/${listing.id}/1.webp`;
    must(await db.storage.from("listing-images").upload(path, await tile(title, CATEGORY_COLOURS[s.cat], s.biz), { contentType: "image/webp", upsert: true }), "image");
    must(await db.from("listing_images").insert({ listing_id: listing.id, path, alt: `${title} by ${s.biz}`, position: 0 }), "listing image");

    for (const t of tagStr.split(",")) {
      const name = t.trim().toLowerCase();
      const tag = must(await db.from("tags").upsert({ name }, { onConflict: "name" }).select("id").single(), "tag");
      await db.from("listing_tags").insert({ listing_id: listing.id, tag_id: tag.id });
    }
  }
  console.log(`seeded ${s.biz} (${s.listings.length} listings)`);
}

// ---------------------------------------------------------------------------
// Phase 4: demo buyers, backdated accounts and enquiries so every trust tier has a seller.
// Target tiers: Top Hustler = Thandi; Trusted = Zanele, Amahle; Responsive = Kagiso, Naledi, Sipho;
// New seller = Lwazi (WhatsApp-only leads), Ethan.
// ---------------------------------------------------------------------------
const BUYERS = [
  ["20250201@vossie.net", "Lerato Mahlangu"], ["20250202@vossie.net", "Siyabonga Dube"], ["20250203@vossie.net", "Palesa Nkosi"],
  ["20250204@vossie.net", "Thabo Mthembu"], ["20250205@vossie.net", "Zinhle Mkhize"], ["20250206@vossie.net", "Dineo Radebe"],
];
const buyerIds = [];
for (const [email, name] of BUYERS) {
  const id = await ensureUser(email, name);
  must(await db.from("profiles").update({ display_name: name, onboarding_seen: true }).eq("id", id), "buyer profile");
  buyerIds.push(id);
}
const ayanda = STAFF.find((x) => x.email === "20250109@vossie.net").id;
const by = (biz) => SELLERS.find((x) => x.biz === biz);
const ACCOUNT_AGE_DAYS = { "Thandi's Kitchen": 130, "Lwazi Cuts": 100, "Naledi Notes": 20, "Pixel & Pen Studio": 25,
  "Zanele's Braids": 60, "CodeCraft Fixers": 5, "Sipho Sneaker Spot": 14, "Amahle Events & Decor": 45 };
for (const sl of SELLERS) {
  must(await db.from("seller_profiles").update({ created_at: new Date(Date.now() - ACCOUNT_AGE_DAYS[sl.biz] * 864e5).toISOString() }).eq("id", sl.sellerId), "backdate");
}

const ago = (days) => new Date(Date.now() - days * 864e5).toISOString();
const plus = (iso, minutes) => new Date(new Date(iso).getTime() + minutes * 6e4).toISOString();
const REPLIES = ["Hi! Yes, it's still available. When would suit you?", "Sure, I can do collection at the pickup point after your last class."];
let seq = 0;

/** Creates a conversation + enquiry (via the real triggers) and a short, backdated thread. */
async function enquire(sl, buyer, li, o) {
  const created = plus(ago(o.days), -(seq++ % 7) * 17);
  const conv = must(await db.from("conversations").insert({
    buyer_id: buyer, seller_id: sl.sellerId, listing_id: li === null ? null : sl.listingIds[li], created_at: created, origin: o.origin ?? "in_app",
  }).select("id").single(), "conversation");
  const title = li === null ? "your hustle" : sl.listings[li][1];
  if (o.origin !== "whatsapp") {
    must(await db.from("messages").insert({ conversation_id: conv.id, sender_id: buyer, body: `Hi! Is ${title} still available?`, created_at: created }), "msg");
    if (o.replyMin != null) {
      const t1 = plus(created, o.replyMin);
      must(await db.from("messages").insert({ conversation_id: conv.id, sender_id: sl.uid, body: REPLIES[0], created_at: t1 }), "reply");
      if (o.chat) {
        const t2 = plus(t1, 8);
        must(await db.from("messages").insert({ conversation_id: conv.id, sender_id: buyer, body: "Perfect, tomorrow at 1pm?", created_at: t2 }), "msg2");
        must(await db.from("messages").insert({ conversation_id: conv.id, sender_id: sl.uid, body: REPLIES[1], created_at: plus(t2, 5) }), "reply2");
      }
    }
  }
  const upd = {};
  if (o.status === "in_progress" || o.status === "declined") upd.status = o.status;
  if (o.status === "completed") {
    const done = plus(created, 2 * 1440);
    Object.assign(upd, { status: "completed", sale_happened: true, completed_at: done, completion_requested_at: done, buyer_confirmed_at: plus(done, 1440) });
  }
  if (o.status === "completed_pending") {
    const done = ago(1);
    Object.assign(upd, { status: "completed", sale_happened: true, completed_at: done, completion_requested_at: done });
  }
  if (Object.keys(upd).length) {
    const { data: enq } = await db.from("enquiries").select("id").eq("conversation_id", conv.id).single();
    must(await db.from("enquiries").update(upd).eq("id", enq.id), "enquiry state");
  }
  return conv.id;
}

// All distinct (buyer, listing) pairs for a seller: 6 buyers x 4 listings.
const pairs = []; for (let l = 0; l < 4; l++) for (let b = 0; b < 6; b++) pairs.push([b, l]);
const spread = (n, from, to) => Array.from({ length: n }, (_, i) => Math.round(from + ((to - from) * i) / Math.max(1, n - 1)));

async function history(biz, plan) {
  const sl = by(biz); let k = 0;
  for (const [count, status, replyMin, from, to] of plan) {
    const days = spread(count, from, to);
    for (let i = 0; i < count; i++) {
      const [b, l] = pairs[k++];
      await enquire(sl, buyerIds[b], l, { days: days[i], status, replyMin: replyMin == null ? null : replyMin + (i % 3) * 5, chat: i % 2 === 0 });
    }
  }
}
// [count, status, first-reply minutes (null = never replied), oldest days ago, newest days ago]
await history("Thandi's Kitchen", [[17, "completed", 15, 80, 4], [1, "declined", 30, 12, 12], [1, "new", null, 6, 6]]);
await history("Zanele's Braids", [[6, "completed", 150, 50, 6], [1, "declined", 180, 20, 20], [1, "new", null, 9, 9]]);
await history("Amahle Events & Decor", [[5, "completed", 620, 40, 5], [1, "in_progress", 700, 8, 8], [1, "new", null, 11, 11]]);
await history("Pixel & Pen Studio", [[2, "completed", 45, 20, 12], [1, "in_progress", 60, 6, 6], [1, "declined", 50, 3, 3]]);
await history("Naledi Notes", [[1, "completed", 90, 15, 15], [1, "in_progress", 100, 7, 7], [1, "declined", 80, 4, 4], [1, "new", null, 9, 9]]);
await history("Sipho Sneaker Spot", [[1, "completed", 120, 10, 10], [2, "in_progress", 140, 4, 2]]);
await history("CodeCraft Fixers", [[1, "in_progress", 240, 3, 3]]);

// Lwazi is WhatsApp-only: leads are logged as handoffs and never count against his response rate.
{
  const sl = by("Lwazi Cuts");
  for (let i = 0; i < 3; i++) {
    const cid = await enquire(sl, buyerIds[i], i, { days: 4 + i * 6, origin: "whatsapp" });
    const { data: enq } = await db.from("enquiries").select("id").eq("conversation_id", cid).single();
    must(await db.from("enquiry_events").insert({ enquiry_id: enq.id, type: "whatsapp_handoff", actor_id: buyerIds[i], data: { source: "listing" }, created_at: ago(4 + i * 6) }), "wa event");
  }
}

// Quick replies for the demo seller.
for (const [i, body] of ["Hi! Yes, it's available. When would you like to collect?", "Thanks for your enquiry! Pre-order by 10am for same-day pickup.",
  "I can meet at the library entrance after your last class."].entries()) {
  must(await db.from("quick_replies").insert({ seller_id: by("Thandi's Kitchen").sellerId, body, position: i }), "quick reply");
}

// Clear notifications produced by backdated seeding, then create the live demo state (fresh notifications).
must(await db.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000"), "wipe notifications");
await db.from("email_queue").delete().neq("id", "00000000-0000-0000-0000-000000000000");
const thandi = by("Thandi's Kitchen");
await enquire(thandi, buyerIds[1], 3, { days: 0.01, status: "new", replyMin: null });   // fresh, unread enquiry
await enquire(thandi, buyerIds[2], 3, { days: 0.003, status: "new", replyMin: null });  // fresh, unread enquiry
await enquire(thandi, ayanda, 2, { days: 5, status: "completed_pending", replyMin: 25, chat: true }); // Ayanda: confirm prompt waiting
await enquire(by("Naledi Notes"), ayanda, 0, { days: 1, status: "in_progress", replyMin: 40, chat: true }); // Ayanda: in progress
await enquire(by("Pixel & Pen Studio"), buyerIds[3], 1, { days: 0.005, status: "new", replyMin: null });

console.log("seeded Phase 4 demo data (buyers, enquiries, trust tiers)");
console.log(`\nDemo password for all demo users: ${DEMO_PASSWORD}`);
