import { createClient } from "@/lib/supabase/server";

export type LandingStats = { listings: number; sellers: number; campusesLive: number; campusesTotal: number };

/** Live numbers for the signed-out landing page. Counts only; nothing personal. */
export async function getLandingStats(campuses: { active: boolean }[]): Promise<LandingStats> {
  const supabase = await createClient();
  const [l, s] = await Promise.all([
    supabase.from("browse_listings").select("id", { count: "exact", head: true }).eq("availability", "available"),
    supabase.from("seller_profiles").select("id", { count: "exact", head: true }).eq("status", "approved"),
  ]);
  return { listings: l.count ?? 0, sellers: s.count ?? 0, campusesLive: campuses.filter((c) => c.active).length, campusesTotal: campuses.length };
}
