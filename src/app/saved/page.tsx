import Image from "next/image";
import Link from "next/link";
import ListingTile from "@/components/ListingTile";
import { FollowButton } from "@/components/SaveButton";
import { ButtonLink, EmptyState, LinkTabs, PageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fetchTiles } from "@/lib/browse";
import { createClient } from "@/lib/supabase/server";
import { getLowData } from "@/lib/viewer";

import Icon from "@/components/Icon";
export const metadata = { title: "Saved" };

export default async function Saved({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const user = await requireUser(`/saved${tab === "sellers" ? "?tab=sellers" : ""}`);
  const supabase = await createClient();
  const lowData = await getLowData();
  const active = tab === "sellers" ? "sellers" : "listings";

  const [{ data: savedRows }, { data: followRows }] = await Promise.all([
    supabase.from("saved_listings").select("listing_id").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("follows").select("seller_id, seller_profiles(id,business_name,slug,tagline,photo_url,verified,status)").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  const tiles = active === "listings" ? await fetchTiles((savedRows ?? []).map((r) => r.listing_id)) : [];
  const sellers = (followRows ?? []).flatMap((r) => (r.seller_profiles && r.seller_profiles.status === "approved" ? [r.seller_profiles] : []));

  return (
    <PageShell title="Saved" width="max-w-5xl">
      <LinkTabs label="Saved tabs" tabs={[
        { href: "/saved", label: `Listings (${savedRows?.length ?? 0})`, active: active === "listings" },
        { href: "/saved?tab=sellers", label: `Sellers (${sellers.length})`, active: active === "sellers" },
      ]} />

      <div className="mt-6">
        {active === "listings" ? (
          tiles.length === 0 ? (
            <EmptyState icon="heart" title="Nothing saved yet" body="Tap the heart on any listing to keep it here for later."
              action={<ButtonLink href="/browse" variant="sand">Browse hustles</ButtonLink>} />
          ) : (
            <ul className={lowData ? "flex flex-col gap-2" : "grid grid-cols-2 gap-3 lg:grid-cols-4"}>
              {tiles.map((t, i) => <ListingTile key={t.id} t={t} index={i} saved authed lowData={lowData} />)}
            </ul>
          )
        ) : sellers.length === 0 ? (
          <EmptyState icon="users" title="You&apos;re not following anyone yet" body="Follow sellers you like to keep their hustles one tap away."
            action={<ButtonLink href="/browse" variant="sand">Find sellers</ButtonLink>} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {sellers.map((s) => (
              <li key={s.id} className="rounded-2xl bg-navy p-4 text-white">
                <div className="flex items-center gap-3">
                  {s.photo_url
                    ? <Image src={s.photo_url} alt="" width={56} height={56} quality={lowData ? 35 : 70} className="h-14 w-14 rounded-xl object-cover" />
                    : <div aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-xl bg-sand font-display text-2xl font-bold text-navy">{s.business_name.slice(0, 1)}</div>}
                  <div className="min-w-0">
                    <Link href={`/s/${s.slug}`} className="block truncate font-display text-lg font-bold hover:underline">{s.business_name}</Link>
                    {s.verified && <p className="inline-flex items-center gap-1 text-sm font-semibold text-sand"><Icon name="check-circle" size="sm" />Verified Incubation Hub member</p>}
                    {s.tagline && <p className="truncate text-sm text-white/85">{s.tagline}</p>}
                  </div>
                </div>
                <div className="mt-3"><FollowButton sellerId={s.id} name={s.business_name} initialFollowing authed /></div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
