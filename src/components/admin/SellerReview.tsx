"use client";

import { useState } from "react";
import { assignMentor, reviewSeller, setSellerVerified } from "@/app/actions/admin";
import { btnDanger, btnGhost, btnPrimary, field, useAct } from "./useAct";

/** Approve, request changes or reject (reason required for the last two), plus the Verified badge and mentor. */
export default function SellerReview({ sellerId, status, verified, mentorId, mentors }: {
  sellerId: string; status: string; verified: boolean; mentorId: string | null; mentors: { id: string; name: string }[];
}) {
  const [reason, setReason] = useState("");
  const review = useAct();
  const badge = useAct();
  const mentor = useAct();
  const [mentorSel, setMentorSel] = useState(mentorId ?? "");

  return (
    <div className="space-y-6">
      {status === "pending" ? (
        <section aria-labelledby="decide-h" className="rounded-2xl border-2 border-sand bg-white p-4">
          <h2 id="decide-h" className="font-display text-xl font-bold text-navy">Decision</h2>
          <label htmlFor="reason" className="mt-3 block font-semibold text-navy">Reason <span className="font-normal text-muted">(required to reject or request changes; the seller sees it)</span></label>
          <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className={`${field} mt-1`} />
          {review.error && <p role="alert" className="mt-2 text-sm font-medium text-red-800">{review.error}</p>}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={review.pending} onClick={() => review.run(() => reviewSeller(sellerId, "approve"))} className={btnPrimary}>Approve</button>
            <button type="button" disabled={review.pending} onClick={() => review.run(() => reviewSeller(sellerId, "request_changes", reason))} className={btnGhost}>Request changes</button>
            <button type="button" disabled={review.pending} onClick={() => review.run(() => reviewSeller(sellerId, "reject", reason))} className={btnDanger}>Reject</button>
          </div>
        </section>
      ) : (
        <p className="rounded-xl bg-mist p-3 text-sm text-ink">This profile isn&apos;t waiting for review (status: <strong>{status}</strong>).</p>
      )}

      <section aria-labelledby="badge-h" className="rounded-2xl bg-mist p-4">
        <h2 id="badge-h" className="font-display text-xl font-bold text-navy">Verified Incubation Hub member</h2>
        <p className="mt-1 text-sm text-muted">Required for the Top Hustler badge. The seller is notified when it changes.</p>
        {badge.error && <p role="alert" className="mt-2 text-sm font-medium text-red-800">{badge.error}</p>}
        <button type="button" disabled={badge.pending} onClick={() => badge.run(() => setSellerVerified(sellerId, !verified, verified ? reason : undefined))} className={`${verified ? btnDanger : btnPrimary} mt-3`}>
          {verified ? "Remove Verified badge" : "Grant Verified badge"}
        </button>
        {verified && <p className="mt-2 text-xs text-muted">Removing it uses the reason box above, if you filled it in.</p>}
      </section>

      <section aria-labelledby="mentor-h" className="rounded-2xl bg-mist p-4">
        <h2 id="mentor-h" className="font-display text-xl font-bold text-navy">Mentor</h2>
        <label htmlFor="mentor" className="sr-only">Assigned mentor</label>
        <select id="mentor" value={mentorSel} onChange={(e) => setMentorSel(e.target.value)} className={`${field} mt-2`}>
          <option value="">No mentor</option>
          {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {mentor.error && <p role="alert" className="mt-2 text-sm font-medium text-red-800">{mentor.error}</p>}
        <button type="button" disabled={mentor.pending || mentorSel === (mentorId ?? "")} onClick={() => mentor.run(() => assignMentor(sellerId, mentorSel || null))} className={`${btnGhost} mt-3`}>Save mentor</button>
        {mentor.saved && <span role="status" className="ml-3 text-sm font-semibold text-emerald-800">Saved</span>}
      </section>
    </div>
  );
}
