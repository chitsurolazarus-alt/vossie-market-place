import Image from "next/image";
import Link from "next/link";

// Logo mark only; the accessible name carries the product name.
export default function Logo() {
  return (
    <Link href="/" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl" aria-label="HustleHub home">
      <Image src="/brand/hustlehub-mark.svg" alt="" width={40} height={40} className="h-10 w-10" priority unoptimized />
    </Link>
  );
}
