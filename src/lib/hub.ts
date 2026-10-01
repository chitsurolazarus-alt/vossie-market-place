import "server-only";
import { createClient } from "@/lib/supabase/server";

export const KIND_LABEL: Record<string, string> = { tip: "Tip", event: "Event", office_hours: "Office hours" };

export type HubPost = {
  id: string; kind: string; title: string; body: string; cover_path: string | null; campus_id: string | null; event_at: string | null;
  venue: string | null; capacity: number | null; published: boolean; rsvp_count: number; author_id: string | null; created_at: string;
  campuses: { name: string } | null;
};

const COLS = "id,kind,title,body,cover_path,campus_id,event_at,venue,capacity,published,rsvp_count,author_id,created_at,campuses(name)";

/** Published posts for a campus (posts with no campus are for everyone). */
export async function getHubPosts(opts: { kind?: string; campusId?: string | null; limit?: number } = {}): Promise<HubPost[]> {
  const supabase = await createClient();
  let q = supabase.from("hub_posts").select(COLS).eq("published", true);
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.campusId) q = q.or(`campus_id.is.null,campus_id.eq.${opts.campusId}`);
  const { data } = await q.order("created_at", { ascending: false }).limit(opts.limit ?? 30);
  return (data ?? []) as HubPost[];
}

export async function getHubPost(id: string): Promise<HubPost | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("hub_posts").select(COLS).eq("id", id).maybeSingle();
  return (data as HubPost | null) ?? null;
}
