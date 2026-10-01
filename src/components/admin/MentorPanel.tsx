"use client";

import { useState } from "react";
import { addMentorNote, deleteMentorNote, logCheckin } from "@/app/actions/mentor";
import { btnGhost, btnPrimary, field, useAct } from "./useAct";

type Note = { id: string; body: string; created_at: string; mine: boolean };
type Checkin = { id: string; note: string | null; checked_in_at: string };
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Johannesburg" });

/** Private notes and check-in log for one seller. Visible to the assigned mentor (and admins, read-only). */
export default function MentorPanel({ sellerId, notes, checkins, canWrite }: { sellerId: string; notes: Note[]; checkins: Checkin[]; canWrite: boolean }) {
  const [note, setNote] = useState("");
  const [ci, setCi] = useState("");
  const addN = useAct();
  const addC = useAct();
  const del = useAct();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section aria-labelledby="notes-h" className="rounded-2xl border border-navy/15 bg-white p-4">
        <h2 id="notes-h" className="font-display text-xl font-bold text-navy">Private notes</h2>
        <p className="text-sm text-muted">Only you (and admins) can see these. The seller cannot.</p>
        {canWrite && (
          <form className="mt-3" onSubmit={(e) => { e.preventDefault(); addN.run(() => addMentorNote(sellerId, note), () => setNote("")); }}>
            <label htmlFor="note" className="sr-only">New note</label>
            <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className={field} placeholder="What should you remember about this seller?" />
            {addN.error && <p role="alert" className="mt-1 text-sm font-medium text-red-800">{addN.error}</p>}
            <button type="submit" disabled={addN.pending || !note.trim()} className={`${btnPrimary} mt-2`}>Add note</button>
          </form>
        )}
        <ul className="mt-4 space-y-2">
          {notes.length === 0 && <li className="text-sm text-muted">No notes yet.</li>}
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-mist p-3">
              <p className="whitespace-pre-wrap break-words text-ink">{n.body}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <time dateTime={n.created_at} className="text-xs text-muted">{fmt(n.created_at)}</time>
                {n.mine && canWrite && <button type="button" disabled={del.pending} onClick={() => del.run(() => deleteMentorNote(n.id, sellerId))} className="min-h-11 px-2 text-sm font-semibold text-red-800 underline">Delete</button>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ci-h" className="rounded-2xl border border-navy/15 bg-white p-4">
        <h2 id="ci-h" className="font-display text-xl font-bold text-navy">Check-ins</h2>
        <p className="text-sm text-muted">Log each time you catch up with this seller.</p>
        {canWrite && (
          <form className="mt-3" onSubmit={(e) => { e.preventDefault(); addC.run(() => logCheckin(sellerId, ci), () => setCi("")); }}>
            <label htmlFor="ci" className="sr-only">Check-in note</label>
            <textarea id="ci" value={ci} onChange={(e) => setCi(e.target.value)} rows={2} maxLength={500} className={field} placeholder="Optional: what did you talk about?" />
            {addC.error && <p role="alert" className="mt-1 text-sm font-medium text-red-800">{addC.error}</p>}
            <button type="submit" disabled={addC.pending} className={`${btnGhost} mt-2`}>Log a check-in</button>
          </form>
        )}
        <ul className="mt-4 space-y-2">
          {checkins.length === 0 && <li className="text-sm text-muted">No check-ins logged yet.</li>}
          {checkins.map((c) => (
            <li key={c.id} className="rounded-lg bg-mist p-3">
              <p className="text-sm font-semibold text-navy">{fmt(c.checked_in_at)}</p>
              {c.note && <p className="whitespace-pre-wrap break-words text-ink">{c.note}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
