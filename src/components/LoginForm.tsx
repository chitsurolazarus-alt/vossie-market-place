"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sendCode, verifyCode, demoLogin } from "@/app/actions/auth";
import { Alert, Button, Field, inputCls, describe } from "@/components/ui";

const DEMO = [
  ["Thandi's Kitchen (seller)", "20250101@vossie.net"],
  ["Lwazi Cuts (seller)", "20250102@vossie.net"],
  ["New student (not a seller yet)", "20250109@vossie.net"],
  ["Admin (staff)", "admin.demo@eduvos.com"],
  ["Mentor (staff)", "mentor.demo@eduvos.com"],
];

export default function LoginForm({ next, demoEnabled }: { next: string; demoEnabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const done = () => { router.replace(next); router.refresh(); };

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await sendCode(email, consent);
      if (r.ok) setStep("code"); else setError(r.error);
    });
  };
  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await verifyCode(email, code);
      if (r.ok) done(); else setError(r.error);
    });
  };

  return (
    <div className="space-y-6">
      {step === "email" ? (
        <form onSubmit={submitEmail} className="space-y-5" noValidate>
          <Field label="Eduvos email" htmlFor="email" hint="Student number @vossie.net, or your @eduvos.com staff email." error={error ?? undefined}>
            <input id="email" type="email" inputMode="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="20250123@vossie.net"
              aria-invalid={!!error} aria-describedby={describe("email", error ?? undefined, true)} />
          </Field>
          <label className="flex min-h-11 items-start gap-3">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
            <span className="text-sm text-ink">
              I agree to Vossie processing my details as described in the{" "}
              <Link href="/privacy" className="font-semibold text-royal underline">privacy policy</Link> (POPIA).
            </span>
          </label>
          <Button type="submit" disabled={pending || !consent || !email} className="w-full">
            {pending ? "Sending code…" : "Email me a sign-in code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="space-y-5" noValidate>
          <Alert tone="info">We sent a code to <strong>{email}</strong>. It can take a minute to arrive; check spam too.</Alert>
          <Field label="Sign-in code" htmlFor="code" error={error ?? undefined}>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d*" maxLength={8} required value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${inputCls} text-center text-2xl tracking-[0.4em]`}
              aria-invalid={!!error} aria-describedby={describe("code", error ?? undefined)} />
          </Field>
          <Button type="submit" disabled={pending || code.length < 6} className="w-full">{pending ? "Checking…" : "Sign in"}</Button>
          <button type="button" onClick={() => { setStep("email"); setCode(""); setError(null); }} className="min-h-11 w-full font-semibold text-royal underline">
            Use a different email
          </button>
        </form>
      )}

      {demoEnabled && (
        <div className="rounded-xl border border-sand bg-sand/20 p-4">
          <h2 className="font-display text-lg font-bold text-navy">Demo accounts</h2>
          <p className="text-sm text-muted">For rehearsals only. Not available in production.</p>
          <ul className="mt-3 grid gap-2">
            {DEMO.map(([label, em]) => (
              <li key={em}>
                <Button variant="secondary" className="w-full justify-between text-left" disabled={pending}
                  onClick={() => start(async () => { const r = await demoLogin(em); if (r.ok) done(); else setError(r.error); })}>
                  <span>{label}</span><span className="text-sm font-normal">{em}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
