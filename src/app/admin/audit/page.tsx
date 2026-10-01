import Link from "next/link";
import { EmptyState, inputCls } from "@/components/ui";
import { clockTime, dayLabel } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";
const PAGE = 50;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AuditLog({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const action = one(sp.action).trim().slice(0, 40).replace(/[%_,()]/g, "");
  const target = one(sp.target).replace(/[^a-z_]/g, "");
  const actor = one(sp.actor).trim().slice(0, 60).replace(/[%,()]/g, "");
  const before = Number.parseInt(one(sp.before), 10);
  const supabase = await createClient();

  let actorIds: string[] | null = null;
  if (actor) {
    const { data } = await supabase.from("profiles").select("id").or(`display_name.ilike.%${actor}%,email.ilike.%${actor}%`).limit(50);
    actorIds = (data ?? []).map((p) => p.id);
  }
  let q = supabase.from("audit_log").select("id,actor_id,action,target_type,target_id,reason,before,after,detail,created_at").order("id", { ascending: false }).limit(PAGE + 1);
  if (action) q = q.ilike("action", `${action}%`);
  if (target) q = q.eq("target_type", target);
  if (actorIds) q = actorIds.length ? q.in("actor_id", actorIds) : q.eq("actor_id", "00000000-0000-0000-0000-000000000000");
  if (Number.isFinite(before)) q = q.lt("id", before);
  const { data } = await q;
  const rows = (data ?? []).slice(0, PAGE);
  const more = (data ?? []).length > PAGE;

  const ids = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => !!x))];
  const { data: names } = ids.length ? await supabase.from("profiles").select("id,display_name").in("id", ids) : { data: [] };
  const who = new Map((names ?? []).map((p) => [p.id, p.display_name ?? "Admin"]));

  const nextHref = () => {
    const u = new URLSearchParams();
    if (action) u.set("action", action); if (target) u.set("target", target); if (actor) u.set("actor", actor);
    u.set("before", String(rows[rows.length - 1].id));
    return `/admin/audit?${u}`;
  };

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-navy">Audit log</h2>
      <p className="mt-1 text-sm text-muted">Every admin action and automatic moderation step. Entries can never be edited or deleted, not even by admins.</p>
      <form method="get" role="search" className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <div><label htmlFor="action" className="sr-only">Action starts with</label><input id="action" name="action" defaultValue={action} placeholder="Action, e.g. seller." className={inputCls} /></div>
        <div><label htmlFor="target" className="sr-only">Target type</label>
          <select id="target" name="target" defaultValue={target} className={inputCls}>
            <option value="">All targets</option>
            {["seller_profile", "listing", "report", "user", "categories", "campuses", "pickup_points", "trust_tiers", "feature_flags", "allowed_email_domains", "allowed_emails", "featured_slots", "site_settings"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select></div>
        <div><label htmlFor="actor" className="sr-only">Actor name or email</label><input id="actor" name="actor" defaultValue={actor} placeholder="Actor name or email" className={inputCls} /></div>
        <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-navy px-5 font-semibold text-white hover:bg-royal">Filter</button>
      </form>
      <div className="mt-4">
        {rows.length === 0 ? <EmptyState title="No entries" body="Nothing matches those filters." /> : (
          <ol className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl border border-navy/15 bg-white p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-semibold text-navy">{r.action}</p>
                  <time dateTime={r.created_at} className="text-xs text-muted">{dayLabel(r.created_at)} {clockTime(r.created_at)}</time>
                </div>
                <p className="text-sm text-ink">By <strong>{r.actor_id ? who.get(r.actor_id) ?? "Admin" : "System"}</strong> on {r.target_type} <span className="break-all text-muted">{r.target_id}</span></p>
                {r.reason && <p className="text-sm text-ink">Reason: “{r.reason}”</p>}
                {(r.before || r.after || r.detail) && (
                  <details className="mt-1">
                    <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-royal">Details</summary>
                    <pre className="max-w-full overflow-x-auto rounded-lg bg-mist p-2 text-xs text-ink">{JSON.stringify({ before: r.before, after: r.after, detail: r.detail }, null, 2)}</pre>
                  </details>
                )}
              </li>
            ))}
          </ol>
        )}
        {more && <div className="mt-4 text-center"><Link href={nextHref()} className="inline-flex min-h-12 items-center rounded-lg border-2 border-navy px-5 font-semibold text-navy hover:bg-mist">Older entries</Link></div>}
      </div>
    </div>
  );
}
