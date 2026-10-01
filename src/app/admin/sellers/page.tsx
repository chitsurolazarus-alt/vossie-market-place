import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { shortTime } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Seller approvals" };

const TABS = [
  { key: "pending", label: "Waiting", statuses: ["pending"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "other", label: "Rejected / changes", statuses: ["rejected", "draft", "suspended"] },
] as const;

export default async function AdminSellers({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const supabase = await createClient();
  const { data } = await supabase.from("seller_profiles")
    .select("id,business_name,slug,status,verified,submitted_at,reviewed_at,review_reason,created_at,campuses(name),categories(name)")
    .in("status", [...active.statuses]).order("submitted_at", { ascending: active.key === "pending", nullsFirst: false }).limit(100);
  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-navy">Seller approvals</h2>
      <nav aria-label="Seller status" className="mt-3 flex gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/sellers?tab=${t.key}`} aria-current={t.key === active.key ? "page" : undefined}
            className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border-2 px-2 text-sm font-semibold ${t.key === active.key ? "border-navy bg-navy text-white" : "border-navy/30 text-navy hover:bg-mist"}`}>{t.label}</Link>
        ))}
      </nav>
      <div className="mt-4">
        {(data ?? []).length === 0 ? <EmptyState title="Nothing here" body="No sellers in this list right now." /> : (
          <ul className="space-y-2">
            {data!.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/sellers/${s.id}`} className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-navy/15 bg-white p-3 hover:bg-mist">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-navy">{s.business_name}{s.verified && " ✓"}</span>
                    <span className="block truncate text-sm text-muted">{[s.categories?.name, s.campuses?.name].filter(Boolean).join(" · ")}</span>
                    {s.review_reason && active.key === "other" && <span className="block truncate text-xs text-muted">“{s.review_reason}”</span>}
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted">
                    <span className="block font-semibold capitalize text-navy">{s.status}</span>
                    {(s.submitted_at ?? s.created_at) && <time dateTime={s.submitted_at ?? s.created_at}>{shortTime(s.submitted_at ?? s.created_at)}</time>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
