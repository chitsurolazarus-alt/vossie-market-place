"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

import Icon, { type IconName } from "@/components/Icon";
type Slide = { icon: IconName; title: string; body: string };

const WELCOME: Slide[] = [
  { icon: "graduation", title: "Welcome to HustleHub", body: "The marketplace for Eduvos student hustles. Buy from students on your campus, or sell your own products and services." },
  { icon: "search", title: "Browse local", body: "Explore food, beauty, tutoring, design and more. Filter by category and campus, and find the hustles closest to you." },
  { icon: "message", title: "Enquire safely", body: "Message a seller inside HustleHub or hop over to WhatsApp. Always meet at a campus pickup point, never at someone's home." },
  { icon: "rocket", title: "Start selling", body: "Got a hustle? Set up your seller profile in about 3 minutes. The Incubation Hub team approves it and you're live." },
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
        <p><Icon name={s.icon} size="lg" className="h-12 w-12 text-royal" /></p>
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
