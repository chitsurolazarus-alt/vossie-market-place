"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteListing, setAvailability } from "@/app/actions/listing";
import { Alert, Button } from "@/components/ui";

export type ManagerListing = {
  id: string; title: string; priceText: string; availability: string; imageUrl: string | null; imageAlt: string;
  kind: string; hidden: boolean;
};

export default function ListingCard({ l, sellerLive }: { l: ManagerListing; sellerLive: boolean }) {
  const [availability, setAv] = useState(l.availability);
  const [confirming, setConfirming] = useState(false);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (gone) return null;

  const change = (v: string) => {
    const prev = availability; setAv(v); setError(null);
    start(async () => { const r = await setAvailability(l.id, v); if (!r.ok) { setAv(prev); setError(r.error); } });
  };
  const remove = () => start(async () => { const r = await deleteListing(l.id); if (r.ok) setGone(true); else { setError(r.error); setConfirming(false); } });

  return (
    <li className="overflow-hidden rounded-xl border border-navy/15 bg-white">
      <div className="relative aspect-[4/3] bg-mist">
        {l.imageUrl ? <Image src={l.imageUrl} alt={l.imageAlt} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" /> : null}
        <span className="absolute left-2 top-2 rounded bg-white/95 px-2 py-0.5 text-xs font-bold capitalize text-navy">{l.kind}</span>
        {(l.hidden || !sellerLive) && (
          <span className="absolute right-2 top-2 rounded bg-navy px-2 py-0.5 text-xs font-bold text-white">
            {l.hidden ? "Under review by the Hub team" : "Hidden until approved"}
          </span>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="font-display text-lg font-bold leading-snug text-navy">{l.title}</h3>
          <p className="font-semibold text-ink">{l.priceText}</p>
        </div>
        <div>
          <label htmlFor={`av-${l.id}`} className="text-sm font-medium text-navy">Availability</label>
          <select id={`av-${l.id}`} value={availability} disabled={pending} onChange={(e) => change(e.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-navy/30 bg-white px-3">
            <option value="available">Available</option>
            <option value="sold_out">Sold out</option>
            <option value="paused">Paused</option>
          </select>
        </div>
        {error && <Alert>{error}</Alert>}
        {confirming ? (
          <div className="space-y-2" role="group" aria-label={`Confirm deleting ${l.title}`}>
            <p className="text-sm font-medium text-red-900">Delete this listing? Buyers will no longer see it.</p>
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1" onClick={remove} disabled={pending}>Yes, delete</Button>
              <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>Keep</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Link href={`/sell/listings/${l.id}/edit`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border-2 border-navy font-semibold text-navy hover:bg-mist">Edit</Link>
            <button type="button" onClick={() => setConfirming(true)} className="min-h-11 flex-1 rounded-lg border-2 border-red-800 font-semibold text-red-800 hover:bg-red-50">Delete</button>
          </div>
        )}
      </div>
    </li>
  );
}
