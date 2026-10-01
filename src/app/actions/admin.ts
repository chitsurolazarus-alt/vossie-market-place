"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildSchema, SECTIONS } from "@/lib/admin-sections";
import { friendlyModerationError } from "@/lib/moderation";
import { actionAuth } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Result } from "./types";

const uuid = z.uuid();
const reasonOf = (r?: string | null) => (r ?? "").trim().slice(0, 500) || null;

/** Every action here re-checks the admin role, then calls an RLS-protected SQL function that writes its own audit row. */
async function admin() { return actionAuth(["admin"]); }
const fail = (message: string | undefined, fallback = "That didn't work. Please try again."): Result => ({ ok: false, error: friendlyModerationError(message, fallback) });

export async function reviewSeller(sellerId: string, decision: "approve" | "reject" | "request_changes", reason?: string): Promise<Result> {
  if (!uuid.safeParse(sellerId).success) return { ok: false, error: "Invalid request" };
  const a = await admin(); if (!a.ok) return a;
  const { error } = await a.supabase.rpc("admin_review_seller", { p_seller: sellerId, p_decision: decision, p_reason: reasonOf(reason) ?? undefined });
  if (error) return fail(error.message);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function setSellerVerified(sellerId: string, verified: boolean, reason?: string): Promise<Result> {
  if (!uuid.safeParse(sellerId).success) return { ok: false, error: "Invalid request" };
  const a = await admin(); if (!a.ok) return a;
  const { error } = await a.supabase.rpc("admin_set_verified", { p_seller: sellerId, p_verified: verified, p_reason: reasonOf(reason) ?? undefined });
  if (error) return fail(error.message);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function moderateListing(listingId: string, action: "hide" | "restore" | "category", opts: { categoryId?: string; reason?: string } = {}): Promise<Result> {
  if (!uuid.safeParse(listingId).success) return { ok: false, error: "Invalid request" };
  const a = await admin(); if (!a.ok) return a;
  const { error } = await a.supabase.rpc("admin_moderate_listing", {
    p_listing: listingId, p_action: action, p_category: opts.categoryId ?? undefined, p_reason: reasonOf(opts.reason) ?? undefined,
  });
  if (error) return fail(error.message);
  revalidatePath("/admin", "layout");
  revalidatePath(`/l/${listingId}`);
  return { ok: true };
}

export async function resolveReport(reportId: string, action: "dismiss" | "hide" | "warn" | "suspend" | "ban", opts: { days?: number; note?: string } = {}): Promise<Result> {
  if (!uuid.safeParse(reportId).success) return { ok: false, error: "Invalid request" };
  const a = await admin(); if (!a.ok) return a;
  const { data: report } = await a.supabase.from("reports").select("target_owner_id").eq("id", reportId).maybeSingle();
  const { error } = await a.supabase.rpc("admin_resolve_report", { p_report: reportId, p_action: action, p_days: opts.days ?? undefined, p_note: reasonOf(opts.note) ?? undefined });
  if (error) return fail(error.message);
  if (action === "ban" && report?.target_owner_id) {
    // Also block sign-in at the auth layer (service role, server only).
    await createAdminClient().auth.admin.updateUserById(report.target_owner_id, { ban_duration: "876000h" });
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function restoreUser(userId: string, reason?: string): Promise<Result> {
  if (!uuid.safeParse(userId).success) return { ok: false, error: "Invalid request" };
  const a = await admin(); if (!a.ok) return a;
  const { error } = await a.supabase.rpc("admin_unsuspend", { p_user: userId, p_reason: reasonOf(reason) ?? undefined });
  if (error) return fail(error.message);
  await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: "none" });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function changeRole(userId: string, role: "buyer" | "seller" | "mentor" | "admin", reason?: string): Promise<Result> {
  if (!uuid.safeParse(userId).success || !["buyer", "seller", "mentor", "admin"].includes(role)) return { ok: false, error: "Invalid request" };
  const a = await admin(); if (!a.ok) return a;
  const { error } = await a.supabase.rpc("admin_set_role", { p_user: userId, p_role: role, p_reason: reasonOf(reason) ?? undefined });
  if (error) return fail(error.message, "We couldn't change that role.");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function assignMentor(sellerId: string, mentorId: string | null, reason?: string): Promise<Result> {
  if (!uuid.safeParse(sellerId).success || (mentorId !== null && !uuid.safeParse(mentorId).success)) return { ok: false, error: "Invalid request" };
  const a = await admin(); if (!a.ok) return a;
  const { error } = await a.supabase.rpc("admin_assign_mentor", { p_seller: sellerId, p_mentor: mentorId as string, // null unassigns (the SQL accepts null)
       p_reason: reasonOf(reason) ?? undefined });
  if (error) return fail(error.message);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

type Values = Record<string, string | number | boolean>;

/** Create or update a row in an admin-managed table. Validated against the section's field list; every change is audited by trigger. */
export async function saveRow(section: string, id: string | null, values: Values): Promise<Result> {
  const spec = SECTIONS[section];
  if (!spec) return { ok: false, error: "Unknown section" };
  if (id === null && !spec.canCreate) return { ok: false, error: "You can't add rows here" };
  const parsed = buildSchema(spec.fields).safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the values and try again" };
  const a = await admin(); if (!a.ok) return a;
  const table = a.supabase.from(spec.table as "categories");
  const row = parsed.data as never;
  const res = id === null
    ? await table.insert(row)
    : await table.update(row).eq(spec.pk as "id", id);
  if (res.error) {
    if (res.error.code === "23505") return { ok: false, error: "That already exists." };
    return { ok: false, error: "We couldn't save that. Check the values and try again." };
  }
  revalidatePath("/admin/manage");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteRow(section: string, id: string): Promise<Result> {
  const spec = SECTIONS[section];
  if (!spec || !spec.canDelete) return { ok: false, error: "You can't delete rows here" };
  const a = await admin(); if (!a.ok) return a;
  const { error } = await a.supabase.from(spec.table as "categories").delete().eq(spec.pk as "id", id);
  if (error) return { ok: false, error: "We couldn't delete that." };
  revalidatePath("/admin/manage");
  return { ok: true };
}

const officer = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160).or(z.literal("")).transform((v) => v || null),
  phone: z.string().trim().max(40).transform((v) => v || null),
  note: z.string().trim().max(300).transform((v) => v || null),
});

export async function saveSettings(input: { autoHide: number; officer: z.input<typeof officer> }): Promise<Result> {
  const n = z.number().int().min(1).max(20).safeParse(input.autoHide);
  const o = officer.safeParse(input.officer);
  if (!n.success) return { ok: false, error: "Auto-hide threshold must be between 1 and 20" };
  if (!o.success) return { ok: false, error: "Enter a name and a valid email for the Information Officer" };
  const a = await admin(); if (!a.ok) return a;
  const now = new Date().toISOString();
  const r1 = await a.supabase.from("site_settings").update({ value: { n: n.data }, updated_at: now, updated_by: a.user.id }).eq("key", "auto_hide_threshold");
  const r2 = await a.supabase.from("site_settings").update({ value: o.data, updated_at: now, updated_by: a.user.id }).eq("key", "information_officer");
  if (r1.error || r2.error) return { ok: false, error: "We couldn't save the settings." };
  revalidatePath("/admin/manage");
  revalidatePath("/privacy");
  return { ok: true };
}
