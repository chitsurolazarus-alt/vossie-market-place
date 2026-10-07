"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveDraft, saveSeller } from "@/app/actions/seller";
import { Alert, Button, ButtonLink, Field, describe, inputCls } from "@/components/ui";
import PhotoCropper from "./PhotoCropper";
import { STEP_FIELDS, validateStep, type FieldErrors, type SellerInput } from "@/lib/validation";

export type SellerState = Omit<SellerInput, "agree"> & { agree: boolean };
export type Option = { id: string; name: string };
export type PickupOption = { id: string; campus_id: string; name: string; description: string | null };

type Props = {
  userId: string;
  categories: Option[];
  campuses: Option[];
  pickupPoints: PickupOption[];
  initial: Partial<SellerState>;
  maskedWhatsapp: string | null;
  mode: "onboard" | "edit";
  slugLocked?: boolean;
  campusLocked?: boolean;
  profileHref?: string;
};

export const EMPTY: SellerState = {
  businessName: "", categoryId: "", tagline: "", bio: "", photoUrl: "", contactPref: "in_app",
  whatsapp: "", campusId: "", pickupPointIds: [], agree: false,
};

const STEPS = ["Basics", "About you", "Contact", "Pickup", "Review"];

type Ctx = Props & { s: SellerState; set: (p: Partial<SellerState>) => void; errors: FieldErrors };

function StepBasics({ s, set, errors, categories }: Ctx) {
  return (
    <div className="space-y-5">
      <Field label="Business name" htmlFor="businessName" error={errors.businessName} hint="Must be unique on your campus.">
        <input id="businessName" className={inputCls} value={s.businessName} maxLength={60} autoComplete="organization"
          onChange={(e) => set({ businessName: e.target.value })} aria-invalid={!!errors.businessName}
          aria-describedby={describe("businessName", errors.businessName, true)} />
      </Field>
      <Field label="Category" htmlFor="categoryId" error={errors.categoryId}>
        <select id="categoryId" className={inputCls} value={s.categoryId} onChange={(e) => set({ categoryId: e.target.value })}
          aria-invalid={!!errors.categoryId} aria-describedby={describe("categoryId", errors.categoryId)}>
          <option value="">Choose a category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Tagline" htmlFor="tagline" error={errors.tagline} counter={`${s.tagline.length}/80`} hint="One line that sells you. Optional.">
        <input id="tagline" className={inputCls} value={s.tagline} maxLength={80} onChange={(e) => set({ tagline: e.target.value })}
          aria-invalid={!!errors.tagline} aria-describedby={describe("tagline", errors.tagline, true)} />
      </Field>
    </div>
  );
}

function StepAbout({ s, set, errors, userId }: Ctx) {
  return (
    <div className="space-y-6">
      <Field label="About your hustle" htmlFor="bio" error={errors.bio} counter={`${s.bio.length}/500`} hint="What do you make or offer, and what makes you great? Optional but buyers love it.">
        <textarea id="bio" rows={5} className={inputCls} value={s.bio} maxLength={500} onChange={(e) => set({ bio: e.target.value })}
          aria-invalid={!!errors.bio} aria-describedby={describe("bio", errors.bio, true)} />
      </Field>
      <PhotoCropper userId={userId} value={s.photoUrl} businessName={s.businessName} onChange={(photoUrl) => set({ photoUrl })} error={errors.photoUrl} />
    </div>
  );
}

function StepContact({ s, set, errors, maskedWhatsapp }: Ctx) {
  const opts = [
    ["in_app", "In-app messages only", "Buyers message you inside HustleHub."],
    ["whatsapp", "WhatsApp only", "Buyers are sent to WhatsApp to chat."],
    ["both", "Both", "Buyers choose what suits them."],
  ] as const;
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="font-semibold text-navy">How should buyers contact you?</legend>
        <div className="mt-2 grid gap-2">
          {opts.map(([v, label, hint]) => (
            <label key={v} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border-2 p-3 ${s.contactPref === v ? "border-royal bg-blue-50" : "border-navy/20"}`}>
              <input type="radio" name="contactPref" value={v} checked={s.contactPref === v} onChange={() => set({ contactPref: v })} className="mt-1 h-5 w-5" />
              <span><span className="block font-semibold text-navy">{label}</span><span className="text-sm text-muted">{hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      {s.contactPref !== "in_app" && (
        <Field label="WhatsApp number" htmlFor="whatsapp" error={errors.whatsapp}
          hint={maskedWhatsapp ? `Saved number: ${maskedWhatsapp}. Type a new one to replace it.` : "South African mobile, e.g. 082 123 4567. Kept private: buyers are sent to WhatsApp without ever seeing your number on HustleHub."}>
          <input id="whatsapp" type="tel" inputMode="tel" autoComplete="tel" className={inputCls} value={s.whatsapp} maxLength={20}
            placeholder="082 123 4567" onChange={(e) => set({ whatsapp: e.target.value })} aria-invalid={!!errors.whatsapp}
            aria-describedby={describe("whatsapp", errors.whatsapp, true)} />
        </Field>
      )}
    </div>
  );
}

function StepCampus({ s, set, errors, campuses, pickupPoints, campusLocked }: Ctx) {
  const points = pickupPoints.filter((p) => p.campus_id === s.campusId);
  const toggle = (id: string) => {
    const has = s.pickupPointIds.includes(id);
    if (!has && s.pickupPointIds.length >= 3) return;
    set({ pickupPointIds: has ? s.pickupPointIds.filter((x) => x !== id) : [...s.pickupPointIds, id] });
  };
  return (
    <div className="space-y-5">
      <Field label="Campus" htmlFor="campusId" error={errors.campusId} hint={campusLocked ? "Campus can't be changed after approval or once you have listings." : undefined}>
        <select id="campusId" className={inputCls} value={s.campusId} disabled={campusLocked}
          onChange={(e) => set({ campusId: e.target.value, pickupPointIds: [] })} aria-invalid={!!errors.campusId}
          aria-describedby={describe("campusId", errors.campusId, !!campusLocked)}>
          <option value="">Choose your campus</option>
          {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      {s.campusId && (
        <fieldset aria-describedby="pp-hint">
          <legend className="font-semibold text-navy">Pickup points (choose 1 to 3)</legend>
          <p id="pp-hint" className="mt-1 text-sm text-muted">Hand over on campus, in public. For your safety we never share home addresses.</p>
          <div className="mt-3 grid gap-2">
            {points.map((p) => {
              const on = s.pickupPointIds.includes(p.id);
              const blocked = !on && s.pickupPointIds.length >= 3;
              return (
                <label key={p.id} className={`flex min-h-14 items-start gap-3 rounded-lg border-2 p-3 ${on ? "border-royal bg-blue-50" : "border-navy/20"} ${blocked ? "opacity-60" : "cursor-pointer"}`}>
                  <input type="checkbox" checked={on} disabled={blocked} onChange={() => toggle(p.id)} className="mt-1 h-5 w-5" />
                  <span><span className="block font-semibold text-navy">{p.name}</span>{p.description && <span className="text-sm text-muted">{p.description}</span>}</span>
                </label>
              );
            })}
          </div>
          {errors.pickupPointIds && <p role="alert" className="mt-2 text-sm font-medium text-red-800">{errors.pickupPointIds}</p>}
        </fieldset>
      )}
    </div>
  );
}

function StepReview({ s, set, errors, categories, campuses, pickupPoints }: Ctx) {
  const rows: [string, string][] = [
    ["Business", s.businessName],
    ["Category", categories.find((c) => c.id === s.categoryId)?.name ?? ""],
    ["Tagline", s.tagline || "None"],
    ["Contact", { in_app: "In-app messages", whatsapp: "WhatsApp", both: "In-app and WhatsApp" }[s.contactPref]],
    ["Campus", campuses.find((c) => c.id === s.campusId)?.name ?? ""],
    ["Pickup points", pickupPoints.filter((p) => s.pickupPointIds.includes(p.id)).map((p) => p.name).join(", ")],
  ];
  return (
    <div className="space-y-5">
      <dl className="divide-y divide-navy/10 rounded-xl bg-mist px-4">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-3 sm:grid-cols-3"><dt className="text-sm text-muted">{k}</dt><dd className="font-semibold text-navy sm:col-span-2">{v}</dd></div>
        ))}
      </dl>
      <div>
        <label className="flex min-h-11 items-start gap-3">
          <input type="checkbox" checked={s.agree} onChange={(e) => set({ agree: e.target.checked })} className="mt-1 h-5 w-5 shrink-0"
            aria-invalid={!!errors.agree} aria-describedby={errors.agree ? "agree-error" : undefined} />
          <span>I&apos;ve read and agree to the{" "}
            <Link href="/seller-guidelines" target="_blank" className="font-semibold text-royal underline">seller guidelines<span className="sr-only"> (opens in a new tab)</span></Link>.
          </span>
        </label>
        {errors.agree && <p id="agree-error" role="alert" className="mt-1 text-sm font-medium text-red-800">{errors.agree}</p>}
      </div>
    </div>
  );
}

const STEP_VIEWS = [StepBasics, StepAbout, StepContact, StepCampus, StepReview];
const STEP_TITLES = ["Business basics", "About you", "How buyers reach you", "Campus and pickup points", "Review and submit"];

function firstErrorStep(errors: FieldErrors) {
  const i = STEP_FIELDS.findIndex((fields) => fields.some((f) => errors[f]));
  return i === -1 ? 4 : i;
}

export function SellerWizard(props: Props) {
  const router = useRouter();
  const [s, setS] = useState<SellerState>({ ...EMPTY, ...props.initial, agree: false });
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (p: Partial<SellerState>) => { setS((x) => ({ ...x, ...p })); setErrors((e) => { const n = { ...e }; Object.keys(p).forEach((k) => delete n[k]); return n; }); };
  const needsNumber = !props.maskedWhatsapp;
  const View = STEP_VIEWS[step];
  const ctx: Ctx = { ...props, s, set, errors };

  const next = () => {
    const errs = validateStep(step, s, needsNumber);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setFormError(null);
    start(async () => { await saveDraft({ ...s }); setStep(step + 1); window.scrollTo({ top: 0 }); });
  };
  const submit = () => {
    setFormError(null);
    start(async () => {
      const r = await saveSeller(s, "submit");
      if (r.ok) { router.refresh(); window.scrollTo({ top: 0 }); return; }
      setFormError(r.error);
      if (r.fieldErrors) { setErrors(r.fieldErrors); setStep(firstErrorStep(r.fieldErrors)); }
    });
  };

  return (
    <div>
      <nav aria-label="Progress" className="mb-6">
        <p className="text-sm font-semibold text-navy" aria-live="polite">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
        <div className="mt-2 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Onboarding progress">
          {STEPS.map((n, i) => <span key={n} className={`h-2 flex-1 rounded-full ${i <= step ? "bg-royal" : "bg-navy/15"}`} />)}
        </div>
      </nav>
      <h2 className="mb-5 font-display text-2xl font-bold text-navy" tabIndex={-1}>{STEP_TITLES[step]}</h2>
      <View {...ctx} />
      {formError && <div className="mt-5"><Alert>{formError}</Alert></div>}
      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="secondary" disabled={step === 0 || pending} onClick={() => { setStep(step - 1); window.scrollTo({ top: 0 }); }}>Back</Button>
        {step < STEPS.length - 1
          ? <Button type="button" onClick={next} disabled={pending}>{pending ? "Saving…" : "Next"}</Button>
          : <Button type="button" variant="sand" onClick={submit} disabled={pending}>{pending ? "Submitting…" : "Submit for approval"}</Button>}
      </div>
      <p className="mt-3 text-sm text-muted">Your progress is saved automatically each step.</p>
    </div>
  );
}

export function SellerEditForm(props: Props & { currentSlug: string }) {
  const [s, setS] = useState<SellerState>({ ...EMPTY, ...props.initial, agree: true });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (p: Partial<SellerState>) => { setS((x) => ({ ...x, ...p })); setErrors((e) => { const n = { ...e }; Object.keys(p).forEach((k) => delete n[k]); return n; }); };
  const ctx: Ctx = { ...props, s, set, errors };

  const save = () => {
    setMsg(null);
    const errs = [0, 1, 2, 3].reduce<FieldErrors>((a, i) => ({ ...a, ...validateStep(i, s, !props.maskedWhatsapp) }), {});
    setErrors(errs);
    if (Object.keys(errs).length) { setMsg({ tone: "error", text: "Please fix the highlighted fields." }); return; }
    start(async () => {
      const r = await saveSeller({ ...s, agree: true }, "edit");
      if (r.ok) setMsg({ tone: "success", text: "Saved. Your profile is up to date." });
      else { setMsg({ tone: "error", text: r.error }); if (r.fieldErrors) setErrors(r.fieldErrors); }
    });
  };

  return (
    <div className="space-y-10">
      <StepBasics {...ctx} />
      <StepAbout {...ctx} />
      <StepContact {...ctx} />
      <StepCampus {...ctx} />
      <Field label="Your profile link" htmlFor="slug" error={errors.slug}
        hint={props.slugLocked ? "You've already changed your link once." : "You can change this once. Old links stop working."}>
        <div className="flex items-center gap-2">
          <span className="text-muted">/s/</span>
          <input id="slug" className={inputCls} value={s.slug ?? props.currentSlug} disabled={props.slugLocked} maxLength={50}
            onChange={(e) => set({ slug: e.target.value })} aria-invalid={!!errors.slug} aria-describedby={describe("slug", errors.slug, true)} />
        </div>
      </Field>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
        {props.profileHref && <ButtonLink href={props.profileHref} variant="secondary">View public profile</ButtonLink>}
      </div>
    </div>
  );
}
