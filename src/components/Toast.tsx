"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Icon from "./Icon";

type Tone = "success" | "error" | "info";
type Item = { id: number; tone: Tone; text: string };
const ToastCtx = createContext<(text: string, tone?: Tone) => void>(() => {});

/** Short confirmations ("Saved", "Couldn't update"). Sits above the bottom nav, announced politely, closes by itself after 5s. */
export function useToast() { return useContext(ToastCtx); }

const TONE = {
  success: { cls: "bg-navy text-white", icon: "check-circle" as const },
  error: { cls: "bg-red-900 text-white", icon: "alert" as const },
  info: { cls: "bg-royal text-white", icon: "info" as const },
};

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const next = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id)); timers.current.delete(id);
    setItems((l) => l.filter((x) => x.id !== id));
  }, []);
  const push = useCallback((text: string, tone: Tone = "success") => {
    const id = ++next.current;
    setItems((l) => [...l.slice(-2), { id, tone, text }]);
    timers.current.set(id, setTimeout(() => dismiss(id), 5000));
  }, [dismiss]);
  useEffect(() => { const t = timers.current; return () => t.forEach(clearTimeout); }, []);
  const value = useMemo(() => push, [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex min-h-11 w-full max-w-sm items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-lg ${TONE[t.tone].cls}`}>
            <Icon name={TONE[t.tone].icon} size="md" />
            <span className="flex-1">{t.text}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
              <Icon name="close" size="sm" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
