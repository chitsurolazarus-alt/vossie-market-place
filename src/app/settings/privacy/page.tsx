import Link from "next/link";
import DeleteAccount from "@/components/DeleteAccount";
import { PageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { REASON_LABEL, TARGET_LABEL } from "@/lib/moderation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Privacy settings", robots: { index: false } };
export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-ZA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Johannesburg" });

export default async function PrivacySettings() {
  const user = await requireUser("/settings/privacy");
  const supabase = await createClient();
  const [{ data: profile }, { data: version }, { data: reports }, { data: warnings }] = await Promise.all([
    supabase.from("profiles").select("popia_consent_at,created_at").eq("id", user.id).maybeSingle(),
    supabase.from("site_settings").select("value").eq("key", "policy_version").maybeSingle(),
    supabase.from("reports").select("id,target_type,reason,status,created_at").eq("reporter_id", user.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("user_warnings").select("id,message,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  const v = (version?.value as { version?: string } | undefined)?.version ?? "2026-10";

  return (
    <PageShell title="Privacy settings" intro="Your data, your choice. These tools follow South Africa's POPIA." width="max-w-xl">
      <section aria-labelledby="consent-h" className="rounded-2xl bg-mist p-4">
        <h2 id="consent-h" className="font-display text-xl font-bold text-navy">Your consent</h2>
        <p className="mt-1 text-ink">
          You accepted the privacy policy on <strong>{profile?.popia_consent_at ? fmt(profile.popia_consent_at) : "an unknown date"}</strong>. The current policy is version {v}.
        </p>
        <Link href="/privacy" className="mt-2 inline-flex min-h-11 items-center font-semibold text-royal underline">Read the privacy policy</Link>
      </section>

      <section aria-labelledby="dl-h" className="mt-6 rounded-2xl border border-navy/15 bg-white p-4">
        <h2 id="dl-h" className="font-display text-xl font-bold text-navy">Download my data</h2>
        <p className="mt-1 text-ink">A JSON file with your profile, seller details and listings, the messages you sent, your enquiries, the reports you made, and what you saved or followed.</p>
        <a href="/settings/privacy/export" download className="mt-3 inline-flex min-h-12 items-center rounded-lg bg-navy px-5 font-semibold text-white hover:bg-royal">Download my data (JSON)</a>
      </section>

      {(warnings ?? []).length > 0 && (
        <section aria-labelledby="warn-h" className="mt-6 rounded-2xl border-l-4 border-amber-700 bg-amber-50 p-4">
          <h2 id="warn-h" className="font-display text-xl font-bold text-amber-950">Messages from the HustleHub team</h2>
          <ul className="mt-2 space-y-2 text-amber-950">{warnings!.map((w) => <li key={w.id}><span className="block text-xs">{fmt(w.created_at)}</span>{w.message}</li>)}</ul>
        </section>
      )}

      <section aria-labelledby="rep-h" className="mt-6 rounded-2xl border border-navy/15 bg-white p-4">
        <h2 id="rep-h" className="font-display text-xl font-bold text-navy">Reports I&apos;ve made</h2>
        {(reports ?? []).length === 0 ? <p className="mt-1 text-muted">You haven&apos;t reported anything.</p> : (
          <ul className="mt-2 divide-y divide-navy/10">
            {reports!.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0"><span className="block font-semibold text-navy">{TARGET_LABEL[r.target_type] ?? r.target_type}</span><span className="block text-sm text-muted">{REASON_LABEL[r.reason] ?? r.reason} · {fmt(r.created_at)}</span></span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${r.status === "pending" ? "bg-sand text-navy" : "bg-mist text-navy"}`}>{r.status === "pending" ? "In review" : "Resolved"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="del-h" className="mt-6 rounded-2xl border-2 border-red-800/40 bg-white p-4">
        <h2 id="del-h" className="font-display text-xl font-bold text-red-900">Delete my account</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink">
          <li>Your name, email, photos and WhatsApp number are removed straight away.</li>
          <li>Your seller profile and listings are hidden and your saved items are cleared.</li>
          <li>Messages you sent stay for the other person as &quot;Deleted user&quot;.</li>
          <li>Your sign-in is permanently removed after 30 days. This can&apos;t be undone.</li>
        </ul>
        <div className="mt-4"><DeleteAccount /></div>
      </section>
    </PageShell>
  );
}
