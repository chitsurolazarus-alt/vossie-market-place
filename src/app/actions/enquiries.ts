"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMySeller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "./types";

const uuid = z.uuid();

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

const KNOWN: Record<string, string> = {
  "That status change is not allowed": "That status change isn't allowed.",
  "Say whether the sale or swap happened": "Say whether the sale or swap happened.",
  "There is nothing to confirm": "There's nothing to confirm.",
  "up to 5 quick replies": "You can save up to 5 quick replies.",
};
function friendly(message: string | undefined, fallback: string) {
  const hit = Object.keys(KNOWN).find((k) => (message ?? "").includes(k));
  return hit ? KNOWN[hit] : fallback;
}

const statusSchema = z.object({
  enquiryId: uuid,
  status: z.enum(["in_progress", "declined", "completed"]),
  saleHappened: z.boolean().optional(),
});

/** Seller moves an enquiry along: new -> in progress -> completed (or declined). The database enforces the rules. */
export async function setEnquiryStatus(input: z.input<typeof statusSchema>): Promise<Result> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const { enquiryId, status, saleHappened } = parsed.data;
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: "Please sign in" };
  if (status === "completed" && saleHappened === undefined) return { ok: false, error: "Say whether the sale or swap happened." };

  const patch: { status: "in_progress" | "declined" | "completed"; sale_happened?: boolean } = { status };
  if (status === "completed") patch.sale_happened = saleHappened;
  const { data, error } = await supabase.from("enquiries").update(patch).eq("id", enquiryId).select("conversation_id").maybeSingle();
  if (error || !data) return { ok: false, error: friendly(error?.message, "We couldn't update that enquiry") };
  revalidatePath("/sell/enquiries");
  revalidatePath(`/messages/${data.conversation_id}`);
  return { ok: true };
}

/** Buyer's one-tap answer to "did this go ahead?". Only a confirmed sale counts toward trust. */
export async function confirmCompletion(enquiryId: string, confirmed: boolean): Promise<Result> {
  if (!uuid.safeParse(enquiryId).success) return { ok: false, error: "Invalid request" };
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: "Please sign in" };
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("enquiries")
    .update(confirmed ? { buyer_confirmed_at: now } : { buyer_disputed_at: now })
    .eq("id", enquiryId).select("conversation_id").maybeSingle();
  if (error || !data) return { ok: false, error: friendly(error?.message, "We couldn't save your answer") };
  revalidatePath(`/messages/${data.conversation_id}`);
  return { ok: true };
}

export async function addQuickReply(text: string): Promise<Result> {
  const body = z.string().trim().min(1, "Write a reply first").max(300, "Quick replies can be up to 300 characters").safeParse(text);
  if (!body.success) return { ok: false, error: body.error.issues[0].message };
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: "Please sign in" };
  const seller = await getMySeller(user.id);
  if (!seller) return { ok: false, error: "Only sellers have quick replies" };
  const { count } = await supabase.from("quick_replies").select("id", { count: "exact", head: true }).eq("seller_id", seller.id);
  const { error } = await supabase.from("quick_replies").insert({ seller_id: seller.id, body: body.data, position: count ?? 0 });
  if (error) return { ok: false, error: friendly(error.message, "We couldn't save that reply") };
  revalidatePath("/sell/enquiries");
  return { ok: true };
}

export async function deleteQuickReply(id: string): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid request" };
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: "Please sign in" };
  const { error } = await supabase.from("quick_replies").delete().eq("id", id);
  if (error) return { ok: false, error: "We couldn't delete that reply" };
  revalidatePath("/sell/enquiries");
  return { ok: true };
}
