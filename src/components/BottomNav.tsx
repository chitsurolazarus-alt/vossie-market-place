import Link from "next/link";
import { NAV } from "./Header";

export default function BottomNav() {
  return (
    <nav aria-label="Primary" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-navy/10">
      <ul className="grid grid-cols-5">
        {NAV.map((n) => (
          <li key={n.href}>
            <Link href={n.href} className="flex flex-col items-center justify-center gap-1 min-h-14 py-2 text-[11px] font-medium leading-tight text-navy active:bg-mist">
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true"><path d={n.icon} /></svg>
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
