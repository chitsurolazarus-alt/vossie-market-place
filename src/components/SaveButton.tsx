"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFollow, toggleSave } from "@/app/actions/engage";

function goSignIn(router: ReturnType<typeof useRouter>) {
  const here = window.location.pathname + window.location.search;
  router.push(`/login?next=${encodeURIComponent(here)}`);
}

export function SaveButton({ listingId, title, initialSaved, authed, className = "" }: {
  listingId: string; title: string; initialSaved: boolean; authed: boolean; className?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState(false);
  const [, start] = useTransition();

  const click = () => {
    if (!authed) return goSignIn(router);
    const next = !saved;
    setSaved(next); setError(false); // optimistic
    start(async () => {
      const r = await toggleSave(listingId, next);
      if (!r.ok) { setSaved(!next); setError(true); }
    });
  };

  return (
    <button type="button" onClick={click} aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      className={`flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-navy shadow ring-1 ring-navy/10 hover:bg-white ${className}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M12 21s-7.5-4.6-9.5-9.2C1.3 8.6 3 5.5 6.2 5.5c1.9 0 3.2 1 3.8 2 .6-1 1.9-2 3.8-2 3.2 0 4.9 3.1 3.7 6.3C19.5 16.4 12 21 12 21z" />
      </svg>
      <span className="sr-only" role="status">{error ? "Couldn't update saved items" : ""}</span>
    </button>
  );
}

export function FollowButton({ sellerId, name, initialFollowing, authed }: {
  sellerId: string; name: string; initialFollowing: boolean; authed: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [error, setError] = useState(false);
  const [, start] = useTransition();

  const click = () => {
    if (!authed) return goSignIn(router);
    const next = !following;
    setFollowing(next); setError(false);
    start(async () => {
      const r = await toggleFollow(sellerId, next);
      if (!r.ok) { setFollowing(!next); setError(true); }
    });
  };

  return (
    <>
      <button type="button" onClick={click} aria-pressed={following} aria-label={following ? `Unfollow ${name}` : `Follow ${name}`}
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 px-5 font-semibold ${following ? "border-sand bg-sand text-navy" : "border-white text-white hover:bg-white/10"}`}>
        {following ? "✓ Following" : "+ Follow"}
      </button>
      {error && <span role="alert" className="text-sm text-white">Couldn&apos;t update. Try again.</span>}
    </>
  );
}
