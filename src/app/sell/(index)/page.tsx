import CoachTour from "@/components/CoachTour";
import { SELLER_TOUR } from "@/lib/tours";
import { ButtonLink, PageShell } from "@/components/ui";
import { ReplyTime, TrustBadge } from "@/components/trust";
import { getSellerTrust, getTierLabels } from "@/lib/trust";
import { getHubPosts, KIND_LABEL } from "@/lib/hub";
import Link from "next/link";
import { getMySeller, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import Icon from "@/components/Icon";
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
      <PageShell title="Sell on HustleHub" intro="Turn your hustle into a campus-wide business." width="max-w-xl">
        <ul className="space-y-3 text-ink">
          <li className="flex gap-3"><Icon name="camera" className="text-royal" /> List products or services with photos and prices in rand</li>
          <li className="flex gap-3"><Icon name="swap" className="text-royal" /> Accept cash, swaps or both</li>
          <li className="flex gap-3"><Icon name="pin" className="text-royal" /> Hand over safely at campus pickup points</li>
          <li className="flex gap-3"><Icon name="check-circle" className="text-royal" /> Earn the Verified Incubation Hub badge</li>
        </ul>
        <div className="mt-8"><ButtonLink href="/sell/onboarding" variant="sand">Become a seller</ButtonLink></div>
      </PageShell>
    );
  }

  const supabase = await createClient();
  const [{ count: newEnq }, trust, tierLabels, hubPosts] = await Promise.all([
    supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("seller_id", seller.id).eq("status", "new"),
    getSellerTrust(seller.id),
    getTierLabels(),
    getHubPosts({ campusId: seller.campus_id, limit: 1 }),
  ]);
  const [{ count: total }, { count: live }] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", seller.id).is("deleted_at", null),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", seller.id).is("deleted_at", null).eq("availability", "available"),
  ]);
  const st = STATUS[seller.status];

  return (
    <PageShell title={seller.business_name} intro={seller.tagline ?? undefined} width="max-w-3xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div data-tour="status" className="rounded-xl bg-navy p-5 text-white sm:col-span-2">
          <p className="text-sm text-white/80">Status</p>
          <p className="font-display text-2xl font-bold">{st.label}</p>
          <p className="mt-1 text-white/90">{st.body}</p>
          {seller.verified && <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-sand px-3 py-1 text-sm font-bold text-navy"><Icon name="check-circle" size="sm" />Verified Incubation Hub member</p>}
        </div>
        <div className="rounded-xl bg-mist p-5">
          <p className="text-sm text-muted">Enquiries</p>
          <p className="font-display text-3xl font-bold text-navy">{newEnq ?? 0} <span className="text-base font-normal text-muted">new</span></p>
          <div className="mt-4"><ButtonLink href="/sell/enquiries" variant="sand">Open enquiries</ButtonLink></div>
        </div>
        <div className="rounded-xl bg-mist p-5">
          <p className="text-sm text-muted">Your trust badge</p>
          <div className="mt-1"><TrustBadge tier={trust?.tier} label={trust ? tierLabels[trust.tier] : undefined} /></div>
          <ReplyTime band={trust?.reply_band} className="mt-2 text-sm text-ink" />
          <p className="mt-2 text-sm text-muted">{trust ? `${trust.confirmed_sales} confirmed ${trust.confirmed_sales === 1 ? "sale" : "sales"}${trust.response_rate !== null ? ` · ${Math.round(Number(trust.response_rate) * 100)}% replied within 48h` : ""}` : "Reply to enquiries to earn your badge."}</p>
          <a href="/how-trust-works" className="mt-2 inline-flex min-h-11 items-center font-semibold text-royal underline">How trust works</a>
        </div>
        {hubPosts[0] && (
          <div className="rounded-xl border-2 border-sand bg-white p-5 sm:col-span-2">
            <p className="text-sm font-semibold text-muted">From the Hub · {KIND_LABEL[hubPosts[0].kind]}</p>
            <Link href={`/growth/${hubPosts[0].id}`} className="mt-1 flex min-h-11 items-center font-display text-xl font-bold text-navy hover:underline">{hubPosts[0].title}</Link>
            <Link href="/growth" className="mt-2 inline-flex min-h-11 items-center font-semibold text-royal underline">More from the Hub Growth corner</Link>
          </div>
        )}
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
      <CoachTour id="seller" label="Seller dashboard tour" steps={SELLER_TOUR} />
    </PageShell>
  );
}
