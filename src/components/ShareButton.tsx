"use client";

import { useState } from "react";

export default function ShareButton({ title, text }: { title: string; text: string }) {
  const [msg, setMsg] = useState("");

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title, text, url }); return; }
      await navigator.clipboard.writeText(url);
      setMsg("Link copied");
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // user closed the share sheet
      setMsg("Couldn't share. Copy the link from your address bar.");
    }
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button type="button" onClick={share} className="inline-flex min-h-12 items-center gap-2 rounded-lg border-2 border-navy px-5 font-semibold text-navy hover:bg-mist">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" /></svg>
        Share
      </button>
      <span role="status" className="text-sm font-medium text-navy">{msg}</span>
    </div>
  );
}
