"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFollow, toggleSave } from "@/app/actions/engage";

import Icon from "./Icon";
import { useToast } from "./Toast";
function goSignIn(router: ReturnType<typeof useRouter>) {
  const here = window.location.pathname + window.location.search;
  router.push(`/login?next=${encodeURIComponent(here)}`);
}

export function SaveButton({ listingId, title, initialSaved, authed, className = "" }: {
  listingId: string; title: string; initialSaved: boolean; authed: boolean; className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState(false);
  const [, start] = useTransition();

  const click = () => {
    if (!authed) return goSignIn(router);
    const next = !saved;
    setSaved(next); setError(false); // optimistic
    start(async () => {
      const r = await toggleSave(listingId, next);
      if (!r.ok) { setSaved(!next); setError(true); toast("Couldn't update saved items. Try again.", "error"); } else toast(next ? "Saved to your list" : "Removed from saved", next ? "success" : "info");
    });
  };

  return (
    <button type="button" onClick={click} aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      className={`flex h-11 w-11 items-center justify-center rounded-full shadow ring-1 ring-navy/10 active:scale-95 transition-transform ${saved ? "bg-royal text-white" : "bg-white/95 text-navy hover:bg-white"} ${className}`}>
      <Icon name="heart" />
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
        <Icon name={following ? "check" : "plus"} size="md" />{following ? "Following" : "Follow"}
      </button>
      {error && <span role="alert" className="text-sm text-white">Couldn&apos;t update. Try again.</span>}
    </>
  );
}
