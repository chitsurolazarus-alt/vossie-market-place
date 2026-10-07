"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { submitReport } from "@/app/actions/reports";
import Modal from "@/components/Modal";
import { REPORT_REASONS, TARGET_LABEL, type ReportReason, type ReportTarget } from "@/lib/moderation";

import Icon from "./Icon";
type Props = {
  targetType: ReportTarget; targetId: string; authed: boolean; returnTo: string;
  /** Visible label; defaults to "Report". */
  label?: string; className?: string;
};

/** Report a listing, seller profile, user or message. Reporter identity is never shown to the reported person. */
export default function ReportButton({ targetType, targetId, authed, returnTo, label = "Report", className }: Props) {
  const router = useRouter();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const tap = () => {
    if (!authed) { router.push(`/login?next=${encodeURIComponent(returnTo)}`); return; }
    setDone(false); setError(null); setOpen(true);
  };
  const close = () => setOpen(false);
  const submit = () => {
    if (!reason) { setError("Choose a reason first."); return; }
    setError(null);
    start(async () => {
      const r = await submitReport({ targetType, targetId, reason, note: note.trim() || undefined });
      if (!r.ok) { setError(r.error); return; }
      setDone(true); setReason(""); setNote("");
    });
  };

  const noun = TARGET_LABEL[targetType].toLowerCase();
  return (
    <>
      <button type="button" onClick={tap} aria-haspopup="dialog"
        className={className ?? "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-muted underline hover:text-navy"}>
        <Icon name="flag" size="sm" />
        {label}
      </button>
      <Modal open={open} onClose={close} title={done ? "Thanks for telling us" : `Report this ${noun}`}>
        {done ? (
          <div>
            <p className="text-ink">The Incubation Hub team will review it. You&apos;ll get a notification when it&apos;s resolved. Whoever you reported is never told who reported them.</p>
            <button type="button" onClick={close} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-navy px-5 font-semibold text-white hover:bg-royal">Close</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <fieldset>
              <legend className="font-semibold text-navy">What&apos;s wrong?</legend>
              <div className="mt-2 space-y-2">
                {REPORT_REASONS.map((r) => (
                  <label key={r.value} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${reason === r.value ? "border-navy bg-mist" : "border-navy/20"}`}>
                    <input type="radio" name={`${uid}-reason`} value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="mt-1 h-5 w-5 shrink-0" />
                    <span><span className="block font-semibold text-navy">{r.label}</span><span className="block text-sm text-muted">{r.hint}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label htmlFor={`${uid}-note`} className="mt-4 block font-semibold text-navy">More detail <span className="font-normal text-muted">(optional)</span></label>
            <textarea id={`${uid}-note`} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500}
              className="mt-1 block w-full rounded-lg border border-navy/30 bg-white px-3 py-2 text-base focus:border-royal" />
            <p className="mt-1 text-right text-sm text-muted">{note.length}/500</p>
            {error && <p role="alert" className="mt-2 rounded-lg border-l-4 border-red-800 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
            <button type="submit" disabled={pending} className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-navy px-5 font-semibold text-white hover:bg-royal disabled:opacity-60">
              {pending ? "Sending…" : "Send report"}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
