"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/actions/privacy";

/** Type DELETE to confirm. Personal data is removed immediately; the login is removed after 30 days. */
export default function DeleteAccount() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = text.trim() === "DELETE";
  return (
    <form onSubmit={(e) => {
      e.preventDefault(); setError(null);
      start(async () => {
        const r = await deleteAccount(text);
        if (!r.ok) { setError(r.error); return; }
        router.replace("/goodbye"); router.refresh();
      });
    }}>
      <label htmlFor="del" className="font-semibold text-navy">Type <code className="rounded bg-mist px-1">DELETE</code> to confirm</label>
      <input id="del" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="characters"
        className="mt-1 block w-full min-h-11 rounded-lg border-2 border-red-800/50 bg-white px-3 py-2 text-base focus:border-red-800" />
      {error && <p role="alert" className="mt-2 rounded-lg border-l-4 border-red-800 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <button type="submit" disabled={!ready || pending} className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-lg border-2 border-red-800 bg-red-800 px-5 font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}
