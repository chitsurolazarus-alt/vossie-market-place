import { NextResponse, type NextRequest } from "next/server";
import { REFERENCE_RE, totalOf, markPaid, paystackVerify, validWebhookSignature } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";

// Signed by Paystack (HMAC SHA-512 of the raw body). We still re-verify the amount with Paystack before recording.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validWebhookSignature(raw, req.headers.get("x-paystack-signature"))) return new NextResponse("Invalid signature", { status: 401 });
  let event: { event?: string; data?: { reference?: string } };
  try { event = JSON.parse(raw); } catch { return new NextResponse("Bad request", { status: 400 }); }
  const reference = event.data?.reference ?? "";
  if (event.event === "charge.success" && REFERENCE_RE.test(reference)) {
    const { data: r } = await createAdminClient().from("payment_requests").select("item_zar, delivery_zar, status").eq("reference", reference).maybeSingle();
    if (r && r.status === "pending") {
      const v = await paystackVerify(reference, totalOf(r));
      if (v.ok) await markPaid(reference, "paystack", v.providerRef ?? reference, v.raw);
    }
  }
  return NextResponse.json({ received: true });
}
