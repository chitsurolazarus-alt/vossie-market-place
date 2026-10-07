import Link from "next/link";
import { NAV } from "./Header";
import Icon from "./Icon";
import MessagesBadge from "./MessagesBadge";
import { getUnreadCounts } from "@/lib/inbox-data";

export default async function BottomNav() {
  const unread = await getUnreadCounts();
  return (
    <nav aria-label="Primary" className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-navy/10 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {NAV.filter((n) => !n.desktopOnly).map((n) => (
          <li key={n.href}>
            <Link href={n.href} className="flex flex-col items-center justify-center gap-1 min-h-14 py-2 text-[11px] font-medium leading-tight text-navy active:bg-mist transition-colors">
              <span className="relative">
                <Icon name={n.icon} size="lg" />
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
