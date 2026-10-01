"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyModerationError } from "@/lib/moderation";
import { actionAuth } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "./types";

const uuid = z.uuid();

const postSchema = z.object({
  id: uuid.nullable(),
  kind: z.enum(["tip", "event", "office_hours"]),
  title: z.string().trim().min(3, "Give it a title (at least 3 characters)").max(120, "Titles can be up to 120 characters"),
  body: z.string().trim().max(4000, "Posts can be up to 4000 characters"),
  coverPath: z.string().max(200).nullable(),
  campusId: uuid.nullable(),
  eventAt: z.string().nullable(),
  venue: z.string().trim().max(120).nullable(),
  capacity: z.number().int().min(1).max(5000).nullable(),
  published: z.boolean(),
});

/** Staff (admin + mentor) create and edit Hub posts. RLS enforces authorship; this validates the shape. */
export async function savePost(input: z.input<typeof postSchema>): Promise<Result<{ id: string }>> {
  const p = postSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the form and try again" };
  const d = p.data;
  if (d.kind === "event" && !d.eventAt) return { ok: false, error: "Events need a date and time" };
  const eventAt = d.eventAt ? new Date(d.eventAt) : null;
  if (eventAt && Number.isNaN(eventAt.getTime())) return { ok: false, error: "That date doesn't look right" };
  const a = await actionAuth(["admin", "mentor"]); if (!a.ok) return a;
  if (d.coverPath && !d.coverPath.startsWith(`${a.user.id}/`)) return { ok: false, error: "That cover image can't be used" };
  const row = {
    kind: d.kind, title: d.title, body: d.body, cover_path: d.coverPath, campus_id: d.campusId,
    event_at: eventAt ? eventAt.toISOString() : null, venue: d.venue || null, capacity: d.kind === "event" ? d.capacity : null, published: d.published,
  };
  if (d.id) {
    const { error } = await a.supabase.from("hub_posts").update(row).eq("id", d.id);
    if (error) return { ok: false, error: "We couldn't save that post." };
    revalidatePath("/growth", "layout");
    return { ok: true, id: d.id };
  }
  const { data, error } = await a.supabase.from("hub_posts").insert({ ...row, author_id: a.user.id }).select("id").single();
  if (error) return { ok: false, error: "We couldn't publish that post." };
  revalidatePath("/growth", "layout");
  revalidatePath("/sell");
  return { ok: true, id: data.id };
}

export async function deletePost(id: string): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid request" };
  const a = await actionAuth(["admin", "mentor"]); if (!a.ok) return a;
  const { error } = await a.supabase.from("hub_posts").delete().eq("id", id);
  if (error) return { ok: false, error: "We couldn't delete that post." };
  revalidatePath("/growth", "layout");
  return { ok: true };
}

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

export async function toggleRsvp(postId: string, going: boolean): Promise<Result> {
  if (!uuid.safeParse(postId).success) return { ok: false, error: "Invalid request" };
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: "Please sign in" };
  const { error } = going
    ? await supabase.from("hub_rsvps").insert({ post_id: postId, user_id: user.id })
    : await supabase.from("hub_rsvps").delete().eq("post_id", postId).eq("user_id", user.id);
  if (error && error.code !== "23505") return { ok: false, error: friendlyModerationError(error.message, "We couldn't update your RSVP.") };
  revalidatePath(`/growth/${postId}`);
  revalidatePath("/growth");
  return { ok: true };
}

export async function requestBooking(postId: string, message: string): Promise<Result> {
  const m = z.string().trim().max(300, "Messages can be up to 300 characters").safeParse(message);
  if (!uuid.safeParse(postId).success) return { ok: false, error: "Invalid request" };
  if (!m.success) return { ok: false, error: m.error.issues[0].message };
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: "Please sign in" };
  const { error } = await supabase.from("hub_bookings").insert({ post_id: postId, user_id: user.id, message: m.data || null });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "You already have a request open for this session." };
    return { ok: false, error: friendlyModerationError(error.message, "We couldn't send your request.") };
  }
  revalidatePath(`/growth/${postId}`);
  return { ok: true };
}

export async function answerBooking(id: string, status: "confirmed" | "declined", hostNote: string): Promise<Result> {
  const note = z.string().trim().max(300).safeParse(hostNote);
  if (!uuid.safeParse(id).success || !note.success) return { ok: false, error: "Invalid request" };
  const a = await actionAuth(["admin", "mentor"]); if (!a.ok) return a;
  const { data, error } = await a.supabase.from("hub_bookings").update({ status, host_note: note.data || null }).eq("id", id).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "We couldn't update that request." };
  revalidatePath("/growth/manage");
  return { ok: true };
}
