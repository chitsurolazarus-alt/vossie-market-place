import { redirect } from "next/navigation";
import ListingCard from "@/components/sell/ListingCard";
import { ButtonLink, EmptyState, PageShell } from "@/components/ui";
import { getMySeller, requireUser } from "@/lib/auth";
import { priceLabel, publicImageUrl } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My listings" };

export default async function MyListings() {
  const user = await requireUser("/sell/listings");
  const seller = await getMySeller(user.id);
  if (!seller) redirect("/sell/onboarding");

  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("id,title,kind,pricing_mode,price_zar,price_is_from,availability,hidden_by_moderation,created_at,listing_images(path,alt,position)")
    .eq("seller_id", seller.id).is("deleted_at", null).order("created_at", { ascending: false });

  const listings = data ?? [];
  const live = seller.status === "approved";

  return (
    <PageShell title="My listings" width="max-w-5xl">
      {!live && (
        <p className="mb-6 rounded-lg border-l-4 border-royal bg-blue-50 p-3 text-navy">
          You can draft listings now. They stay hidden from buyers until the Incubation Hub team approves your profile.
        </p>
      )}
      {listings.length === 0 ? (
        <EmptyState title="No listings yet" body="Create your first in under 2 minutes. A clear photo, a fair price and a short description is all you need."
          action={<ButtonLink href="/sell/listings/new" variant="sand">Create your first listing</ButtonLink>} />
      ) : (
        <>
          <div className="mb-6"><ButtonLink href="/sell/listings/new" variant="sand">+ New listing</ButtonLink></div>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => {
              const cover = [...l.listing_images].sort((a, b) => a.position - b.position)[0];
              return (
                <ListingCard key={l.id} sellerLive={live} l={{
                  id: l.id, title: l.title, kind: l.kind, priceText: priceLabel(l), availability: l.availability,
                  imageUrl: cover ? publicImageUrl(cover.path) : null, imageAlt: cover?.alt ?? l.title, hidden: l.hidden_by_moderation,
                }} />
              );
            })}
          </ul>
        </>
      )}
    </PageShell>
  );
}
