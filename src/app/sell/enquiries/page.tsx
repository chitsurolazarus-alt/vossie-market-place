import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import LiveRefresh from "@/components/messages/LiveRefresh";
import QuickReplies from "@/components/sell/QuickReplies";
import StatusActions, { STATUS_LABEL } from "@/components/sell/StatusActions";
import { EmptyState, inputCls, PageShell } from "@/components/ui";
import { getMySeller, requireUser } from "@/lib/auth";
import { getSellerEnquiries, type EnquiryRow } from "@/lib/inbox-data";
import { shortTime } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Enquiries" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "new", label: "New", statuses: ["new"] },
  { key: "progress", label: "In progress", statuses: ["in_progress"] },
  { key: "done", label: "Completed", statuses: ["completed", "declined"] },
] as const;

const isoDaysAgo = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function doneNote(e: EnquiryRow) {
  if (e.status === "declined") return "Declined";
  if (e.saleHappened === false) return "Closed: didn't go ahead";
  if (e.buyerConfirmedAt) return e.autoConfirmed ? "Sale confirmed automatically ✓" : "Sale confirmed by buyer ✓";
  if (e.buyerDisputedAt) return "Buyer says it didn't go ahead";
  return "Waiting for buyer to confirm";
}

export default async function Enquiries({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/sell/enquiries");
  const seller = await getMySeller(user.id);
  if (!seller) redirect("/sell");

  const tab = TABS.find((t) => t.key === one(sp.tab)) ?? TABS[0];
  const listingFilter = one(sp.listing);
  const q = one(sp.q).trim().slice(0, 40).toLowerCase();

  const all = await getSellerEnquiries(seller.id, user.id);
  const listings = [...new Map(all.filter((e) => e.listingId && e.listingTitle).map((e) => [e.listingId!, e.listingTitle!])).entries()];
  const filtered = all.filter((e) => (!listingFilter || e.listingId === listingFilter) && (!q || e.buyerName.toLowerCase().includes(q)));
  const counts = Object.fromEntries(TABS.map((t) => [t.key, filtered.filter((e) => (t.statuses as readonly string[]).includes(e.status)).length]));
  const rows = filtered.filter((e) => (tab.statuses as readonly string[]).includes(e.status));

  const supabase = await createClient();
  const since = isoDaysAgo(30);
  const [{ data: wa }, { data: qr }] = await Promise.all([
    supabase.from("enquiry_events").select("enquiry_id").eq("type", "whatsapp_handoff").gte("created_at", since),
    supabase.from("quick_replies").select("id,body").eq("seller_id", seller.id).order("position"),
  ]);
  const waLeads = new Set((wa ?? []).map((w) => w.enquiry_id)).size;
  const confirmed = all.filter((e) => e.buyerConfirmedAt && e.saleHappened).length;

  const href = (t: string) => {
    const u = new URLSearchParams();
    u.set("tab", t);
    if (listingFilter) u.set("listing", listingFilter);
    if (q) u.set("q", q);
    return `/sell/enquiries?${u}`;
  };

  return (
    <PageShell title="Enquiries" intro="Every buyer message and WhatsApp lead in one place." width="max-w-3xl">
      <LiveRefresh tables={["enquiries", "messages"]} channel="enquiries" />
      <dl className="grid grid-cols-3 gap-3 text-center">
        {[["New", all.filter((e) => e.status === "new").length], ["WhatsApp leads (30 days)", waLeads], ["Confirmed sales", confirmed]].map(([label, n]) => (
          <div key={label as string} className="rounded-xl bg-mist p-3">
            <dd className="font-display text-2xl font-bold text-navy">{n}</dd>
            <dt className="text-xs text-muted">{label}</dt>
          </div>
        ))}
      </dl>

      <nav aria-label="Enquiry status" className="mt-6 flex gap-2">
        {TABS.map((t) => {
          const on = t.key === tab.key;
          return (
            <Link key={t.key} href={href(t.key)} aria-current={on ? "page" : undefined}
              className={`inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-lg border-2 px-2 text-sm font-semibold ${on ? "border-navy bg-navy text-white" : "border-navy/30 text-navy hover:bg-mist"}`}>
              {t.label}
              <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold ${on ? "bg-white text-navy" : "bg-royal text-white"}`}>{counts[t.key]}</span>
            </Link>
          );
        })}
      </nav>

      <form method="get" className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]" role="search">
        <input type="hidden" name="tab" value={tab.key} />
        <div>
          <label htmlFor="f-listing" className="sr-only">Filter by listing</label>
          <select id="f-listing" name="listing" defaultValue={listingFilter} className={inputCls}>
            <option value="">All listings</option>
            {listings.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-q" className="sr-only">Search buyer name</label>
          <input id="f-q" name="q" type="search" defaultValue={q} placeholder="Search buyer name" className={inputCls} />
        </div>
        <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-navy px-5 font-semibold text-white hover:bg-royal">Filter</button>
      </form>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            title={all.length === 0 ? "No enquiries yet" : "Nothing here"}
            body={all.length === 0 ? "When a buyer messages you or taps WhatsApp on one of your listings, it lands here." : "Try another tab or clear your filters."} />
        ) : (
          <ul className="space-y-3">
            {rows.map((e) => (
              <li key={e.id} className="rounded-2xl border border-navy/15 bg-white p-3">
                <div className="flex gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-mist">
                    {e.coverUrl && <Image src={e.coverUrl} alt="" fill sizes="56px" quality={50} className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold text-navy">{e.buyerName}</p>
                      <time dateTime={e.lastAt ?? e.createdAt} className="shrink-0 text-xs text-muted">{shortTime(e.lastAt ?? e.createdAt)}</time>
                    </div>
                    <p className="truncate text-sm text-muted">{e.listingTitle ?? "General enquiry"}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="rounded-full bg-navy px-2 py-0.5 font-bold text-white">{STATUS_LABEL[e.status] ?? e.status}</span>
                      {e.source === "whatsapp" && <span className="rounded-full bg-sand px-2 py-0.5 font-bold text-navy">WhatsApp lead</span>}
                      {e.unread > 0 && <span className="rounded-full bg-royal px-2 py-0.5 font-bold text-white">{e.unread} unread</span>}
                    </p>
                  </div>
                </div>
                {e.preview && <p className="mt-2 line-clamp-2 text-sm text-ink">{e.preview}</p>}
                {tab.key === "done" && <p className="mt-2 text-sm font-medium text-navy">{doneNote(e)}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {e.source === "in_app" || e.lastAt ? (
                    <Link href={`/messages/${e.conversationId}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border-2 border-navy px-4 text-sm font-semibold text-navy hover:bg-mist">Open chat</Link>
                  ) : null}
                  <StatusActions enquiryId={e.id} status={e.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <QuickReplies replies={qr ?? []} />
    </PageShell>
  );
}
