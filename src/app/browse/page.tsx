import type { Metadata } from "next";
import Link from "next/link";
import BrowseFilters from "@/components/BrowseFilters";
import ListingTile from "@/components/ListingTile";
import { ButtonLink, EmptyState, inputCls } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { PAGE_SIZE, browseHref, getReference, parseParams, searchListings } from "@/lib/browse";
import { getLowData, getSavedIds } from "@/lib/viewer";

export const metadata: Metadata = { title: "Browse", description: "Search products and services from Eduvos student entrepreneurs." };

const SORTS = [
  ["relevance", "Best match"], ["newest", "Newest"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"],
] as const;

export default async function Browse({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = parseParams(await searchParams);
  const [ref, { tiles, total }, lowData, user] = await Promise.all([getReference(), searchListings(p), getLowData(), getUser()]);
  const saved = await getSavedIds(tiles.map((t) => t.id));

  const catName = ref.categories.find((c) => c.slug === p.category)?.name;
  const campusName = ref.campuses.find((c) => c.slug === p.campus)?.name;
  const chips: [string, string][] = [];
  if (catName) chips.push([catName, browseHref(p, { category: "", n: 1 })]);
  if (campusName) chips.push([campusName, browseHref(p, { campus: "", n: 1 })]);
  if (p.kind) chips.push([p.kind === "product" ? "Products" : "Services", browseHref(p, { kind: "", n: 1 })]);
  if (p.mode) chips.push([{ cash: "Accepts cash", swap: "Accepts swaps", both: "Cash or swap" }[p.mode], browseHref(p, { mode: "", n: 1 })]);
  if (p.min || p.max) chips.push([`R${p.min || 0} – ${p.max ? "R" + p.max : "any"}`, browseHref(p, { min: "", max: "", n: 1 })]);
  if (!p.avail) chips.push(["Including sold out", browseHref(p, { avail: true, n: 1 })]);
  const clearHref = browseHref({ ...p, category: "", campus: "", kind: "", mode: "", min: "", max: "", avail: true, n: 1 });
  const sortOptions = SORTS.filter(([k]) => k !== "relevance" || p.q);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <h1 className="font-display text-3xl font-bold text-navy">{p.q ? <>Results for &ldquo;{p.q}&rdquo;</> : "Browse hustles"}</h1>

      <form action="/browse" method="get" role="search" className="mt-4 flex gap-2">
        {p.category && <input type="hidden" name="category" value={p.category} />}
        {p.campus && <input type="hidden" name="campus" value={p.campus} />}
        {p.kind && <input type="hidden" name="kind" value={p.kind} />}
        {p.mode && <input type="hidden" name="mode" value={p.mode} />}
        {p.min && <input type="hidden" name="min" value={p.min} />}
        {p.max && <input type="hidden" name="max" value={p.max} />}
        {!p.avail && <input type="hidden" name="avail" value="0" />}
        <label htmlFor="q" className="sr-only">Search listings</label>
        <input id="q" name="q" type="search" defaultValue={p.q} placeholder="Try &ldquo;braids&rdquo;, &ldquo;logo&rdquo; or &ldquo;kota&rdquo;" className={inputCls} enterKeyHint="search" />
        <button type="submit" className="min-h-11 shrink-0 rounded-lg bg-navy px-5 font-semibold text-white hover:bg-royal">Search</button>
      </form>

      <div className="mt-6 grid gap-6 md:grid-cols-[260px_1fr]">
        <aside aria-label="Filters" className="md:sticky md:top-20 md:self-start">
          <BrowseFilters
            v={{ category: p.category, campus: p.campus, kind: p.kind, mode: p.mode, min: p.min, max: p.max, avail: p.avail, q: p.q, sort: p.sort }}
            categories={ref.categories} campuses={ref.campuses} activeCount={chips.length} clearHref={clearHref} />
        </aside>

        <section aria-label="Results">
          <div className="flex flex-wrap items-center gap-2" aria-label="Sort and active filters">
            <nav aria-label="Sort" className="flex flex-wrap gap-2">
              {sortOptions.map(([k, label]) => (
                <Link key={k} href={browseHref(p, { sort: k, n: 1 })} aria-current={p.sort === k ? "true" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${p.sort === k ? "border-navy bg-navy text-white" : "border-navy/30 text-navy hover:bg-mist"}`}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          {chips.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Active filters">
              {chips.map(([label, href]) => (
                <li key={label}><Link href={href} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-mist px-4 text-sm font-medium text-navy">
                  {label} <span aria-hidden="true">×</span><span className="sr-only">remove filter</span></Link></li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-sm text-muted" role="status">
            {total === 0 ? "No results" : `Showing ${tiles.length} of ${total} listing${total === 1 ? "" : "s"}`}
          </p>

          {tiles.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No matches" body="Try another category or fewer filters, or tell campus sellers what you need with a Looking For request."
                action={<div className="flex flex-col gap-2 sm:flex-row"><ButtonLink href={clearHref} variant="secondary">Clear filters</ButtonLink><ButtonLink href="/looking-for" variant="sand">Post a Looking For request</ButtonLink></div>} />
            </div>
          ) : (
            <ul className={lowData ? "mt-3 flex flex-col gap-2" : "mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4"}>
              {tiles.map((t, i) => (
                <ListingTile key={t.id} t={t} index={i} saved={saved.has(t.id)} authed={!!user} lowData={lowData} priority={i < 2} />
              ))}
            </ul>
          )}

          {tiles.length < total && tiles.length >= PAGE_SIZE * p.n && (
            <div className="mt-6 flex justify-center">
              <Link href={browseHref(p, { n: p.n + 1 })} scroll={false} className="inline-flex min-h-12 items-center rounded-lg bg-navy px-8 font-semibold text-white hover:bg-royal">
                Load more
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
