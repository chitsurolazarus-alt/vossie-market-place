"use client";

import { useState } from "react";
import { changeRole, restoreUser } from "@/app/actions/admin";
import { btnGhost, btnPrimary, field, useAct } from "./useAct";

const ROLES = ["buyer", "seller", "mentor", "admin"] as const;

/** Change a role (the last admin can't be demoted) or lift a suspension/ban. */
export default function UserActions({ userId, role, restricted, isSelf }: { userId: string; role: string; restricted: boolean; isSelf: boolean }) {
  const [sel, setSel] = useState(role);
  const roleAct = useAct();
  const restore = useAct();
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={`role-${userId}`} className="text-sm font-semibold text-navy">Role{isSelf && " (you)"}</label>
          <select id={`role-${userId}`} value={sel} onChange={(e) => setSel(e.target.value)} className={`${field} mt-1`}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button type="button" disabled={roleAct.pending || sel === role} onClick={() => roleAct.run(() => changeRole(userId, sel as (typeof ROLES)[number]))} className={btnPrimary}>Save</button>
      </div>
      {roleAct.error && <p role="alert" className="text-sm font-medium text-red-800">{roleAct.error}</p>}
      {restricted && (
        <div>
          <button type="button" disabled={restore.pending} onClick={() => restore.run(() => restoreUser(userId, "Restored by an admin"))} className={btnGhost}>Lift suspension / ban</button>
          {restore.error && <p role="alert" className="mt-1 text-sm font-medium text-red-800">{restore.error}</p>}
        </div>
      )}
    </div>
  );
}
