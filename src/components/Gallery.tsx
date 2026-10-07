"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import Icon from "@/components/Icon";
type Img = { url: string; alt: string };

export default function Gallery({ images, lowData }: { images: Img[]; lowData: boolean }) {
  const scroller = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [showAll, setShowAll] = useState(!lowData);
  const shown = showAll ? images : images.slice(0, 1);

  const go = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const reduce = lowData || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  };

  if (images.length === 0) {
    return <div className="flex aspect-square items-center justify-center rounded-2xl bg-mist text-muted">No photo yet</div>;
  }

  return (
    <div className="relative">
      <ul ref={scroller} aria-label="Photos" tabIndex={0}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl bg-mist [scrollbar-width:none]">
        {shown.map((img, i) => (
          <li key={img.url} className="relative aspect-square min-w-full snap-center" aria-roledescription="slide" aria-label={`${i + 1} of ${images.length}`}>
            <Image src={img.url} alt={img.alt} fill priority={i === 0} sizes="(max-width: 768px) 100vw, 50vw" quality={lowData ? 40 : 75} className="object-cover" />
          </li>
        ))}
      </ul>
      {shown.length > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous photo"
            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-navy shadow disabled:opacity-40"><Icon name="chevron-left" /></button>
          <button type="button" onClick={() => go(1)} disabled={index >= shown.length - 1} aria-label="Next photo"
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-navy shadow disabled:opacity-40"><Icon name="chevron-right" /></button>
          <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-navy/80 px-3 py-1 text-sm text-white" aria-live="polite">{index + 1} / {shown.length}</p>
        </>
      )}
      {!showAll && images.length > 1 && (
        <button type="button" onClick={() => setShowAll(true)} className="mt-2 min-h-11 font-semibold text-royal underline">
          Show {images.length - 1} more photo{images.length - 1 === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}
