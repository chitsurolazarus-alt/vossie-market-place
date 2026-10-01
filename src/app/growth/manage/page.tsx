import Link from "next/link";
import { BookingAnswer } from "@/components/growth/PostActions";
import { EmptyState } from "@/components/ui";
import { shortTime } from "@/lib/messages";
import { KIND_LABEL } from "@/lib/hub";
import { requireStaff } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Manage Hub posts", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ManageHub() {
  const { user, profile } = await requireStaff("/growth/manage");
  const supabase = await createClient();
  let posts = supabase.from("hub_posts").select("id,kind,title,published,rsvp_count,event_at,created_at").order("created_at", { ascending: false }).limit(50);
  if (profile.role !== "admin") posts = posts.eq("author_id", user.id);
  const [{ data: mine }, { data: bookings }] = await Promise.all([
    posts,
    supabase.from("hub_bookings").select("id,message,status,host_note,created_at,user_id,hub_posts(id,title,author_id)").eq("status", "requested").order("created_at"),
  ]);
  const requests = (bookings ?? []).filter((b) => b.hub_posts && (profile.role === "admin" || b.hub_posts.author_id === user.id));
  const ids = [...new Set(requests.map((b) => b.user_id))];
  const { data: names } = ids.length ? await supabase.from("profiles").select("id,display_name").in("id", ids) : { data: [] };
  const name = new Map((names ?? []).map((p) => [p.id, p.display_name ?? "A seller"]));

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/growth" className="inline-flex min-h-11 items-center text-sm font-semibold text-royal underline">← Hub Growth corner</Link>
      <h1 className="font-display text-3xl font-bold text-navy">Manage Hub posts</h1>

      <h2 className="mt-6 font-display text-xl font-bold text-navy">Office-hours requests ({requests.length})</h2>
      {requests.length === 0 ? <p className="mt-2 rounded-xl bg-mist p-4 text-muted">No requests waiting.</p> : (
        <ul className="mt-2 space-y-3">
          {requests.map((b) => (
            <li key={b.id} className="rounded-2xl border border-navy/15 bg-white p-4">
              <p className="font-semibold text-navy">{name.get(b.user_id)} <span className="font-normal text-muted">· {shortTime(b.created_at)} ago</span></p>
              <p className="text-sm text-muted">For: {b.hub_posts?.title}</p>
              {b.message && <p className="mt-1 text-ink">“{b.message}”</p>}
              <BookingAnswer bookingId={b.id} />
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 font-display text-xl font-bold text-navy">{profile.role === "admin" ? "All posts" : "Your posts"}</h2>
      {(mine ?? []).length === 0 ? <div className="mt-2"><EmptyState title="No posts yet" body="Share a tip, an event or your office hours." /></div> : (
        <ul className="mt-2 divide-y divide-navy/10 rounded-xl border border-navy/15 bg-white">
          {mine!.map((p) => (
            <li key={p.id}>
              <Link href={`/growth/${p.id}/edit`} className="flex min-h-14 items-center justify-between gap-2 px-4 py-2 hover:bg-mist">
                <span className="min-w-0"><span className="block truncate font-semibold text-navy">{p.title}</span><span className="block text-xs text-muted">{KIND_LABEL[p.kind]}{p.kind === "event" ? ` · ${p.rsvp_count} going` : ""}</span></span>
                {!p.published && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-900">Draft</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
