import { notFound, redirect } from "next/navigation";
import ListingForm, { type ListingInitial } from "@/components/sell/ListingForm";
import { PageShell } from "@/components/ui";
import { getMySeller, requireUser } from "@/lib/auth";
import { publicImageUrl } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { loadSellerPickups } from "@/lib/sell-data";
import { z } from "zod";

export const metadata = { title: "Edit listing" };

export default async function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser(`/sell/listings/${id}/edit`);
  const seller = await getMySeller(user.id);
  if (!seller) redirect("/sell/onboarding");

  const supabase = await createClient();
  const [{ data: l }, { data: categories }, pickups] = await Promise.all([
    supabase.from("listings")
      .select("*, listing_images(path,alt,position), listing_tags(tags(name))")
      .eq("id", id).eq("seller_id", seller.id).is("deleted_at", null).maybeSingle(),
    supabase.from("categories").select("id,name").eq("active", true).order("sort_order"),
    loadSellerPickups(seller.id),
  ]);
  if (!l) notFound();

  return (
    <PageShell title="Edit listing" width="max-w-xl">
      <ListingForm userId={user.id} categories={categories ?? []} pickupPoints={pickups} isEdit
        initial={{
          id: l.id, kind: l.kind, title: l.title, description: l.description ?? "", categoryId: l.category_id ?? "",
          tags: l.listing_tags.map((t) => t.tags?.name).filter((n): n is string => !!n),
          pricingMode: l.pricing_mode, priceZar: l.price_zar, priceIsFrom: l.price_is_from, swapFor: l.swap_for ?? "",
          availability: l.availability, pickupPointId: l.pickup_point_id, handover: l.handover as ListingInitial["handover"], deliveryFeeZar: l.delivery_fee_zar,
          images: [...l.listing_images].sort((a, b) => a.position - b.position).map((i) => ({ path: i.path, url: publicImageUrl(i.path), alt: i.alt })),
        }} />
    </PageShell>
  );
}
