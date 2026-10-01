import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 grid gap-6 sm:grid-cols-2 items-center">
        <div>
          <p className="font-display text-xl font-bold">Vossie Market Place</p>
          <p className="text-white/80 mt-1">Student hustles. Campus customers.</p>
        </div>
        <div className="sm:text-right">
          <span className="inline-block bg-white rounded-md p-2">
            <Image src="/brand/eduvos-logo.png" alt="Eduvos" width={3019} height={1116} className="h-8 w-auto" />
          </span>
          <p className="text-sm text-white/80 mt-3">
            An Eduvos Incubation Hub project &middot;{" "}
            <Link href="/growth" className="underline min-h-11 inline-flex items-center">Hub Growth</Link>{" "}&middot;{" "}
            <Link href="/how-trust-works" className="underline min-h-11 inline-flex items-center">How trust works</Link>{" "}&middot;{" "}
            <Link href="/privacy" className="underline min-h-11 inline-flex items-center">Privacy</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
