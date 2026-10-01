import Link from "next/link";
import ListingActions from "@/components/admin/ListingActions";
import { EmptyState, inputCls } from "@/components/ui";
import { priceLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Listings" };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminListings({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 60);
  const hiddenOnly = one(sp.hidden) === "1";
  const supabase = await createClient();
  let query = supabase.from("listings")
    .select("id,title,pricing_mode,price_zar,price_is_from,hidden_by_moderation,moderation_hidden_reason,deleted_at,category_id,created_at,seller_profiles(business_name,slug),categories(name)")
    .order("created_at", { ascending: false }).limit(50);
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
  if (hiddenOnly) query = query.eq("hidden_by_moderation", true);
  const [{ data }, { data: cats }] = await Promise.all([query, supabase.from("categories").select("id,name").order("sort_order")]);

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-navy">Listings</h2>
      <form method="get" role="search" className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div><label htmlFor="q" className="sr-only">Search listings</label><input id="q" name="q" type="search" defaultValue={q} placeholder="Search by title" className={inputCls} /></div>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="hidden" value="1" defaultChecked={hiddenOnly} className="h-5 w-5" /><span className="text-sm text-ink">Hidden only</span></label>
        <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-navy px-5 font-semibold text-white hover:bg-royal">Search</button>
      </form>
      <div className="mt-4">
        {(data ?? []).length === 0 ? <EmptyState title="No listings found" body="Try a different search." /> : (
          <ul className="space-y-3">
            {data!.map((l) => (
              <li key={l.id} className="rounded-2xl border border-navy/15 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/l/${l.id}`} className="flex min-h-11 items-center truncate font-semibold text-navy underline"><span className="truncate">{l.title}</span></Link>
                    <p className="truncate text-sm text-muted">{l.seller_profiles?.business_name} · {l.categories?.name ?? "No category"} · {priceLabel(l)}</p>
                  </div>
                  <span className="flex shrink-0 flex-col items-end gap-1 text-xs font-bold">
                    {l.hidden_by_moderation && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-900">Hidden{l.moderation_hidden_reason === "auto" ? " (auto)" : ""}</span>}
                    {l.deleted_at && <span className="rounded-full bg-mist px-2 py-0.5 text-muted">Deleted</span>}
                  </span>
                </div>
                <div className="mt-3"><ListingActions listingId={l.id} title={l.title} hidden={l.hidden_by_moderation} categoryId={l.category_id} categories={cats ?? []} /></div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
