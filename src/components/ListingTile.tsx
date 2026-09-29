import Image from "next/image";
import Link from "next/link";
import { priceLabel, publicImageUrl } from "@/lib/format";
import type { Tile } from "@/lib/browse";
import { SaveButton } from "./SaveButton";
import TapImage from "./TapImage";

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
            <p className="truncate text-sm text-muted">{t.business_name}{t.seller_verified && " ✓"}</p>
          </div>
        </Link>
        <SaveButton listingId={t.id} title={t.title} initialSaved={saved} authed={authed} className="absolute right-2 top-2" />
      </li>
    );
  }

  return (
    <li className="relative overflow-hidden rounded-xl border border-navy/15 bg-white">
      <Link href={`/l/${t.id}`} className="block">
        <div className="relative aspect-square bg-mist">
          {src && <Image src={src} alt={alt} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            quality={70} priority={priority} loading={priority ? undefined : "lazy"} className="object-cover" />}
          {soldOut && <span className="absolute left-2 top-2 rounded bg-navy px-2 py-0.5 text-xs font-bold text-white">Sold out</span>}
        </div>
        <div className="p-3">
          <h3 className="line-clamp-2 font-semibold leading-snug text-navy">{t.title}</h3>
          <p className="mt-1 font-semibold text-ink">{price}</p>
          {t.pricing_mode !== "cash" && t.swap_for && <p className="line-clamp-1 text-xs text-muted">Swap for: {t.swap_for}</p>}
          <p className="mt-1 truncate text-sm text-muted">
            {t.business_name}{t.seller_verified && <span title="Verified Incubation Hub member"> ✓<span className="sr-only"> Verified</span></span>}
          </p>
          {t.campus_name && <p className="truncate text-xs text-muted">{t.campus_name}</p>}
        </div>
      </Link>
      <SaveButton listingId={t.id} title={t.title} initialSaved={saved} authed={authed} className="absolute right-2 top-2" />
    </li>
  );
}
