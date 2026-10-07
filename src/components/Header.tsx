import { TopNavLink } from "./NavLink";
import type { IconName } from "./Icon";
import Logo from "./Logo";
import MessagesBadge from "./MessagesBadge";
import NotificationBell from "./NotificationBell";
import { ThemeIconButton } from "./ThemeToggle";
import { getUnreadCounts } from "@/lib/inbox-data";

// Mobile bottom nav shows the items without `desktopOnly` (max 5). The desktop top bar shows all of them.
// Saved, Looking For and Settings are reached from Account on mobile.
export const NAV: { href: string; label: string; icon: IconName; badge?: boolean; desktopOnly?: boolean }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/browse", label: "Browse", icon: "search" },
  { href: "/sell", label: "Sell", icon: "store" },
  { href: "/messages", label: "Messages", icon: "message", badge: true },
  { href: "/saved", label: "Saved", icon: "heart", desktopOnly: true },
  { href: "/looking-for", label: "Looking For", icon: "megaphone", desktopOnly: true },
  { href: "/account", label: "Account", icon: "user" },
];

export default async function Header() {
  const unread = await getUnreadCounts();
  return (
    <header className="sticky top-0 z-40 border-b border-navy/10 bg-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
        <Logo />
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <nav aria-label="Main" className="hidden gap-1 lg:flex">
            {NAV.map((n) => (
              <TopNavLink key={n.href} href={n.href}>
                {n.label}
                {n.badge && unread.userId && <MessagesBadge userId={unread.userId} initial={unread.messages} />}
              </TopNavLink>
            ))}
          </nav>
          {unread.userId && <NotificationBell userId={unread.userId} initialUnread={unread.notifications} />}
          <ThemeIconButton />
        </div>
      </div>
    </header>
  );
}
