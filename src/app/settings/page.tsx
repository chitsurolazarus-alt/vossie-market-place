import Link from "next/link";
import LowDataToggle from "@/components/LowDataToggle";
import { ThemeChooser } from "@/components/ThemeToggle";
import { ButtonLink, PageShell } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { getLowData } from "@/lib/viewer";

const ABOUT = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of use" },
  { href: "/seller-guidelines", label: "Seller guidelines" },
  { href: "/how-trust-works", label: "How trust works" },
  { href: "/how-featured-works", label: "How Featured Hustle works" },
  { href: "/growth", label: "Hub Growth corner" },
  { href: "/privacy#contact", label: "Contact" },
];

export const metadata = { title: "Settings" };

export default async function Settings() {
  const [lowData, user] = await Promise.all([getLowData(), getUser()]);
  return (
    <PageShell title="Settings" width="max-w-xl">
      <div className="space-y-4">
        <ThemeChooser />
        <LowDataToggle initial={lowData} variant="settings" />
        <p className="text-sm text-muted">
          {user ? "This is saved to your account and works on every device you sign in on." : "Saved on this device. Sign in to keep it across devices."}
        </p>
        {user && <ButtonLink href="/settings/privacy" variant="secondary">Privacy and my data</ButtonLink>}
        {user
          ? <ButtonLink href="/account" variant="secondary">Account</ButtonLink>
          : <ButtonLink href="/login?next=/settings" variant="secondary">Sign in</ButtonLink>}
      </div>
      <section aria-labelledby="about-h" className="mt-10">
        <h2 id="about-h" className="font-display text-2xl font-bold text-navy">About &amp; legal</h2>
        <ul className="mt-3 divide-y divide-navy/10 rounded-xl border border-navy/10 bg-white">
          {ABOUT.map((a) => (
            <li key={a.href}>
              <Link href={a.href} className="flex min-h-11 items-center justify-between px-4 py-3 font-medium text-navy hover:bg-mist">{a.label}</Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">Built for the Eduvos Incubation Hub.</p>
      </section>
    </PageShell>
  );
}
