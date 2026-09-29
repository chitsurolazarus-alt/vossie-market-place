import { PageShell } from "@/components/ui";

export const metadata = {
  title: "How Featured Hustles are chosen",
  description: "The fair, rotating rules behind Vossie's Featured Hustle slots.",
};

const STEPS: [string, string][] = [
  ["Every campus gets 4 slots a day", "A scheduled job runs each night (02:05 South African time) and fills the Featured Hustle slots for every campus, so each campus is spotlighted fairly."],
  ["Only real, active sellers qualify", "A seller must be approved by the Incubation Hub team and have at least one available listing. Paused, sold-out or hidden listings don't count."],
  ["No repeats within a week", "If you were featured in the last 7 days, you sit out. That gives every seller a turn before anyone appears twice."],
  ["Quieter shops get a better chance", "Each seller gets a weight based on how many views their listings had in the last 14 days. The fewer views, the higher the weight: 0 views is 1.0, 10 views is 0.5, 30 views is 0.25. It's a weighted lucky draw, not a ranking, so busy sellers still have a chance."],
  ["New sellers get a welcome boost", "For the first 14 days after approval, a seller's weight is doubled so newcomers are seen quickly."],
  ["Staff can pin a slot", "Incubation Hub staff can override a slot, for example to celebrate an event. Pinned slots are marked in our records and they reduce the number of drawn slots that day."],
  ["Everything is recorded", "Each day's line-up is stored, so we can always show who was featured and when."],
];

export default function HowFeaturedWorks() {
  return (
    <PageShell title="How Featured Hustles are chosen" intro="Fair by design: nobody buys a spot, and quieter sellers get a boost." width="max-w-2xl">
      <ol className="space-y-4">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="rounded-xl bg-mist p-5">
            <h2 className="font-display text-lg font-bold text-navy">{i + 1}. {t}</h2>
            <p className="mt-1 text-ink">{d}</p>
          </li>
        ))}
      </ol>
      <p className="mt-6 rounded-xl border-l-4 border-royal bg-blue-50 p-4 text-navy">
        In short: <strong>eligible sellers are drawn at random, with lower-view and brand-new sellers more likely to be picked, and no one repeats within 7 days.</strong>
      </p>
    </PageShell>
  );
}
