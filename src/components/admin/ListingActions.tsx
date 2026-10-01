"use client";

import { useState } from "react";
import { moderateListing } from "@/app/actions/admin";
import Modal from "@/components/Modal";
import { btnDanger, btnGhost, btnPrimary, field, useAct } from "./useAct";

/** Hide / restore a listing, or move it to another category. Every change is written to the audit log with the reason. */
export default function ListingActions({ listingId, title, hidden, categoryId, categories }: {
  listingId: string; title: string; hidden: boolean; categoryId: string | null; categories: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState<null | "hide" | "restore" | "category">(null);
  const [reason, setReason] = useState("");
  const [cat, setCat] = useState(categoryId ?? "");
  const { run, pending, error, setError } = useAct();
  const close = () => { setOpen(null); setError(null); setReason(""); };
  const go = () => open && run(() => moderateListing(listingId, open, { categoryId: open === "category" ? cat : undefined, reason }), close);

  return (
    <div className="flex flex-wrap gap-2">
      {hidden
        ? <button type="button" onClick={() => setOpen("restore")} className={btnPrimary}>Restore</button>
        : <button type="button" onClick={() => setOpen("hide")} className={btnDanger}>Hide</button>}
      <button type="button" onClick={() => setOpen("category")} className={btnGhost}>Change category</button>
      <Modal open={open !== null} onClose={close} title={open === "hide" ? "Hide this listing" : open === "restore" ? "Restore this listing" : "Change category"}>
        <form onSubmit={(e) => { e.preventDefault(); go(); }}>
          <p className="font-semibold text-navy">{title}</p>
          {open === "category" && (
            <>
              <label htmlFor="cat" className="mt-3 block font-semibold text-navy">Category</label>
              <select id="cat" value={cat} onChange={(e) => setCat(e.target.value)} className={`${field} mt-1`}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </>
          )}
          <label htmlFor="why" className="mt-3 block font-semibold text-navy">Reason <span className="font-normal text-muted">(kept in the audit log)</span></label>
          <textarea id="why" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} className={`${field} mt-1`} />
          {error && <p role="alert" className="mt-2 text-sm font-medium text-red-800">{error}</p>}
          <button type="submit" disabled={pending || (open === "category" && !cat)} className={`${open === "hide" ? btnDanger : btnPrimary} mt-4 w-full min-h-12`}>{pending ? "Working…" : "Confirm"}</button>
        </form>
      </Modal>
    </div>
  );
}
