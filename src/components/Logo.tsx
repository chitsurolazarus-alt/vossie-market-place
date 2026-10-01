import Image from "next/image";
import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3 min-h-11" aria-label="Vossie Market Place home">
      <span className="font-display text-base min-[400px]:text-xl font-bold text-navy leading-none">
        Vossie<span className="text-royal"> Market Place</span>
      </span>
      <span className="hidden sm:block h-6 w-px bg-navy/20" aria-hidden="true" />
      <Image
        src="/brand/eduvos-logo.png"
        alt="Eduvos"
        width={3019}
        height={1116}
        className="hidden sm:block h-7 w-auto"
        priority
      />
    </Link>
  );
}
