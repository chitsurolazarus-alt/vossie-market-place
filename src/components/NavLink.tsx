"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Nav link that knows when it is the current section (exact for Home, prefix for the rest). */
export function useActive(href: string) {
  const path = usePathname();
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

export function BottomNavLink({ href, label, icon, badge }: { href: string; label: string; icon: ReactNode; badge?: ReactNode }) {
  const on = useActive(href);
  return (
    <Link href={href} aria-current={on ? "page" : undefined}
      className={`relative flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[11px] leading-tight transition-colors active:bg-mist ${on ? "font-bold text-royal" : "font-medium text-navy"}`}>
      {on && <span aria-hidden="true" className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-royal" />}
      <span className="relative">{icon}{badge}</span>
      {label}
    </Link>
  );
}

export function TopNavLink({ href, children }: { href: string; children: ReactNode }) {
  const on = useActive(href);
  return (
    <Link href={href} aria-current={on ? "page" : undefined}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 font-medium transition-colors hover:bg-mist ${on ? "bg-mist font-bold text-royal" : "text-navy"}`}>
      {children}
    </Link>
  );
}
