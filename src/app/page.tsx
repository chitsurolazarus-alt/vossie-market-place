import Link from "next/link";

const PILLARS = [
  ["Buy local", "Food, beauty, tutoring, design and more, all from fellow students."],
  ["Swap skills", "Trade a service for a service when cash is tight."],
  ["Safe handovers", "Meet at campus pickup points, never at home."],
];

export default function Home() {
  return (
    <>
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="inline-block bg-sand text-navy text-sm font-semibold px-3 py-1 rounded-full">Eduvos Incubation Hub</p>
          <h1 className="font-display mt-4 text-4xl sm:text-5xl font-bold max-w-2xl">Student hustles. Campus customers.</h1>
          <p className="mt-4 text-lg text-white/90 max-w-xl">
            Discover products and services from Eduvos student entrepreneurs, or start selling your own.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link href="/browse" className="min-h-12 inline-flex items-center justify-center rounded-lg bg-sand text-navy font-semibold px-6 hover:brightness-95">Browse hustles</Link>
            <Link href="/account" className="min-h-12 inline-flex items-center justify-center rounded-lg border-2 border-white text-white font-semibold px-6 hover:bg-white/10">Start selling</Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-12 grid gap-6 sm:grid-cols-3">
        {PILLARS.map(([t, d]) => (
          <div key={t} className="rounded-xl bg-mist p-6">
            <h2 className="font-display text-xl font-bold text-navy">{t}</h2>
            <p className="mt-2 text-muted">{d}</p>
          </div>
        ))}
      </section>
    </>
  );
}
