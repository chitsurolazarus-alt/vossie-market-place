import "server-only";
import { createClient } from "@/lib/supabase/server";
import { REPLY_BAND_LABEL } from "@/lib/trust-shared";

export type SellerStats = {
  id: string; business_name: string; slug: string; verified: boolean; campus: string | null; mentor_id: string | null;
  tier: string; enquiries_30d: number; whatsapp_30d: number; enquiries_14d: number; response_rate: number | null;
  reply_band: string | null; confirmed_sales: number; listing_views_30d: number; last_active_at: string | null;
  last_listing_update_at: string | null; hidden_listings_14d: number; account_days: number; has_listings: boolean;
};

/** "May need support" flags. Aggregates only: nothing here touches message content. */
export function supportFlags(s: SellerStats): string[] {
  const now = Date.now();
  const flags: string[] = [];
  if (s.account_days >= 14 && s.enquiries_14d === 0) flags.push("No enquiries in 14 days");
  if (s.response_rate !== null && s.response_rate < 0.5) flags.push(`Response rate ${Math.round(s.response_rate * 100)}% (under 50%)`);
  if (!s.has_listings) flags.push("No active listings");
  else if (!s.last_listing_update_at || now - new Date(s.last_listing_update_at).getTime() > 21 * 864e5) flags.push("No listing updated in 21 days");
  if (s.hidden_listings_14d > 0) flags.push("Content hidden by moderation recently");
  return flags;
}

/** The sellers the caller may see (RLS: a mentor sees only their assigned sellers, an admin sees all). */
export async function getSellerStats(onlyId?: string): Promise<SellerStats[]> {
  const supabase = await createClient();
  let q = supabase.from("seller_profiles")
    .select("id,business_name,slug,verified,mentor_id,campuses(name),seller_trust(tier,enquiries_30d,whatsapp_30d,enquiries_14d,response_rate,reply_band,confirmed_sales,listing_views_30d,last_active_at,last_listing_update_at,hidden_listings_14d,account_days)")
    .eq("status", "approved").order("business_name");
  if (onlyId) q = q.eq("id", onlyId);
  const { data } = await q;
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const { data: ls } = ids.length ? await supabase.from("listings").select("seller_id").in("seller_id", ids).is("deleted_at", null) : { data: [] };
  const has = new Set((ls ?? []).map((l) => l.seller_id));
  return rows.map((r) => {
    const t = Array.isArray(r.seller_trust) ? r.seller_trust[0] : r.seller_trust;
    return {
      id: r.id, business_name: r.business_name, slug: r.slug, verified: r.verified, mentor_id: r.mentor_id, campus: r.campuses?.name ?? null,
      tier: t?.tier ?? "new", enquiries_30d: t?.enquiries_30d ?? 0, whatsapp_30d: t?.whatsapp_30d ?? 0, enquiries_14d: t?.enquiries_14d ?? 0,
      response_rate: t?.response_rate === null || t?.response_rate === undefined ? null : Number(t.response_rate), reply_band: t?.reply_band ?? null,
      confirmed_sales: t?.confirmed_sales ?? 0, listing_views_30d: t?.listing_views_30d ?? 0, last_active_at: t?.last_active_at ?? null,
      last_listing_update_at: t?.last_listing_update_at ?? null, hidden_listings_14d: t?.hidden_listings_14d ?? 0, account_days: t?.account_days ?? 0,
      has_listings: has.has(r.id),
    };
  });
}

const csvCell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function statsToCsv(rows: SellerStats[], tierLabels: Record<string, string>): string {
  const head = ["Seller", "Campus", "Trust tier", "Enquiries (30d, in-app)", "WhatsApp handoffs (30d)", "Response rate %", "Reply time",
    "Confirmed sales", "Listing views (30d)", "Last active", "Needs support"];
  const lines = rows.map((s) => [
    s.business_name, s.campus, tierLabels[s.tier] ?? s.tier, s.enquiries_30d, s.whatsapp_30d,
    s.response_rate === null ? "" : Math.round(s.response_rate * 100), s.reply_band ? REPLY_BAND_LABEL[s.reply_band as keyof typeof REPLY_BAND_LABEL] : "",
    s.confirmed_sales, s.listing_views_30d, s.last_active_at ? s.last_active_at.slice(0, 10) : "", supportFlags(s).join("; "),
  ].map(csvCell).join(","));
  return [head.map(csvCell).join(","), ...lines].join("\r\n");
}
