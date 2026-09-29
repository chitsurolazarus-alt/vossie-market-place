import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function requireUser(next: string) {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export const getMySeller = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("seller_profiles").select("*").eq("user_id", userId).maybeSingle();
  return data;
});

/** Only allow same-site relative redirects. */
export function safeNext(next: string | undefined | null, fallback = "/account") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
