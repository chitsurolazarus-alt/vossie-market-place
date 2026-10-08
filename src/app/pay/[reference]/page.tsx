import { notFound } from "next/navigation";
import PayPanel from "@/components/pay/PayPanel";
import { Alert, PageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { activeProvider, isExpired, totalOf, REFERENCE_RE } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pay" };
export const dynamic = "force-dynamic";

const zar = (n: number) => `R${n.toLocaleString("en-ZA")}`;

export default async function PayPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  if (!REFERENCE_RE.test(reference)) notFound();
  const user = await requireUser(`/pay/${reference}`);
  const supabase = await createClient();
  // RLS lets only the buyer and the seller read this row; only the buyer may pay.
  const { data: r } = await supabase.from("payment_requests")
    .select("*, seller_profiles(business_name), listings(title)").eq("reference", reference).maybeSingle();
  if (!r || r.buyer_id !== user.id) notFound();

  const back = `/messages/${r.conversation_id}`;
  const expired = isExpired(r);
  const open = r.status === "pending" && !expired;
  const provider = await activeProvider();

  return (
    <PageShell title="Pay securely" width="max-w-md">
      <div className="rounded-2xl border-2 border-navy/15 bg-white p-5">
        <p className="text-sm text-muted">{r.seller_profiles?.business_name ?? "Seller"}{r.listings?.title ? ` · ${r.listings.title}` : ""}</p>
        <dl className="mt-3 space-y-1">
          <div className="flex justify-between"><dt className="text-muted">Item</dt><dd className="font-medium text-navy">{zar(r.item_zar)}</dd></div>
          {r.delivery_zar > 0 && <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd className="font-medium text-navy">{zar(r.delivery_zar)}</dd></div>}
          <div className="flex justify-between border-t border-navy/10 pt-2 text-lg"><dt className="font-semibold text-navy">Total</dt><dd className="font-display font-bold text-navy">{zar(totalOf(r))}</dd></div>
        </dl>
        {r.note && <p className="mt-3 rounded-lg bg-mist p-3 text-sm text-ink">{r.note}</p>}
        <p className="mt-3 text-xs text-muted">Reference {r.reference}</p>
      </div>

      <div className="mt-4 space-y-3">
        {open ? (
          <PayPanel reference={reference} provider={provider} backHref={back} />
        ) : (
          <>
            {r.status === "paid" ? (
              <Alert tone="success"><strong>Paid.</strong> {r.provider === "mockpay" ? "This was a test payment. " : ""}The seller has been told. Hand-over happens as agreed in the chat; confirm there once you have your order.</Alert>
            ) : r.status === "cancelled" ? (
              <Alert tone="info">The seller cancelled this request.</Alert>
            ) : (
              <Alert tone="info">This request has expired. Ask the seller for a new one.</Alert>
            )}
            <a href={back} className="flex min-h-11 items-center justify-center text-sm font-semibold text-royal underline">Back to the conversation</a>
          </>
        )}
      </div>
    </PageShell>
  );
}
