"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

type Slide = { icon: string; title: string; body: string };

const WELCOME: Slide[] = [
  { icon: "🎓", title: "Welcome to HustleHub", body: "The marketplace for Eduvos student hustles. Buy from students on your campus, or sell your own products and services." },
  { icon: "🔎", title: "Browse local", body: "Explore food, beauty, tutoring, design and more. Filter by category and campus, and find the hustles closest to you." },
  { icon: "💬", title: "Enquire safely", body: "Message a seller inside HustleHub or hop over to WhatsApp. Always meet at a campus pickup point, never at someone's home." },
  { icon: "🚀", title: "Start selling", body: "Got a hustle? Set up your seller profile in about 3 minutes. The Incubation Hub team approves it and you're live." },
];

export function WelcomeGate() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const settled = useRef(false);
  const pathname = usePathname();

  // The root layout persists across client-side navigation (including the redirect after sign-in),
  // so re-check on each route change until we know the user has seen the tour.
  useEffect(() => {
    if (settled.current) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;
        const { data: p } = await supabase.from("profiles").select("onboarding_seen").eq("id", data.user.id).maybeSingle();
        if (cancelled || !p) return;
        settled.current = true;
        if (!p.onboarding_seen) { setUserId(data.user.id); setOpen(true); }
      } catch { /* offline or not configured: skip the tour */ }
    })();
    return () => { cancelled = true; };
  }, [pathname]);

  if (!open || !userId) return null;
  const finish = async () => {
    setOpen(false);
    await createClient().from("profiles").update({ onboarding_seen: true }).eq("id", userId);
  };
  return <SlideDialog slides={WELCOME} label="Welcome tour" onFinish={finish} />;
}

function SlideDialog({ slides, label, onFinish }: { slides: Slide[]; label: string; onFinish: () => void }) {
  const [i, setI] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);
  const last = i === slides.length - 1;
  const s = slides[i];

  useEffect(() => { nextRef.current?.focus(); }, [i]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onFinish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={label}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-5xl" aria-hidden="true">{s.icon}</p>
        <h2 className="mt-3 font-display text-2xl font-bold text-navy" aria-live="polite">{s.title}</h2>
        <p className="mt-2 text-ink">{s.body}</p>
        <div className="mt-5 flex justify-center gap-2" aria-hidden="true">
          {slides.map((_, n) => <span key={n} className={`h-2 w-2 rounded-full ${n === i ? "bg-royal" : "bg-navy/20"}`} />)}
        </div>
        <p className="mt-1 text-center text-sm text-muted">{i + 1} of {slides.length}</p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onFinish}>Skip</Button>
          <Button ref={nextRef} className="flex-1" onClick={() => (last ? onFinish() : setI(i + 1))}>{last ? "Let's go" : "Next"}</Button>
        </div>
      </div>
    </div>
  );
}

const SELLER_STEPS = [
  { target: "status", title: "1. Your status", body: "See whether your profile is waiting for approval or live. Approved sellers get the Verified Incubation Hub badge from the team." },
  { target: "listings", title: "2. Your listings", body: "Create products or services with photos and a price in rand. Pause or mark sold out anytime." },
  { target: "profile", title: "3. Your public profile", body: "This is what buyers see. Keep your photo, bio and pickup points fresh to win trust." },
];

export function SellerTour({ userId }: { userId: string }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(true);
  const step = SELLER_STEPS[i];

  useEffect(() => {
    if (!open) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    el?.classList.add("tour-highlight");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    return () => el?.classList.remove("tour-highlight");
  }, [i, open, step.target]);

  if (!open) return null;
  const finish = async () => {
    setOpen(false);
    await createClient().from("profiles").update({ seller_tour_seen: true }).eq("id", userId);
  };
  return (
    <div className="fixed inset-x-0 bottom-20 z-50 px-4 md:bottom-6" role="dialog" aria-label="Seller dashboard tour">
      <div className="mx-auto max-w-md rounded-2xl bg-navy p-5 text-white shadow-2xl">
        <h2 className="font-display text-xl font-bold" aria-live="polite">{step.title}</h2>
        <p className="mt-1 text-white/90">{step.body}</p>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={finish} className="min-h-11 rounded-lg px-4 font-semibold underline">Skip</button>
          <span className="flex-1 text-center text-sm text-white/80">{i + 1} of {SELLER_STEPS.length}</span>
          <Button variant="sand" onClick={() => (i === SELLER_STEPS.length - 1 ? finish() : setI(i + 1))}>
            {i === SELLER_STEPS.length - 1 ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
