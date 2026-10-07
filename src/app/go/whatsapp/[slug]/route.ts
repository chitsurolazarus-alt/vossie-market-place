import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Admin = ReturnType<typeof createAdminClient>;

export const dynamic = "force-dynamic";

// Builds the wa.me link server-side so the seller's number is never in page HTML.
// Only signed-in (Eduvos-verified) users are redirected.
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const origin = request.nextUrl.origin;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(`/s/${slug}`)}`);

  const admin = createAdminClient();
  const { data: seller } = await admin
    .from("seller_profiles").select("id,user_id,business_name,contact_pref,status")
    .eq("slug", slug).eq("status", "approved").maybeSingle();
  if (!seller || seller.contact_pref === "in_app") return NextResponse.redirect(`${origin}/s/${slug}`);

  const { data: priv } = await admin.from("seller_private").select("whatsapp_e164").eq("seller_id", seller.id).maybeSingle();
  if (!priv?.whatsapp_e164) return NextResponse.redirect(`${origin}/s/${slug}`);

  let subject = "your hustle";
  let validListing: string | null = null;
  const listingId = request.nextUrl.searchParams.get("listing");
  if (listingId && /^[0-9a-f-]{36}$/i.test(listingId)) {
    const { data: l } = await admin.from("listings").select("title").eq("id", listingId).eq("seller_id", seller.id).maybeSingle();
    if (l) { subject = l.title; validListing = listingId; }
  }
  if (seller.user_id !== auth.user.id) await logHandoff(admin, auth.user.id, seller.id, validListing);
  const text = `Hi ${seller.business_name}, I found ${subject} on HustleHub and I'm interested.`;
  const number = priv.whatsapp_e164.replace(/\D/g, "");
  return NextResponse.redirect(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, 302);
}

/**
 * Records the handoff as a 'whatsapp_handoff' event on the enquiry (creating a WhatsApp-sourced conversation +
 * enquiry if the buyer has none yet), so seller dashboards and the mentor view still count WhatsApp leads.
 * Never blocks the redirect.
 */
async function logHandoff(admin: Admin, buyerId: string, sellerId: string, listingId: string | null) {
  try {
    let q = admin.from("conversations").select("id").eq("buyer_id", buyerId).eq("seller_id", sellerId);
    q = listingId ? q.eq("listing_id", listingId) : q.is("listing_id", null);
    let { data: conv } = await q.maybeSingle();
    if (!conv) {
      const ins = await admin.from("conversations").insert({ buyer_id: buyerId, seller_id: sellerId, listing_id: listingId, origin: "whatsapp" }).select("id").single();
      conv = ins.data ?? (await q.maybeSingle()).data;
    }
    if (!conv) return;
    const { data: enq } = await admin.from("enquiries").select("id").eq("conversation_id", conv.id).maybeSingle();
    if (!enq) return;
    const recent = await admin.from("enquiry_events").select("id").eq("enquiry_id", enq.id).eq("type", "whatsapp_handoff")
      .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString()).limit(1);
    if (recent.data?.length) return; // repeated taps within 10 minutes count once
    await admin.from("enquiry_events").insert({ enquiry_id: enq.id, type: "whatsapp_handoff", actor_id: buyerId, data: { listing_id: listingId } });
  } catch {
    /* logging must never break the handoff */
  }
}
