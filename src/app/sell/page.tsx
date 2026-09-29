import { SellerTour } from "@/components/Tours";
import { ButtonLink, PageShell } from "@/components/ui";
import { getMySeller, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Seller dashboard" };

const STATUS: Record<string, { label: string; body: string }> = {
  draft: { label: "Draft", body: "Finish your profile and submit it for approval." },
  pending: { label: "Waiting for approval", body: "The Incubation Hub team is reviewing your profile. You can draft listings meanwhile." },
  approved: { label: "Live", body: "Your profile and available listings are visible to buyers." },
  rejected: { label: "Changes needed", body: "Update your details and submit again." },
  suspended: { label: "Suspended", body: "Contact the Incubation Hub team." },
};

export default async function SellDashboard() {
  const user = await requireUser("/sell");
  const seller = await getMySeller(user.id);

  if (!seller) {
    return (
      <PageShell title="Sell on Vossie" intro="Turn your hustle into a campus-wide business." width="max-w-xl">
        <ul className="space-y-3 text-ink">
          <li className="flex gap-3"><span aria-hidden="true">📸</span> List products or services with photos and prices in rand</li>
          <li className="flex gap-3"><span aria-hidden="true">🤝</span> Accept cash, swaps or both</li>
          <li className="flex gap-3"><span aria-hidden="true">📍</span> Hand over safely at campus pickup points</li>
          <li className="flex gap-3"><span aria-hidden="true">✅</span> Earn the Verified Incubation Hub badge</li>
        </ul>
        <div className="mt-8"><ButtonLink href="/sell/onboarding" variant="sand">Become a seller</ButtonLink></div>
      </PageShell>
    );
  }

  const supabase = await createClient();
  const [{ count: total }, { count: live }, { data: prof }] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", seller.id).is("deleted_at", null),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", seller.id).is("deleted_at", null).eq("availability", "available"),
    supabase.from("profiles").select("seller_tour_seen").eq("id", user.id).single(),
  ]);
  const st = STATUS[seller.status];

  return (
    <PageShell title={seller.business_name} intro={seller.tagline ?? undefined} width="max-w-3xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div data-tour="status" className="rounded-xl bg-navy p-5 text-white sm:col-span-2">
          <p className="text-sm text-white/80">Status</p>
          <p className="font-display text-2xl font-bold">{st.label}</p>
          <p className="mt-1 text-white/90">{st.body}</p>
          {seller.verified && <p className="mt-3 inline-block rounded-full bg-sand px-3 py-1 text-sm font-bold text-navy">✓ Verified Incubation Hub member</p>}
        </div>
        <div data-tour="listings" className="rounded-xl bg-mist p-5">
          <p className="text-sm text-muted">Listings</p>
          <p className="font-display text-3xl font-bold text-navy">{total ?? 0}</p>
          <p className="text-sm text-muted">{live ?? 0} available</p>
          <div className="mt-4 flex flex-col gap-2">
            <ButtonLink href="/sell/listings/new" variant="sand">+ New listing</ButtonLink>
            <ButtonLink href="/sell/listings" variant="secondary">Manage listings</ButtonLink>
          </div>
        </div>
        <div data-tour="profile" className="rounded-xl bg-mist p-5">
          <p className="text-sm text-muted">Public profile</p>
          <p className="break-all font-semibold text-navy">/s/{seller.slug}</p>
          <div className="mt-4 flex flex-col gap-2">
            <ButtonLink href={`/s/${seller.slug}`} variant="secondary">View profile</ButtonLink>
            <ButtonLink href="/sell/profile/edit" variant="secondary">Edit profile</ButtonLink>
          </div>
        </div>
      </div>
      {!prof?.seller_tour_seen && <SellerTour userId={user.id} />}
    </PageShell>
  );
}
