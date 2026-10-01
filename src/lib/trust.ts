import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export { REPLY_BAND_LABEL, TIER_STYLE, type ReplyBand } from "@/lib/trust-shared";

export type TrustTier = {
  tier: string; rank: number; label: string; summary: string; min_enquiries: number;
  min_response_rate: number; min_confirmed: number; min_account_days: number; requires_verified: boolean;
};

/** Tier rules from the admin-editable config table. */
export const getTiers = cache(async (): Promise<TrustTier[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("trust_tiers").select("*").order("rank");
  return (data ?? []).map((t) => ({ ...t, min_response_rate: Number(t.min_response_rate) }));
});

export async function getTierLabels(): Promise<Record<string, string>> {
  return Object.fromEntries((await getTiers()).map((t) => [t.tier, t.label]));
}

export async function getSellerTrust(sellerId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("seller_trust").select("*").eq("seller_id", sellerId).maybeSingle();
  return data;
}

/** "A rule in plain words", used on /how-trust-works. */
export function describeTier(t: TrustTier): string[] {
  const rules: string[] = [];
  if (t.min_enquiries > 0) rules.push(`At least ${t.min_enquiries} enquiries in the last 90 days`);
  if (t.min_response_rate > 0) rules.push(`Replied to ${Math.round(t.min_response_rate * 100)}% or more of them within 48 hours`);
  if (t.min_confirmed > 0) rules.push(`${t.min_confirmed} or more sales or swaps confirmed by buyers`);
  if (t.min_account_days > 0) rules.push(`Account at least ${t.min_account_days} days old`);
  if (t.requires_verified) rules.push("Verified Incubation Hub member");
  return rules.length ? rules : ["Everyone starts here"];
}
