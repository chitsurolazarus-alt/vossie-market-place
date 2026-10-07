import Image from "next/image";
import Link from "next/link";
import { priceLabel, publicImageUrl } from "@/lib/format";
import type { Tile } from "@/lib/browse";
import { SaveButton } from "./SaveButton";
import TapImage from "./TapImage";
import { ReplyTime, TrustBadge } from "./trust";

import Icon from "./Icon";
import Verified from "./Verified";
type Props = {
  t: Tile; saved: boolean; authed: boolean; lowData: boolean;
  index?: number;        // position in the list (first ones load eagerly)
  layout?: "card" | "row";
  priority?: boolean;
};

export default function ListingTile({ t, saved, authed, lowData, index = 0, layout, priority = false }: Props) {
  const row = layout ? layout === "row" : lowData;
  const src = t.cover_path ? publicImageUrl(t.cover_path) : null;
  const alt = t.cover_alt ?? t.title;
  const price = priceLabel(t);
  const soldOut = t.availability !== "available";
  // Low-data: below-the-fold photos wait for a tap.
  const tapToLoad = lowData && index >= 4;

  if (row) {
    return (
      <li className="relative flex gap-3 rounded-xl border border-navy/15 bg-white p-2 pr-14">
        <Link href={`/l/${t.id}`} className="flex min-h-14 flex-1 gap-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-mist">
            {src && (tapToLoad
              ? <TapImage src={src} alt={alt} sizes="80px" />
              : <Image src={src} alt={alt} fill sizes="80px" quality={35} className="object-cover" />)}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold leading-snug text-navy">{t.title}</h3>
            <p className="text-sm font-semibold text-ink">{price}{soldOut && " · Sold out"}</p>
            <p className="truncate text-sm text-muted">{t.business_name}{t.seller_verified && <Verified />}</p>
            <div className="mt-1"><TrustBadge tier={t.seller_tier} label={t.seller_tier_label} size="sm" /></div>
          </div>
        </Link>
        <SaveButton listingId={t.id} title={t.title} initialSaved={saved} authed={authed} className="absolute right-2 top-2" />
      </li>
    );
  }

  // Card layout. Structure adapted from a 21st.dev product card (image well, overlaid save badge, title/price footer),
  // restyled with HustleHub tokens: 4:3 real photo, price first in the display face, location line, trust badge.
  return (
    <li className="group relative overflow-hidden rounded-xl border border-navy/10 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
      <Link href={`/l/${t.id}`} className="block transition-transform duration-150 active:scale-[.985]">
        <div className="relative aspect-[4/3] overflow-hidden bg-mist">
          {src && <Image src={src} alt={alt} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            quality={70} priority={priority} loading={priority ? undefined : "lazy"}
            className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none" />}
          {soldOut && <span className="absolute left-2 top-2 rounded-md bg-navy px-2 py-0.5 text-xs font-bold text-white">Sold out</span>}
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-xs font-semibold text-navy">
            <Icon name={t.kind === "service" ? "bolt" : "bag"} size="sm" />{t.kind === "service" ? "Service" : "Product"}
          </span>
        </div>
        <div className="p-3">
          <p className="font-display text-xl font-bold leading-none text-navy">{price}</p>
          <h3 className="mt-1.5 line-clamp-2 font-semibold leading-snug text-ink">{t.title}</h3>
          {t.pricing_mode !== "cash" && t.swap_for && (
            <p className="mt-0.5 line-clamp-1 inline-flex items-center gap-1 text-xs text-muted"><Icon name="swap" size="sm" />Swap for: {t.swap_for}</p>
          )}
          {t.campus_name && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-muted"><Icon name="pin" size="sm" /><span className="truncate">{t.campus_name}</span></p>
          )}
          <p className="mt-1 truncate text-sm text-muted">{t.business_name}{t.seller_verified && <Verified />}</p>
          <div className="mt-1.5"><TrustBadge tier={t.seller_tier} label={t.seller_tier_label} size="sm" /></div>
          <ReplyTime band={t.seller_reply_band} className="mt-1 line-clamp-1 text-xs text-muted" />
        </div>
      </Link>
      <SaveButton listingId={t.id} title={t.title} initialSaved={saved} authed={authed} className="absolute right-2 top-2" />
    </li>
  );
}
