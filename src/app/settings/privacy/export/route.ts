import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POPIA "download my data". Runs as the signed-in user, so row-level security guarantees the file contains only
 * their own data (messages are limited to ones they sent; the other person's words are not included).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return new NextResponse("Please sign in", { status: 401 });

  const mine = <T,>(r: { data: T | null }) => r.data ?? null;
  const [profile, seller, messages, enquiriesAsBuyer, reports, saved, follows, rsvps, bookings, warnings, notes] = await Promise.all([
    supabase.from("profiles").select("id,display_name,email,role,campus_id,popia_consent_at,low_data_mode,created_at,last_seen_at").eq("id", user.id).maybeSingle(),
    supabase.from("seller_profiles").select("*, seller_private(whatsapp_e164), listings(*, listing_images(path,alt,position), listing_tags(tags(name)))").eq("user_id", user.id).maybeSingle(),
    supabase.from("messages").select("id,conversation_id,body,kind,swap_listing_title,image_path,created_at").eq("sender_id", user.id).order("created_at"),
    supabase.from("enquiries").select("id,conversation_id,listing_id,seller_id,buyer_id,status,source,sale_happened,created_at,completed_at,buyer_confirmed_at,buyer_disputed_at").or(`buyer_id.eq.${user.id}`).order("created_at"),
    supabase.from("reports").select("id,target_type,target_id,reason,note,status,created_at,resolved_at").eq("reporter_id", user.id).order("created_at"),
    supabase.from("saved_listings").select("listing_id,created_at").eq("user_id", user.id),
    supabase.from("follows").select("seller_id,created_at").eq("user_id", user.id),
    supabase.from("hub_rsvps").select("post_id,created_at").eq("user_id", user.id),
    supabase.from("hub_bookings").select("post_id,message,status,created_at").eq("user_id", user.id),
    supabase.from("user_warnings").select("message,created_at").eq("user_id", user.id),
    supabase.from("notification_prefs").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  const sellerData = mine(seller);
  let sellerEnquiries: unknown[] = [];
  if (sellerData && "id" in sellerData) {
    const { data } = await supabase.from("enquiries").select("id,conversation_id,listing_id,buyer_id,status,source,sale_happened,created_at,completed_at,buyer_confirmed_at").eq("seller_id", sellerData.id as string).order("created_at");
    sellerEnquiries = data ?? [];
  }

  const body = {
    exported_at: new Date().toISOString(),
    about: "Everything Vossie Market Place holds about you that you can access. Messages are limited to those you sent.",
    account: mine(profile),
    seller_profile: sellerData,
    messages_i_sent: messages.data ?? [],
    enquiries_as_buyer: enquiriesAsBuyer.data ?? [],
    enquiries_as_seller: sellerEnquiries,
    reports_i_made: reports.data ?? [],
    saved_listings: saved.data ?? [],
    followed_sellers: follows.data ?? [],
    event_rsvps: rsvps.data ?? [],
    office_hours_requests: bookings.data ?? [],
    messages_from_the_team: warnings.data ?? [],
    notification_preferences: mine(notes),
  };
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="vossie-my-data-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
