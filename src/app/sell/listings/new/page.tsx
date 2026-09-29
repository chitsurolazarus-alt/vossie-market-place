import { redirect } from "next/navigation";
import ListingForm from "@/components/sell/ListingForm";
import { PageShell } from "@/components/ui";
import { getMySeller, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadSellerPickups } from "@/lib/sell-data";

export const metadata = { title: "New listing" };

export default async function NewListing() {
  const user = await requireUser("/sell/listings/new");
  const seller = await getMySeller(user.id);
  if (!seller) redirect("/sell/onboarding");
  const supabase = await createClient();
  const [{ data: categories }, pickups] = await Promise.all([
    supabase.from("categories").select("id,name").eq("active", true).order("sort_order"),
    loadSellerPickups(seller.id),
  ]);

  return (
    <PageShell title="New listing" intro="A clear photo, a fair price and a short description is all you need." width="max-w-xl">
      <ListingForm userId={user.id} categories={categories ?? []} pickupPoints={pickups} isEdit={false}
        initial={{
          id: crypto.randomUUID(), kind: "product", title: "", description: "", categoryId: seller.category_id ?? "", tags: [],
          pricingMode: "cash", priceZar: null, priceIsFrom: false, swapFor: "", availability: "available",
          pickupPointId: pickups.length === 1 ? pickups[0].id : null, deliveredOnCampus: false, images: [],
        }} />
    </PageShell>
  );
}
