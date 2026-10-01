"use client";

import { useState } from "react";
import { resolveReport } from "@/app/actions/admin";
import Modal from "@/components/Modal";
import { SUSPEND_OPTIONS } from "@/lib/moderation";
import { btnDanger, btnGhost, btnPrimary, field, useAct } from "./useAct";

type Action = "dismiss" | "hide" | "warn" | "suspend" | "ban";

/** Resolve a report: dismiss / hide content / warn / suspend (with duration) / ban. Resolves all open reports on the same target. */
export default function ReportActions({ reportId, targetType, hasUser, listingHidden }: {
  reportId: string; targetType: string; hasUser: boolean; listingHidden: boolean;
}) {
  const [open, setOpen] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [days, setDays] = useState(7);
  const { run, pending, error, setError } = useAct();
  const close = () => { setOpen(null); setError(null); };

  const submit = () => {
    if (!open) return;
    run(() => resolveReport(reportId, open, { days: open === "suspend" ? days : undefined, note }), close);
  };
  const titles: Record<Action, string> = {
    dismiss: "Dismiss this report", hide: "Hide this listing", warn: "Warn the user", suspend: "Suspend the user", ban: "Ban the user",
  };
  const help: Record<Action, string> = {
    dismiss: listingHidden ? "No breach found. A listing hidden automatically will be restored." : "No breach found. Reporters are told it was reviewed.",
    hide: "The listing is hidden from buyers. The seller is told it's under review (never who reported).",
    warn: "Sends the user a notification with your message.",
    suspend: "They can sign in but can't list or message until it ends. Their profile and listings are hidden meanwhile.",
    ban: "Permanent. They can't sign in, list or message, and their profile is hidden.",
  };
  const noteLabel = open === "warn" ? "Message to the user (required)" : open === "dismiss" ? "Internal note (optional)" : "Reason (shown to the user, kept in the audit log)";

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen("dismiss")} className={btnGhost}>Dismiss</button>
        {targetType === "listing" && <button type="button" onClick={() => setOpen("hide")} className={btnGhost}>Hide listing</button>}
        {hasUser && <button type="button" onClick={() => setOpen("warn")} className={btnGhost}>Warn user</button>}
        {hasUser && <button type="button" onClick={() => setOpen("suspend")} className={btnDanger}>Suspend user</button>}
        {hasUser && <button type="button" onClick={() => setOpen("ban")} className={btnDanger}>Ban user</button>}
      </div>
      <Modal open={open !== null} onClose={close} title={open ? titles[open] : ""}>
        {open && (
          <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <p className="text-ink">{help[open]}</p>
            {open === "suspend" && (
              <>
                <label htmlFor="days" className="mt-3 block font-semibold text-navy">For how long?</label>
                <select id="days" value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${field} mt-1`}>
                  {SUSPEND_OPTIONS.map((o) => <option key={o.days} value={o.days}>{o.label}</option>)}
                </select>
              </>
            )}
            <label htmlFor="note" className="mt-3 block font-semibold text-navy">{noteLabel}</label>
            <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className={`${field} mt-1`} />
            {error && <p role="alert" className="mt-2 text-sm font-medium text-red-800">{error}</p>}
            <button type="submit" disabled={pending} className={`${open === "suspend" || open === "ban" ? btnDanger : btnPrimary} mt-4 w-full min-h-12`}>
              {pending ? "Working…" : `Confirm: ${titles[open].toLowerCase()}`}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
