"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addQuickReply, deleteQuickReply } from "@/app/actions/enquiries";

import Icon from "@/components/Icon";
/** Up to 5 canned responses a seller can drop into any thread. */
export default function QuickReplies({ replies }: { replies: { id: string; body: string }[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const full = replies.length >= 5;

  const add = () => {
    setError(null);
    start(async () => {
      const r = await addQuickReply(text);
      if (!r.ok) { setError(r.error); return; }
      setText(""); router.refresh();
    });
  };
  const remove = (id: string) => start(async () => { const r = await deleteQuickReply(id); if (!r.ok) setError(r.error); else router.refresh(); });

  return (
    <section aria-labelledby="qr-h" className="mt-10 rounded-2xl bg-mist p-5">
      <h2 id="qr-h" className="font-display text-xl font-bold text-navy">Quick replies <span className="text-base font-normal text-muted">({replies.length}/5)</span></h2>
      <p className="mt-1 text-sm text-muted">Save answers you send a lot. They appear above the message box in every chat.</p>
      {replies.length > 0 && (
        <ul className="mt-3 space-y-2">
          {replies.map((r) => (
            <li key={r.id} className="flex items-start gap-2 rounded-lg bg-white p-3">
              <p className="min-w-0 flex-1 text-ink">{r.body}</p>
              <button type="button" onClick={() => remove(r.id)} disabled={pending} aria-label={`Delete quick reply: ${r.body.slice(0, 30)}`}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-red-800 hover:bg-red-50"><Icon name="close" size="md" /></button>
            </li>
          ))}
        </ul>
      )}
      <form className="mt-3" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <label htmlFor="qr-new" className="sr-only">New quick reply</label>
        <textarea id="qr-new" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={300} disabled={full}
          placeholder={full ? "You've saved 5 quick replies. Delete one to add another." : "e.g. Hi! Yes it's available. Collect at the library entrance after class?"}
          className="block w-full rounded-lg border border-navy/30 bg-white px-3 py-2 text-base disabled:bg-white/60" />
        {error && <p role="alert" className="mt-2 text-sm font-medium text-red-800">{error}</p>}
        <button type="submit" disabled={pending || full || !text.trim()} className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-navy px-4 font-semibold text-white hover:bg-royal disabled:opacity-60">Save reply</button>
      </form>
    </section>
  );
}
