"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLowData } from "@/app/actions/engage";

import Icon from "./Icon";
export default function LowDataToggle({ initial, variant = "header" }: { initial: boolean; variant?: "header" | "settings" }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  const click = () => {
    const next = !on;
    setOn(next);
    start(async () => { await setLowData(next); router.refresh(); });
  };

  if (variant === "settings") {
    return (
      <button type="button" role="switch" aria-checked={on} onClick={click} disabled={pending}
        className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border-2 border-navy/20 bg-white p-4 text-left">
        <span><span className="block font-semibold text-navy">Low-data mode</span>
          <span className="text-sm text-muted">Smaller photos, a simple list, no animations, and photos below the fold load only when you tap.</span></span>
        <span aria-hidden="true" className={`relative h-8 w-14 shrink-0 rounded-full ${on ? "bg-royal" : "bg-navy/30"}`}>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${on ? "left-7" : "left-1"}`} />
        </span>
        <span className="sr-only">{on ? "On" : "Off"}</span>
      </button>
    );
  }

  return (
    <button type="button" onClick={click} aria-pressed={on} disabled={pending} title="Low-data mode: smaller photos, no animations"
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${on ? "border-navy bg-navy text-white" : "border-navy/30 text-navy hover:bg-mist"}`}>
      <Icon name={on ? "wifi-off" : "wifi"} size="md" />
      <span className="hidden sm:inline">Data saver</span>
      <span className="sr-only sm:hidden">Data saver</span>
      <span className="hidden text-xs sm:inline">{on ? "On" : "Off"}</span><span className="sr-only sm:hidden">{on ? "On" : "Off"}</span>
    </button>
  );
}
