"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyDbError, MAX_BODY } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "./types";

const uuid = z.uuid();
const body = z.string().trim().max(MAX_BODY, `Messages can be up to ${MAX_BODY} characters`);

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

const startSchema = z.object({
  sellerId: uuid,
  listingId: uuid.nullable(),
  body: body.min(1, "Write a message first"),
  swap: z.object({ listingId: uuid.nullable(), text: z.string().trim().max(200) }).nullable(),
});

/**
 * First message of an enquiry. Creates ONE conversation per (buyer, seller, listing) and its enquiry
 * (the enquiry row is created by a database trigger). Re-enquiring reuses the existing conversation.
 */
export async function startConversation(input: z.input<typeof startSchema>): Promise<Result<{ conversationId: string }>> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your message and try again" };
  const { sellerId, listingId, body: text, swap } = parsed.data;
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: "Please sign in" };

  const { data: seller } = await supabase.from("seller_profiles").select("id,user_id,status,contact_pref").eq("id", sellerId).maybeSingle();
  if (!seller || seller.status !== "approved") return { ok: false, error: "This seller isn't available right now" };
  if (seller.user_id === user.id) return { ok: false, error: "You can't message your own hustle." };
  if (seller.contact_pref === "whatsapp") return { ok: false, error: "This seller prefers WhatsApp" };

  let q = supabase.from("conversations").select("id").eq("buyer_id", user.id).eq("seller_id", sellerId);
  q = listingId ? q.eq("listing_id", listingId) : q.is("listing_id", null);
  let { data: conv } = await q.maybeSingle();

  if (!conv) {
    const ins = await supabase.from("conversations").insert({ buyer_id: user.id, seller_id: sellerId, listing_id: listingId }).select("id").single();
    if (ins.error) {
      if (ins.error.code === "23505") {
        const again = await q.maybeSingle(); // lost a race with ourselves: reuse
        conv = again.data;
      }
      if (!conv) return { ok: false, error: friendlyDbError(ins.error.message, "We couldn't start that conversation") };
    } else conv = ins.data;
  }

  const first = await supabase.from("messages").insert({ conversation_id: conv.id, sender_id: user.id, body: text });
  if (first.error) return { ok: false, error: friendlyDbError(first.error.message, "We couldn't send your message") };

  if (swap && (swap.listingId || swap.text)) {
    const s = await supabase.from("messages").insert({
      conversation_id: conv.id, sender_id: user.id, kind: "swap_offer", body: swap.text, swap_listing_id: swap.listingId,
    });
    if (s.error) return { ok: false, error: friendlyDbError(s.error.message, "Your message was sent, but the swap offer wasn't") };
  }
  revalidatePath("/messages");
  return { ok: true, conversationId: conv.id };
}

const sendSchema = z.object({
  conversationId: uuid,
  id: uuid,
  body,
  imagePath: z.string().max(200).nullable(),
  swap: z.object({ listingId: uuid.nullable(), text: z.string().trim().max(200) }).nullable(),
});

export type SentMessage = {
  id: string; conversation_id: string; sender_id: string; body: string; kind: string; image_path: string | null;
  swap_listing_id: string | null; swap_listing_title: string | null; risk_flag: string | null; read_at: string | null; created_at: string;
};

/** Idempotent on `id`: a retry after a dropped connection never creates a duplicate. */
export async function sendMessage(input: z.input<typeof sendSchema>): Promise<Result<{ message: SentMessage }>> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your message and try again" };
  const { conversationId, id, body: text, imagePath, swap } = parsed.data;
  if (!text && !imagePath && !(swap && (swap.listingId || swap.text))) return { ok: false, error: "Write a message first" };
  if (imagePath && !imagePath.startsWith(`${conversationId}/`)) return { ok: false, error: "That image couldn't be attached." };
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: "Please sign in" };

  const isSwap = !!swap && !!(swap.listingId || swap.text);
  const row = {
    id, conversation_id: conversationId, sender_id: user.id,
    body: isSwap ? swap!.text : text, kind: isSwap ? "swap_offer" : "text",
    image_path: imagePath, swap_listing_id: isSwap ? swap!.listingId : null,
  };
  const ins = await supabase.from("messages").insert(row).select("*").single();
  if (ins.error) {
    if (ins.error.code === "23505") {
      const { data: existing } = await supabase.from("messages").select("*").eq("id", id).maybeSingle();
      if (existing && existing.sender_id === user.id) return { ok: true, message: existing };
    }
    return { ok: false, error: friendlyDbError(ins.error.message, "Couldn't send. Tap to retry.") };
  }
  return { ok: true, message: ins.data };
}
