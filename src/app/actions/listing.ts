"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AVAILABILITY, issuesToErrors, listingSchema } from "@/lib/validation";
import type { Result } from "./types";

export async function saveListing(input: unknown): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { ok: false, error: "Please sign in again" };

  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields", fieldErrors: issuesToErrors(parsed.error.issues) };
  }
  const v = parsed.data;

  const { data: seller } = await supabase.from("seller_profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (!seller) return { ok: false, error: "Set up your seller profile first" };

  const prefix = `${user.id}/${v.id}/`;
  if (v.images.some((i) => !i.path.startsWith(prefix) || i.path.includes(".."))) {
    return { ok: false, error: "One of your photos didn't upload properly. Please re-add it." };
  }

  const row = {
    seller_id: seller.id,
    category_id: v.categoryId,
    kind: v.kind,
    title: v.title,
    description: v.description || null,
    pricing_mode: v.pricingMode,
    price_zar: v.pricingMode === "swap" ? null : v.priceZar,
    price_is_from: v.kind === "service" && v.pricingMode !== "swap" ? v.priceIsFrom : false,
    swap_for: v.pricingMode === "cash" ? null : v.swapFor,
    availability: v.availability,
    pickup_point_id: v.kind === "product" ? v.pickupPointId : v.pickupPointId,
    delivered_on_campus: v.kind === "service" ? v.deliveredOnCampus : false,
  };

  const { data: existing } = await supabase.from("listings").select("id").eq("id", v.id).eq("seller_id", seller.id).maybeSingle();
  // campus_id is set by a database trigger from the seller profile.
  const write = existing
    ? await supabase.from("listings").update(row).eq("id", v.id)
    : await supabase.from("listings").insert({ ...row, id: v.id, campus_id: "00000000-0000-0000-0000-000000000000" });
  if (write.error) {
    if (write.error.message.includes("account_suspended")) return { ok: false, error: "Your account is suspended, so you can't create or edit listings right now." };
    if (write.error.message.includes("Daily listing limit")) return { ok: false, error: "You've reached today's limit of 20 new listings. Try again tomorrow." };
    if (write.error.message.includes("pickup point")) return { ok: false, error: "Choose one of your approved pickup points", fieldErrors: { pickupPointId: "Choose one of your approved pickup points" } };
    return { ok: false, error: "We couldn't save your listing. Please try again." };
  }

  // Images: remove dropped, upsert the rest in order
  const { data: current } = await supabase.from("listing_images").select("id,path").eq("listing_id", v.id);
  const keep = new Set(v.images.map((i) => i.path));
  const dropped = (current ?? []).filter((c) => !keep.has(c.path));
  if (dropped.length) {
    await supabase.from("listing_images").delete().in("id", dropped.map((d) => d.id));
    await supabase.storage.from("listing-images").remove(dropped.map((d) => d.path));
  }
  const byPath = new Map((current ?? []).map((c) => [c.path, c.id]));
  for (const [position, img] of v.images.entries()) {
    const id = byPath.get(img.path);
    const res = id
      ? await supabase.from("listing_images").update({ alt: img.alt, position }).eq("id", id)
      : await supabase.from("listing_images").insert({ listing_id: v.id, path: img.path, alt: img.alt, position });
    if (res.error) return { ok: false, error: "We couldn't save your photos. Please try again." };
  }

  // Tags: insert missing (ignore duplicates), then relink
  const tags = [...new Set(v.tags)];
  await supabase.from("listing_tags").delete().eq("listing_id", v.id);
  if (tags.length) {
    await supabase.from("tags").upsert(tags.map((name) => ({ name })), { onConflict: "name", ignoreDuplicates: true });
    const { data: tagRows } = await supabase.from("tags").select("id").in("name", tags);
    if (tagRows?.length) {
      await supabase.from("listing_tags").insert(tagRows.map((t) => ({ listing_id: v.id, tag_id: t.id })));
    }
  }

  revalidatePath("/sell/listings");
  revalidatePath("/sell");
  return { ok: true, id: v.id };
}

export async function setAvailability(id: string, availability: string): Promise<Result> {
  if (!(AVAILABILITY as readonly string[]).includes(availability)) return { ok: false, error: "Invalid status" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings").update({ availability: availability as (typeof AVAILABILITY)[number] })
    .eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: "We couldn't update that listing" };
  revalidatePath("/sell/listings");
  return { ok: true };
}

export async function deleteListing(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: "We couldn't delete that listing" };
  revalidatePath("/sell/listings");
  revalidatePath("/sell");
  return { ok: true };
}
