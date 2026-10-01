"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { confirmCompletion } from "@/app/actions/enquiries";
import { sendMessage, type SentMessage } from "@/app/actions/messages";
import StatusActions, { STATUS_LABEL } from "@/components/sell/StatusActions";
import { compressMessageImage } from "@/lib/image";
import { AUTO_CONFIRM_DAYS, clockTime, dayKey, dayLabel, detectRisk, linkify, MAX_BODY, RISK_TIPS } from "@/lib/messages";
import { createClient } from "@/lib/supabase/client";
import { RiskTip, SwapFields, type SwapValue } from "./EnquireButton";

type Msg = SentMessage & { _state?: "sending" | "failed"; _error?: string; _preview?: string };
export type EnquiryState = {
  id: string; status: string; sale_happened: boolean | null; completion_requested_at: string | null;
  buyer_confirmed_at: string | null; buyer_disputed_at: string | null; auto_confirmed: boolean;
};
type Payload = { body: string; swap: { listingId: string | null; text: string } | null; blob: Blob | null; uploaded: boolean };

type Props = {
  conversationId: string; meId: string; role: "buyer" | "seller"; otherName: string;
  sellerSlug: string | null; listing: { id: string; title: string; price: string; availability: string } | null;
  listingTitle: string | null; coverUrl: string | null; source: string;
  initialMessages: SentMessage[]; images: Record<string, string>; hasMore: boolean; initialEnquiry: EnquiryState;
  quickReplies: { id: string; body: string }[]; myListings: { id: string; title: string }[]; swapAllowed: boolean;
};

const byTime = (a: Msg, b: Msg) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0);

export default function Thread(p: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [msgs, setMsgs] = useState<Msg[]>(p.initialMessages);
  const [urls, setUrls] = useState<Record<string, string>>(p.images);
  const [hasMore, setHasMore] = useState(p.hasMore);
  const [enq, setEnq] = useState<EnquiryState>(p.initialEnquiry);
  const [text, setText] = useState("");
  const [swapOn, setSwapOn] = useState(false);
  const [swap, setSwap] = useState<SwapValue>({ listingId: "", text: "" });
  const [file, setFile] = useState<{ blob: Blob; preview: string } | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [busyImage, setBusyImage] = useState(false);
  const payloads = useRef(new Map<string, Payload>());
  const msgsRef = useRef(msgs);
  useEffect(() => { msgsRef.current = msgs; }, [msgs]);
  const bottom = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);

  // ---- helpers
  const merge = useCallback((m: SentMessage) => {
    setMsgs((prev) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i >= 0) { const next = [...prev]; next[i] = { ...m }; return next; }
      return [...prev, m].sort(byTime);
    });
  }, []);

  const ensureUrl = useCallback(async (path: string) => {
    const { data } = await supabase.storage.from("message-images").createSignedUrl(path, 3600);
    if (data?.signedUrl) setUrls((u) => (u[path] ? u : { ...u, [path]: data.signedUrl }));
  }, [supabase]);

  const markRead = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const now = new Date().toISOString();
    await supabase.from("messages").update({ read_at: now }).eq("conversation_id", p.conversationId).neq("sender_id", p.meId).is("read_at", null);
    await supabase.from("notifications").update({ read_at: now }).eq("user_id", p.meId).eq("conversation_id", p.conversationId).is("read_at", null).neq("type", "completion_request");
  }, [supabase, p.conversationId, p.meId]);

  const catchUp = useCallback(async () => {
    const last = [...msgsRef.current].reverse().find((m) => !m._state)?.created_at;
    let q = supabase.from("messages").select("*").eq("conversation_id", p.conversationId).order("created_at");
    if (last) q = q.gt("created_at", last);
    const { data } = await q;
    for (const m of data ?? []) { merge(m); if (m.image_path) void ensureUrl(m.image_path); }
  }, [supabase, p.conversationId, merge, ensureUrl]);

  // ---- realtime
  useEffect(() => {
    void markRead();
    const ch = supabase.channel(`thread:${p.conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${p.conversationId}` }, (e) => {
        const m = e.new as SentMessage;
        merge(m);
        if (m.image_path) void ensureUrl(m.image_path);
        if (m.sender_id !== p.meId) void markRead();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${p.conversationId}` }, (e) => merge(e.new as SentMessage))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "enquiries", filter: `id=eq.${p.initialEnquiry.id}` }, (e) => setEnq((cur) => ({ ...cur, ...(e.new as Partial<EnquiryState>) })))
      .subscribe((status) => { if (status === "SUBSCRIBED") void catchUp(); });
    const onVisible = () => { if (document.visibilityState === "visible") { void catchUp(); void markRead(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { supabase.removeChannel(ch); document.removeEventListener("visibilitychange", onVisible); };
  }, [supabase, p.conversationId, p.meId, p.initialEnquiry.id, merge, ensureUrl, markRead, catchUp]);

  // ---- scrolling: stay pinned to the newest message unless the reader scrolled up
  useEffect(() => {
    const onScroll = () => { stick.current = window.innerHeight + window.scrollY >= document.body.scrollHeight - 160; };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => { if (stick.current) bottom.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, []);

  const loadEarlier = async () => {
    const first = msgs.find((m) => !m._state);
    if (!first) return;
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", p.conversationId)
      .lt("created_at", first.created_at).order("created_at", { ascending: false }).limit(60);
    const older = (data ?? []).slice().reverse();
    stick.current = false;
    setMsgs((prev) => [...older, ...prev]);
    setHasMore((data ?? []).length === 60);
    for (const m of older) if (m.image_path) void ensureUrl(m.image_path);
  };

  // ---- sending (optimistic, idempotent retry)
  const deliver = useCallback(async (id: string) => {
    const pl = payloads.current.get(id);
    if (!pl) return;
    setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, _state: "sending", _error: undefined } : m)));
    const fail = (error: string) => setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, _state: "failed", _error: error } : m)));
    try {
      let imagePath: string | null = null;
      if (pl.blob) {
        imagePath = `${p.conversationId}/${p.meId}/${id}.webp`;
        if (!pl.uploaded) {
          const up = await supabase.storage.from("message-images").upload(imagePath, pl.blob, { contentType: "image/webp" });
          if (up.error && !/exists|duplicate/i.test(up.error.message)) { fail("Photo upload failed. Tap to retry."); return; }
          pl.uploaded = true;
        }
      }
      const res = await sendMessage({ conversationId: p.conversationId, id, body: pl.body, imagePath, swap: pl.swap });
      if (!res.ok) { fail(res.error); return; }
      payloads.current.delete(id);
      merge(res.message);
      if (res.message.image_path) void ensureUrl(res.message.image_path);
    } catch {
      fail("No connection. Tap to retry.");
    }
  }, [supabase, p.conversationId, p.meId, merge, ensureUrl]);

  const submit = () => {
    const body = text.trim();
    const swapPayload = swapOn && (swap.listingId || swap.text.trim()) ? { listingId: swap.listingId || null, text: swap.text.trim() } : null;
    if (!body && !file && !swapPayload) return;
    setComposeError(null);
    const id = crypto.randomUUID();
    const myTitle = swapPayload?.listingId ? p.myListings.find((l) => l.id === swapPayload.listingId)?.title ?? null : null;
    payloads.current.set(id, { body: swapPayload ? swapPayload.text : body, swap: swapPayload, blob: file?.blob ?? null, uploaded: false });
    const optimistic: Msg = {
      id, conversation_id: p.conversationId, sender_id: p.meId, body: swapPayload ? swapPayload.text : body,
      kind: swapPayload ? "swap_offer" : "text", image_path: null, swap_listing_id: swapPayload?.listingId ?? null,
      swap_listing_title: myTitle, risk_flag: detectRisk(body), read_at: null, created_at: new Date().toISOString(),
      _state: "sending", _preview: file?.preview,
    };
    stick.current = true;
    setMsgs((prev) => [...prev, optimistic].sort(byTime));
    // A typed message alongside a swap offer is sent first so it isn't lost.
    if (swapPayload && body) {
      const textId = crypto.randomUUID();
      payloads.current.set(textId, { body, swap: null, blob: null, uploaded: false });
      setMsgs((prev) => [...prev, { ...optimistic, id: textId, body, kind: "text", swap_listing_id: null, swap_listing_title: null, created_at: new Date(Date.parse(optimistic.created_at) - 1).toISOString(), _preview: undefined }].sort(byTime));
      void deliver(textId).then(() => deliver(id));
    } else void deliver(id);
    setText(""); setSwap({ listingId: "", text: "" }); setSwapOn(false); setFile(null);
  };

  const discard = (id: string) => { payloads.current.delete(id); setMsgs((prev) => prev.filter((m) => m.id !== id)); };

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    setComposeError(null); setBusyImage(true);
    try {
      const blob = await compressMessageImage(f);
      setFile({ blob, preview: URL.createObjectURL(blob) });
    } catch (e) { setComposeError(e instanceof Error ? e.message : "Couldn't use that photo"); }
    finally { setBusyImage(false); if (fileInput.current) fileInput.current.value = ""; }
  };

  // ---- completion prompt (buyer)
  const [confirming, setConfirming] = useState(false);
  const [confirmErr, setConfirmErr] = useState<string | null>(null);
  const answer = async (yes: boolean) => {
    setConfirming(true); setConfirmErr(null);
    const res = await confirmCompletion(enq.id, yes);
    setConfirming(false);
    if (!res.ok) { setConfirmErr(res.error); return; }
    const now = new Date().toISOString();
    setEnq((e) => ({ ...e, ...(yes ? { buyer_confirmed_at: now } : { buyer_disputed_at: now }) }));
  };
  const awaiting = enq.status === "completed" && enq.sale_happened === true && !enq.buyer_confirmed_at && !enq.buyer_disputed_at;
  const autoDate = enq.completion_requested_at
    ? new Date(new Date(enq.completion_requested_at).getTime() + AUTO_CONFIRM_DAYS * 864e5).toLocaleDateString("en-ZA", { day: "numeric", month: "long" }) : null;

  // ---- render helpers
  const flagged = [...msgs].reverse().find((m) => m.sender_id !== p.meId && m.risk_flag);
  const lastMine = [...msgs].reverse().find((m) => m.sender_id === p.meId);
  const pendingSwapTitle = swapOn && swap.listingId ? p.myListings.find((l) => l.id === swap.listingId)?.title : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      {/* Pinned listing context */}
      <div className="sticky top-[60px] z-30 border-b border-navy/10 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-mist">
            {p.coverUrl && <Image src={p.coverUrl} alt="" fill sizes="48px" quality={50} className="object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-navy">{p.otherName}{p.source === "whatsapp" && <span className="font-normal text-muted"> · WhatsApp lead</span>}</p>
            {p.listing ? (
              <Link href={`/l/${p.listing.id}`} className="flex min-h-11 items-center truncate font-semibold text-navy hover:underline"><span className="truncate">{p.listing.title}<span className="font-normal text-muted"> · {p.listing.price}</span></span></Link>
            ) : (
              <p className="truncate font-semibold text-navy">{p.listingTitle ?? "General enquiry"}</p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-mist px-3 py-1 text-xs font-bold text-navy" aria-label={`Status: ${STATUS_LABEL[enq.status] ?? enq.status}`}>{STATUS_LABEL[enq.status] ?? enq.status}</span>
        </div>
      </div>

      <div className="space-y-3 px-4 pt-3">
        {p.role === "seller" && (
          <div className="rounded-xl bg-mist p-3">
            <StatusActions enquiryId={enq.id} status={enq.status} onChanged={(patch) => setEnq((e) => ({ ...e, status: patch.status, sale_happened: patch.sale_happened ?? e.sale_happened }))} />
            {enq.status === "completed" && enq.sale_happened && (
              <p className="text-sm text-ink">
                {enq.buyer_confirmed_at ? `Sale confirmed${enq.auto_confirmed ? " automatically" : " by the buyer"} ✓ It counts toward your trust badge.`
                  : enq.buyer_disputed_at ? "The buyer said this didn't go ahead, so it won't count toward your trust badge."
                  : `Waiting for the buyer to confirm${autoDate ? ` (auto-confirms on ${autoDate})` : ""}.`}
              </p>
            )}
            {enq.status === "completed" && enq.sale_happened === false && <p className="text-sm text-ink">Closed: marked as not going ahead.</p>}
            {enq.status === "declined" && <p className="text-sm text-ink">Declined. If the buyer messages again, this reopens.</p>}
            {enq.status === "new" && <p className="mt-2 text-sm text-muted">Tap Start once you&apos;ve agreed to go ahead, so your dashboard stays tidy.</p>}
          </div>
        )}
        {p.role === "buyer" && awaiting && (
          <div role="group" aria-label="Confirm completion" className="rounded-xl border-2 border-sand bg-white p-4">
            <p className="font-semibold text-navy">Did this go ahead?</p>
            <p className="mt-1 text-sm text-ink">{p.otherName} marked {p.listingTitle ?? "this enquiry"} as done. Your answer keeps seller badges honest.{autoDate && ` If you don't answer, it's confirmed on ${autoDate}.`}</p>
            {confirmErr && <p role="alert" className="mt-2 text-sm font-medium text-red-800">{confirmErr}</p>}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" disabled={confirming} onClick={() => answer(true)} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg bg-navy px-4 font-semibold text-white hover:bg-royal disabled:opacity-60">Yes, it went ahead</button>
              <button type="button" disabled={confirming} onClick={() => answer(false)} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg border-2 border-navy px-4 font-semibold text-navy hover:bg-mist disabled:opacity-60">No, it didn&apos;t</button>
            </div>
          </div>
        )}
        {p.role === "buyer" && enq.status === "completed" && enq.sale_happened && (enq.buyer_confirmed_at || enq.buyer_disputed_at) && (
          <p className="rounded-lg bg-mist p-3 text-sm text-ink">{enq.buyer_confirmed_at ? "Thanks, you confirmed this went ahead." : "Thanks, we've noted this didn't go ahead."}</p>
        )}
        {p.role === "buyer" && enq.status === "declined" && <p className="rounded-lg bg-mist p-3 text-sm text-ink">{p.otherName} declined this enquiry. Send a message to reopen it.</p>}
        {flagged?.risk_flag && (
          <p role="status" className="rounded-lg border-l-4 border-amber-700 bg-amber-50 p-3 text-sm text-amber-950">{RISK_TIPS[flagged.risk_flag as "payment" | "bank"]}</p>
        )}
        <p className="text-center text-xs text-muted">Meet at a campus pickup point. Never pay a deposit before you&apos;ve seen the item.</p>
      </div>

      {/* Messages */}
      <ol aria-label="Messages" aria-live="polite" className="space-y-1.5 px-4 pb-4 pt-2">
        {hasMore && <li className="text-center"><button type="button" onClick={loadEarlier} className="min-h-11 rounded-lg px-4 text-sm font-semibold text-royal underline">Load earlier messages</button></li>}
        {msgs.length === 0 && <li className="py-10 text-center text-muted">No messages yet. Say hi!</li>}
        {msgs.map((m, i) => {
          const mine = m.sender_id === p.meId;
          const newDay = i === 0 || dayKey(msgs[i - 1].created_at) !== dayKey(m.created_at);
          const img = m.image_path ? urls[m.image_path] : m._preview;
          return (
            <Fragment key={m.id}>
              {newDay && <li className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted"><span className="rounded-full bg-mist px-3 py-1">{dayLabel(m.created_at)}</span></li>}
              <li className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? "rounded-br-sm bg-navy text-white" : "rounded-bl-sm bg-mist text-ink"} ${m._state === "failed" ? "ring-2 ring-red-700" : ""}`}>
                  {m.kind === "swap_offer" && (
                    <div className={`mb-2 rounded-xl border-2 p-3 ${mine ? "border-sand bg-white/10" : "border-navy/30 bg-white"}`}>
                      <p className={`text-xs font-bold uppercase tracking-wide ${mine ? "text-sand" : "text-royal"}`}>Swap offer</p>
                      {m.swap_listing_title && <p className="mt-1 font-semibold">{m.swap_listing_title}</p>}
                      {m.body && <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>}
                    </div>
                  )}
                  {img && (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs: skip the optimiser
                    <a href={img} target="_blank" rel="noopener noreferrer"><img src={img} alt="Photo sent in this chat" className="mb-1 max-h-64 w-full rounded-lg object-cover" loading="lazy" /></a>
                  )}
                  {m.image_path && !img && <p className="text-sm opacity-80">Loading photo…</p>}
                  {m.kind !== "swap_offer" && m.body && (
                    <p className="whitespace-pre-wrap break-words">
                      {linkify(m.body).map((s, k) => s.type === "link"
                        ? <a key={k} href={s.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="underline underline-offset-2">{s.text}</a>
                        : <Fragment key={k}>{s.text}</Fragment>)}
                    </p>
                  )}
                </div>
                {!mine && m.risk_flag && <p className="mt-1 max-w-[85%] text-xs font-semibold text-amber-900">⚠ Be careful with this message</p>}
                <p className="mt-0.5 px-1 text-xs text-muted">
                  {clockTime(m.created_at)}
                  {mine && m.id === lastMine?.id && !m._state && (m.read_at ? " · Seen" : " · Sent")}
                  {m._state === "sending" && " · Sending…"}
                </p>
                {m._state === "failed" && (
                  <p role="alert" className="flex flex-wrap items-center gap-2 px-1 text-sm font-medium text-red-800">
                    {m._error ?? "Couldn't send."}
                    <button type="button" onClick={() => deliver(m.id)} className="min-h-11 rounded-lg border-2 border-red-800 px-3 font-semibold">Retry</button>
                    <button type="button" onClick={() => discard(m.id)} className="min-h-11 rounded-lg px-3 font-semibold underline">Discard</button>
                  </p>
                )}
              </li>
            </Fragment>
          );
        })}
        <li><div ref={bottom} /></li>
      </ol>

      {/* Composer */}
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="sticky bottom-14 z-30 border-t border-navy/10 bg-white px-4 pb-3 pt-2 md:bottom-0">
        {p.quickReplies.length > 0 && (
          <ul aria-label="Quick replies" className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {p.quickReplies.map((q) => (
              <li key={q.id} className="shrink-0">
                <button type="button" onClick={() => setText(q.body)} title={q.body} className="inline-flex min-h-11 max-w-[16rem] items-center truncate rounded-full border border-navy/30 bg-mist px-4 text-sm font-medium text-navy hover:bg-navy/10">
                  <span className="truncate">{q.body}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {file && (
          <div className="mb-2 flex items-center gap-3 rounded-lg bg-mist p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img src={file.preview} alt="Photo to send" className="h-14 w-14 rounded-lg object-cover" />
            <p className="flex-1 text-sm text-ink">Photo ready to send</p>
            <button type="button" onClick={() => setFile(null)} aria-label="Remove photo" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-xl text-navy hover:bg-white">×</button>
          </div>
        )}
        {swapOn && p.swapAllowed && <SwapFields idPrefix="thread" myListings={p.myListings} value={swap} onChange={setSwap} />}
        {pendingSwapTitle && <p className="sr-only">Offering {pendingSwapTitle}</p>}
        <RiskTip text={text} />
        {composeError && <p role="alert" className="mt-2 text-sm font-medium text-red-800">{composeError}</p>}
        <div className="mt-2 flex items-end gap-2">
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" id="thread-photo" onChange={(e) => pickFile(e.target.files?.[0])} />
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busyImage} aria-label="Attach a photo"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-navy/30 text-navy hover:bg-mist disabled:opacity-60">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true"><path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z" /></svg>
          </button>
          {p.swapAllowed && (
            <button type="button" onClick={() => setSwapOn((v) => !v)} aria-pressed={swapOn} aria-label="Propose a swap" title="Propose a swap"
              className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 ${swapOn ? "border-navy bg-navy text-white" : "border-navy/30 text-navy hover:bg-mist"}`}>
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true"><path d="M7 7h11l-3-3 1.4-1.4L22 8l-5.6 5.4L15 12l3-3H7V7zm10 10H6l3 3-1.4 1.4L2 16l5.6-5.4L9 12l-3 3h11v2z" /></svg>
            </button>
          )}
          <div className="min-w-0 flex-1">
            <label htmlFor="thread-text" className="sr-only">Message</label>
            <textarea id="thread-text" value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={MAX_BODY} placeholder="Write a message"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 768px)").matches) { e.preventDefault(); submit(); } }}
              className="block max-h-32 min-h-12 w-full resize-none rounded-lg border border-navy/30 bg-white px-3 py-3 text-base focus:border-royal" />
          </div>
          <button type="submit" disabled={busyImage || (!text.trim() && !file && !(swapOn && (swap.listingId || swap.text.trim())))}
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-lg bg-navy px-4 font-semibold text-white hover:bg-royal disabled:opacity-50">Send</button>
        </div>
        {text.length > MAX_BODY - 150 && <p className="mt-1 text-right text-xs text-muted">{text.length}/{MAX_BODY}</p>}
      </form>
    </div>
  );
}
