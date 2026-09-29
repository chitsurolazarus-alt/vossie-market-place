import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";

export const LOWDATA_COOKIE = "vossie_lowdata";

/** Low-data preference: cookie wins (works signed-out); signed-in users fall back to their profile. */
export const getLowData = cache(async (): Promise<boolean> => {
  const jar = await cookies();
  const c = jar.get(LOWDATA_COOKIE)?.value;
  if (c === "1") return true;
  if (c === "0") return false;
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("low_data_mode").eq("id", user.id).maybeSingle();
  return data?.low_data_mode ?? false;
});

export async function getSavedIds(listingIds: string[]): Promise<Set<string>> {
  const user = await getUser();
  if (!user || !listingIds.length) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from("saved_listings").select("listing_id").eq("user_id", user.id).in("listing_id", listingIds);
  return new Set((data ?? []).map((r) => r.listing_id));
}

export async function isFollowing(sellerId: string): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("follows").select("seller_id").eq("user_id", user.id).eq("seller_id", sellerId).maybeSingle();
  return !!data;
}
