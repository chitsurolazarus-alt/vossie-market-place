import Image from "next/image";
import Link from "next/link";
import ListingTile from "@/components/ListingTile";
import { ButtonLink, inputCls } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { CATEGORY_ICONS, getReference, latestTiles } from "@/lib/browse";
import { isWithinDays } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getLowData, getSavedIds } from "@/lib/viewer";

import CoachTour from "@/components/CoachTour";
import { CampusGrid, FinalCta, HowItWorks, LandingHero, StatsBand, TrustStrip } from "@/components/landing/Landing";
import { getLandingStats } from "@/lib/landing";
import { HOME_TOUR } from "@/lib/tours";
import Verified from "@/components/Verified";
import Icon from "@/components/Icon";
export const metadata = { title: { absolute: "HustleHub | Student hustles. Nationwide." } };

async function loadFeatured(campusId?: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const sel = "position, slot_date, seller_profiles!inner(business_name, slug, tagline, photo_url, verified, status, categories(name), campuses(name))";
  let q = supabase.from("featured_slots").select(sel).eq("slot_date", today).eq("seller_profiles.status", "approved").order("position");
  if (campusId) q = q.eq("campus_id", campusId);
  let { data } = await q;
  if (!data?.length) {
    // The daily job hasn't run yet today: show the latest rotation instead of an empty section.
    let latest = supabase.from("featured_slots").select("slot_date").order("slot_date", { ascending: false }).limit(1);
    if (campusId) latest = latest.eq("campus_id", campusId);
    const { data: d } = await latest.maybeSingle();
    if (d) {
      let q2 = supabase.from("featured_slots").select(sel).eq("slot_date", d.slot_date).eq("seller_profiles.status", "approved").order("position");
      if (campusId) q2 = q2.eq("campus_id", campusId);
      data = (await q2).data;
    }
  }
  return data ?? [];
}

export default async function Home({ searchParams }: { searchParams: Promise<{ campus?: string }> }) {
  const { campus } = await searchParams;
  const ref = await getReference();
  const campusId = ref.campuses.find((c) => c.slug === campus)?.id;
  const [featured, fresh, lowData, user] = await Promise.all([loadFeatured(campusId), latestTiles(12, campusId), getLowData(), getUser()]);
  const saved = await getSavedIds(fresh.map((t) => t.id));
  // Signed-out visitors get the landing page; signed-in users go straight to the marketplace.
  const stats = user ? null : await getLandingStats(ref.allCampuses);

  const hasNew = fresh.some((t) => isWithinDays(t.created_at, 7));

  return (
    <>
      <CoachTour id="home" label="Home tour" steps={HOME_TOUR} />
      {user || !stats ? (
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
          <p className="inline-block rounded-full bg-sand px-3 py-1 text-sm font-semibold text-navy">Eduvos Incubation Hub</p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold sm:text-5xl">Student hustles. Nationwide.</h1>
          <p className="mt-3 max-w-xl text-lg text-white/90">Find food, hair, tutoring, design and more from students on your campus.</p>
          <form data-tour="home-search" action="/browse" method="get" role="search" className="mt-6 flex max-w-xl gap-2">
            <label htmlFor="home-q" className="sr-only">Search HustleHub</label>
            <input id="home-q" name="q" type="search" enterKeyHint="search" placeholder="Try braids, logo, kota…" className={`${inputCls} border-white`} />
            <button type="submit" className="min-h-11 shrink-0 rounded-lg bg-sand px-5 font-semibold text-navy hover:brightness-95">Search</button>
          </form>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href="/sell" variant="sand">Start selling</ButtonLink>
            <nav data-tour="home-campus" aria-label="Campus" className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-white/80">Campus:</span>
              {[{ slug: "", name: "All" }, ...ref.campuses].map((c) => (
                <Link key={c.slug || "all"} href={c.slug ? `/?campus=${c.slug}` : "/"} aria-current={(campus ?? "") === c.slug ? "true" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 font-semibold ${(campus ?? "") === c.slug ? "border-sand bg-sand text-navy" : "border-white/50 text-white hover:bg-white/10"}`}>
                  {c.name.replace("Eduvos ", "")}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </section>
      ) : (
        <>
          <LandingHero tiles={fresh} campuses={ref.allCampuses} campus={campus} />
          <StatsBand stats={stats} />
          <HowItWorks />
        </>
      )}

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-10" aria-labelledby="featured-h">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="featured-h" className="font-display text-2xl font-bold text-navy">Featured Hustles</h2>
            <Link href="/how-featured-works" className="min-h-11 py-2 text-sm font-semibold text-royal underline">How we pick</Link>
          </div>
          <ul className="relative mt-3 flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
            {featured.map((f, i) => {
              const s = f.seller_profiles;
              return (
                <li key={`${s.slug}-${f.position}`} className="min-w-[70%] snap-start sm:min-w-0">
                  <Link href={`/s/${s.slug}`} className="block h-full overflow-hidden rounded-xl border-2 border-sand bg-white">
                    <div className="relative aspect-[4/3] bg-mist">
                      {s.photo_url && <Image src={s.photo_url} alt={`${s.business_name} profile photo`} fill sizes="(max-width: 640px) 70vw, 25vw"
                        quality={lowData ? 35 : 70} priority={i === 0} className="object-cover" />}
                      <span className="absolute left-2 top-2 rounded bg-sand px-2 py-0.5 text-xs font-bold text-navy">Featured</span>
                    </div>
                    <div className="p-3">
                      <h3 className="font-display text-lg font-bold leading-snug text-navy">{s.business_name}{s.verified && <Verified />}</h3>
                      {s.tagline && <p className="line-clamp-2 text-sm text-ink">{s.tagline}</p>}
                      <p className="mt-1 text-xs text-muted">{[s.categories?.name, s.campuses?.name].filter(Boolean).join(" · ")}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pt-10" aria-labelledby="new-h">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="new-h" className="font-display text-2xl font-bold text-navy">{hasNew ? "New this week" : "Latest listings"}</h2>
          <Link href="/browse" className="min-h-11 py-2 text-sm font-semibold text-royal underline">See all</Link>
        </div>
        {fresh.length === 0 ? (
          <p className="mt-3 rounded-xl bg-mist p-6 text-center text-muted">Nothing here yet. Be the first to list something on this campus.</p>
        ) : (
          <ul className={lowData ? "mt-3 flex flex-col gap-2" : "relative mt-3 flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&>li]:w-44 [&>li]:shrink-0 [&>li]:snap-start sm:[&>li]:w-52"}>
            {fresh.map((t, i) => (
              <ListingTile key={t.id} t={t} index={i} saved={saved.has(t.id)} authed={!!user} lowData={lowData} />
            ))}
          </ul>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-10" aria-labelledby="cats-h">
        <h2 id="cats-h" className="font-display text-2xl font-bold text-navy">Shop by category</h2>
        <ul data-tour="home-categories" className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {ref.categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/browse?category=${c.slug}${campus ? `&campus=${campus}` : ""}`} className="flex min-h-16 items-center gap-3 rounded-xl bg-mist px-4 font-semibold text-navy hover:bg-navy/10">
                <Icon name={CATEGORY_ICONS[c.slug] ?? "other"} />{c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="lf-h">
        <div className="rounded-2xl bg-sand p-6 text-navy sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <h2 id="lf-h" className="font-display text-2xl font-bold">Can&apos;t find it? Ask for it.</h2>
            <p className="mt-1 max-w-xl">Soon you&apos;ll be able to post what you need (a tutor, a cake, a logo) and let campus sellers come to you.</p>
          </div>
          <div className="mt-4 sm:mt-0"><ButtonLink href="/looking-for" variant="primary">Looking For (coming soon)</ButtonLink></div>
        </div>
      </section>
      {!user && (
        <>
          <CampusGrid campuses={ref.allCampuses} />
          <TrustStrip />
          <FinalCta />
        </>
      )}
    </>
  );
}
