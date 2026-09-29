import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import type { SellerState } from "@/components/sell/SellerForm";

export async function loadReferenceData() {
  const supabase = await createClient();
  const [cats, camps, pps] = await Promise.all([
    supabase.from("categories").select("id,name").eq("active", true).order("sort_order"),
    supabase.from("campuses").select("id,name").eq("active", true).order("name"),
    supabase.from("pickup_points").select("id,campus_id,name,description").eq("approved", true).order("name"),
  ]);
  return { categories: cats.data ?? [], campuses: camps.data ?? [], pickupPoints: pps.data ?? [] };
}

export async function loadSellerPickups(sellerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seller_pickup_points").select("pickup_points(id,name)").eq("seller_id", sellerId);
  return (data ?? []).flatMap((r) => (r.pickup_points ? [r.pickup_points] : []));
}

export function maskNumber(e164: string | null | undefined) {
  return e164 ? `+27 •• ••• ${e164.slice(-4)}` : null;
}

export async function loadSellerInitial(seller: Tables<"seller_profiles"> | null, userId: string) {
  const supabase = await createClient();
  if (seller) {
    const [{ data: priv }, { data: pps }] = await Promise.all([
      supabase.from("seller_private").select("whatsapp_e164").eq("seller_id", seller.id).maybeSingle(),
      supabase.from("seller_pickup_points").select("pickup_point_id").eq("seller_id", seller.id),
    ]);
    const initial: Partial<SellerState> = {
      businessName: seller.business_name, categoryId: seller.category_id ?? "", tagline: seller.tagline ?? "",
      bio: seller.bio ?? "", photoUrl: seller.photo_url ?? "", contactPref: seller.contact_pref, campusId: seller.campus_id,
      pickupPointIds: (pps ?? []).map((p) => p.pickup_point_id),
    };
    return { initial, maskedWhatsapp: maskNumber(priv?.whatsapp_e164) };
  }
  const { data: draft } = await supabase.from("seller_drafts").select("data").eq("user_id", userId).maybeSingle();
  return { initial: (draft?.data ?? {}) as Partial<SellerState>, maskedWhatsapp: null };
}
