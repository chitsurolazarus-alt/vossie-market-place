import Image from "next/image";
import Link from "next/link";
import CoachTour from "@/components/CoachTour";
import { MESSAGES_TOUR } from "@/lib/tours";
import LiveRefresh from "@/components/messages/LiveRefresh";
import { ButtonLink, EmptyState, PageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getInbox } from "@/lib/inbox-data";
import { shortTime } from "@/lib/messages";

export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default async function Inbox() {
  const user = await requireUser("/messages");
  const rows = await getInbox(user.id);

  return (
    <PageShell title="Messages" intro="Your enquiries with buyers and sellers." width="max-w-2xl">
      <LiveRefresh tables={["messages", "conversations"]} channel="inbox" />
      <CoachTour id="messages" label="Messages tour" steps={MESSAGES_TOUR} />
      {rows.length === 0 ? (
        <EmptyState title="No messages yet" body="When you message a seller, or a buyer messages you, the conversation shows up here."
          action={<ButtonLink href="/browse" variant="sand">Browse hustles</ButtonLink>} />
      ) : (
        <ul data-tour="inbox" className="divide-y divide-navy/10 overflow-hidden rounded-2xl border border-navy/15 bg-white">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/messages/${r.id}`} className="flex min-h-[4.5rem] items-center gap-3 p-3 hover:bg-mist">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-mist">
                  {r.coverUrl && <Image src={r.coverUrl} alt="" fill sizes="56px" quality={50} className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`truncate ${r.unread ? "font-bold" : "font-semibold"} text-navy`}>{r.otherName}</p>
                    <time dateTime={r.lastAt} className="shrink-0 text-xs text-muted">{shortTime(r.lastAt)}</time>
                  </div>
                  <p className="truncate text-xs text-muted">{r.listingTitle ?? "General enquiry"}{r.role === "seller" ? " · buyer" : ""}</p>
                  <p className={`truncate text-sm ${r.unread ? "font-semibold text-ink" : "text-muted"}`}>{r.mine && "You: "}{r.preview}</p>
                </div>
                {r.unread > 0 && (
                  <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-royal px-1.5 text-xs font-bold text-white">
                    {r.unread > 99 ? "99+" : r.unread}<span className="sr-only"> unread</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
