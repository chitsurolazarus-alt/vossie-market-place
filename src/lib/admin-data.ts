import "server-only";
import type { createClient } from "@/lib/supabase/server";

/** Human-readable titles for report targets (admins can read all of these under RLS). */
export async function describeTargets(supabase: Awaited<ReturnType<typeof createClient>>, rows: { target_type: string; target_id: string }[]) {
  const ids = (t: string) => [...new Set(rows.filter((r) => r.target_type === t).map((r) => r.target_id))];
  const [l, s, u] = await Promise.all([
    ids("listing").length ? supabase.from("listings").select("id,title").in("id", ids("listing")) : { data: [] },
    ids("seller").length ? supabase.from("seller_profiles").select("id,business_name").in("id", ids("seller")) : { data: [] },
    ids("user").length ? supabase.from("profiles").select("id,display_name").in("id", ids("user")) : { data: [] },
  ]);
  const map = new Map<string, string>();
  for (const x of l.data ?? []) map.set(`listing:${x.id}`, x.title);
  for (const x of s.data ?? []) map.set(`seller:${x.id}`, x.business_name);
  for (const x of u.data ?? []) map.set(`user:${x.id}`, x.display_name ?? "User");
  return (r: { target_type: string; target_id: string }) => map.get(`${r.target_type}:${r.target_id}`) ?? (r.target_type === "message" ? "A message in a conversation" : "Removed content");
}
