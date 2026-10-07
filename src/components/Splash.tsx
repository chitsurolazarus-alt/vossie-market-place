"use client";

import { useEffect } from "react";
import Image from "next/image";

/**
 * Branded splash for app launch. It only appears when the site is opened as an installed app (standalone display mode),
 * once per session: SPLASH_INIT_SCRIPT sets <html data-splash="1"> before first paint and CSS shows the overlay,
 * so there is no flash of page content first. Browser visitors never see it, so it cannot slow the first visit down.
 * It leaves as soon as the page has hydrated (short minimum so the logo registers; shorter with reduced motion).
 */

export default function Splash() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-splash") !== "1") return;
    try { sessionStorage.setItem("hh_splash", "1"); } catch {}
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const out = setTimeout(() => root.setAttribute("data-splash", "out"), reduced ? 250 : 700);
    const gone = setTimeout(() => root.removeAttribute("data-splash"), reduced ? 300 : 950);
    return () => { clearTimeout(out); clearTimeout(gone); };
  }, []);

  return (
    <div className="splash" aria-hidden="true">
      <Image src="/brand/hustlehub-mark.svg" alt="" width={96} height={96} className="splash-mark h-24 w-24" priority unoptimized />
      <p className="splash-tag font-display text-lg font-bold text-white">HustleHub</p>
    </div>
  );
}
