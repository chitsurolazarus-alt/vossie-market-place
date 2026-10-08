import Link from "next/link";
import { cancelPaymentRequest } from "@/app/actions/payments";
import RequestPaymentForm from "@/components/messages/RequestPaymentForm";
import Icon from "@/components/Icon";
import { ButtonLink } from "@/components/ui";
import { isExpired, totalOf, paymentsEnabled } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";

const zar = (n: number) => `R${n.toLocaleString("en-ZA")}`;
const when = (iso: string) => new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });

/** Payment requests for one conversation, above the thread. Hidden entirely when the payments flag is off and nothing exists. */
export default async function PaymentPanel({ conversationId, role, listingId }: { conversationId: string; role: "buyer" | "seller"; listingId: string | null }) {
  const supabase = await createClient();
  const [enabled, { data: rows }, { data: listing }] = await Promise.all([
    paymentsEnabled(),
    supabase.from("payment_requests").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(5),
    listingId ? supabase.from("listings").select("price_zar, delivery_fee_zar, handover").eq("id", listingId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const list = rows ?? [];
  if (!enabled && list.length === 0) return null;
  const open = list.find((r) => r.status === "pending" && !isExpired(r));

  return (
    <section aria-label="Payments" className="mx-auto max-w-2xl space-y-3 px-4 pt-3">
      {list.map((r) => {
        const expired = isExpired(r);
        const state = r.status === "paid" ? "Paid" : r.status === "cancelled" ? "Cancelled" : expired ? "Expired" : "Waiting for payment";
        return (
          <div key={r.id} className="rounded-2xl border-2 border-navy/15 bg-white p-4" data-payment-status={expired ? "expired" : r.status}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-display text-lg font-bold text-navy"><Icon name="money" size="md" className="text-royal" />{zar(totalOf(r))}</p>
                <p className="text-sm text-muted">{r.delivery_zar > 0 ? `${zar(r.item_zar)} + ${zar(r.delivery_zar)} delivery · ` : ""}{when(r.created_at)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${r.status === "paid" ? "bg-emerald-100 text-emerald-950" : r.status === "pending" && !expired ? "bg-sand text-navy" : "bg-mist text-muted"}`}>{state}</span>
            </div>
            {r.note && <p className="mt-2 text-sm text-ink">{r.note}</p>}
            {r.status === "paid" && <p className="mt-2 text-sm text-muted">{r.provider === "mockpay" ? "Test payment (no real money). " : ""}Reference {r.reference}</p>}
            {r.status === "pending" && !expired && (
              role === "buyer" ? (
                <div className="mt-3"><ButtonLink href={`/pay/${r.reference}`}>Pay {zar(totalOf(r))}</ButtonLink></div>
              ) : (
                <form className="mt-3" action={async () => { "use server"; await cancelPaymentRequest(r.id); }}>
                  <button type="submit" className="min-h-11 rounded-lg px-3 font-semibold text-royal underline">Cancel request</button>
                </form>
              )
            )}
          </div>
        );
      })}
      {role === "seller" && enabled && !open && (
        <RequestPaymentForm conversationId={conversationId} defaultItem={listing?.price_zar ?? null}
          defaultDelivery={listing && listing.handover?.some((h) => h !== "pickup") ? listing.delivery_fee_zar ?? 0 : 0} />
      )}
      {role === "buyer" && enabled && list.length === 0 && (
        <p className="text-sm text-muted">Agree the price and handover in the chat. The seller can then send a payment request here. <Link href="/faq" className="font-semibold text-royal underline">How payments work</Link></p>
      )}
    </section>
  );
}
