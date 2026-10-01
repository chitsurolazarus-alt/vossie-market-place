import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth";

export const VISITOR_COOKIE = "vossie_vid";

/**
 * Record a listing view without blocking the response.
 * One row per viewer per listing per day (unique index). Signed-in viewers use their user id;
 * anonymous viewers use a salted hash of a random cookie id. No IP address is read or stored.
 * The seller's own views are excluded.
 */
export async function recordView(listingId: string, sellerUserId: string | null) {
  const user = await getUser();
  if (user?.id === sellerUserId) return;
  const vid = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!user && !vid) return;
  const anonHash = user ? null : createHash("sha256").update(`${vid}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`).digest("hex").slice(0, 32);

  after(async () => {
    try {
      await createAdminClient().from("listing_views").upsert(
        { listing_id: listingId, viewer_id: user?.id ?? null, anon_hash: anonHash },
        { onConflict: "listing_id,view_date,viewer_key", ignoreDuplicates: true }
      );
    } catch {
      // Analytics must never break a page.
    }
  });
}
