"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { answerBooking, requestBooking, toggleRsvp } from "@/app/actions/hub";
import { btnGhost, btnPrimary, field, useAct } from "@/components/admin/useAct";

/** RSVP to an Incubation Hub event. */
export function RsvpButton({ postId, going, authed, full, returnTo }: { postId: string; going: boolean; authed: boolean; full: boolean; returnTo: string }) {
  const router = useRouter();
  const { run, pending, error } = useAct();
  if (!authed) return <button type="button" onClick={() => router.push(`/login?next=${encodeURIComponent(returnTo)}`)} className={btnPrimary}>Sign in to RSVP</button>;
  return (
    <div>
      <button type="button" disabled={pending || (full && !going)} aria-pressed={going} onClick={() => run(() => toggleRsvp(postId, !going))} className={going ? btnGhost : btnPrimary}>
        {going ? "You're going ✓ (tap to cancel)" : full ? "Event is full" : "RSVP: I'm going"}
      </button>
      {error && <p role="alert" className="mt-1 text-sm font-medium text-red-800">{error}</p>}
    </div>
  );
}

/** Ask to book mentor office hours. The host gets a notification. */
export function BookingForm({ postId, authed, returnTo, existing }: { postId: string; authed: boolean; returnTo: string; existing: { status: string; host_note: string | null } | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const { run, pending, error, saved } = useAct();
  if (!authed) return <button type="button" onClick={() => router.push(`/login?next=${encodeURIComponent(returnTo)}`)} className={btnPrimary}>Sign in to request a slot</button>;
  if (existing && existing.status !== "declined") {
    return (
      <p role="status" className="rounded-xl bg-mist p-4 text-ink">
        {existing.status === "confirmed" ? "Your request is confirmed ✓" : "Your request is with the mentor. We'll notify you when they reply."}
        {existing.host_note && <span className="mt-1 block text-sm text-muted">Note: {existing.host_note}</span>}
      </p>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => requestBooking(postId, msg), () => setMsg("")); }}>
      {existing?.status === "declined" && <p className="mb-2 rounded-lg bg-mist p-3 text-sm text-ink">Your last request was declined{existing.host_note ? `: ${existing.host_note}` : ""}. You can ask again.</p>}
      <label htmlFor="booking-msg" className="font-semibold text-navy">What would you like help with? <span className="font-normal text-muted">(and a time that suits you)</span></label>
      <textarea id="booking-msg" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={300} rows={3} className={`${field} mt-1`} />
      {error && <p role="alert" className="mt-1 text-sm font-medium text-red-800">{error}</p>}
      {saved && <p role="status" className="mt-1 text-sm font-semibold text-emerald-800">Request sent. We&apos;ll notify you when the mentor replies.</p>}
      <button type="submit" disabled={pending} className={`${btnPrimary} mt-2`}>{pending ? "Sending…" : "Request a slot"}</button>
    </form>
  );
}

/** Host confirms or declines a booking request. */
export function BookingAnswer({ bookingId }: { bookingId: string }) {
  const [note, setNote] = useState("");
  const { run, pending, error } = useAct();
  return (
    <div className="mt-2">
      <label htmlFor={`note-${bookingId}`} className="sr-only">Note to the seller</label>
      <input id={`note-${bookingId}`} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Optional note (time, venue…)" className={field} />
      {error && <p role="alert" className="mt-1 text-sm font-medium text-red-800">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={pending} onClick={() => run(() => answerBooking(bookingId, "confirmed", note))} className={btnPrimary}>Confirm</button>
        <button type="button" disabled={pending} onClick={() => run(() => answerBooking(bookingId, "declined", note))} className={btnGhost}>Decline</button>
      </div>
    </div>
  );
}
