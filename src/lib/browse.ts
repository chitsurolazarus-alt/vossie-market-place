import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

import type { IconName } from "@/components/Icon";
export const PAGE_SIZE = 24;

export type Tile = {
  id: string; seller_id: string; title: string; kind: "product" | "service";
  pricing_mode: "cash" | "swap" | "both"; price_zar: number | null; price_is_from: boolean;
  swap_for: string | null; availability: "available" | "sold_out" | "paused";
  business_name: string; seller_slug: string; seller_verified: boolean;
  category_name: string | null; campus_name: string | null; cover_path: string | null; cover_alt: string | null;
  created_at: string; seller_tier: string | null; seller_reply_band: string | null; seller_tier_label: string | null;
};

const TILE_COLUMNS =
  "id,seller_id,title,kind,pricing_mode,price_zar,price_is_from,swap_for,availability,business_name,seller_slug,seller_verified,category_name,campus_name,cover_path,cover_alt,created_at,seller_tier,seller_reply_band,seller_tier_label";

export const getReference = cache(async () => {
  const supabase = await createClient();
  const [cats, camps] = await Promise.all([
    supabase.from("categories").select("id,name,slug").eq("active", true).order("sort_order"),
    supabase.from("campuses").select("id,name,slug,province,active").order("name"),
  ]);
  const all = camps.data ?? [];
  // `campuses` = launched ones (filters, chips); `allCampuses` = everything, for pickers that show "coming soon".
  return { categories: cats.data ?? [], campuses: all.filter((c) => c.active), allCampuses: all };
});

export type BrowseParams = {
  q: string; category: string; campus: string; kind: "" | "product" | "service";
  mode: "" | "cash" | "swap" | "both"; min: string; max: string;
  sort: "relevance" | "newest" | "price_asc" | "price_desc"; avail: boolean; n: number;
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const digits = (v: string) => (/^\d{1,7}$/.test(v) ? v : "");

export function parseParams(sp: SP): BrowseParams {
  const q = one(sp.q).trim().slice(0, 80);
  const kind = one(sp.kind);
  const mode = one(sp.mode);
  const sort = one(sp.sort);
  const n = Number.parseInt(one(sp.n), 10);
  return {
    q,
    category: one(sp.category).slice(0, 40),
    campus: one(sp.campus).slice(0, 40),
    kind: kind === "product" || kind === "service" ? kind : "",
    mode: mode === "cash" || mode === "swap" || mode === "both" ? mode : "",
    min: digits(one(sp.min)),
    max: digits(one(sp.max)),
    sort: sort === "price_asc" || sort === "price_desc" || sort === "newest" || sort === "relevance" ? sort : q ? "relevance" : "newest",
    avail: one(sp.avail) !== "0",
    n: Number.isFinite(n) && n >= 1 ? Math.min(n, 20) : 1,
  };
}

/** Build a /browse href from params, with overrides. Defaults are omitted to keep URLs short. */
export function browseHref(p: BrowseParams, over: Partial<BrowseParams> = {}) {
  const m = { ...p, ...over };
  const u = new URLSearchParams();
  if (m.q) u.set("q", m.q);
  if (m.category) u.set("category", m.category);
  if (m.campus) u.set("campus", m.campus);
  if (m.kind) u.set("kind", m.kind);
  if (m.mode) u.set("mode", m.mode);
  if (m.min) u.set("min", m.min);
  if (m.max) u.set("max", m.max);
  if (m.sort !== (m.q ? "relevance" : "newest")) u.set("sort", m.sort);
  if (!m.avail) u.set("avail", "0");
  if (m.n > 1) u.set("n", String(m.n));
  const s = u.toString();
  return s ? `/browse?${s}` : "/browse";
}

export async function fetchTiles(ids: string[]): Promise<Tile[]> {
  if (!ids.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("browse_listings").select(TILE_COLUMNS).in("id", ids);
  const byId = new Map((data ?? []).map((r) => [r.id as string, r as unknown as Tile]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

export async function searchListings(p: BrowseParams): Promise<{ tiles: Tile[]; total: number }> {
  const ref = await getReference();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_listings", {
    p_q: p.q || undefined,
    p_category: ref.categories.find((c) => c.slug === p.category)?.id,
    p_campus: ref.campuses.find((c) => c.slug === p.campus)?.id,
    p_kind: p.kind || undefined,
    p_mode: p.mode || undefined,
    p_min: p.min ? Number(p.min) : undefined,
    p_max: p.max ? Number(p.max) : undefined,
    p_available_only: p.avail,
    p_sort: p.sort === "relevance" && !p.q ? "newest" : p.sort,
    p_limit: PAGE_SIZE * p.n,
    p_offset: 0,
  });
  if (error) throw new Error("Search failed");
  const rows = data ?? [];
  return { tiles: await fetchTiles(rows.map((r) => r.listing_id)), total: Number(rows[0]?.total_count ?? 0) };
}

export async function latestTiles(limit: number, campusId?: string): Promise<Tile[]> {
  const supabase = await createClient();
  let q = supabase.from("browse_listings").select(TILE_COLUMNS).eq("availability", "available").order("created_at", { ascending: false }).limit(limit);
  if (campusId) q = q.eq("campus_id", campusId);
  const { data } = await q;
  return (data ?? []) as unknown as Tile[];
}

export async function sellerTiles(sellerId: string, excludeId: string, limit: number): Promise<Tile[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("browse_listings").select(TILE_COLUMNS).eq("seller_id", sellerId).neq("id", excludeId).limit(limit);
  return (data ?? []) as unknown as Tile[];
}

export async function similarTiles(categoryId: string | null, excludeSeller: string, excludeId: string, limit: number): Promise<Tile[]> {
  if (!categoryId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("browse_listings").select(TILE_COLUMNS)
    .eq("category_id", categoryId).neq("seller_id", excludeSeller).neq("id", excludeId)
    .eq("availability", "available").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as unknown as Tile[];
}

export const CATEGORY_ICONS: Record<string, IconName> = {
  food: "food", beauty: "beauty", tutoring: "tutoring", design: "design", tech: "tech", fashion: "fashion",
  construction: "build", trading: "trade", events: "events", transport: "truck", other: "other",
};
