"use server";

import { z } from "zod";
import { friendlyModerationError } from "@/lib/moderation";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "./types";

const schema = z.object({
  targetType: z.enum(["listing", "seller", "user", "message"]),
  targetId: z.uuid(),
  reason: z.enum(["scam", "prohibited_item", "inappropriate", "harassment", "fake_profile", "wrong_category", "other"]),
  note: z.string().trim().max(500, "Notes can be up to 500 characters").optional(),
});

/**
 * One open report per reporter per target (database index), 10 a day (trigger). Listings auto-hide after N unique
 * reporters. The reported person never sees who reported (RLS: reports are readable only by the reporter and admins).
 */
export async function submitReport(input: z.input<typeof schema>): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your report and try again" };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "Please sign in to report" };
  const { targetType, targetId, reason, note } = parsed.data;
  const { error } = await supabase.from("reports").insert({
    reporter_id: data.user.id, target_type: targetType, target_id: targetId, reason, note: note || null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: friendlyModerationError("reports_one_open") };
    return { ok: false, error: friendlyModerationError(error.message, "We couldn't send your report. Please try again.") };
  }
  return { ok: true };
}
