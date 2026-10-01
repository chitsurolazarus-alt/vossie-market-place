"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEnquiryStatus } from "@/app/actions/enquiries";
import Modal from "@/components/Modal";

export const STATUS_LABEL: Record<string, string> = { new: "New", in_progress: "In progress", completed: "Completed", declined: "Declined" };

type Patch = { status: string; sale_happened?: boolean | null };

const btn = "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold disabled:opacity-60";

/** Seller controls: new -> in progress -> completed, or decline. Completing asks if the sale/swap happened. */
export default function StatusActions({ enquiryId, status, onChanged }: { enquiryId: string; status: string; onChanged?: (p: Patch) => void }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "complete" | "decline">(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (next: "in_progress" | "declined" | "completed", saleHappened?: boolean, fromDialog = false) => {
    setError(null);
    start(async () => {
      const res = await setEnquiryStatus({ enquiryId, status: next, saleHappened });
      if (!res.ok) { setError(res.error); return; }
      if (fromDialog) setDialog(null); // never close a dialog the user opened while this request was in flight
      onChanged?.({ status: next, sale_happened: next === "completed" ? saleHappened ?? null : undefined });
      router.refresh();
    });
  };

  if (status === "completed" || status === "declined") return null;
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "new" && <button type="button" disabled={pending} onClick={() => run("in_progress")} className={`${btn} bg-navy text-white hover:bg-royal`}>Start</button>}
        {status === "in_progress" && <button type="button" disabled={pending} onClick={() => setDialog("complete")} className={`${btn} bg-sand text-navy hover:brightness-95`}>Mark completed</button>}
        <button type="button" disabled={pending} onClick={() => setDialog("decline")} className={`${btn} border-2 border-red-800 text-red-800 hover:bg-red-50`}>Decline</button>
      </div>
      {error && !dialog && <p role="alert" className="mt-2 text-sm font-medium text-red-800">{error}</p>}

      <Modal open={dialog === "complete"} onClose={() => setDialog(null)} title="Did this sale or swap happen?">
        <p className="text-ink">Only sales the buyer confirms count toward your trust badge. They&apos;ll get a one-tap prompt, and it auto-confirms after 7 days.</p>
        {error && <p role="alert" className="mt-3 text-sm font-medium text-red-800">{error}</p>}
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" disabled={pending} onClick={() => run("completed", true, true)} className={`${btn} min-h-12 bg-navy text-white hover:bg-royal`}>Yes, it happened</button>
          <button type="button" disabled={pending} onClick={() => run("completed", false, true)} className={`${btn} min-h-12 border-2 border-navy text-navy hover:bg-mist`}>No, it didn&apos;t go ahead</button>
        </div>
      </Modal>
      <Modal open={dialog === "decline"} onClose={() => setDialog(null)} title="Decline this enquiry?">
        <p className="text-ink">The buyer will be told. If they message again, the enquiry reopens.</p>
        {error && <p role="alert" className="mt-3 text-sm font-medium text-red-800">{error}</p>}
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" disabled={pending} onClick={() => run("declined", undefined, true)} className={`${btn} min-h-12 border-2 border-red-800 text-red-800 hover:bg-red-50`}>Yes, decline</button>
          <button type="button" onClick={() => setDialog(null)} className={`${btn} min-h-12 border-2 border-navy text-navy hover:bg-mist`}>Keep it open</button>
        </div>
      </Modal>
    </div>
  );
}
