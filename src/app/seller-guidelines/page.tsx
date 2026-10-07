import { PageShell } from "@/components/ui";

export const metadata = { title: "Seller guidelines" };

const RULES: [string, string][] = [
  ["Be yourself, be honest", "Only sell what you own or make. Describe items and services accurately, including any flaws, and use your own photos."],
  ["Keep it safe", "Hand over on campus at an approved pickup point, in public and during daylight where possible. Never share your home address or ask buyers for theirs."],
  ["Keep it legal and appropriate", "No alcohol, tobacco, vaping products, medicines, weapons, counterfeit goods, adult content or anything else the law or Eduvos policy prohibits."],
  ["Respect your buyers", "Reply politely and promptly. If you can't deliver, say so early and honestly."],
  ["Price fairly, in rand", "Show clear prices in ZAR. If you accept swaps, say exactly what you'd swap for."],
  ["Protect people's information", "Use buyer details only to complete the sale or swap, in line with POPIA. Never share messages or numbers with others."],
  ["Follow the moderation process", "The Incubation Hub team may hide listings or pause accounts that break these rules. You can appeal by contacting the team."],
];

export default function Guidelines() {
  return (
    <PageShell title="Seller guidelines" intro="HustleHub only works when buyers can trust student sellers. These rules keep it that way.">
      <ol className="space-y-4">
        {RULES.map(([t, d], i) => (
          <li key={t} className="rounded-xl bg-mist p-5">
            <h2 className="font-display text-lg font-bold text-navy">{i + 1}. {t}</h2>
            <p className="mt-1 text-ink">{d}</p>
          </li>
        ))}
      </ol>
    </PageShell>
  );
}
