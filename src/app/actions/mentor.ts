"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionAuth } from "@/lib/roles";
import type { Result } from "./types";

const uuid = z.uuid();

/** Mentor notes and check-ins. RLS limits them to the assigned mentor (and admins read-only); mentors never touch messages. */
export async function addMentorNote(sellerId: string, body: string): Promise<Result> {
  const b = z.string().trim().min(1, "Write a note first").max(1000, "Notes can be up to 1000 characters").safeParse(body);
  if (!uuid.safeParse(sellerId).success) return { ok: false, error: "Invalid request" };
  if (!b.success) return { ok: false, error: b.error.issues[0].message };
  const a = await actionAuth(["mentor"]); if (!a.ok) return a;
  const { error } = await a.supabase.from("mentor_notes").insert({ seller_id: sellerId, mentor_id: a.user.id, body: b.data });
  if (error) return { ok: false, error: "We couldn't save that note." };
  revalidatePath(`/mentor/${sellerId}`);
  return { ok: true };
}

export async function deleteMentorNote(id: string, sellerId: string): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid request" };
  const a = await actionAuth(["mentor"]); if (!a.ok) return a;
  const { error } = await a.supabase.from("mentor_notes").delete().eq("id", id);
  if (error) return { ok: false, error: "We couldn't delete that note." };
  revalidatePath(`/mentor/${sellerId}`);
  return { ok: true };
}

export async function logCheckin(sellerId: string, note: string): Promise<Result> {
  const n = z.string().trim().max(500, "Check-in notes can be up to 500 characters").safeParse(note);
  if (!uuid.safeParse(sellerId).success) return { ok: false, error: "Invalid request" };
  if (!n.success) return { ok: false, error: n.error.issues[0].message };
  const a = await actionAuth(["mentor"]); if (!a.ok) return a;
  const { error } = await a.supabase.from("mentor_checkins").insert({ seller_id: sellerId, mentor_id: a.user.id, note: n.data || null });
  if (error) return { ok: false, error: "We couldn't log that check-in." };
  revalidatePath(`/mentor/${sellerId}`);
  revalidatePath("/mentor");
  return { ok: true };
}
