"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Re-renders the server page when any of these tables change for the signed-in user (RLS filters the events). */
export default function LiveRefresh({ tables, channel }: { tables: ("messages" | "conversations" | "enquiries" | "payment_requests")[]; channel: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const key = tables.join(",");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => { clearTimeout(timer); timer = setTimeout(() => router.refresh(), 400); };
    let ch = supabase.channel(channel);
    for (const table of key.split(",")) ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, bump);
    ch.subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(ch); };
  }, [supabase, router, channel, key]);
  return null;
}
