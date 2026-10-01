import Link from "next/link";
import { PageShell } from "@/components/ui";
import { TrustBadge } from "@/components/trust";
import { REPLY_BAND_LABEL } from "@/lib/trust-shared";
import { describeTier, getTiers } from "@/lib/trust";

export const metadata = { title: "How trust works", description: "How Vossie badges and reply times are earned. No stars, no reviews to game." };

export default async function HowTrustWorks() {
  const tiers = await getTiers();
  return (
    <PageShell title="How trust works" intro="Vossie shows badges, not star ratings. They're worked out by the system from what sellers actually do, and sellers can't edit them." width="max-w-3xl">
      <section aria-labelledby="tiers-h">
        <h2 id="tiers-h" className="font-display text-2xl font-bold text-navy">The four badges</h2>
        <ol className="mt-4 space-y-4">
          {tiers.map((t) => (
            <li key={t.tier} className="rounded-2xl border border-navy/15 bg-white p-4">
              <div className="flex items-center gap-3"><TrustBadge tier={t.tier} label={t.label} /></div>
              <p className="mt-2 text-ink">{t.summary}</p>
              <p className="mt-3 text-sm font-semibold text-navy">What it takes</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-ink">
                {describeTier(t).map((r) => <li key={r}>{r}</li>)}
              </ul>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-muted">A seller holds the highest badge whose rules they meet in full. Badges are recalculated every time an enquiry changes and again every night, so they can go down as well as up.</p>
      </section>

      <section className="mt-10" aria-labelledby="inputs-h">
        <h2 id="inputs-h" className="font-display text-2xl font-bold text-navy">What counts</h2>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="font-semibold text-navy">Response rate</dt>
            <dd className="text-ink">Of the enquiries a seller received in the last 90 days, the share they replied to within 48 hours. Enquiries that are still inside their 48-hour window don&apos;t count against anyone. WhatsApp leads aren&apos;t counted because Vossie can&apos;t see the reply.</dd>
          </div>
          <div>
            <dt className="font-semibold text-navy">Confirmed sales and swaps</dt>
            <dd className="text-ink">When a seller marks an enquiry completed and says the sale or swap happened, the buyer gets a one-tap prompt to confirm it. Only buyer-confirmed sales count. If the buyer doesn&apos;t answer within 7 days it&apos;s confirmed automatically, and if the buyer says it didn&apos;t happen it doesn&apos;t count. That stops sellers inflating their own badge.</dd>
          </div>
          <div>
            <dt className="font-semibold text-navy">Account age</dt>
            <dd className="text-ink">How long the seller profile has existed on Vossie.</dd>
          </div>
          <div>
            <dt className="font-semibold text-navy">Verified badge</dt>
            <dd className="text-ink">Granted by the Incubation Hub team to confirmed members. It is required for the top badge.</dd>
          </div>
        </dl>
      </section>

      <section className="mt-10" aria-labelledby="reply-h">
        <h2 id="reply-h" className="font-display text-2xl font-bold text-navy">Reply times</h2>
        <p className="mt-2 text-ink">We look at how long a seller took to send their first reply over the last 30 days and show a friendly band rather than an exact number. It only appears once a seller has had at least 3 enquiries.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-ink">
          {Object.values(REPLY_BAND_LABEL).map((l) => <li key={l}>{l}</li>)}
        </ul>
      </section>

      <p className="mt-10 rounded-xl bg-mist p-4 text-ink">
        Trust badges are a guide, not a guarantee. Always meet at a campus pickup point and never pay a deposit before you&apos;ve seen the item. See the <Link href="/seller-guidelines" className="font-semibold text-royal underline">seller guidelines</Link>.
      </p>
    </PageShell>
  );
}
