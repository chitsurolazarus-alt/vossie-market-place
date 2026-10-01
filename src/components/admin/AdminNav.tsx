"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/sellers", label: "Sellers", badge: "sellers" },
  { href: "/admin/reports", label: "Reports", badge: "reports" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/manage", label: "Manage" },
  { href: "/admin/audit", label: "Audit log" },
] as const;

export default function AdminNav({ counts }: { counts: { sellers: number; reports: number } }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex gap-2 pb-1">
        {ITEMS.map((i) => {
          const on = "exact" in i && i.exact ? path === i.href : path === i.href || path.startsWith(`${i.href}/`);
          const n = "badge" in i ? counts[i.badge] : 0;
          return (
            <li key={i.href} className="shrink-0">
              <Link href={i.href} aria-current={on ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border-2 px-3 text-sm font-semibold ${on ? "border-navy bg-navy text-white" : "border-navy/30 text-navy hover:bg-mist"}`}>
                {i.label}
                {n > 0 && <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${on ? "bg-white text-navy" : "bg-royal text-white"}`}>{n}<span className="sr-only"> waiting</span></span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
