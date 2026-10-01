import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { dateTimeSA, hubCoverUrl } from "@/lib/format";
import { getHubPosts, KIND_LABEL } from "@/lib/hub";
import { getProfile } from "@/lib/roles";
import { getReference } from "@/lib/browse";

export const metadata = { title: "Hub Growth corner", description: "Tips, Incubation Hub events and mentor office hours for student sellers." };
export const dynamic = "force-dynamic";

const TABS = [{ key: "", label: "All" }, { key: "tip", label: "Tips" }, { key: "event", label: "Events" }, { key: "office_hours", label: "Office hours" }];

export default async function Growth({ searchParams }: { searchParams: Promise<{ k?: string; campus?: string }> }) {
  const { k, campus } = await searchParams;
  const kind = TABS.find((t) => t.key === k)?.key ?? "";
  const [ref, profile] = await Promise.all([getReference(), getProfile()]);
  const campusId = ref.campuses.find((c) => c.slug === campus)?.id ?? null;
  const posts = await getHubPosts({ kind: kind || undefined, campusId });
  const staff = profile?.role === "admin" || profile?.role === "mentor";
  const href = (over: { k?: string; campus?: string }) => {
    const u = new URLSearchParams();
    const kk = over.k ?? kind; const cc = over.campus ?? campus ?? "";
    if (kk) u.set("k", kk); if (cc) u.set("campus", cc);
    return `/growth${u.size ? `?${u}` : ""}`;
  };

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Hub Growth corner</h1>
          <p className="mt-1 max-w-xl text-muted">Tips, Incubation Hub events and mentor office hours to help your hustle grow.</p>
        </div>
        {staff && (
          <div className="flex gap-2">
            <Link href="/growth/manage" className="inline-flex min-h-12 items-center rounded-lg border-2 border-navy px-4 font-semibold text-navy hover:bg-mist">Manage</Link>
            <Link href="/growth/new" className="inline-flex min-h-12 items-center rounded-lg bg-sand px-4 font-semibold text-navy hover:brightness-95">+ New post</Link>
          </div>
        )}
      </div>
      <nav aria-label="Post type" className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key || "all"} href={href({ k: t.key })} aria-current={t.key === kind ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border-2 px-4 text-sm font-semibold ${t.key === kind ? "border-navy bg-navy text-white" : "border-navy/30 text-navy hover:bg-mist"}`}>{t.label}</Link>
        ))}
      </nav>
      <nav aria-label="Campus" className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Campus:</span>
        {[{ slug: "", name: "All" }, ...ref.campuses].map((c) => (
          <Link key={c.slug || "all"} href={href({ campus: c.slug })} aria-current={(campus ?? "") === c.slug ? "true" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-3 font-semibold ${(campus ?? "") === c.slug ? "border-sand bg-sand text-navy" : "border-navy/30 text-navy hover:bg-mist"}`}>{c.name.replace("Eduvos ", "")}</Link>
        ))}
      </nav>
      <div className="mt-6">
        {posts.length === 0 ? (
          <EmptyState title="Nothing posted yet" body="The Incubation Hub team will share tips, events and office hours here." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/growth/${p.id}`} className="block h-full overflow-hidden rounded-2xl border border-navy/15 bg-white hover:shadow-md">
                  <div className="relative aspect-[16/9] bg-navy">
                    {p.cover_path
                      ? <Image src={hubCoverUrl(p.cover_path)} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" quality={60} className="object-cover" />
                      : <div aria-hidden="true" className="flex h-full items-center justify-center font-display text-4xl font-bold text-sand">{KIND_LABEL[p.kind]}</div>}
                    <span className="absolute left-2 top-2 rounded bg-sand px-2 py-0.5 text-xs font-bold text-navy">{KIND_LABEL[p.kind]}</span>
                  </div>
                  <div className="p-4">
                    <h2 className="font-display text-lg font-bold leading-snug text-navy">{p.title}</h2>
                    {p.event_at && <p className="mt-1 text-sm font-semibold text-ink">{dateTimeSA(p.event_at)}</p>}
                    <p className="text-sm text-muted">{[p.venue, p.campuses?.name ?? "All campuses"].filter(Boolean).join(" · ")}</p>
                    {p.kind === "event" && <p className="mt-1 text-sm text-muted">{p.rsvp_count} going{p.capacity ? ` · ${p.capacity} places` : ""}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
