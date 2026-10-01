"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "./types";

type Admin = ReturnType<typeof createAdminClient>;

/** Remove every object under `${prefix}` in a bucket (one or two folder levels deep). Best effort. */
async function purge(admin: Admin, bucket: string, prefix: string, depth = 2) {
  const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  const files: string[] = [];
  for (const item of data ?? []) {
    if (item.id) files.push(`${prefix}/${item.name}`);
    else if (depth > 1) await purge(admin, bucket, `${prefix}/${item.name}`, depth - 1);
  }
  if (files.length) await admin.storage.from(bucket).remove(files);
}

/**
 * POPIA "delete my account". Soft-deletes immediately (a database trigger scrubs personal data, hides the seller
 * profile and listings, and anonymises names on conversations as "Deleted user"); a scheduled job removes the login
 * and remaining rows after 30 days. Messages other people rely on are kept, anonymised.
 */
export async function deleteAccount(confirmation: string): Promise<Result> {
  if (confirmation.trim() !== "DELETE") return { ok: false, error: "Type DELETE (all capitals) to confirm." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { ok: false, error: "Please sign in" };

  const admin = createAdminClient();
  // 1. Files first (best effort): photos the user uploaded in chats, listings and their avatar.
  try {
    const { data: msgs } = await admin.from("messages").select("image_path").eq("sender_id", user.id).not("image_path", "is", null);
    const paths = (msgs ?? []).flatMap((m) => (m.image_path ? [m.image_path] : []));
    if (paths.length) await admin.storage.from("message-images").remove(paths);
    await purge(admin, "avatars", user.id, 1);
    await purge(admin, "listing-images", user.id, 2);
  } catch { /* the database scrub below is what matters */ }

  // 2. Soft delete as the user (RLS + guard allow only this); the trigger does the scrub.
  const { error } = await supabase.from("profiles").update({ deleted_at: new Date().toISOString() }).eq("id", user.id);
  if (error) {
    if (error.message.includes("last_admin")) return { ok: false, error: "You're the last admin. Make another admin before deleting your account." };
    return { ok: false, error: "We couldn't delete your account. Please try again or contact the Information Officer." };
  }
  // 3. Block sign-in and end this session.
  await admin.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { ok: true };
}
