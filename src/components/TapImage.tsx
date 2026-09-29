"use client";

import Image from "next/image";
import { useState } from "react";

/** Low-data mode: the photo only downloads after the user taps. */
export default function TapImage({ src, alt, sizes, quality = 35 }: { src: string; alt: string; sizes: string; quality?: number }) {
  const [show, setShow] = useState(false);
  if (show) return <Image src={src} alt={alt} fill sizes={sizes} quality={quality} className="object-cover" />;
  return (
    <button type="button" onClick={() => setShow(true)} aria-label={`Load photo: ${alt}`}
      className="flex h-full w-full flex-col items-center justify-center bg-mist p-1 text-center text-xs font-semibold text-navy">
      <span aria-hidden="true" className="text-xl">📷</span>
      Tap to load
    </button>
  );
}
