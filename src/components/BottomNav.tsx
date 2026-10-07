import { NAV } from "./Header";
import Icon from "./Icon";
import MessagesBadge from "./MessagesBadge";
import { BottomNavLink } from "./NavLink";
import { getUnreadCounts } from "@/lib/inbox-data";

// Five items maximum (Home, Browse, Sell, Messages, Account), icon + label, current section highlighted.
export default async function BottomNav() {
  const unread = await getUnreadCounts();
  const items = NAV.filter((n) => !n.desktopOnly).slice(0, 5);
  return (
    <nav aria-label="Primary" className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-navy/10 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {items.map((n) => (
          <li key={n.href}>
            <BottomNavLink href={n.href} label={n.label} icon={<Icon name={n.icon} size="lg" />}
              badge={n.badge && unread.userId ? <MessagesBadge userId={unread.userId} initial={unread.messages} className="absolute -right-3 -top-2" /> : undefined} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
