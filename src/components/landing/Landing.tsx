import Image from "next/image";
import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import { ButtonLink, inputCls } from "@/components/ui";
import type { Tile } from "@/lib/browse";
import { priceLabel, publicImageUrl } from "@/lib/format";
import type { LandingStats } from "@/lib/landing";

type Campus = { id: string; name: string; slug: string; province: string; active: boolean };

/** Signed-out hero: big type, solid blocks and three live listings so the page proves the marketplace is real. */
export function LandingHero({ tiles, campuses, campus }: { tiles: Tile[]; campuses: Campus[]; campus?: string }) {
  const live = campuses.filter((c) => c.active);
  // Real photos first; generated tiles only fill the gaps.
  const withImage = tiles.filter((t) => t.cover_path);
  const shown = [...withImage.filter((t) => t.cover_path!.includes("-photo")), ...withImage.filter((t) => !t.cover_path!.includes("-photo"))].slice(0, 3);
  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-royal" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-32 rotate-12 rounded-2xl bg-sand/90" />
      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="inline-block rounded-full bg-sand px-3 py-1 text-sm font-semibold text-navy">Eduvos Incubation Hub</p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold leading-[1.1] sm:text-6xl">Student hustles. Nationwide.</h1>
          <p className="mt-4 max-w-xl text-lg text-white/90">Buy food, hair, tutoring, design and more from students on your campus. Or turn your own hustle into a business, free.</p>
          <form action="/browse" method="get" role="search" className="mt-6 flex max-w-xl gap-2">
            <label htmlFor="home-q" className="sr-only">Search HustleHub</label>
            <input id="home-q" name="q" type="search" enterKeyHint="search" placeholder="Try braids, logo, kota…" className={`${inputCls} border-white`} />
            <button type="submit" className="min-h-11 shrink-0 rounded-lg bg-sand px-5 font-semibold text-navy hover:brightness-95">Search</button>
          </form>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/browse" variant="sand">Browse hustles</ButtonLink>
            <Link href="/sell" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-white px-5 font-semibold text-white transition-colors hover:bg-white/10">
              Start selling<Icon name="arrow-right" size="md" />
            </Link>
          </div>
          <nav aria-label="Campus" className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-white/80">Campus:</span>
            {[{ slug: "", name: "All" }, ...live].map((c) => (
              <Link key={c.slug || "all"} href={c.slug ? `/?campus=${c.slug}` : "/"} aria-current={(campus ?? "") === c.slug ? "true" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 font-semibold ${(campus ?? "") === c.slug ? "border-sand bg-sand text-navy" : "border-white/50 text-white hover:bg-white/10"}`}>
                {c.name.replace("Eduvos ", "")}
              </Link>
            ))}
          </nav>
        </div>

        {shown.length > 0 && (
          <ul aria-label="Live on HustleHub now" className="grid grid-cols-3 gap-3 lg:block lg:h-[26rem] lg:space-y-0 lg:[&>li]:absolute lg:[&>li]:w-44 lg:relative">
            {shown.map((t, i) => (
              <li key={t.id} className={["lg:left-4 lg:top-0 lg:-rotate-6", "lg:right-2 lg:top-20 lg:rotate-3", "lg:left-24 lg:top-56 lg:-rotate-2"][i]}>
                <Link href={`/l/${t.id}`} className="block overflow-hidden rounded-xl border-2 border-white bg-white shadow-xl transition-transform hover:-translate-y-1">
                  <div className="relative aspect-square bg-mist lg:aspect-[4/3]">
                    <Image src={publicImageUrl(t.cover_path!)} alt={t.cover_alt ?? t.title} fill sizes="(min-width: 1024px) 176px, 33vw" quality={60} priority={i === 0} className="object-cover" />
                  </div>
                  <div className="p-2 text-navy">
                    <p className="line-clamp-1 text-sm font-semibold">{t.title}</p>
                    <p className="text-sm font-bold">{priceLabel(t)}</p>
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

export function StatsBand({ stats }: { stats: LandingStats }) {
  const items: { n: string; label: string; icon: IconName }[] = [
    { n: String(stats.listings), label: "things for sale", icon: "bag" },
    { n: String(stats.sellers), label: "student sellers", icon: "store" },
    { n: `${stats.campusesLive}/${stats.campusesTotal}`, label: "campuses live", icon: "pin" },
    { n: "R0", label: "to start selling", icon: "money" },
  ];
  return (
    <section aria-label="HustleHub in numbers" className="bg-royal text-white">
      <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 py-6 sm:grid-cols-4">
        {items.map((s) => (
          <li key={s.label} className="flex items-center gap-3 py-2">
            <Icon name={s.icon} size="lg" className="shrink-0 text-sand" />
            <div><p className="font-display text-3xl font-bold leading-none [font-variant-numeric:lining-nums]">{s.n}</p><p className="text-sm text-white/90">{s.label}</p></div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const BUY: { icon: IconName; title: string; body: string }[] = [
  { icon: "search", title: "Find it", body: "Search or browse by category and campus. Every seller is an Eduvos student." },
  { icon: "message", title: "Chat safely", body: "Message in the app or on WhatsApp. Agree the price and how you will meet." },
  { icon: "pin", title: "Meet on campus", body: "Hand over at a public pickup point. Pay in the app or in person." },
];
const SELL: { icon: IconName; title: string; body: string }[] = [
  { icon: "store", title: "Set up in 3 minutes", body: "Make your seller profile. The Incubation Hub team approves it." },
  { icon: "camera", title: "List it", body: "Add photos, a price in rand and your pickup points. Products, services or swaps." },
  { icon: "award", title: "Grow your name", body: "Get paid, earn trust badges and a shot at Featured Hustle." },
];

function Steps({ steps, tone }: { steps: typeof BUY; tone: "light" | "sand" }) {
  return (
    <ol className="mt-4 space-y-4">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-4">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone === "light" ? "bg-navy text-white" : "bg-navy text-sand"}`}>
            <Icon name={s.icon} size="lg" />
          </span>
          <div>
            <h3 className="font-display text-xl font-bold"><span className="sr-only">Step {i + 1}: </span>{s.title}</h3>
            <p className={tone === "light" ? "text-ink" : "text-navy"}>{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-12" aria-labelledby="how-h">
      <h2 id="how-h" className="font-display text-3xl font-bold text-navy">How it works</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
          <p className="inline-flex items-center gap-2 rounded-full bg-mist px-3 py-1 text-sm font-semibold text-navy"><Icon name="bag" size="sm" />Buying</p>
          <Steps steps={BUY} tone="light" />
        </div>
        <div className="rounded-2xl bg-sand p-6 text-navy">
          <p className="inline-flex items-center gap-2 rounded-full bg-navy px-3 py-1 text-sm font-semibold text-white"><Icon name="rocket" size="sm" />Selling</p>
          <Steps steps={SELL} tone="sand" />
          <div className="mt-5"><ButtonLink href="/sell" variant="primary">Start selling</ButtonLink></div>
        </div>
      </div>
    </section>
  );
}

export function CampusGrid({ campuses }: { campuses: Campus[] }) {
  const provinces = [...new Set(campuses.map((c) => c.province))].sort();
  const liveCount = campuses.filter((c) => c.active).length;
  return (
    <section className="mx-auto max-w-6xl px-4 pt-12" aria-labelledby="campuses-h">
      <h2 id="campuses-h" className="font-display text-3xl font-bold text-navy">One hub, every campus</h2>
      <p className="mt-2 max-w-2xl text-ink">{liveCount} of {campuses.length} Eduvos campuses are live. The rest open as soon as students there start listing.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {provinces.map((p) => (
          <li key={p} className="rounded-xl border border-navy/10 bg-white p-4 shadow-sm">
            <h3 className="font-display text-lg font-bold text-navy">{p}</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {campuses.filter((c) => c.province === p).map((c) => c.active ? (
                <li key={c.id}>
                  <Link href={`/browse?campus=${c.slug}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-navy px-4 text-sm font-semibold text-white hover:bg-royal">
                    <Icon name="check-circle" size="sm" />{c.name.replace("Eduvos ", "")}<span className="sr-only"> (live)</span>
                  </Link>
                </li>
              ) : (
                <li key={c.id} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-dashed border-navy/30 px-4 text-sm font-medium text-muted">
                  <Icon name="clock" size="sm" />{c.name.replace("Eduvos ", "")}<span className="sr-only"> (coming soon)</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">Dashed campuses are coming soon. <Link href="/privacy#contact" className="font-semibold text-royal underline">Tell the team you want yours next.</Link></p>
    </section>
  );
}

const TRUST: { icon: IconName; title: string; body: string }[] = [
  { icon: "shield", title: "Safe by design", body: "Public pickup points only. We never show home addresses or phone numbers." },
  { icon: "check-circle", title: "Earned trust", body: "Badges come from real confirmed sales and reply times. Sellers can't edit them." },
  { icon: "wifi-off", title: "Light on data", body: "Data saver mode keeps photos small and pages quick on a tight budget." },
];

export function TrustStrip() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-12" aria-labelledby="trust-h">
      <h2 id="trust-h" className="sr-only">Why students trust HustleHub</h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {TRUST.map((t) => (
          <li key={t.title} className="rounded-xl bg-mist p-5">
            <Icon name={t.icon} size="lg" className="text-royal" />
            <h3 className="mt-2 font-display text-lg font-bold text-navy">{t.title}</h3>
            <p className="text-ink">{t.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="cta-h">
      <div className="relative overflow-hidden rounded-2xl bg-navy p-8 text-white sm:p-12">
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-royal" />
        <div className="relative max-w-xl">
          <h2 id="cta-h" className="font-display text-3xl font-bold sm:text-4xl">Got a hustle? Put it on the map.</h2>
          <p className="mt-2 text-white/90">Sign in with your Eduvos email and start in minutes. It costs nothing.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/sell" variant="sand">Start selling</ButtonLink>
            <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-lg border-2 border-white px-5 font-semibold text-white transition-colors hover:bg-white/10">Sign in</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
