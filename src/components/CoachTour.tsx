"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

export type TourStep = { target: string; title: string; body: string };

type Box = { top: number; left: number; width: number; height: number };

const PAD = 6;
const GAP = 12;

/** First element for a tour target that is actually on screen (the top and bottom navs share a name; only one is displayed). */
function findTarget(name: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const el of all) if (el.getClientRects().length > 0) return el;
  return null;
}

/**
 * Spotlight coach-mark tour for one screen. Shows once per signed-in user (id stored in profiles.tours_seen),
 * waits for the welcome slides to be done, and skips steps whose target is not on this screen.
 */
export default function CoachTour({ id, label, steps }: { id: string; label: string; steps: TourStep[] }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [live, setLive] = useState<TourStep[] | null>(null);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [popH, setPopH] = useState(180);
  const popRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  // 1. Is this tour due for this user?
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;
        const { data: p } = await supabase.from("profiles").select("onboarding_seen, tours_seen").eq("id", data.user.id).maybeSingle();
        if (cancelled || !p || !p.onboarding_seen || p.tours_seen.includes(id)) return;
        setUserId(data.user.id);
        setSeen(p.tours_seen);
        // Give the page a moment to finish streaming, then keep only the steps that exist here.
        setTimeout(() => {
          if (cancelled) return;
          const present = steps.filter((s) => findTarget(s.target));
          if (present.length) setLive(present);
        }, 500);
      } catch { /* offline or not configured: no tour */ }
    })();
    return () => { cancelled = true; };
    // steps is a module-level constant at every call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const step = live?.[i];

  const measure = useCallback(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (!el) { setBox(null); return; }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  // 2. Bring the target into view, then follow it while the page moves.
  useLayoutEffect(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const r = el.getBoundingClientRect();
    const fixedBar = getComputedStyle(el).position === "fixed" || !!el.closest("nav[aria-label='Primary']");
    if (!fixedBar && (r.top < 80 || r.bottom > window.innerHeight - popH - 90)) {
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }
    let raf = requestAnimationFrame(measure);
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    const settle = setTimeout(measure, 400); // after smooth scrolling ends
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [step, measure, popH]);

  useEffect(() => { if (popRef.current) setPopH(popRef.current.offsetHeight); }, [i, live, box]);
  useEffect(() => { if (step) nextRef.current?.focus(); }, [step]);

  const finish = useCallback(async () => {
    setLive(null);
    if (!userId) return;
    const next = Array.from(new Set([...seen, id]));
    setSeen(next);
    await createClient().from("profiles").update({ tours_seen: next }).eq("id", userId);
  }, [userId, seen, id]);

  useEffect(() => {
    if (!live) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "Tab") {
        // Keep keyboard focus inside the coach mark while it is open.
        const f = popRef.current?.querySelectorAll<HTMLElement>("button");
        if (!f?.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [live, finish]);

  if (!live || !step) return null;

  const vh = typeof window === "undefined" ? 700 : window.innerHeight;
  const vw = typeof window === "undefined" ? 360 : window.innerWidth;
  const popW = Math.min(384, vw - 32);
  let popTop = vh - popH - 16;
  let popLeft = (vw - popW) / 2;
  if (box) {
    const below = box.top + box.height + PAD + GAP;
    const above = box.top - PAD - GAP - popH;
    if (below + popH <= vh - 8) popTop = below;
    else if (above >= 8) popTop = above;
    popLeft = Math.min(Math.max(16, box.left + box.width / 2 - popW / 2), vw - popW - 16);
  }
  const last = i === live.length - 1;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={label}>
      {/* Swallows taps so the page behind stays still while the tour is open. */}
      <div className="absolute inset-0" onClick={finish} aria-hidden="true" />
      {box ? (
        <div aria-hidden="true" className="pointer-events-none absolute rounded-xl border-2 border-sand shadow-[0_0_0_9999px_rgba(22,48,94,0.72)] transition-[top,left,width,height] duration-200"
          style={{ top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }} />
      ) : (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-navy/70" />
      )}
      <div ref={popRef} className="absolute rounded-2xl bg-navy p-5 text-white shadow-2xl" style={{ top: popTop, left: popLeft, width: popW }}>
        <h2 className="font-display text-xl font-bold" aria-live="polite">{step.title}</h2>
        <p className="mt-1 text-white/90">{step.body}</p>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={finish} className="min-h-11 rounded-lg px-3 font-semibold underline">Skip</button>
          <span className="flex-1 text-center text-sm text-white/80">{i + 1} of {live.length}</span>
          <Button ref={nextRef} variant="sand" onClick={() => (last ? finish() : setI(i + 1))}>{last ? "Done" : "Next"}</Button>
        </div>
      </div>
    </div>
  );
}
