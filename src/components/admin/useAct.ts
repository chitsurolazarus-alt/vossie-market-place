"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Result } from "@/app/actions/types";

/** Runs a server action, shows its error (or a saved flash), and refreshes the page data on success. */
export function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function run(fn: () => Promise<Result<object>>, onOk?: () => void) {
    setError(null); setSaved(false);
    start(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error); return; }
      setSaved(true);
      onOk?.();
      router.refresh();
    });
  }
  return { run, pending, error, saved, setError };
}

export const btn = "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold disabled:opacity-60";
export const btnPrimary = `${btn} bg-navy text-white hover:bg-royal`;
export const btnGhost = `${btn} border-2 border-navy text-navy hover:bg-mist`;
export const btnDanger = `${btn} border-2 border-red-800 text-red-800 hover:bg-red-50`;
export const field = "block w-full min-h-11 rounded-lg border border-navy/30 bg-white px-3 py-2 text-base text-ink focus:border-royal";
