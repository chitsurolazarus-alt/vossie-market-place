"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "./types";

// All writes use the signed-in user's own client, so RLS (nprefs_owner, profile own-row policies) and the guard triggers still apply.
async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

const prefsSchema = z.object({ email_new_enquiry: z.boolean(), email_daily_digest: z.boolean() });

export async function saveNotificationPrefs(input: z.input<typeof prefsSchema>): Promise<Result> {
  const p = prefsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Those settings were not valid." };
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: "Sign in to change notification settings." };
  const { error } = await supabase.from("notification_prefs").upsert({ user_id: user.id, ...p.data, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: "Couldn't save. Try again." };
  return { ok: true };
}

export async function saveMyCampus(campusId: string | null): Promise<Result> {
  if (campusId !== null && !z.uuid().safeParse(campusId).success) return { ok: false, error: "Pick a campus from the list." };
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: "Sign in to save your campus." };
  if (campusId) {
    const { data } = await supabase.from("campuses").select("id").eq("id", campusId).eq("active", true).maybeSingle();
    if (!data) return { ok: false, error: "That campus isn't available." };
  }
  const { error } = await supabase.from("profiles").update({ campus_id: campusId }).eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save. Try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Settings -> Help -> Replay app tour: clears the "seen" flags so both tours show again. */
export async function replayTours(): Promise<Result> {
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: "Sign in to replay the tour." };
  const { error } = await supabase.from("profiles").update({ onboarding_seen: false, seller_tour_seen: false }).eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't reset the tour. Try again." };
  return { ok: true };
}
