"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { activeProvider, isExpired, markPaid, newReference, paymentsEnabled, paystackInit, totalOf } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "./types";

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

const requestSchema = z.object({
  conversationId: z.uuid(),
  itemZar: z.number().int("Use whole rand").min(1, "Enter an amount in rand").max(100000, "That amount looks too high"),
  deliveryZar: z.number().int("Use whole rand").min(0, "Fee can't be negative").max(5000, "That fee looks too high"),
  note: z.string().trim().max(200, "Keep the note under 200 characters").optional(),
});

/** Seller asks the buyer to pay for this conversation. */
export async function createPaymentRequest(input: z.input<typeof requestSchema>): Promise<Result> {
  const p = requestSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the amount and try again." };
  if (!(await paymentsEnabled())) return { ok: false, error: "Payments aren't switched on yet." };
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: "Please sign in" };

  // RLS limits this to conversations the user is part of.
  const { data: conv } = await supabase.from("conversations")
    .select("id, listing_id, buyer_id, seller_id, seller_profiles(user_id, status), enquiries(status)").eq("id", p.data.conversationId).maybeSingle();
  if (!conv || conv.seller_profiles?.user_id !== user.id) return { ok: false, error: "Only the seller can request payment." };
  if (conv.seller_profiles.status !== "approved") return { ok: false, error: "Your seller profile must be approved to take payments." };
  if (!conv.buyer_id || !conv.seller_id) return { ok: false, error: "This conversation is no longer active." };
  const enq = Array.isArray(conv.enquiries) ? conv.enquiries[0] : conv.enquiries;
  if (enq?.status === "declined" || enq?.status === "completed") return { ok: false, error: "This enquiry is closed." };

  const db = createAdminClient();
  const { count } = await db.from("payment_requests").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id).eq("status", "pending").gt("expires_at", new Date().toISOString());
  if (count) return { ok: false, error: "There is already an open payment request. Cancel it first." };

  const { error } = await db.from("payment_requests").insert({
    conversation_id: conv.id, listing_id: conv.listing_id, seller_id: conv.seller_id, buyer_id: conv.buyer_id,
    item_zar: p.data.itemZar, delivery_zar: p.data.deliveryZar, note: p.data.note || null, reference: newReference(),
  });
  if (error) return { ok: false, error: "Couldn't create the request. Try again." };

  const total = p.data.itemZar + p.data.deliveryZar;
  await db.from("notifications").insert({
    user_id: conv.buyer_id, type: "payment_request", title: `Payment request: R${total.toLocaleString("en-ZA")}`,
    body: "The seller has asked you to pay. Open the conversation to pay securely.", url: `/messages/${conv.id}`, conversation_id: conv.id,
  });
  revalidatePath(`/messages/${conv.id}`);
  return { ok: true };
}

export async function cancelPaymentRequest(id: string): Promise<Result> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid request" };
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: "Please sign in" };
  const { data: r } = await supabase.from("payment_requests").select("id, conversation_id, seller_profiles!inner(user_id)").eq("id", id).maybeSingle();
  if (!r || r.seller_profiles.user_id !== user.id) return { ok: false, error: "Only the seller can cancel this request." };
  const { data } = await createAdminClient().from("payment_requests").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select("id").maybeSingle();
  if (!data) return { ok: false, error: "This request is no longer open." };
  revalidatePath(`/messages/${r.conversation_id}`);
  return { ok: true };
}

/** The buyer's own open request, or an error the UI can show. */
async function buyerRequest(reference: string) {
  const { supabase, user } = await me();
  if (!user) return { ok: false as const, error: "Please sign in" };
  const { data: r } = await supabase.from("payment_requests").select("*").eq("reference", reference).maybeSingle();
  if (!r || r.buyer_id !== user.id) return { ok: false as const, error: "We couldn't find that payment." };
  if (r.status !== "pending") return { ok: false as const, error: "This payment is no longer open." };
  if (isExpired(r)) return { ok: false as const, error: "This payment request has expired. Ask the seller for a new one." };
  return { ok: true as const, user, r };
}

/** MockPay: the buyer approves a test payment. No money moves. */
export async function mockPayApprove(reference: string): Promise<Result> {
  const got = await buyerRequest(reference);
  if (!got.ok) return { ok: false, error: got.error };
  if ((await activeProvider()) !== "mockpay") return { ok: false, error: "Test payments are switched off." };
  const res = await markPaid(reference, "mockpay", "MOCK-" + Date.now().toString(36).toUpperCase(), { test: true });
  if (!res.ok) return { ok: false, error: "Couldn't record the payment. Try again." };
  revalidatePath(`/messages/${got.r.conversation_id}`);
  revalidatePath(`/pay/${reference}`);
  return { ok: true };
}

/** Paystack: returns the hosted checkout URL to send the buyer to. */
export async function startPaystack(reference: string): Promise<Result<{ url: string }>> {
  const got = await buyerRequest(reference);
  if (!got.ok) return { ok: false, error: got.error };
  if ((await activeProvider()) !== "paystack" || !got.user.email) return { ok: false, error: "Paystack isn't available right now." };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const r = await paystackInit({ reference, email: got.user.email, totalZar: totalOf(got.r), callbackUrl: `${proto}://${host}/api/paystack/callback` });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, url: r.url };
}
