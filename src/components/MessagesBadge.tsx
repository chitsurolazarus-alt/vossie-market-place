"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Live unread-message count shown on the Messages nav item. */
export default function MessagesBadge({ userId, initial, className = "" }: { userId: string; initial: number; className?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const uid = useId();
  const [n, setN] = useState(initial);

  const refresh = useCallback(async () => {
    const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).neq("sender_id", userId);
    setN(count ?? 0);
  }, [supabase, userId]);

  useEffect(() => {
    const ch = supabase.channel(`msgbadge-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => void refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, uid, refresh]);

  if (n <= 0) return null;
  return (
    <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-royal px-1 text-[11px] font-bold leading-none text-white ${className}`}>
      <span aria-hidden="true">{n > 9 ? "9+" : n}</span><span className="sr-only">{n} unread messages</span>
    </span>
  );
}
