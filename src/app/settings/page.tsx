import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import LowDataToggle from "@/components/LowDataToggle";
import { CampusPicker, NotificationPrefs, ReplayTourButton } from "@/components/SettingsControls";
import { ThemeChooser } from "@/components/ThemeToggle";
import { ButtonLink, PageShell } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { getReference } from "@/lib/browse";
import { createClient } from "@/lib/supabase/server";
import { getLowData } from "@/lib/viewer";

export const metadata = { title: "Settings" };

const ABOUT = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of use" },
  { href: "/seller-guidelines", label: "Seller guidelines" },
  { href: "/how-trust-works", label: "How trust works" },
  { href: "/how-featured-works", label: "How Featured Hustle works" },
  { href: "/growth", label: "Hub Growth corner" },
  { href: "/privacy#contact", label: "Contact" },
];

function Section({ id, icon, title, children }: { id: string; icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20">
      <h2 id={`${id}-h`} className="flex items-center gap-2 font-display text-2xl font-bold text-navy"><Icon name={icon} className="text-royal" />{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function LinkList({ items }: { items: { href: string; label: string }[] }) {
  return (
    <ul className="divide-y divide-navy/10 rounded-xl border border-navy/10 bg-white">
      {items.map((a) => (
        <li key={a.href}>
          <Link href={a.href} className="flex min-h-11 items-center justify-between px-4 py-3 font-medium text-navy hover:bg-mist">
            {a.label}<Icon name="chevron-right" size="md" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function Settings() {
  const [lowData, user, ref] = await Promise.all([getLowData(), getUser(), getReference()]);
  let prefs = { email_new_enquiry: true, email_daily_digest: false };
  let campusId: string | null = null;
  if (user) {
    const supabase = await createClient();
    const [p, n] = await Promise.all([
      supabase.from("profiles").select("campus_id").eq("id", user.id).maybeSingle(),
      supabase.from("notification_prefs").select("email_new_enquiry,email_daily_digest").eq("user_id", user.id).maybeSingle(),
    ]);
    campusId = p.data?.campus_id ?? null;
    if (n.data) prefs = n.data;
  }
  const signInHint = <p className="text-sm text-muted">Sign in to use this. <Link href="/login?next=/settings" className="font-semibold text-royal underline">Sign in</Link></p>;

  return (
    <PageShell title="Settings" width="max-w-xl">
      <nav aria-label="Settings sections" className="-mx-4 mb-6 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <ul className="flex w-max gap-2">
          {[["appearance", "Appearance"], ["data-saver", "Data saver"], ["notifications", "Notifications"], ["location", "Location"], ["help", "Help"], ["privacy", "Privacy & data"], ["about", "About & legal"]].map(([id, label]) => (
            <li key={id}><a href={`#${id}`} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border-2 border-navy/20 px-4 text-sm font-semibold text-navy hover:bg-mist">{label}</a></li>
          ))}
        </ul>
      </nav>

      <div className="space-y-10">
        <Section id="appearance" icon="sun" title="Appearance"><ThemeChooser /></Section>

        <Section id="data-saver" icon="wifi-off" title="Data saver">
          <LowDataToggle initial={lowData} />
          <p className="text-sm text-muted">{user ? "Saved to your account and used on every device you sign in on." : "Saved on this device. Sign in to keep it across devices."}</p>
        </Section>

        <Section id="notifications" icon="bell" title="Notifications">
          {user ? <NotificationPrefs initial={prefs} /> : signInHint}
        </Section>

        <Section id="location" icon="pin" title="Location">
          {user ? <CampusPicker campuses={ref.allCampuses} initial={campusId} /> : signInHint}
        </Section>

        <Section id="help" icon="help" title="Help">
          {user ? <ReplayTourButton /> : signInHint}
          <LinkList items={[{ href: "/faq", label: "Frequently asked questions" }, { href: "/how-trust-works", label: "How trust works" }]} />
        </Section>

        <Section id="privacy" icon="lock" title="Privacy & data">
          {user ? (
            <>
              <p className="text-sm text-muted">Download everything we hold about you, or delete your account.</p>
              <ButtonLink href="/settings/privacy" variant="secondary" className="w-full sm:w-auto">Download my data or delete my account</ButtonLink>
            </>
          ) : signInHint}
        </Section>

        <Section id="about" icon="info" title="About & legal">
          <LinkList items={ABOUT} />
          <p className="text-sm text-muted">Built for the Eduvos Incubation Hub.</p>
        </Section>
      </div>
    </PageShell>
  );
}
