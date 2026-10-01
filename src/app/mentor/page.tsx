import Link from "next/link";
import { TrustBadge } from "@/components/trust";
import { EmptyState } from "@/components/ui";
import { shortTime } from "@/lib/messages";
import { getSellerStats, supportFlags } from "@/lib/mentor";
import { requireStaff } from "@/lib/roles";
import { getTierLabels } from "@/lib/trust";

export const metadata = { title: "Mentor view", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MentorHome() {
  const { profile } = await requireStaff("/mentor");
  const [sellers, labels] = await Promise.all([getSellerStats(), getTierLabels()]);
  const rows = sellers.map((s) => ({ s, flags: supportFlags(s) })).sort((a, b) => b.flags.length - a.flags.length);
  const needing = rows.filter((r) => r.flags.length > 0).length;

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Mentor view</h1>
          <p className="mt-1 text-muted">{profile.role === "admin" ? "All sellers (admin)." : "Your assigned sellers."} Read-only: you see activity numbers, never message content.</p>
        </div>
        {rows.length > 0 && <a href="/mentor/export" download className="inline-flex min-h-12 items-center rounded-lg border-2 border-navy px-5 font-semibold text-navy hover:bg-mist">Export CSV</a>}
      </div>
      {rows.length > 0 && <p className="mt-4 rounded-xl bg-mist p-3 text-ink"><strong>{needing}</strong> of {rows.length} sellers may need support.</p>}
      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState title="No sellers assigned yet" body="When an admin assigns sellers to you, they appear here with their activity." />
        ) : (
          <ul className="space-y-3">
            {rows.map(({ s, flags }) => (
              <li key={s.id}>
                <Link href={`/mentor/${s.id}`} className="block rounded-2xl border border-navy/15 bg-white p-4 hover:bg-mist">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-lg font-bold text-navy">{s.business_name}{s.verified && " ✓"}</p>
                    <TrustBadge tier={s.tier} label={labels[s.tier]} size="sm" />
                  </div>
                  <p className="text-sm text-muted">{s.campus}{s.last_active_at ? ` · active ${shortTime(s.last_active_at)} ago` : " · not seen yet"}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                    <div><dt className="text-muted">Enquiries (30d)</dt><dd className="font-semibold text-navy">{s.enquiries_30d} <span className="font-normal text-muted">+ {s.whatsapp_30d} WhatsApp</span></dd></div>
                    <div><dt className="text-muted">Response rate</dt><dd className="font-semibold text-navy">{s.response_rate === null ? "n/a" : `${Math.round(s.response_rate * 100)}%`}</dd></div>
                    <div><dt className="text-muted">Confirmed sales</dt><dd className="font-semibold text-navy">{s.confirmed_sales}</dd></div>
                    <div><dt className="text-muted">Listing views (30d)</dt><dd className="font-semibold text-navy">{s.listing_views_30d}</dd></div>
                  </dl>
                  {flags.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="May need support">
                      {flags.map((f) => <li key={f} className="rounded-full bg-sand px-2.5 py-1 text-xs font-bold text-navy">⚑ {f}</li>)}
                    </ul>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
