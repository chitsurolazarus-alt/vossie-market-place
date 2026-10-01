import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import EnquireButton from "@/components/messages/EnquireButton";
import ReportButton from "@/components/ReportButton";
import { FollowButton } from "@/components/SaveButton";
import { ReplyTime, TrustBadge } from "@/components/trust";
import { ButtonLink } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { AVAILABILITY_LABEL, memberSince, priceLabel, publicImageUrl } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getExistingConversationId } from "@/lib/inbox-data";
import { getSellerTrust, getTierLabels } from "@/lib/trust";
import { isFollowing } from "@/lib/viewer";

async function load(slug: string) {
  const supabase = await createClient();
  const { data: seller } = await supabase
    .from("seller_profiles").select("*, categories(name), campuses(name)").eq("slug", slug).maybeSingle();
  return { supabase, seller };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { seller } = await load(slug);
  if (!seller || seller.status !== "approved") return { title: "Seller" };
  return {
    title: seller.business_name,
    description: seller.tagline ?? `${seller.business_name} on Vossie Market Place`,
    openGraph: { title: seller.business_name, description: seller.tagline ?? undefined, images: seller.photo_url ? [seller.photo_url] : undefined },
  };
}

export default async function SellerPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ compose?: string }> }) {
  const { slug } = await params;
  const { compose } = await searchParams;
  const { supabase, seller } = await load(slug);
  if (!seller) notFound();

  const user = await getUser();
  const isOwner = user?.id === seller.user_id;
  const { data } = await supabase
    .from("listings")
    .select("id,title,kind,pricing_mode,price_zar,price_is_from,availability,listing_images(path,alt,position)")
    .eq("seller_id", seller.id).is("deleted_at", null).order("created_at", { ascending: false });
  const listings = data ?? [];
  const [following, trust, tierLabels, existingConv] = await Promise.all([
    isOwner ? Promise.resolve(false) : isFollowing(seller.id),
    getSellerTrust(seller.id),
    getTierLabels(),
    user && !isOwner ? getExistingConversationId(user.id, seller.id, null) : Promise.resolve(null),
  ]);

  const wantsWhatsapp = seller.contact_pref === "whatsapp" || seller.contact_pref === "both";
  const wantsInApp = seller.contact_pref === "in_app" || seller.contact_pref === "both";

  return (
    <article>
      {isOwner && seller.status !== "approved" && (
        <div className="bg-sand text-navy">
          <p className="mx-auto max-w-5xl px-4 py-3 font-medium">Preview only: your profile isn&apos;t public until the Incubation Hub team approves it.</p>
        </div>
      )}
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center">
          {seller.photo_url ? (
            <Image src={seller.photo_url} alt={`${seller.business_name} profile photo`} width={128} height={128} priority className="h-28 w-28 rounded-2xl object-cover sm:h-32 sm:w-32" />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-sand font-display text-4xl font-bold text-navy sm:h-32 sm:w-32" aria-hidden="true">{seller.business_name.slice(0, 1)}</div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-bold">{seller.business_name}</h1>
            {seller.tagline && <p className="mt-1 text-lg text-white/90">{seller.tagline}</p>}
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {seller.verified && <li className="rounded-full bg-sand px-3 py-1 font-bold text-navy">✓ Verified Incubation Hub member</li>}
              {seller.categories?.name && <li className="rounded-full bg-white/15 px-3 py-1">{seller.categories.name}</li>}
              {seller.campuses?.name && <li className="rounded-full bg-white/15 px-3 py-1">{seller.campuses.name}</li>}
              <li className="rounded-full bg-white/15 px-3 py-1">Member since {memberSince(seller.created_at)}</li>
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <TrustBadge tier={trust?.tier} label={trust ? tierLabels[trust.tier] : undefined} />
              <Link href="/how-trust-works" className="inline-flex min-h-11 items-center text-sm font-semibold text-sand underline">How trust works</Link>
            </div>
            <ReplyTime band={trust?.reply_band} className="text-sm text-white/90" />
            {!isOwner && seller.status === "approved" && <div className="mt-4"><FollowButton sellerId={seller.id} name={seller.business_name} initialFollowing={following} authed={!!user} /></div>}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col gap-3 sm:flex-row">
          {isOwner ? (
            <ButtonLink href="/sell/profile/edit" variant="sand">Edit profile</ButtonLink>
          ) : (
            <>
              {wantsInApp && seller.status === "approved" && (
                <EnquireButton authed={!!user} sellerId={seller.id} listingId={null} listingTitle={null} sellerName={seller.business_name}
                  swapAllowed={false} myListings={[]} openInitially={compose === "1"} returnTo={`/s/${seller.slug}`} existingConversationId={existingConv} />
              )}
              {wantsWhatsapp && (
                <a href={`/go/whatsapp/${seller.slug}`} rel="nofollow" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-navy px-5 font-semibold text-white hover:bg-royal">
                  Chat on WhatsApp
                </a>
              )}
            </>
          )}
        </div>

        {!isOwner && seller.status === "approved" && (
          <div className="mt-2"><ReportButton targetType="seller" targetId={seller.id} authed={!!user} returnTo={`/s/${seller.slug}`} label="Report this profile" /></div>
        )}

        {seller.bio && (
          <section className="mt-8" aria-labelledby="about-h">
            <h2 id="about-h" className="font-display text-2xl font-bold text-navy">About</h2>
            <p className="mt-2 max-w-2xl whitespace-pre-line text-ink">{seller.bio}</p>
          </section>
        )}

        <section className="mt-10" aria-labelledby="listings-h">
          <h2 id="listings-h" className="font-display text-2xl font-bold text-navy">Listings</h2>
          {listings.length === 0 ? (
            <p className="mt-3 rounded-xl bg-mist p-6 text-center text-muted">
              {isOwner ? <>No listings yet. <Link href="/sell/listings/new" className="font-semibold text-royal underline">Create your first</Link>.</> : "No listings yet. Check back soon."}
            </p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
              {listings.map((l) => {
                const cover = [...l.listing_images].sort((a, b) => a.position - b.position)[0];
                return (
                  <li key={l.id} className="overflow-hidden rounded-xl border border-navy/15 bg-white">
                    <Link href={`/l/${l.id}`} className="block">
                    <div className="relative aspect-square bg-mist">
                      {cover && <Image src={publicImageUrl(cover.path)} alt={cover.alt} fill sizes="(max-width: 1024px) 50vw, 33vw" className="object-cover" />}
                      {l.availability !== "available" && (
                        <span className="absolute left-2 top-2 rounded bg-navy px-2 py-0.5 text-xs font-bold text-white">{AVAILABILITY_LABEL[l.availability]}</span>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold leading-snug text-navy">{l.title}</h3>
                      <p className="mt-1 text-sm font-semibold text-ink">{priceLabel(l)}</p>
                    </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}
