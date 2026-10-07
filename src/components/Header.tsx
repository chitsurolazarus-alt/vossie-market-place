import Link from "next/link";
import type { IconName } from "./Icon";
import Logo from "./Logo";
import LowDataToggle from "./LowDataToggle";
import MessagesBadge from "./MessagesBadge";
import NotificationBell from "./NotificationBell";
import { ThemeIconButton } from "./ThemeToggle";
import { getUnreadCounts } from "@/lib/inbox-data";
import { getLowData } from "@/lib/viewer";

export const NAV: { href: string; label: string; icon: IconName; badge?: boolean; desktopOnly?: boolean }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/browse", label: "Browse", icon: "search" },
  { href: "/messages", label: "Messages", icon: "message", badge: true },
  { href: "/saved", label: "Saved", icon: "heart" },
  { href: "/looking-for", label: "Looking For", icon: "megaphone", desktopOnly: true },
  { href: "/account", label: "Account", icon: "user" },
];

export default async function Header() {
  const [lowData, unread] = await Promise.all([getLowData(), getUnreadCounts()]);
  return (
    <header className="sticky top-0 z-40 border-b border-navy/10 bg-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
        <Logo />
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <nav aria-label="Main" className="hidden gap-1 lg:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 font-medium text-navy hover:bg-mist">
                {n.label}
                {n.badge && unread.userId && <MessagesBadge userId={unread.userId} initial={unread.messages} />}
              </Link>
            ))}
          </nav>
          {unread.userId && <NotificationBell userId={unread.userId} initialUnread={unread.notifications} />}
          <ThemeIconButton />
          <LowDataToggle initial={lowData} />
        </div>
      </div>
    </header>
  );
}
