import "server-only";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Payments are recorded here, not paid out. Writes use the service role after the caller has been checked;
// users can only read their own rows (RLS). MockPay is the default; Paystack is used only when the
// `payment_provider` setting says so AND the secret key is configured.

export type Provider = "mockpay" | "paystack";
export const REFERENCE_RE = /^HH-[A-F0-9]{16}$/;
export const newReference = () => "HH-" + crypto.randomBytes(8).toString("hex").toUpperCase();

export async function paymentsEnabled(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("feature_flags").select("enabled").eq("key", "payments").maybeSingle();
  return !!data?.enabled;
}

export async function activeProvider(): Promise<Provider> {
  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "payment_provider").maybeSingle();
  const wanted = (data?.value as { provider?: string } | null)?.provider;
  return wanted === "paystack" && process.env.PAYSTACK_SECRET_KEY ? "paystack" : "mockpay";
}

export const totalOf = (r: { item_zar: number; delivery_zar: number }) => r.item_zar + r.delivery_zar;
export const isExpired = (r: { status: string; expires_at: string }) => r.status === "pending" && new Date(r.expires_at).getTime() < Date.now();

/** Marks a pending request paid exactly once, logs the provider event and tells the seller. Safe to call twice. */
export async function markPaid(reference: string, provider: Provider, providerRef: string, payload: unknown = null) {
  const db = createAdminClient();
  const { data: updated } = await db.from("payment_requests")
    .update({ status: "paid", provider, provider_ref: providerRef, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("reference", reference).eq("status", "pending").select("id, conversation_id, seller_id, item_zar, delivery_zar").maybeSingle();

  if (!updated) {
    // Already paid (a repeat webhook) or no longer payable (cancelled): keep a trace so a human can refund if money moved.
    const { data: r } = await db.from("payment_requests").select("id, status").eq("reference", reference).maybeSingle();
    if (r && r.status !== "paid") {
      await db.from("payment_events").upsert({ request_id: r.id, type: "late_payment", payload: payload as never }, { onConflict: "request_id,type", ignoreDuplicates: true });
    }
    return { ok: !!r && r.status === "paid", alreadyHandled: true };
  }

  await db.from("payment_events").upsert({ request_id: updated.id, type: "paid", payload: payload as never }, { onConflict: "request_id,type", ignoreDuplicates: true });
  const { data: seller } = await db.from("seller_profiles").select("user_id").eq("id", updated.seller_id).maybeSingle();
  if (seller?.user_id) {
    await db.from("notifications").insert({
      user_id: seller.user_id, type: "payment_received", title: `Payment received: R${totalOf(updated).toLocaleString("en-ZA")}`,
      body: "The buyer paid your request. Hand over the order, then ask them to confirm.", url: `/messages/${updated.conversation_id}`, conversation_id: updated.conversation_id,
    });
  }
  return { ok: true, alreadyHandled: false };
}

const PAYSTACK = "https://api.paystack.co";
const auth = () => ({ Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" });

export async function paystackInit(p: { reference: string; email: string; totalZar: number; callbackUrl: string }): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${PAYSTACK}/transaction/initialize`, {
      method: "POST", headers: auth(), cache: "no-store",
      body: JSON.stringify({ email: p.email, amount: p.totalZar * 100, currency: "ZAR", reference: p.reference, callback_url: p.callbackUrl }),
    });
    const j = await res.json();
    if (!res.ok || !j.status) return { ok: false, error: typeof j.message === "string" ? j.message : "Paystack could not start the payment" };
    return { ok: true, url: j.data.authorization_url as string };
  } catch {
    return { ok: false, error: "Couldn't reach Paystack. Try again." };
  }
}

/** Asks Paystack whether this reference really succeeded for the right amount in rand. */
export async function paystackVerify(reference: string, expectedTotalZar: number): Promise<{ ok: boolean; providerRef?: string; raw?: unknown }> {
  try {
    const res = await fetch(`${PAYSTACK}/transaction/verify/${encodeURIComponent(reference)}`, { headers: auth(), cache: "no-store" });
    const j = await res.json();
    const d = j?.data;
    const ok = !!j?.status && d?.status === "success" && d?.currency === "ZAR" && d?.amount === expectedTotalZar * 100;
    return { ok, providerRef: d?.id ? String(d.id) : undefined, raw: { status: d?.status, amount: d?.amount, currency: d?.currency, channel: d?.channel } };
  } catch {
    return { ok: false };
  }
}

export function validWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !process.env.PAYSTACK_SECRET_KEY) return false;
  const expected = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
