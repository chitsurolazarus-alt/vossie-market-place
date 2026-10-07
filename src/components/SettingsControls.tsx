"use client";

import { useState, useTransition } from "react";
import { replayTours, saveMyCampus, saveNotificationPrefs } from "@/app/actions/settings";
import Icon from "./Icon";
import { useToast } from "./Toast";
import { Button, inputCls } from "./ui";

function Switch({ label, hint, checked, onChange, disabled }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border-2 border-navy/20 bg-white p-4 text-left transition-transform active:scale-[.99] disabled:opacity-60">
      <span><span className="block font-semibold text-navy">{label}</span><span className="text-sm text-muted">{hint}</span></span>
      <span aria-hidden="true" className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? "bg-royal" : "bg-navy/30"}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${checked ? "left-7" : "left-1"}`} />
      </span>
    </button>
  );
}

export function NotificationPrefs({ initial }: { initial: { email_new_enquiry: boolean; email_daily_digest: boolean } }) {
  const toast = useToast();
  const [prefs, setPrefs] = useState(initial);
  const [, start] = useTransition();
  const set = (patch: Partial<typeof prefs>) => {
    const prev = prefs, next = { ...prefs, ...patch };
    setPrefs(next);
    start(async () => {
      const r = await saveNotificationPrefs(next);
      if (!r.ok) { setPrefs(prev); toast(r.error, "error"); } else toast("Notification settings saved");
    });
  };
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-xl bg-mist p-4 text-sm text-ink">
        <Icon name="bell" size="md" className="mt-0.5 text-royal" />
        <p>In-app notifications (the bell) are always on, so you never miss a message. Email alerts are saved now and start once HustleHub email is switched on.</p>
      </div>
      <Switch label="Email me about new enquiries" hint="For sellers: when a buyer starts a conversation." checked={prefs.email_new_enquiry} onChange={(v) => set({ email_new_enquiry: v })} />
      <Switch label="Daily email summary" hint="One email a day instead of one per event." checked={prefs.email_daily_digest} onChange={(v) => set({ email_daily_digest: v })} />
      <Switch label="Push notifications on this phone" hint="Coming soon." checked={false} onChange={() => {}} disabled />
    </div>
  );
}

export function CampusPicker({ campuses, initial }: { campuses: { id: string; name: string }[]; initial: string | null }) {
  const toast = useToast();
  const [value, setValue] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await saveMyCampus(value || null);
    if (r.ok) toast(value ? "Campus saved" : "Campus cleared"); else toast(r.error, "error");
  });
  return (
    <div className="space-y-3">
      <label htmlFor="my-campus" className="block font-semibold text-navy">My campus</label>
      <select id="my-campus" value={value} onChange={(e) => setValue(e.target.value)} className={inputCls}>
        <option value="">Not set</option>
        {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <p className="text-sm text-muted">We use this to show hustles at your campus first.</p>
      <Button type="button" onClick={save} disabled={pending || value === (initial ?? "")} className="w-full sm:w-auto">{pending ? "Saving..." : "Save campus"}</Button>
    </div>
  );
}

export function ReplayTourButton() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const go = () => start(async () => {
    const r = await replayTours();
    // A full page load on purpose: the tour gate only checks once per page load.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (r.ok) window.location.href = "/"; else toast(r.error, "error");
  });
  return (
    <button type="button" onClick={go} disabled={pending}
      className="flex min-h-11 w-full items-center justify-between rounded-xl border-2 border-navy/20 bg-white px-4 py-3 text-left font-semibold text-navy transition-transform active:scale-[.99] disabled:opacity-60">
      <span className="inline-flex items-center gap-2"><Icon name="rocket" size="md" className="text-royal" />Replay app tour</span>
      <Icon name="chevron-right" size="md" />
    </button>
  );
}
