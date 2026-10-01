import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getUser, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type Role = "buyer" | "seller" | "mentor" | "admin";

export const getProfile = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles")
    .select("id,role,display_name,suspended_until,suspension_reason,banned_at,ban_reason,deleted_at,popia_consent_at")
    .eq("id", user.id).maybeSingle();
  return data;
});

/** Server-side role gate (the proxy and RLS also enforce this). Non-staff get a plain 404 so the area's existence isn't advertised. */
export async function requireRole(roles: Role[], next: string) {
  const user = await requireUser(next);
  const profile = await getProfile();
  if (!profile || !roles.includes(profile.role) || profile.banned_at || profile.deleted_at) notFound();
  return { user, profile };
}
export const requireAdmin = (next: string) => requireRole(["admin"], next);
export const requireStaff = (next: string) => requireRole(["admin", "mentor"], next);

/** For server actions: returns the caller's client when they hold one of the roles, else an error result. */
export async function actionAuth(roles: Role[]) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false as const, error: "Please sign in" };
  const { data: p } = await supabase.from("profiles").select("role,banned_at,deleted_at").eq("id", data.user.id).maybeSingle();
  if (!p || !roles.includes(p.role) || p.banned_at || p.deleted_at) return { ok: false as const, error: "Not allowed" };
  return { ok: true as const, supabase, user: data.user, role: p.role };
}

export function isSuspended(p: { suspended_until: string | null; banned_at: string | null; deleted_at: string | null } | null) {
  if (!p) return false;
  return !!p.banned_at || !!p.deleted_at || (!!p.suspended_until && new Date(p.suspended_until).getTime() > Date.now());
}
