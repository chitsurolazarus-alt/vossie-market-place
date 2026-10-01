"use client";

import { useState } from "react";
import { deleteRow, saveRow } from "@/app/actions/admin";
import type { Field, Section } from "@/lib/admin-sections";
import { btnDanger, btnGhost, btnPrimary, field as fieldCls, useAct } from "./useAct";

type Row = Record<string, string | number | boolean | null>;
type Options = Record<string, { value: string; label: string }[]>;

function Input({ f, value, onChange, options, id }: { f: Field; value: string | number | boolean | null; onChange: (v: string | number | boolean) => void; options: Options; id: string }) {
  if (f.type === "bool") {
    return (
      <label htmlFor={id} className="flex min-h-11 items-center gap-2">
        <input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" />
        <span className="text-sm text-ink">{f.label}</span>
      </label>
    );
  }
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-navy">{f.label}</label>
      {f.type === "select" ? (
        <select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={`${fieldCls} mt-1`}>
          <option value="">Choose…</option>
          {(options[f.optionsKey ?? ""] ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input id={id} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} step={f.step} min={f.min} max={f.max}
          value={value === null || value === undefined ? "" : String(value)} placeholder={f.hint}
          onChange={(e) => onChange(f.type === "number" ? (e.target.value === "" ? 0 : Number(e.target.value)) : e.target.value)} className={`${fieldCls} mt-1`} />
      )}
    </div>
  );
}

function defaults(fields: Field[]): Row {
  return Object.fromEntries(fields.map((f) => [f.key, f.type === "bool" ? true : f.type === "number" ? (f.min ?? 0) : ""]));
}

function RowForm({ sectionKey, spec, row, rowId, options, onDone }: { sectionKey: string; spec: Section; row: Row; rowId: string | null; options: Options; onDone?: () => void }) {
  const [vals, setVals] = useState<Row>(row);
  const save = useAct();
  const del = useAct();
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.run(() => saveRow(sectionKey, rowId, vals as Record<string, string | number | boolean>), () => { if (rowId === null) setVals(defaults(spec.fields)); onDone?.(); }); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        {spec.fields.map((f) => <Input key={f.key} f={f} id={`${sectionKey}-${rowId ?? "new"}-${f.key}`} value={vals[f.key] ?? ""} options={options} onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))} />)}
      </div>
      {(save.error || del.error) && <p role="alert" className="text-sm font-medium text-red-800">{save.error ?? del.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={save.pending} className={rowId === null ? btnPrimary : btnGhost}>{rowId === null ? "Add" : "Save"}</button>
        {rowId !== null && spec.canDelete && <button type="button" disabled={del.pending} onClick={() => del.run(() => deleteRow(sectionKey, rowId))} className={btnDanger}>Delete</button>}
        {save.saved && <span role="status" className="text-sm font-semibold text-emerald-800">Saved</span>}
      </div>
    </form>
  );
}

/** Generic editor for an admin-managed table. Changes are validated server-side and audited by the database. */
export default function ConfigTable({ sectionKey, spec, rows, options }: { sectionKey: string; spec: Section; rows: Row[]; options: Options }) {
  return (
    <div>
      <p className="text-ink">{spec.help}</p>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => {
          const id = String(r[spec.pk]);
          const title = String(r.name ?? r.label ?? r.key ?? r.domain ?? r.email ?? id);
          return (
            <li key={id}>
              <details className="rounded-xl border border-navy/15 bg-white">
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-4 font-semibold text-navy">
                  <span className="truncate">{title}</span>
                  {"active" in r && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${r.active ? "bg-mist text-navy" : "bg-red-100 text-red-900"}`}>{r.active ? "Active" : "Inactive"}</span>}
                  {"enabled" in r && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${r.enabled ? "bg-emerald-100 text-emerald-900" : "bg-mist text-muted"}`}>{r.enabled ? "On" : "Off"}</span>}
                </summary>
                <div className="border-t border-navy/10 p-4">
                  <RowForm sectionKey={sectionKey} spec={spec} row={Object.fromEntries(spec.fields.map((f) => [f.key, r[f.key] ?? (f.type === "bool" ? false : "")]))} rowId={id} options={options} />
                </div>
              </details>
            </li>
          );
        })}
        {rows.length === 0 && <li className="rounded-xl bg-mist p-4 text-center text-muted">Nothing here yet.</li>}
      </ul>
      {spec.canCreate && (
        <details className="mt-4 rounded-xl border-2 border-sand bg-white">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold text-navy">+ Add new</summary>
          <div className="border-t border-navy/10 p-4"><RowForm sectionKey={sectionKey} spec={spec} row={defaults(spec.fields)} rowId={null} options={options} /></div>
        </details>
      )}
    </div>
  );
}
