import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { REASON_LABEL, TARGET_LABEL } from "@/lib/moderation";
import { shortTime } from "@/lib/messages";

export const metadata = { title: "Dashboard" };

const isoDaysAgo = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
const startOfToday = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };

export default async function AdminDashboard() {
  const supabase = await createClient();
  const [pending, reports, today, active, latestSellers, latestReports] = await Promise.all([
    supabase.from("seller_profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("listings").select("id", { count: "exact", head: true }).gte("created_at", startOfToday()),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("last_seen_at", isoDaysAgo(7)),
    supabase.from("seller_profiles").select("id,business_name,submitted_at,campuses(name)").eq("status", "pending").order("submitted_at").limit(5),
    supabase.from("reports").select("id,reason,target_type,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
  ]);
  const cards = [
    { label: "Sellers waiting", n: pending.count ?? 0, href: "/admin/sellers" },
    { label: "Open reports", n: reports.count ?? 0, href: "/admin/reports" },
    { label: "New listings today", n: today.count ?? 0, href: "/admin/listings" },
    { label: "Active users (7 days)", n: active.count ?? 0, href: "/admin/users" },
  ];
  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={c.label}>
            <Link href={c.href} className="block min-h-24 rounded-2xl bg-mist p-4 hover:bg-navy/10">
              <span className="block font-display text-3xl font-bold text-navy">{c.n}</span>
              <span className="text-sm text-muted">{c.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section aria-labelledby="ps-h">
          <h2 id="ps-h" className="font-display text-xl font-bold text-navy">Waiting for approval</h2>
          {(latestSellers.data ?? []).length === 0 ? <p className="mt-2 rounded-xl bg-mist p-4 text-muted">Nobody is waiting.</p> : (
            <ul className="mt-2 divide-y divide-navy/10 rounded-xl border border-navy/15 bg-white">
              {latestSellers.data!.map((s) => (
                <li key={s.id}><Link href={`/admin/sellers/${s.id}`} className="flex min-h-14 items-center justify-between gap-2 px-4 py-2 hover:bg-mist">
                  <span className="min-w-0"><span className="block truncate font-semibold text-navy">{s.business_name}</span><span className="block text-xs text-muted">{s.campuses?.name}</span></span>
                  {s.submitted_at && <time dateTime={s.submitted_at} className="shrink-0 text-xs text-muted">{shortTime(s.submitted_at)}</time>}
                </Link></li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="or-h">
          <h2 id="or-h" className="font-display text-xl font-bold text-navy">Open reports</h2>
          {(latestReports.data ?? []).length === 0 ? <p className="mt-2 rounded-xl bg-mist p-4 text-muted">No open reports.</p> : (
            <ul className="mt-2 divide-y divide-navy/10 rounded-xl border border-navy/15 bg-white">
              {latestReports.data!.map((r) => (
                <li key={r.id}><Link href={`/admin/reports/${r.id}`} className="flex min-h-14 items-center justify-between gap-2 px-4 py-2 hover:bg-mist">
                  <span className="min-w-0"><span className="block truncate font-semibold text-navy">{REASON_LABEL[r.reason] ?? r.reason}</span><span className="block text-xs text-muted">{TARGET_LABEL[r.target_type] ?? r.target_type}</span></span>
                  <time dateTime={r.created_at} className="shrink-0 text-xs text-muted">{shortTime(r.created_at)}</time>
                </Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
