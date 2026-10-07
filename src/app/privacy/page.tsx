import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Privacy policy", description: "What HustleHub collects, why, who sees it, how long we keep it and how to use your POPIA rights." };
export const dynamic = "force-dynamic";

type Officer = { name?: string; email?: string | null; phone?: string | null; note?: string | null };

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="font-display text-2xl font-bold text-navy">{title}</h2>
      <div className="mt-2 space-y-3 text-ink">{children}</div>
    </section>
  );
}

export default async function Privacy() {
  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("key,value").in("key", ["information_officer", "policy_version"]);
  const officer = (data?.find((r) => r.key === "information_officer")?.value ?? {}) as Officer;
  const version = ((data?.find((r) => r.key === "policy_version")?.value ?? {}) as { version?: string }).version ?? "2026-10";

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-navy">Privacy policy</h1>
      <p className="mt-2 text-muted">Version {version}. In plain language, under South Africa&apos;s Protection of Personal Information Act (POPIA).</p>
      <p role="note" className="mt-4 rounded-xl border-l-4 border-amber-700 bg-amber-50 p-3 text-sm text-amber-950">
        Draft for the Hack Jam. Eduvos should have this reviewed by its legal and information-governance team before a public launch.
      </p>

      <Section id="who" title="Who we are">
        <p>HustleHub is a student marketplace run by the Eduvos Incubation Hub. It connects Eduvos students and staff who sell products and services with buyers on their campus. The Incubation Hub is the &quot;responsible party&quot; under POPIA.</p>
      </Section>

      <Section id="collect" title="What we collect, and why">
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Your account:</strong> your Eduvos email address, name (if you give one), campus and the time you accepted this policy. We need these to sign you in and to keep HustleHub limited to the Eduvos community.</li>
          <li><strong>If you sell:</strong> business name, tagline, bio, profile photo, category, campus, pickup points, listings with photos and prices, and your WhatsApp number if you choose WhatsApp contact. We need these to show your hustle to buyers.</li>
          <li><strong>Messages and enquiries:</strong> the messages and photos you send in HustleHub, the status of each enquiry and whether a sale was confirmed. We need these to run conversations and to work out trust badges.</li>
          <li><strong>Things you save or do:</strong> saved listings, followed sellers, RSVPs, office-hours requests, notification settings and reports you file.</li>
          <li><strong>Basic usage:</strong> when you were last active (to help mentors support sellers and to count active users), and an anonymous random cookie that counts one listing view per visitor per day. We do not use advertising trackers and we do not sell data.</li>
          <li><strong>Your settings:</strong> for example low-data mode, saved in a cookie and on your profile.</li>
        </ul>
      </Section>

      <Section id="see" title="Who can see it">
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Everyone:</strong> approved seller profiles and available listings, plus the trust badge and reply-time band.</li>
          <li><strong>The other person in a conversation:</strong> your messages and your first name with a last initial. Your email address is never shown to other users.</li>
          <li><strong>Your WhatsApp number</strong> is never put on a web page. Signed-in buyers are sent to WhatsApp through a redirect, and HustleHub records that a handoff happened (not what was said).</li>
          <li><strong>Incubation Hub admins:</strong> account details and reports. Admins can read only the message you report and a few messages around it, not your other conversations.</li>
          <li><strong>Mentors:</strong> activity numbers for the sellers assigned to them (enquiries, response rate, confirmed sales, views). Mentors cannot read any messages.</li>
          <li><strong>Our service providers:</strong> Supabase (database, sign-in and file storage, hosted in Ireland, EU) and our web host. They process data for us under their own security commitments. Moving data outside South Africa is allowed under POPIA section 72 where the provider is bound to protect it to a comparable standard.</li>
        </ul>
      </Section>

      <Section id="keep" title="How long we keep it">
        <ul className="list-disc space-y-2 pl-6">
          <li>Your account data is kept while your account is open.</li>
          <li>If you delete your account, your personal details are removed immediately, your seller profile and listings are hidden, and your sign-in is removed after 30 days.</li>
          <li>Messages you sent stay visible to the other person as &quot;Deleted user&quot; so their records still make sense. Your name and photos are removed.</li>
          <li>Reports and the admin audit log are kept for safety and accountability. They no longer identify you once your account is deleted.</li>
        </ul>
      </Section>

      <Section id="rights" title="Your rights">
        <p>You can ask to see your information, correct it, delete it, or object to how it is used.</p>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Download your data</strong> and <strong>delete your account</strong> yourself at <Link href="/settings/privacy" className="font-semibold text-royal underline">Settings &gt; Privacy</Link>.</li>
          <li>You can see the time you gave consent on that page.</li>
          <li>If you are unhappy, you may complain to South Africa&apos;s Information Regulator at <a href="https://inforegulator.org.za" className="font-semibold text-royal underline" rel="noopener noreferrer">inforegulator.org.za</a> (complaints.IR@justice.gov.za).</li>
        </ul>
      </Section>

      <Section id="contact" title="Contact the Information Officer">
        <div className="rounded-xl bg-mist p-4">
          <p className="font-semibold text-navy">{officer.name ?? "Incubation Hub Information Officer"}</p>
          {officer.email ? <p>Email: <a href={`mailto:${officer.email}`} className="font-semibold text-royal underline">{officer.email}</a></p> : <p className="text-muted">Email: to be confirmed</p>}
          {officer.phone && <p>Phone: {officer.phone}</p>}
          {officer.note && <p className="mt-1 text-sm text-muted">{officer.note}</p>}
        </div>
      </Section>

      <p className="mt-10 text-sm text-muted">We will update this page if we change how we use your information, and ask for your consent again if the change matters.</p>
    </article>
  );
}
