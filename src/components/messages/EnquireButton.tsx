"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startConversation } from "@/app/actions/messages";
import Modal from "@/components/Modal";
import { detectRisk, MAX_BODY, RISK_TIPS } from "@/lib/messages";

export type SwapValue = { listingId: string; text: string };

export function RiskTip({ text }: { text: string }) {
  const risk = detectRisk(text);
  if (!risk) return null;
  return <p role="status" className="mt-2 rounded-lg border-l-4 border-amber-700 bg-amber-50 p-3 text-sm text-amber-950">{RISK_TIPS[risk]}</p>;
}

/** "Propose a swap": pick one of your own listings and/or describe an offer. */
export function SwapFields({ myListings, value, onChange, idPrefix }: {
  myListings: { id: string; title: string }[]; value: SwapValue; onChange: (v: SwapValue) => void; idPrefix: string;
}) {
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-mist p-3">
      {myListings.length > 0 && (
        <div>
          <label htmlFor={`${idPrefix}-swap-listing`} className="text-sm font-semibold text-navy">Offer one of my listings</label>
          <select id={`${idPrefix}-swap-listing`} value={value.listingId} onChange={(e) => onChange({ ...value, listingId: e.target.value })}
            className="mt-1 block min-h-11 w-full rounded-lg border border-navy/30 bg-white px-3 text-base">
            <option value="">None</option>
            {myListings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </div>
      )}
      <div>
        <label htmlFor={`${idPrefix}-swap-text`} className="text-sm font-semibold text-navy">{myListings.length ? "Or type an offer" : "What can you offer?"}</label>
        <input id={`${idPrefix}-swap-text`} value={value.text} maxLength={200} onChange={(e) => onChange({ ...value, text: e.target.value })}
          placeholder="e.g. A logo for your poster, or R50 airtime" className="mt-1 block min-h-11 w-full rounded-lg border border-navy/30 bg-white px-3 text-base" />
      </div>
    </div>
  );
}

type Props = {
  authed: boolean;
  sellerId: string;
  listingId: string | null;
  /** What the first message asks about, e.g. the listing title. Null for a seller-level chat. */
  listingTitle: string | null;
  sellerName: string;
  swapAllowed: boolean;
  myListings: { id: string; title: string }[];
  openInitially: boolean;
  /** Page to come back to after signing in. */
  returnTo: string;
  existingConversationId: string | null;
  className?: string;
};

export default function EnquireButton({ authed, sellerId, listingId, listingTitle, sellerName, swapAllowed, myListings, openInitially, returnTo, existingConversationId, className }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(openInitially && authed);
  const [text, setText] = useState(listingTitle ? `Hi! Is ${listingTitle} still available?` : "Hi! Are you taking orders at the moment?");
  const [swapOn, setSwapOn] = useState(false);
  const [swap, setSwap] = useState<SwapValue>({ listingId: "", text: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const tap = () => {
    if (!authed) {
      const sep = returnTo.includes("?") ? "&" : "?";
      router.push(`/login?next=${encodeURIComponent(`${returnTo}${sep}compose=1`)}`);
      return;
    }
    setOpen(true);
  };

  const submit = () => {
    setError(null);
    start(async () => {
      const wantsSwap = swapOn && (swap.listingId || swap.text.trim());
      const res = await startConversation({
        sellerId, listingId, body: text,
        swap: wantsSwap ? { listingId: swap.listingId || null, text: swap.text } : null,
      });
      if (!res.ok) { setError(res.error); return; }
      router.push(`/messages/${res.conversationId}`);
    });
  };

  return (
    <>
      <button type="button" onClick={tap} className={className ?? "inline-flex min-h-12 items-center justify-center rounded-lg bg-navy px-5 font-semibold text-white hover:bg-royal"}>
        Message on HustleHub
      </button>
      {authed && existingConversationId && (
        <Link href={`/messages/${existingConversationId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-royal underline">You&apos;ve already messaged · open chat</Link>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={`Message ${sellerName}`}>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label htmlFor="enq-body" className="sr-only">Your message</label>
          <textarea id="enq-body" value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={MAX_BODY}
            className="block w-full rounded-lg border border-navy/30 bg-white px-3 py-2 text-base focus:border-royal" aria-describedby="enq-count" />
          <p id="enq-count" className="mt-1 text-right text-sm text-muted">{text.length}/{MAX_BODY}</p>
          <RiskTip text={text} />
          {swapAllowed && (
            <>
              <button type="button" aria-expanded={swapOn} onClick={() => setSwapOn((v) => !v)}
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-navy px-4 font-semibold text-navy hover:bg-mist">
                {swapOn ? "Remove swap offer" : "Propose a swap"}
              </button>
              {swapOn && <SwapFields idPrefix="enq" myListings={myListings} value={swap} onChange={setSwap} />}
            </>
          )}
          {error && <p role="alert" className="mt-3 rounded-lg border-l-4 border-red-800 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
          <p className="mt-3 text-sm text-muted">Meet at a campus pickup point and never pay a deposit before you have seen the item.</p>
          <button type="submit" disabled={pending || !text.trim()}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-navy px-5 font-semibold text-white hover:bg-royal disabled:opacity-60">
            {pending ? "Sending…" : "Send message"}
          </button>
        </form>
      </Modal>
    </>
  );
}
