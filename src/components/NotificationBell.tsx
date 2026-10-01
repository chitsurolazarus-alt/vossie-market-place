"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { shortTime } from "@/lib/messages";

type Item = { id: string; type: string; title: string; body: string | null; url: string | null; count: number; read_at: string | null; created_at: string };

/** In-app bell with a live unread count (Supabase Realtime) and mark-all-read. */
export default function NotificationBell({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const supabase = useMemo(() => createClient(), []);
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const wrap = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  const refreshCount = useCallback(async () => {
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
    setUnread(count ?? 0);
  }, [supabase, userId]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("notifications").select("id,type,title,body,url,count,read_at,created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
    setItems(data ?? []);
  }, [supabase, userId]);

  useEffect(() => {
    const ch = supabase.channel(`notif-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        void refreshCount();
        if (openRef.current) void load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, uid, userId, refreshCount, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [open]);

  const markAll = async () => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
    setUnread(0);
    void load();
  };
  const markOne = (id: string) => {
    setOpen(false);
    void supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null).then(() => refreshCount());
  };

  return (
    <div ref={wrap} className="relative">
      <button type="button" onClick={() => { const next = !open; setOpen(next); if (next) void load(); }} aria-expanded={open} aria-controls={`${uid}-panel`}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-navy hover:bg-mist">
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-6.5V11a7 7 0 0 0-5.5-6.8V3.5a1.5 1.5 0 0 0-3 0v.7A7 7 0 0 0 5 11v4.5L3 17.5V19h18v-1.5l-2-2z" /></svg>
        {unread > 0 && (
          <span aria-hidden="true" className="absolute right-0 top-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-royal px-1 text-[11px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
      {open && (
        <div id={`${uid}-panel`} role="region" aria-label="Notifications"
          className="fixed inset-x-2 top-[60px] z-50 max-h-[70dvh] overflow-y-auto rounded-2xl border border-navy/15 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
          <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-navy/10 bg-white px-4 py-2">
            <h2 className="font-display text-lg font-bold text-navy">Notifications</h2>
            <button type="button" onClick={markAll} disabled={unread === 0} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-royal underline disabled:opacity-40 disabled:no-underline">Mark all read</button>
          </div>
          {items === null ? (
            <p className="p-6 text-center text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-muted">Nothing yet. We&apos;ll tell you about new enquiries and messages here.</p>
          ) : (
            <ul className="divide-y divide-navy/10">
              {items.map((n) => (
                <li key={n.id}>
                  <Link href={n.url ?? "/messages"} onClick={() => markOne(n.id)} className={`block min-h-14 px-4 py-3 hover:bg-mist ${n.read_at ? "" : "bg-blue-50"}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`text-sm text-navy ${n.read_at ? "font-medium" : "font-bold"}`}>{n.title}{n.count > 1 && ` (${n.count})`}</p>
                      <time dateTime={n.created_at} className="shrink-0 text-xs text-muted">{shortTime(n.created_at)}</time>
                    </div>
                    {n.body && <p className="line-clamp-2 text-sm text-ink">{n.body}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
