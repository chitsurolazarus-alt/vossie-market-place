import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { shortTime } from "@/lib/messages";
import { REASON_LABEL, TARGET_LABEL } from "@/lib/moderation";
import { describeTargets } from "@/lib/admin-data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Reports" };

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const open = tab !== "resolved";
  const supabase = await createClient();
  const q = supabase.from("reports").select("id,reason,target_type,target_id,status,resolution,created_at,resolved_at,note");
  const { data } = await (open ? q.eq("status", "pending").order("created_at") : q.neq("status", "pending").order("resolved_at", { ascending: false })).limit(100);
  const rows = data ?? [];
  const title = await describeTargets(supabase, rows);
  // how many unique people have a pending report on the same target
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(`${r.target_type}:${r.target_id}`, (counts.get(`${r.target_type}:${r.target_id}`) ?? 0) + 1);

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-navy">Reports</h2>
      <nav aria-label="Report status" className="mt-3 flex gap-2">
        {[["open", "Open"], ["resolved", "Resolved"]].map(([k, l]) => (
          <Link key={k} href={`/admin/reports?tab=${k}`} aria-current={(k === "open") === open ? "page" : undefined}
            className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border-2 px-2 text-sm font-semibold ${(k === "open") === open ? "border-navy bg-navy text-white" : "border-navy/30 text-navy hover:bg-mist"}`}>{l}</Link>
        ))}
      </nav>
      <div className="mt-4">
        {rows.length === 0 ? <EmptyState title={open ? "No open reports" : "Nothing resolved yet"} body={open ? "Nothing needs your attention." : "Resolved reports show up here."} /> : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/reports/${r.id}`} className="block rounded-xl border border-navy/15 bg-white p-3 hover:bg-mist">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 truncate font-semibold text-navy">{title(r)}</p>
                    <time dateTime={r.resolved_at ?? r.created_at} className="shrink-0 text-xs text-muted">{shortTime(r.resolved_at ?? r.created_at)}</time>
                  </div>
                  <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    <span className="rounded-full bg-navy px-2 py-0.5 font-bold text-white">{REASON_LABEL[r.reason] ?? r.reason}</span>
                    <span className="rounded-full bg-mist px-2 py-0.5 font-bold text-navy">{TARGET_LABEL[r.target_type] ?? r.target_type}</span>
                    {open && (counts.get(`${r.target_type}:${r.target_id}`) ?? 0) > 1 && <span className="rounded-full bg-sand px-2 py-0.5 font-bold text-navy">{counts.get(`${r.target_type}:${r.target_id}`)} reports</span>}
                    {!open && r.resolution && <span className="rounded-full bg-sand px-2 py-0.5 font-bold capitalize text-navy">{r.resolution.replace("_", " ")}</span>}
                  </p>
                  {r.note && <p className="mt-1 line-clamp-2 text-sm text-ink">“{r.note}”</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
