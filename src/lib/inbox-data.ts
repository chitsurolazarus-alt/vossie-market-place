import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { publicImageUrl } from "@/lib/format";

export const THREAD_PAGE = 60;

export type InboxRow = {
  id: string; otherName: string; role: "buyer" | "seller"; listingTitle: string | null; coverUrl: string | null;
  preview: string; lastAt: string; unread: number; mine: boolean;
};

export async function getInbox(userId: string): Promise<InboxRow[]> {
  const supabase = await createClient();
  const { data: convs } = await supabase.from("conversations")
    .select("id,buyer_id,buyer_name,seller_name,listing_title,listing_cover,last_message_at,last_message_preview,last_sender_id")
    .not("last_message_at", "is", null).order("last_message_at", { ascending: false }).limit(100);
  const rows = convs ?? [];
  if (!rows.length) return [];
  const { data: unread } = await supabase.from("messages").select("conversation_id")
    .in("conversation_id", rows.map((r) => r.id)).is("read_at", null).neq("sender_id", userId);
  const counts = new Map<string, number>();
  for (const u of unread ?? []) counts.set(u.conversation_id, (counts.get(u.conversation_id) ?? 0) + 1);
  return rows.map((r) => {
    const role = r.buyer_id === userId ? "buyer" : "seller";
    return {
      id: r.id, role,
      otherName: (role === "buyer" ? r.seller_name : r.buyer_name) ?? "HustleHub user",
      listingTitle: r.listing_title,
      coverUrl: r.listing_cover ? publicImageUrl(r.listing_cover) : null,
      preview: r.last_message_preview ?? "", lastAt: r.last_message_at!, unread: counts.get(r.id) ?? 0,
      mine: r.last_sender_id === userId,
    };
  });
}

/** Unread messages + notifications for the nav badges. Cached per request. */
export const getUnreadCounts = cache(async (): Promise<{ messages: number; notifications: number; userId: string | null }> => {
  const user = await getUser();
  if (!user) return { messages: 0, notifications: 0, userId: null };
  const supabase = await createClient();
  const [m, n] = await Promise.all([
    supabase.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).neq("sender_id", user.id),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null).eq("user_id", user.id),
  ]);
  return { messages: m.count ?? 0, notifications: n.count ?? 0, userId: user.id };
});

export async function signImages(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const supabase = await createClient();
  const { data } = await supabase.storage.from("message-images").createSignedUrls(unique, 3600);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

export async function getThread(id: string, userId: string) {
  const supabase = await createClient();
  const { data: conv } = await supabase.from("conversations").select("*").eq("id", id).maybeSingle();
  if (!conv) return null;
  const [{ data: seller }, { data: enquiry }, { data: msgsDesc }] = await Promise.all([
    supabase.from("seller_profiles").select("id,user_id,slug,business_name,photo_url").eq("id", conv.seller_id).maybeSingle(),
    supabase.from("enquiries").select("*").eq("conversation_id", id).maybeSingle(),
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: false }).limit(THREAD_PAGE),
  ]);
  const messages = (msgsDesc ?? []).slice().reverse();
  const role: "buyer" | "seller" = conv.buyer_id === userId ? "buyer" : "seller";
  const [images, listingRes, quick] = await Promise.all([
    signImages(messages.flatMap((m) => (m.image_path ? [m.image_path] : []))),
    conv.listing_id
      ? supabase.from("listings").select("id,title,pricing_mode,price_zar,price_is_from,swap_for,availability").eq("id", conv.listing_id).maybeSingle()
      : Promise.resolve({ data: null }),
    role === "seller"
      ? supabase.from("quick_replies").select("id,body").eq("seller_id", conv.seller_id).order("position")
      : Promise.resolve({ data: [] as { id: string; body: string }[] }),
  ]);
  // Listings the viewer could offer in a swap (only sellers have any).
  let myListings: { id: string; title: string }[] = [];
  const swapAllowed = !listingRes.data || listingRes.data.pricing_mode !== "cash";
  if (swapAllowed) myListings = await getMyListingsForSwap(userId, conv.listing_id);
  return {
    conv, seller, enquiry, messages, images, role, listing: listingRes.data,
    quickReplies: quick.data ?? [], myListings, swapAllowed, hasMore: (msgsDesc ?? []).length === THREAD_PAGE,
  };
}

export async function getMyListingsForSwap(userId: string, excludeListingId?: string | null) {
  const supabase = await createClient();
  const { data: mine } = await supabase.from("seller_profiles").select("id").eq("user_id", userId).maybeSingle();
  if (!mine) return [];
  const { data } = await supabase.from("listings").select("id,title").eq("seller_id", mine.id)
    .is("deleted_at", null).eq("availability", "available").order("created_at", { ascending: false }).limit(30);
  return (data ?? []).filter((l) => l.id !== excludeListingId);
}

export type EnquiryRow = {
  id: string; conversationId: string; status: string; source: string; buyerName: string; listingId: string | null;
  listingTitle: string | null; coverUrl: string | null; preview: string; lastAt: string | null; createdAt: string;
  saleHappened: boolean | null; buyerConfirmedAt: string | null; buyerDisputedAt: string | null;
  completionRequestedAt: string | null; autoConfirmed: boolean; firstResponseAt: string | null; unread: number;
};

export async function getSellerEnquiries(sellerId: string, userId: string): Promise<EnquiryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("enquiries")
    .select("id,conversation_id,status,source,listing_id,created_at,sale_happened,buyer_confirmed_at,buyer_disputed_at,completion_requested_at,auto_confirmed,first_response_at,conversations!inner(buyer_name,listing_title,listing_cover,last_message_preview,last_message_at)")
    .eq("seller_id", sellerId).order("created_at", { ascending: false }).limit(400);
  const rows = data ?? [];
  const ids = rows.map((r) => r.conversation_id);
  const unread = new Map<string, number>();
  if (ids.length) {
    const { data: u } = await supabase.from("messages").select("conversation_id").in("conversation_id", ids).is("read_at", null).neq("sender_id", userId);
    for (const m of u ?? []) unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
  }
  return rows.map((r) => {
    const c = r.conversations;
    return {
      id: r.id, conversationId: r.conversation_id, status: r.status, source: r.source, buyerName: c.buyer_name ?? "Student",
      listingId: r.listing_id, listingTitle: c.listing_title, coverUrl: c.listing_cover ? publicImageUrl(c.listing_cover) : null,
      preview: c.last_message_preview ?? "", lastAt: c.last_message_at, createdAt: r.created_at, saleHappened: r.sale_happened,
      buyerConfirmedAt: r.buyer_confirmed_at, buyerDisputedAt: r.buyer_disputed_at, completionRequestedAt: r.completion_requested_at,
      autoConfirmed: r.auto_confirmed, firstResponseAt: r.first_response_at, unread: unread.get(r.conversation_id) ?? 0,
    };
  });
}

export async function getExistingConversationId(userId: string, sellerId: string, listingId: string | null): Promise<string | null> {
  const supabase = await createClient();
  let q = supabase.from("conversations").select("id").eq("buyer_id", userId).eq("seller_id", sellerId);
  q = listingId ? q.eq("listing_id", listingId) : q.is("listing_id", null);
  const { data } = await q.maybeSingle();
  return data?.id ?? null;
}
