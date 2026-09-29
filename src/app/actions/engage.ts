"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LOWDATA_COOKIE } from "@/lib/viewer";
import type { Result } from "./types";

const id = z.uuid();

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

export async function toggleSave(listingId: string, save: boolean): Promise<Result> {
  if (!id.safeParse(listingId).success) return { ok: false, error: "Invalid listing" };
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: "Please sign in" };
  const r = save
    ? await supabase.from("saved_listings").upsert({ user_id: user.id, listing_id: listingId }, { onConflict: "user_id,listing_id", ignoreDuplicates: true })
    : await supabase.from("saved_listings").delete().eq("user_id", user.id).eq("listing_id", listingId);
  if (r.error) return { ok: false, error: "We couldn't update your saved items" };
  revalidatePath("/saved");
  return { ok: true };
}

export async function toggleFollow(sellerId: string, follow: boolean): Promise<Result> {
  if (!id.safeParse(sellerId).success) return { ok: false, error: "Invalid seller" };
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: "Please sign in" };
  const r = follow
    ? await supabase.from("follows").upsert({ user_id: user.id, seller_id: sellerId }, { onConflict: "user_id,seller_id", ignoreDuplicates: true })
    : await supabase.from("follows").delete().eq("user_id", user.id).eq("seller_id", sellerId);
  if (r.error) return { ok: false, error: "We couldn't update who you follow" };
  revalidatePath("/saved");
  return { ok: true };
}

export async function setLowData(on: boolean): Promise<Result> {
  const jar = await cookies();
  jar.set(LOWDATA_COOKIE, on ? "1" : "0", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const { supabase, user } = await me();
  if (user) await supabase.from("profiles").update({ low_data_mode: on }).eq("id", user.id);
  return { ok: true };
}
