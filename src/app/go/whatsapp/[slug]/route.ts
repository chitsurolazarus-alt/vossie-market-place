import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
    .from("seller_profiles").select("id,business_name,contact_pref,status")
    .eq("slug", slug).eq("status", "approved").maybeSingle();
  if (!seller || seller.contact_pref === "in_app") return NextResponse.redirect(`${origin}/s/${slug}`);

  const { data: priv } = await admin.from("seller_private").select("whatsapp_e164").eq("seller_id", seller.id).maybeSingle();
  if (!priv?.whatsapp_e164) return NextResponse.redirect(`${origin}/s/${slug}`);

  let subject = "your hustle";
  const listingId = request.nextUrl.searchParams.get("listing");
  if (listingId && /^[0-9a-f-]{36}$/i.test(listingId)) {
    const { data: l } = await admin.from("listings").select("title").eq("id", listingId).eq("seller_id", seller.id).maybeSingle();
    if (l) subject = l.title;
  }
  const text = `Hi ${seller.business_name}, I found ${subject} on Vossie Market Place and I'm interested.`;
  const number = priv.whatsapp_e164.replace(/\D/g, "");
  return NextResponse.redirect(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, 302);
}
