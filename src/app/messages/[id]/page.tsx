import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import LiveRefresh from "@/components/messages/LiveRefresh";
import PaymentPanel from "@/components/messages/PaymentPanel";
import Thread from "@/components/messages/Thread";
import { requireUser } from "@/lib/auth";
import { priceLabel, publicImageUrl } from "@/lib/format";
import { getThread } from "@/lib/inbox-data";

import Icon from "@/components/Icon";
export const metadata = { title: "Conversation" };
export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/messages/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  // RLS hides conversations the viewer isn't part of, so a stranger gets a plain 404.
  const t = await getThread(id, user.id);
  if (!t || !t.enquiry) notFound();
  const { conv, role } = t;
  const otherName = (role === "buyer" ? conv.seller_name : conv.buyer_name) ?? "HustleHub user";

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 pt-3">
        <Link href={role === "seller" ? "/sell/enquiries" : "/messages"} className="inline-flex min-h-11 items-center text-sm font-semibold text-royal underline">
          <Icon name="arrow-left" size="md" className="mr-1" />{role === "seller" ? "Enquiries" : "All messages"}
        </Link>
      </div>
      <LiveRefresh tables={["payment_requests"]} channel={`pay-${conv.id}`} />
      <PaymentPanel conversationId={conv.id} role={role} listingId={t.listing?.id ?? null} />
      <Thread
        conversationId={conv.id} meId={user.id} otherUserId={role === "buyer" ? t.seller?.user_id ?? null : conv.buyer_id} role={role} otherName={otherName} sellerSlug={t.seller?.slug ?? null}
        listing={t.listing ? { id: t.listing.id, title: t.listing.title, price: priceLabel(t.listing), availability: t.listing.availability } : null}
        listingTitle={conv.listing_title} coverUrl={conv.listing_cover ? publicImageUrl(conv.listing_cover) : null} source={t.enquiry.source}
        initialMessages={t.messages} images={t.images} hasMore={t.hasMore}
        initialEnquiry={{
          id: t.enquiry.id, status: t.enquiry.status, sale_happened: t.enquiry.sale_happened, completion_requested_at: t.enquiry.completion_requested_at,
          buyer_confirmed_at: t.enquiry.buyer_confirmed_at, buyer_disputed_at: t.enquiry.buyer_disputed_at, auto_confirmed: t.enquiry.auto_confirmed,
        }}
        quickReplies={t.quickReplies} myListings={t.myListings} swapAllowed={t.swapAllowed}
      />
    </>
  );
}
