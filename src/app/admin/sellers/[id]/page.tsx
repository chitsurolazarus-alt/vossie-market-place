import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import SellerReview from "@/components/admin/SellerReview";
import { TrustBadge } from "@/components/trust";
import { memberSince } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import Verified from "@/components/Verified";
import Icon from "@/components/Icon";
export const metadata = { title: "Review seller" };

export default async function AdminSellerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: s } = await supabase.from("seller_profiles")
    .select("*, campuses(name), categories(name), seller_pickup_points(pickup_points(name))").eq("id", id).maybeSingle();
  if (!s) notFound();
  const [{ data: owner }, { data: mentors }, { data: listings }, { data: trust }] = await Promise.all([
    s.user_id ? supabase.from("profiles").select("display_name,email,created_at").eq("id", s.user_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id,display_name,email").eq("role", "mentor"),
    supabase.from("listings").select("id,title,availability,hidden_by_moderation,deleted_at").eq("seller_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(20),
    supabase.from("seller_trust").select("tier,confirmed_sales,response_rate,enquiries_30d").eq("seller_id", id).maybeSingle(),
  ]);
  const pickups = (s.seller_pickup_points ?? []).map((p) => p.pickup_points?.name).filter(Boolean);

  return (
    <div>
      <Link href="/admin/sellers" className="inline-flex min-h-11 items-center text-sm font-semibold text-royal underline"><Icon name="arrow-left" size="md" className="mr-1" />All sellers</Link>
      <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="det-h" className="rounded-2xl border border-navy/15 bg-white p-4">
          <div className="flex items-center gap-3">
            {s.photo_url
              ? <Image src={s.photo_url} alt={`${s.business_name} profile photo`} width={72} height={72} className="h-[72px] w-[72px] rounded-xl object-cover" />
              : <div aria-hidden="true" className="flex h-[72px] w-[72px] items-center justify-center rounded-xl bg-sand font-display text-3xl font-bold text-navy">{s.business_name.slice(0, 1)}</div>}
            <div className="min-w-0">
              <h2 id="det-h" className="font-display text-2xl font-bold text-navy">{s.business_name}</h2>
              <p className="text-sm text-muted capitalize">Status: <strong className="text-navy">{s.status}</strong>{s.verified && <> · <Verified /> Verified</>}</p>
              {s.status === "approved" && <div className="mt-1"><TrustBadge tier={trust?.tier} size="sm" /></div>}
            </div>
          </div>
          {s.tagline && <p className="mt-3 text-lg text-ink">{s.tagline}</p>}
          {s.bio && <p className="mt-2 whitespace-pre-line text-ink">{s.bio}</p>}
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Owner</dt><dd className="font-medium text-navy">{owner?.display_name ?? "Deleted user"}{owner?.email && <span className="text-muted"> · {owner.email}</span>}</dd>
            <dt className="text-muted">Category</dt><dd className="font-medium text-navy">{s.categories?.name ?? "None"}</dd>
            <dt className="text-muted">Campus</dt><dd className="font-medium text-navy">{s.campuses?.name}</dd>
            <dt className="text-muted">Pickup points</dt><dd className="font-medium text-navy">{pickups.join(", ") || "None"}</dd>
            <dt className="text-muted">Contact</dt><dd className="font-medium text-navy capitalize">{s.contact_pref.replace("_", " ")}</dd>
            <dt className="text-muted">Profile link</dt><dd className="font-medium text-navy break-all">/s/{s.slug}</dd>
            <dt className="text-muted">Submitted</dt><dd className="font-medium text-navy">{s.submitted_at ? memberSince(s.submitted_at) : "Not yet"}</dd>
            {s.review_reason && <><dt className="text-muted">Last reason</dt><dd className="font-medium text-navy">{s.review_reason}</dd></>}
          </dl>
          <h3 className="mt-5 font-display text-lg font-bold text-navy">Listings ({listings?.length ?? 0})</h3>
          {(listings ?? []).length === 0 ? <p className="mt-1 text-sm text-muted">No listings yet.</p> : (
            <ul className="mt-1 space-y-1">
              {listings!.map((l) => (
                <li key={l.id}><Link href={`/l/${l.id}`} className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 text-ink hover:bg-mist">
                  <span className="truncate">{l.title}</span>
                  {l.hidden_by_moderation && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-900">Hidden</span>}
                </Link></li>
              ))}
            </ul>
          )}
          {s.status === "approved" && <Link href={`/s/${s.slug}`} className="mt-3 inline-flex min-h-11 items-center font-semibold text-royal underline">View public profile</Link>}
        </section>
        <SellerReview sellerId={s.id} status={s.status} verified={s.verified} mentorId={s.mentor_id}
          mentors={(mentors ?? []).map((m) => ({ id: m.id, name: m.display_name ?? m.email ?? "Mentor" }))} />
      </div>
    </div>
  );
}
