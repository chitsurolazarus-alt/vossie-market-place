"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mockPayApprove, startPaystack } from "@/app/actions/payments";
import { Alert, Button } from "@/components/ui";

/** The buyer's pay controls. MockPay approves a test payment; Paystack sends the buyer to hosted checkout. */
export default function PayPanel({ reference, provider, backHref }: { reference: string; provider: "mockpay" | "paystack"; backHref: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const approve = () => start(async () => {
    setError("");
    const r = await mockPayApprove(reference);
    if (r.ok) router.refresh(); else setError(r.error);
  });
  const paystack = () => start(async () => {
    setError("");
    const r = await startPaystack(reference);
    if (r.ok) window.location.assign(r.url); else setError(r.error);
  });

  return (
    <div className="space-y-3">
      {provider === "mockpay" ? (
        <>
          <p className="rounded-xl bg-sand/40 p-3 text-sm text-navy"><strong>Test payment.</strong> MockPay simulates a card payment. No real money moves.</p>
          <Button className="w-full" onClick={approve} disabled={pending}>{pending ? "Processing..." : "Approve test payment"}</Button>
        </>
      ) : (
        <>
          <p className="rounded-xl bg-mist p-3 text-sm text-ink">You&apos;ll finish on Paystack&apos;s secure page and come straight back here.</p>
          <Button className="w-full" onClick={paystack} disabled={pending}>{pending ? "Opening Paystack..." : "Pay with Paystack"}</Button>
        </>
      )}
      <a href={backHref} className="flex min-h-11 items-center justify-center text-sm font-semibold text-royal underline">Back to the conversation</a>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
