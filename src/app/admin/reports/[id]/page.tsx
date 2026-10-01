import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import ReportActions from "@/components/admin/ReportActions";
import { describeTargets } from "@/lib/admin-data";
import { clockTime, dayLabel } from "@/lib/messages";
import { REASON_LABEL, TARGET_LABEL } from "@/lib/moderation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Report" };

export default async function AdminReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: r } = await supabase.from("reports").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const title = await describeTargets(supabase, [r]);

  const [{ data: same }, { data: ctx }, listing, owner, resolver] = await Promise.all([
    supabase.from("reports").select("id,reason,note,reporter_id,status,created_at").eq("target_type", r.target_type).eq("target_id", r.target_id).order("created_at"),
    r.target_type === "message" ? supabase.from("report_context").select("*").eq("report_id", id).order("position") : Promise.resolve({ data: [] }),
    r.target_type === "listing" ? supabase.from("listings").select("id,title,hidden_by_moderation,moderation_hidden_reason,seller_id,description").eq("id", r.target_id).maybeSingle() : Promise.resolve({ data: null }),
    r.target_owner_id ? supabase.from("profiles").select("id,display_name,email,role,suspended_until,banned_at").eq("id", r.target_owner_id).maybeSingle() : Promise.resolve({ data: null }),
    r.resolved_by ? supabase.from("profiles").select("display_name").eq("id", r.resolved_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const reporterIds = [...new Set((same ?? []).map((x) => x.reporter_id).filter((x): x is string => !!x))];
  const { data: reporters } = reporterIds.length ? await supabase.from("profiles").select("id,display_name").in("id", reporterIds) : { data: [] };
  const rname = new Map((reporters ?? []).map((p) => [p.id, p.display_name ?? "User"]));
  const open = r.status === "pending";
  const href = r.target_type === "listing" ? `/l/${r.target_id}` : r.target_type === "seller" ? `/admin/sellers/${r.target_id}` : null;
  const msgs = ctx ?? [];

  return (
    <div>
      <Link href="/admin/reports" className="inline-flex min-h-11 items-center text-sm font-semibold text-royal underline">← All reports</Link>
      <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <section aria-labelledby="rep-h" className="rounded-2xl border border-navy/15 bg-white p-4">
            <p className="text-sm text-muted">{TARGET_LABEL[r.target_type] ?? r.target_type}</p>
            <h2 id="rep-h" className="font-display text-2xl font-bold text-navy">
              {href ? <Link href={href} className="inline-flex min-h-11 items-center underline">{title(r)}</Link> : title(r)}
            </h2>
            <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-full bg-navy px-2 py-0.5 font-bold text-white">{REASON_LABEL[r.reason] ?? r.reason}</span>
              <span className="rounded-full bg-mist px-2 py-0.5 font-bold capitalize text-navy">{r.status}</span>
              {listing.data?.hidden_by_moderation && <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-900">Hidden ({listing.data.moderation_hidden_reason})</span>}
            </p>
            {listing.data?.description && <p className="mt-3 line-clamp-4 text-ink">{listing.data.description}</p>}
            {owner.data && (
              <p className="mt-3 text-sm text-ink">Reported person: <strong>{owner.data.display_name ?? "User"}</strong> ({owner.data.role}){owner.data.email && ` · ${owner.data.email}`}
                {owner.data.banned_at ? " · banned" : owner.data.suspended_until && new Date(owner.data.suspended_until) > new Date() ? " · suspended" : ""}</p>
            )}
          </section>

          {r.target_type === "message" && (
            <section aria-labelledby="ctx-h" className="rounded-2xl border border-navy/15 bg-white p-4">
              <h3 id="ctx-h" className="font-display text-lg font-bold text-navy">The message and its surroundings</h3>
              <p className="text-sm text-muted">Only the reported message and up to 5 messages around it are shown. The rest of the conversation stays private.</p>
              <ol className="mt-3 space-y-2">
                {msgs.map((m) => (
                  <li key={m.id} className={`rounded-xl p-3 ${m.is_reported ? "border-2 border-royal bg-blue-50" : "bg-mist"}`}>
                    <p className="text-xs text-muted">
                      {m.sender_is_reported ? "Reported person" : "Reporter side"} ({m.sender_role}) · {dayLabel(m.created_at)} {clockTime(m.created_at)}
                      {m.is_reported && <strong className="ml-1 text-royal">· reported</strong>}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-ink">
                      {m.kind === "swap_offer" && <strong>[Swap offer{m.swap_title ? `: ${m.swap_title}` : ""}] </strong>}
                      {m.body || (m.has_image ? "[photo]" : "")}{m.has_image && m.body ? " [photo]" : ""}
                    </p>
                  </li>
                ))}
                {msgs.length === 0 && <li className="text-sm text-muted">No context was captured.</li>}
              </ol>
            </section>
          )}

          <section aria-labelledby="who-h" className="rounded-2xl border border-navy/15 bg-white p-4">
            <h3 id="who-h" className="font-display text-lg font-bold text-navy">Reports on this {TARGET_LABEL[r.target_type]?.toLowerCase()} ({same?.length ?? 0})</h3>
            <ul className="mt-2 space-y-2">
              {(same ?? []).map((x) => (
                <li key={x.id} className="rounded-lg bg-mist p-3 text-sm">
                  <p className="font-semibold text-navy">{x.reporter_id ? rname.get(x.reporter_id) ?? "User" : "Deleted user"} · {REASON_LABEL[x.reason] ?? x.reason} <span className="font-normal capitalize text-muted">({x.status})</span></p>
                  {x.note && <p className="mt-1 text-ink">“{x.note}”</p>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">Reporter names are visible to admins only, never to the reported person.</p>
          </section>
        </div>

        <aside aria-labelledby="act-h" className="h-fit rounded-2xl border-2 border-sand bg-white p-4">
          <h3 id="act-h" className="font-display text-xl font-bold text-navy">{open ? "Take action" : "Resolution"}</h3>
          {open ? (
            <div className="mt-3"><ReportActions reportId={r.id} targetType={r.target_type} hasUser={!!r.target_owner_id} listingHidden={!!listing.data?.hidden_by_moderation} /></div>
          ) : (
            <dl className="mt-2 space-y-1 text-sm">
              <div><dt className="inline text-muted">Outcome: </dt><dd className="inline font-semibold capitalize text-navy">{(r.resolution ?? r.status).replace("_", " ")}</dd></div>
              {r.resolution_note && <div><dt className="inline text-muted">Note: </dt><dd className="inline text-ink">{r.resolution_note}</dd></div>}
              <div><dt className="inline text-muted">By: </dt><dd className="inline text-ink">{resolver.data?.display_name ?? "Admin"}</dd></div>
            </dl>
          )}
        </aside>
      </div>
    </div>
  );
}
