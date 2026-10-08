"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPaymentRequest } from "@/app/actions/payments";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import { useToast } from "@/components/Toast";

/** Seller side: ask the buyer to pay. Amounts are prefilled from the listing. */
export default function RequestPaymentForm({ conversationId, defaultItem, defaultDelivery }: { conversationId: string; defaultItem: number | null; defaultDelivery: number }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState(defaultItem ? String(defaultItem) : "");
  const [delivery, setDelivery] = useState(defaultDelivery ? String(defaultDelivery) : "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await createPaymentRequest({ conversationId, itemZar: Number(item), deliveryZar: Number(delivery || 0), note });
      if (r.ok) { toast("Payment request sent"); setOpen(false); setNote(""); router.refresh(); } else setError(r.error);
    });
  };

  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}>Request payment</Button>;
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border-2 border-navy/15 bg-white p-4">
      <h3 className="font-display text-lg font-bold text-navy">Request payment</h3>
      <Field label="Item price (R)" htmlFor="pay-item">
        <input id="pay-item" type="number" inputMode="numeric" min={1} step={1} required className={inputCls} value={item} onChange={(e) => setItem(e.target.value)} />
      </Field>
      <Field label="Delivery fee (R, optional)" htmlFor="pay-delivery">
        <input id="pay-delivery" type="number" inputMode="numeric" min={0} max={5000} step={1} className={inputCls} value={delivery} onChange={(e) => setDelivery(e.target.value)} />
      </Field>
      <Field label="Note to the buyer (optional)" htmlFor="pay-note">
        <input id="pay-note" maxLength={200} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex gap-3">
        <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" className="flex-1" disabled={pending}>{pending ? "Sending..." : "Send request"}</Button>
      </div>
    </form>
  );
}
