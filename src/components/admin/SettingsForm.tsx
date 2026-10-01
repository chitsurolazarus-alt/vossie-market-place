"use client";

import { useState } from "react";
import { saveSettings } from "@/app/actions/admin";
import { btnPrimary, field, useAct } from "./useAct";

type Officer = { name: string; email: string | null; phone: string | null; note: string | null };

/** Auto-hide threshold and the POPIA Information Officer shown on /privacy. */
export default function SettingsForm({ autoHide, officer }: { autoHide: number; officer: Officer }) {
  const [n, setN] = useState(autoHide);
  const [o, setO] = useState({ name: officer.name, email: officer.email ?? "", phone: officer.phone ?? "", note: officer.note ?? "" });
  const { run, pending, error, saved } = useAct();
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => saveSettings({ autoHide: n, officer: o })); }}>
      <div>
        <label htmlFor="n" className="font-semibold text-navy">Auto-hide a listing after this many unique reporters</label>
        <input id="n" type="number" min={1} max={20} value={n} onChange={(e) => setN(Number(e.target.value))} className={`${field} mt-1 max-w-32`} />
        <p className="mt-1 text-sm text-muted">Counts reporters with a report still pending review. The seller is told it is under review, never who reported.</p>
      </div>
      <fieldset className="space-y-3 rounded-xl bg-mist p-4">
        <legend className="px-1 font-semibold text-navy">POPIA Information Officer (shown on /privacy)</legend>
        {(["name", "email", "phone", "note"] as const).map((k) => (
          <div key={k}>
            <label htmlFor={`io-${k}`} className="text-sm font-semibold capitalize text-navy">{k === "note" ? "Note (optional)" : k}</label>
            <input id={`io-${k}`} value={o[k]} onChange={(e) => setO((s) => ({ ...s, [k]: e.target.value }))} className={`${field} mt-1`} type={k === "email" ? "email" : "text"} />
          </div>
        ))}
      </fieldset>
      {error && <p role="alert" className="text-sm font-medium text-red-800">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={btnPrimary}>Save settings</button>
        {saved && <span role="status" className="text-sm font-semibold text-emerald-800">Saved</span>}
      </div>
    </form>
  );
}
