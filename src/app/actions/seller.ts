"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { issuesToErrors, normalisePhone, sellerSchema, slugify } from "@/lib/validation";
import type { TablesUpdate } from "@/types/database";
import type { Result } from "./types";

export async function saveDraft(data: Record<string, unknown>): Promise<Result> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in again" };
  // Never persist the agreement flag in a draft; the seller must tick it at submit.
  const { agree: _agree, ...rest } = data;
  void _agree;
  const { error } = await supabase
    .from("seller_drafts")
    .upsert({ user_id: auth.user.id, data: rest as never, updated_at: new Date().toISOString() });
  return error ? { ok: false, error: "Couldn't save your progress" } : { ok: true };
}

export async function saveSeller(input: unknown, mode: "submit" | "edit"): Promise<Result<{ slug: string; status: string }>> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { ok: false, error: "Please sign in again" };

  const parsed = sellerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields", fieldErrors: issuesToErrors(parsed.error.issues) };
  }
  const v = parsed.data;

  const photoPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/`;
  if (v.photoUrl && !v.photoUrl.startsWith(photoPrefix)) {
    return { ok: false, error: "Please re-upload your photo", fieldErrors: { photoUrl: "Please re-upload your photo" } };
  }

  const { data: existing } = await supabase.from("seller_profiles").select("*").eq("user_id", user.id).maybeSingle();
  const { data: priv } = existing
    ? await supabase.from("seller_private").select("whatsapp_e164").eq("seller_id", existing.id).maybeSingle()
    : { data: null };

  const number = v.whatsapp ? normalisePhone(v.whatsapp) : null;
  if (v.contactPref !== "in_app" && !number && !priv?.whatsapp_e164) {
    return { ok: false, error: "Add your WhatsApp number", fieldErrors: { whatsapp: "Add your WhatsApp number so buyers can reach you" } };
  }

  const fields = {
    campus_id: v.campusId,
    category_id: v.categoryId,
    business_name: v.businessName,
    tagline: v.tagline || null,
    bio: v.bio || null,
    photo_url: v.photoUrl || null,
    contact_pref: v.contactPref,
  };

  let sellerId: string;
  let slug: string;
  let status: string;

  if (!existing) {
    const base = slugify(v.businessName);
    let inserted: { id: string; slug: string; status: string } | null = null;
    for (let attempt = 0; attempt < 6 && !inserted; attempt++) {
      const candidate = attempt === 0 ? base : `${base}-${Math.floor(100 + Math.random() * 900)}`;
      const res = await supabase
        .from("seller_profiles")
        .insert({ ...fields, user_id: user.id, slug: candidate, status: "pending" })
        .select("id,slug,status")
        .single();
      if (!res.error) inserted = res.data;
      else if (res.error.code === "23505" && res.error.message.includes("slug")) continue;
      else if (res.error.code === "23505") {
        return { ok: false, error: "That business name is taken on this campus", fieldErrors: { businessName: "That business name is already used on this campus. Try adding a detail, e.g. \"Thandi's Kitchen Midrand\"." } };
      } else return { ok: false, error: "We couldn't save your profile. Please try again." };
    }
    if (!inserted) return { ok: false, error: "We couldn't create your profile link. Please try again." };
    sellerId = inserted.id; slug = inserted.slug; status = inserted.status;
  } else {
    if (existing.campus_id !== v.campusId) {
      const { count } = await supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", existing.id);
      if (existing.status === "approved" || (count ?? 0) > 0) {
        return { ok: false, error: "You can't change campus once you have listings or are approved. Ask the Incubation Hub team.", fieldErrors: { campusId: "Campus can't be changed after approval or once you have listings" } };
      }
    }
    const update: TablesUpdate<"seller_profiles"> = { ...fields };
    if (mode === "submit" && (existing.status === "draft" || existing.status === "rejected")) update.status = "pending";
    if (v.slug && v.slug !== existing.slug) update.slug = v.slug;
    const res = await supabase.from("seller_profiles").update(update).eq("id", existing.id).select("id,slug,status").single();
    if (res.error) {
      if (res.error.code === "23505" && res.error.message.includes("slug")) {
        return { ok: false, error: "That profile link is taken", fieldErrors: { slug: "That link is taken. Try another." } };
      }
      if (res.error.code === "23505") {
        return { ok: false, error: "That business name is taken on this campus", fieldErrors: { businessName: "That business name is already used on this campus." } };
      }
      if (res.error.message.includes("only be changed once")) {
        return { ok: false, error: "Your profile link can only be changed once", fieldErrors: { slug: "Your profile link can only be changed once" } };
      }
      return { ok: false, error: "We couldn't save your changes. Please try again." };
    }
    sellerId = res.data.id; slug = res.data.slug; status = res.data.status;
  }

  // Private WhatsApp number (owner-only table)
  if (v.contactPref === "in_app") {
    await supabase.from("seller_private").delete().eq("seller_id", sellerId);
  } else if (number) {
    const r = await supabase.from("seller_private").upsert({ seller_id: sellerId, whatsapp_e164: number });
    if (r.error) return { ok: false, error: "We couldn't save your WhatsApp number", fieldErrors: { whatsapp: "We couldn't save that number" } };
  }

  // Pickup points (must be approved points on the seller's campus; enforced in the database too)
  await supabase.from("seller_pickup_points").delete().eq("seller_id", sellerId);
  const pp = await supabase.from("seller_pickup_points").insert(v.pickupPointIds.map((id) => ({ seller_id: sellerId, pickup_point_id: id })));
  if (pp.error) {
    return { ok: false, error: "Choose approved pickup points on your campus", fieldErrors: { pickupPointIds: "Choose approved pickup points on your campus" } };
  }

  await supabase.from("profiles").update({ campus_id: v.campusId, display_name: v.businessName }).eq("id", user.id);
  if (mode === "submit") await supabase.from("seller_drafts").delete().eq("user_id", user.id);

  revalidatePath("/sell");
  revalidatePath(`/s/${slug}`);
  return { ok: true, slug, status };
}
