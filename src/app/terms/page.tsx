import { PageShell } from "@/components/ui";

export const metadata = { title: "Terms of use", description: "The rules for using HustleHub as a buyer or a student seller." };

const TERMS = [
  ["Who can use HustleHub", "Students and staff with an allowed Eduvos email can sign up. Sellers must be approved before their listings appear."],
  ["Your listings and messages", "Only list things you are allowed to sell. Be honest about price, condition and delivery. Do not post illegal, unsafe or misleading items."],
  ["Meeting and delivery", "Meet at public campus pickup points. Never share your home address. Delivery and payment terms are shown before you confirm."],
  ["Reports and moderation", "Anyone can report a listing or a user. The Incubation Hub team may hide content, suspend or remove accounts that break these rules or the seller guidelines."],
  ["Your data", "We handle your personal information as set out in the privacy policy, in line with POPIA."],
  ["Changes", "We may update these terms. If a change matters to you, we will tell you in the app."],
];

export default function Terms() {
  return (
    <PageShell title="Terms of use" intro="The short version of the rules that keep HustleHub safe and fair." width="max-w-3xl">
      <div className="space-y-6">
        {TERMS.map(([h, b]) => (
          <section key={h}>
            <h2 className="font-display text-xl font-bold text-navy">{h}</h2>
            <p className="mt-1 text-ink">{b}</p>
          </section>
        ))}
        <p className="text-sm text-muted">Draft for the Incubation Hub to review with Eduvos legal before launch.</p>
      </div>
    </PageShell>
  );
}
