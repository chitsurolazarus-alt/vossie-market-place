import { redirect } from "next/navigation";
import { SellerWizard } from "@/components/sell/SellerForm";
import { Alert, ButtonLink, PageShell } from "@/components/ui";
import { getMySeller, requireUser } from "@/lib/auth";
import { loadReferenceData, loadSellerInitial } from "@/lib/sell-data";

import Icon from "@/components/Icon";
export const metadata = { title: "Become a seller" };

export default async function Onboarding() {
  const user = await requireUser("/sell/onboarding");
  const seller = await getMySeller(user.id);

  if (seller?.status === "approved") redirect("/sell/profile/edit");

  if (seller?.status === "pending") {
    return (
      <PageShell title="You're in the queue" width="max-w-xl">
        <div className="rounded-2xl bg-navy p-6 text-white">
          <p className="text-lg">Thanks, <strong>{seller.business_name}</strong>! The Incubation Hub team reviews every new seller before they go live. This usually takes 1 to 2 working days.</p>
        </div>
        <ol className="mt-6 space-y-3 text-ink">
          <li className="flex gap-3"><Icon name="check-circle" className="text-royal" /> Profile submitted</li>
          <li className="flex gap-3"><Icon name="clock" className="text-royal" /> Admin review in progress</li>
          <li className="flex gap-3"><Icon name="rocket" className="text-royal" /> Your listings go public once you&apos;re approved</li>
        </ol>
        <p className="mt-6 text-muted">You don&apos;t have to wait. Draft your listings now; they stay hidden until you&apos;re approved.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/sell/listings/new" variant="sand">Draft your first listing</ButtonLink>
          <ButtonLink href="/sell" variant="secondary">Go to dashboard</ButtonLink>
        </div>
      </PageShell>
    );
  }

  if (seller?.status === "suspended") {
    return (
      <PageShell title="Seller account suspended" width="max-w-xl">
        <Alert>Your seller account is suspended. Please contact the Incubation Hub team.</Alert>
      </PageShell>
    );
  }

  const [ref, init] = await Promise.all([loadReferenceData(), loadSellerInitial(seller, user.id)]);
  return (
    <PageShell title="Become a seller" intro="Five quick steps. It takes about 3 minutes." width="max-w-xl">
      {seller?.status === "rejected" && <div className="mb-6"><Alert>Your last submission needed changes. Update your details and submit again.</Alert></div>}
      <SellerWizard userId={user.id} {...ref} {...init} mode="onboard" />
    </PageShell>
  );
}
