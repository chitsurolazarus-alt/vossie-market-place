import { NextResponse, type NextRequest } from "next/server";
import { REFERENCE_RE, totalOf, markPaid, paystackVerify } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";

// Paystack sends the buyer back here. We never trust the query string: ask Paystack, then record the result.
export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("reference") ?? req.nextUrl.searchParams.get("trxref") ?? "";
  if (!REFERENCE_RE.test(reference)) return NextResponse.redirect(new URL("/messages", req.url));
  const { data: r } = await createAdminClient().from("payment_requests").select("item_zar, delivery_zar, status").eq("reference", reference).maybeSingle();
  if (r && r.status === "pending") {
    const v = await paystackVerify(reference, totalOf(r));
    if (v.ok) await markPaid(reference, "paystack", v.providerRef ?? reference, v.raw);
  }
  return NextResponse.redirect(new URL(`/pay/${reference}`, req.url));
}
