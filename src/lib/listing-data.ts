import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getListing = cache(async (id: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("*, listing_images(path,alt,position), listing_tags(tags(name)), categories(name,slug), campuses(name), pickup_points(name,description), seller_profiles(id,user_id,business_name,slug,tagline,photo_url,verified,contact_pref,status)")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  return data;
});
