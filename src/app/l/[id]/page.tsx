import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import Gallery from "@/components/Gallery";
import ListingTile from "@/components/ListingTile";
import { FollowButton, SaveButton } from "@/components/SaveButton";
import ReportButton from "@/components/ReportButton";
import ShareButton from "@/components/ShareButton";
import { getUser } from "@/lib/auth";
import { sellerTiles, similarTiles } from "@/lib/browse";
import { priceLabel, publicImageUrl } from "@/lib/format";
import EnquireButton from "@/components/messages/EnquireButton";
import { ReplyTime, TrustBadge } from "@/components/trust";
import { getExistingConversationId, getMyListingsForSwap } from "@/lib/inbox-data";
import { getListing } from "@/lib/listing-data";
import { getSellerTrust, getTierLabels } from "@/lib/trust";
import { recordView } from "@/lib/views";
import { getLowData, getSavedIds, isFollowing } from "@/lib/viewer";

const uuid = z.uuid();

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return { title: "Listing" };
  const l = await getListing(id);
  const s = l?.seller_profiles;
  if (!l || !s || l.hidden_by_moderation || s.status !== "approved") return { title: "Listing not found" };
  const price = priceLabel(l);
  return {
    title: l.title,
    description: `${price} · ${s.business_name} on HustleHub. ${l.description ?? ""}`.slice(0, 200),
    openGraph: { title: `${l.title} · ${price}`, description: `From ${s.business_name} on HustleHub` },
  };
}

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ compose?: string }> }) {
  const { id } = await params;
  const { compose } = await searchParams;
  if (!uuid.safeParse(id).success) notFound();

  const l = await getListing(id);
  const seller = l?.seller_profiles;
  if (!l || !seller) notFound();

  const user = await getUser();
  const isOwner = user?.id === seller.user_id;
  const isPublic = !l.hidden_by_moderation && seller.status === "approved";
  if (!isPublic && !isOwner) notFound();
  if (isPublic) await recordView(l.id, seller.user_id);

  const [lowData, more, similar, following, trust, tierLabels, existingConv, myListings] = await Promise.all([
    getLowData(),
    sellerTiles(seller.id, l.id, 4),
    similarTiles(l.category_id, seller.id, l.id, 4),
    isFollowing(seller.id),
    getSellerTrust(seller.id),
    getTierLabels(),
    user && !isOwner ? getExistingConversationId(user.id, seller.id, l.id) : Promise.resolve(null),
    user && !isOwner && l.pricing_mode !== "cash" ? getMyListingsForSwap(user.id, null) : Promise.resolve([]),
  ]);
  const saved = await getSavedIds([l.id, ...more.map((t) => t.id), ...similar.map((t) => t.id)]);

  const images = [...l.listing_images].sort((a, b) => a.position - b.position).map((i) => ({ url: publicImageUrl(i.path), alt: i.alt }));
  const tags = l.listing_tags.map((t) => t.tags?.name).filter((n): n is string => !!n);
  const wantsWhatsapp = seller.contact_pref !== "in_app";
  const wantsInApp = seller.contact_pref !== "whatsapp";
  const status = l.availability === "sold_out" ? "Sold out" : l.availability === "paused" ? "Paused: not taking orders right now" : null;

  return (
    <article className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      {!isPublic && <p className="mb-4 rounded-lg bg-sand p-3 font-medium text-navy">Preview only: this listing isn&apos;t public yet.</p>}
      <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-x-1 text-sm text-muted">
        <Link href="/browse" className="inline-flex min-h-11 min-w-11 items-center justify-center underline">Browse</Link>
        {l.categories && <> / <Link href={`/browse?category=${l.categories.slug}`} className="inline-flex min-h-11 min-w-11 items-center justify-center underline">{l.categories.name}</Link></>}
      </nav>

      <div className="grid gap-6 md:grid-cols-2">
        <Gallery images={images} lowData={lowData} />

        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-3xl font-bold leading-tight text-navy">{l.title}</h1>
            <SaveButton listingId={l.id} title={l.title} initialSaved={saved.has(l.id)} authed={!!user} className="shrink-0 border border-navy/20" />
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">{priceLabel(l)}</p>
          {status && <p className="mt-2 inline-block rounded bg-navy px-2 py-1 text-sm font-bold text-white">{status}</p>}
          {l.pricing_mode !== "cash" && l.swap_for && (
            <p className="mt-3 rounded-lg bg-mist p-3"><strong className="text-navy">Happy to swap for:</strong> {l.swap_for}</p>
          )}

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Type</dt><dd className="font-medium capitalize text-navy">{l.kind}</dd>
            {l.categories && <><dt className="text-muted">Category</dt><dd className="font-medium text-navy">{l.categories.name}</dd></>}
            {l.campuses && <><dt className="text-muted">Campus</dt><dd className="font-medium text-navy">{l.campuses.name}</dd></>}
            {l.pickup_points && <><dt className="text-muted">Pickup point</dt><dd className="font-medium text-navy">{l.pickup_points.name}</dd></>}
            {l.delivered_on_campus && <><dt className="text-muted">Delivery</dt><dd className="font-medium text-navy">On campus or online</dd></>}
          </dl>

          {l.description && <p className="mt-4 whitespace-pre-line text-ink">{l.description}</p>}
          {tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
              {tags.map((t) => <li key={t}><Link href={`/browse?q=${encodeURIComponent(t)}`} className="inline-flex min-h-11 items-center rounded-full bg-mist px-3 text-sm text-navy">#{t}</Link></li>)}
            </ul>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {!isOwner && wantsInApp && (
              <EnquireButton authed={!!user} sellerId={seller.id} listingId={l.id} listingTitle={l.title} sellerName={seller.business_name}
                swapAllowed={l.pricing_mode !== "cash"} myListings={myListings} openInitially={compose === "1"}
                returnTo={`/l/${l.id}`} existingConversationId={existingConv} />
            )}
            {!isOwner && wantsWhatsapp && (
              <a href={`/go/whatsapp/${seller.slug}?listing=${l.id}`} rel="nofollow" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-navy px-5 font-semibold text-white hover:bg-royal">Chat on WhatsApp</a>
            )}
            {isOwner && <Link href={`/sell/listings/${l.id}/edit`} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-sand px-5 font-semibold text-navy">Edit listing</Link>}
            <ShareButton title={l.title} text={`${l.title} · ${priceLabel(l)} on HustleHub`} />
          </div>
          {!isOwner && <div className="mt-1"><ReportButton targetType="listing" targetId={l.id} authed={!!user} returnTo={`/l/${l.id}`} label="Report this listing" /></div>}

          <div className="mt-6 rounded-2xl bg-navy p-4 text-white">
            <div className="flex items-center gap-3">
              {seller.photo_url
                ? <Image src={seller.photo_url} alt="" width={56} height={56} quality={lowData ? 35 : 75} className="h-14 w-14 rounded-xl object-cover" />
                : <div aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-xl bg-sand font-display text-2xl font-bold text-navy">{seller.business_name.slice(0, 1)}</div>}
              <div className="min-w-0">
                <Link href={`/s/${seller.slug}`} className="flex min-h-11 items-center truncate font-display text-lg font-bold underline-offset-2 hover:underline">{seller.business_name}</Link>
                {seller.verified && <p className="text-sm font-semibold text-sand">✓ Verified Incubation Hub member</p>}
                <div className="mt-1"><TrustBadge tier={trust?.tier} label={trust ? tierLabels[trust.tier] : undefined} size="sm" /></div>
                <ReplyTime band={trust?.reply_band} className="mt-1 text-sm text-white/90" />
                {seller.tagline && <p className="truncate text-sm text-white/85">{seller.tagline}</p>}
              </div>
            </div>
            {!isOwner && <div className="mt-3"><FollowButton sellerId={seller.id} name={seller.business_name} initialFollowing={following} authed={!!user} /></div>}
          </div>
        </div>
      </div>

      {more.length > 0 && <Related title={`More from ${seller.business_name}`} tiles={more} saved={saved} authed={!!user} lowData={lowData} />}
      {similar.length > 0 && <Related title="Similar listings" tiles={similar} saved={saved} authed={!!user} lowData={lowData} />}
    </article>
  );
}

function Related({ title, tiles, saved, authed, lowData }: { title: string; tiles: Awaited<ReturnType<typeof sellerTiles>>; saved: Set<string>; authed: boolean; lowData: boolean }) {
  return (
    <section className="mt-10" aria-label={title}>
      <h2 className="font-display text-2xl font-bold text-navy">{title}</h2>
      <ul className={lowData ? "mt-3 flex flex-col gap-2" : "mt-3 grid grid-cols-2 gap-3 md:grid-cols-4"}>
        {tiles.map((t, i) => <ListingTile key={t.id} t={t} index={i + 4} saved={saved.has(t.id)} authed={authed} lowData={lowData} />)}
      </ul>
    </section>
  );
}
