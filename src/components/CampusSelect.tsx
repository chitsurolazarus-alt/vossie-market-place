"use client";

import { useState } from "react";
import { inputCls } from "@/components/ui";

export type CampusOption = { id: string; name: string; province: string; active: boolean };

/** Province first, then campus. Campuses that have not launched yet are listed but cannot be chosen. */
export default function CampusSelect({ id, campuses, value, onChange, disabled, emptyLabel = "Choose your campus", invalid, describedBy }: {
  id: string; campuses: CampusOption[]; value: string; onChange: (campusId: string) => void;
  disabled?: boolean; emptyLabel?: string; invalid?: boolean; describedBy?: string;
}) {
  const provinces = [...new Set(campuses.map((c) => c.province))].sort();
  const current = campuses.find((c) => c.id === value);
  const [picked, setPicked] = useState(current?.province ?? "");
  const province = picked || current?.province || "";
  const inProvince = campuses.filter((c) => c.province === province);
  const short = (n: string) => n.replace("Eduvos ", "");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor={`${id}-province`} className="mb-1 block text-sm font-semibold text-navy">Province</label>
        <select id={`${id}-province`} className={inputCls} value={province} disabled={disabled}
          onChange={(e) => { setPicked(e.target.value); onChange(""); }}>
          <option value="">Choose a province</option>
          {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-semibold text-navy">Campus</label>
        <select id={id} className={inputCls} value={value} disabled={disabled || !province}
          onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} aria-describedby={describedBy}>
          <option value="">{province ? emptyLabel : "Pick a province first"}</option>
          {inProvince.map((c) => (
            <option key={c.id} value={c.id} disabled={!c.active}>{short(c.name)}{c.active ? "" : " (coming soon)"}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
