import Link from "next/link";
import { NAV } from "./Header";
import MessagesBadge from "./MessagesBadge";
import { getUnreadCounts } from "@/lib/inbox-data";

export default async function BottomNav() {
  const unread = await getUnreadCounts();
  return (
    <nav aria-label="Primary" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-navy/10">
      <ul className="grid grid-cols-5">
        {NAV.filter((n) => !n.desktopOnly).map((n) => (
          <li key={n.href}>
            <Link href={n.href} className="flex flex-col items-center justify-center gap-1 min-h-14 py-2 text-[11px] font-medium leading-tight text-navy active:bg-mist">
              <span className="relative">
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true"><path d={n.icon} /></svg>
                {n.badge && unread.userId && <MessagesBadge userId={unread.userId} initial={unread.messages} className="absolute -right-3 -top-2" />}
              </span>
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
