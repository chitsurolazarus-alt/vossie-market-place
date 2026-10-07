import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BookingForm, RsvpButton } from "@/components/growth/PostActions";
import { getUser } from "@/lib/auth";
import { dateTimeSA, hubCoverUrl } from "@/lib/format";
import { getHubPost, KIND_LABEL } from "@/lib/hub";
import { Markdown } from "@/lib/markdown";
import { getProfile } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

import Icon from "@/components/Icon";
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return { title: "Hub Growth corner" };
  const p = await getHubPost(id);
  return { title: p?.title ?? "Hub Growth corner", description: p ? p.body.replace(/[#*[\]()]/g, "").slice(0, 150) : undefined };
}

export default async function GrowthPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [post, user, profile] = await Promise.all([getHubPost(id), getUser(), getProfile()]);
  if (!post) notFound();
  const supabase = await createClient();
  const [rsvp, booking] = await Promise.all([
    user && post.kind === "event" ? supabase.from("hub_rsvps").select("post_id").eq("post_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user && post.kind === "office_hours" ? supabase.from("hub_bookings").select("status,host_note").eq("post_id", id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const canEdit = !!user && (profile?.role === "admin" || post.author_id === user.id) && (profile?.role === "admin" || profile?.role === "mentor");
  const full = post.capacity !== null && post.rsvp_count >= post.capacity;

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/growth" className="inline-flex min-h-11 items-center text-sm font-semibold text-royal underline"><Icon name="arrow-left" size="md" className="mr-1" />Hub Growth corner</Link>
      {post.cover_path && (
        <div className="relative mt-2 aspect-[16/9] overflow-hidden rounded-2xl bg-navy">
          <Image src={hubCoverUrl(post.cover_path)} alt="" fill sizes="(max-width: 768px) 100vw, 768px" quality={70} priority className="object-cover" />
        </div>
      )}
      <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-sand px-3 py-1 font-bold text-navy">{KIND_LABEL[post.kind]}</span>
        <span className="text-muted">{post.campuses?.name ?? "All campuses"}</span>
        {!post.published && <span className="rounded-full bg-red-100 px-3 py-1 font-bold text-red-900">Draft (not public)</span>}
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-navy">{post.title}</h1>
      {(post.event_at || post.venue) && (
        <p className="mt-2 text-lg font-semibold text-ink">{[post.event_at && dateTimeSA(post.event_at), post.venue].filter(Boolean).join(" · ")}</p>
      )}
      {canEdit && <Link href={`/growth/${post.id}/edit`} className="mt-3 inline-flex min-h-11 items-center rounded-lg border-2 border-navy px-4 text-sm font-semibold text-navy hover:bg-mist">Edit post</Link>}
      {post.body && <div className="mt-2"><Markdown source={post.body} /></div>}

      {post.kind === "event" && post.published && (
        <div className="mt-8 rounded-2xl bg-mist p-4">
          <p className="font-semibold text-navy">{post.rsvp_count} going{post.capacity ? ` of ${post.capacity} places` : ""}</p>
          <div className="mt-2"><RsvpButton postId={post.id} going={!!rsvp.data} authed={!!user} full={full} returnTo={`/growth/${post.id}`} /></div>
        </div>
      )}
      {post.kind === "office_hours" && post.published && (
        <div className="mt-8 rounded-2xl bg-mist p-4">
          <h2 className="font-display text-xl font-bold text-navy">Book a slot</h2>
          <div className="mt-2"><BookingForm postId={post.id} authed={!!user} returnTo={`/growth/${post.id}`} existing={booking.data} /></div>
        </div>
      )}
    </article>
  );
}
