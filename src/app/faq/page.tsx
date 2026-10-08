import Link from "next/link";
import Icon from "@/components/Icon";
import { PageShell } from "@/components/ui";

export const metadata = { title: "FAQ", description: "Answers to common questions about buying and selling on HustleHub." };

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: "Who can sell on HustleHub?", a: "Eduvos students and staff with an allowed Eduvos email. You set up a seller profile (about 3 minutes) and the Incubation Hub team approves it before your listings go public." },
  { q: "How do I buy something?", a: "Browse or search, open a listing and message the seller in the app or on WhatsApp. Agree the details, then meet at a campus pickup point. Never go to someone's home." },
  { q: "Can I swap instead of paying?", a: "Yes. Sellers can accept cash, swaps or both. Swap listings never ask for payment." },
  { q: "How do payments work?", a: "Paying in the app is optional. Once you and the seller agree the price and handover, the seller sends a payment request in the conversation and you pay it there. While HustleHub is in test mode the payment is simulated and no real money moves. Hand-over still happens in public, and you confirm in the chat once you have your order." },
  { q: "What do the trust badges mean?", a: <>They are worked out by the system from what sellers actually do (confirmed sales, reply times, how long they have been here). Sellers cannot edit them. <Link href="/how-trust-works" className="font-semibold text-royal underline">How trust works</Link></> },
  { q: "What is the Featured Hustle?", a: <>A fair, rotating spotlight on student sellers. <Link href="/how-featured-works" className="font-semibold text-royal underline">How Featured Hustle works</Link></> },
  { q: "How do I stay safe?", a: "Meet in public campus spots, keep chatting inside HustleHub, and never share card numbers, PINs or your home address. If something feels wrong, use the Report button and the team will look at it." },
  { q: "Is my WhatsApp number public?", a: "No. It is never put on a web page. Signed-in buyers are sent to WhatsApp through a redirect, and HustleHub only records that a handoff happened, not what was said." },
  { q: "How do I save data?", a: <>Turn on Data saver in <Link href="/settings#data-saver" className="font-semibold text-royal underline">Settings</Link>. Photos get smaller, animations stop and photos below the fold load only when you tap.</> },
  { q: "How do I delete my account or download my data?", a: <>Go to <Link href="/settings#privacy" className="font-semibold text-royal underline">Settings, Privacy &amp; data</Link>. Your personal details are removed straight away.</> },
  { q: "I found a problem or have a question.", a: <>Use the contact details in the <Link href="/privacy#contact" className="font-semibold text-royal underline">privacy policy</Link>, or tell your Incubation Hub mentor.</> },
];

export default function Faq() {
  return (
    <PageShell title="Frequently asked questions" intro="Quick answers about buying and selling on HustleHub." width="max-w-2xl">
      <ul className="divide-y divide-navy/10 rounded-xl border border-navy/10 bg-white">
        {FAQ.map((f) => (
          <li key={f.q}>
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-navy hover:bg-mist [&::-webkit-details-marker]:hidden">
                {f.q}
                <Icon name="chevron-down" size="md" className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-4 text-ink">{f.a}</div>
            </details>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
