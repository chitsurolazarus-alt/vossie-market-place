"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Accessible dialog: bottom sheet on phones, centred card on larger screens. Esc and backdrop close it. */
export default function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  // Keep the latest onClose in a ref: callers pass inline arrows, and re-running the effect on every render
  // would steal focus from whatever the user is typing in.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { closeRef.current(); return; }
      if (e.key !== "Tab" || !box.current) return;
      const f = [...box.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex='-1'])")];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/60 sm:items-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl outline-none sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-navy">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-2xl text-navy hover:bg-mist">×</button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
