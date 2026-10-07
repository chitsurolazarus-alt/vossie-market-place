import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import MentorPanel from "@/components/admin/MentorPanel";
import { TrustBadge } from "@/components/trust";
import { shortTime } from "@/lib/messages";
import { getSellerStats, supportFlags } from "@/lib/mentor";
import { requireStaff } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getTierLabels } from "@/lib/trust";
import { REPLY_BAND_LABEL } from "@/lib/trust-shared";

import Verified from "@/components/Verified";
import Icon from "@/components/Icon";
export const metadata = { title: "Seller (mentor view)", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MentorSeller({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { user, profile } = await requireStaff(`/mentor/${id}`);
  // RLS: an unassigned seller simply isn't returned to a mentor, so they get a 404.
  const [stats, labels] = await Promise.all([getSellerStats(id), getTierLabels()]);
  const s = stats[0];
  if (!s) notFound();
  const supabase = await createClient();
  const [{ data: notes }, { data: checkins }, { data: listings }] = await Promise.all([
    supabase.from("mentor_notes").select("id,body,created_at,mentor_id").eq("seller_id", id).order("created_at", { ascending: false }),
    supabase.from("mentor_checkins").select("id,note,checked_in_at").eq("seller_id", id).order("checked_in_at", { ascending: false }).limit(30),
    supabase.from("listings").select("id,title,availability,hidden_by_moderation,updated_at").eq("seller_id", id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(10),
  ]);
  const flags = supportFlags(s);
  const tiles: [string, string][] = [
    ["In-app enquiries (30d)", String(s.enquiries_30d)], ["WhatsApp handoffs (30d)", String(s.whatsapp_30d)],
    ["Response rate", s.response_rate === null ? "n/a" : `${Math.round(s.response_rate * 100)}%`],
    ["Reply time", s.reply_band ? REPLY_BAND_LABEL[s.reply_band as keyof typeof REPLY_BAND_LABEL] : "Not enough data"],
    ["Confirmed sales", String(s.confirmed_sales)], ["Listing views (30d)", String(s.listing_views_30d)],
    ["Last active", s.last_active_at ? `${shortTime(s.last_active_at)} ago` : "Not seen yet"],
  ];

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/mentor" className="inline-flex min-h-11 items-center text-sm font-semibold text-royal underline"><Icon name="arrow-left" size="md" className="mr-1" />All sellers</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-navy">{s.business_name}{s.verified && <Verified />}</h1>
        <TrustBadge tier={s.tier} label={labels[s.tier]} />
      </div>
      <p className="text-muted">{s.campus} · <Link href={`/s/${s.slug}`} className="font-semibold text-royal underline">public profile</Link></p>
      {flags.length > 0 && (
        <div role="note" className="mt-4 rounded-xl border-l-4 border-amber-700 bg-amber-50 p-4">
          <p className="font-semibold text-amber-950">May need support</p>
          <ul className="mt-1 list-disc pl-5 text-amber-950">{flags.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-mist p-3"><dd className="font-display text-xl font-bold text-navy">{v}</dd><dt className="text-xs text-muted">{k}</dt></div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">Numbers only. Mentors cannot read any messages between sellers and buyers.</p>

      <h2 className="mt-8 font-display text-xl font-bold text-navy">Recent listings</h2>
      <ul className="mt-2 divide-y divide-navy/10 rounded-xl border border-navy/15 bg-white">
        {(listings ?? []).length === 0 && <li className="p-4 text-muted">No active listings.</li>}
        {(listings ?? []).map((l) => (
          <li key={l.id} className="flex min-h-12 items-center justify-between gap-2 px-4 py-2">
            <span className="min-w-0 truncate text-navy">{l.title}</span>
            <span className="shrink-0 text-xs text-muted">{l.hidden_by_moderation ? "Hidden · " : ""}{l.availability.replace("_", " ")} · updated {shortTime(l.updated_at)} ago</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <MentorPanel sellerId={id} canWrite={profile.role === "mentor"}
          notes={(notes ?? []).map((n) => ({ id: n.id, body: n.body, created_at: n.created_at, mine: n.mentor_id === user.id }))}
          checkins={checkins ?? []} />
      </div>
    </section>
  );
}
