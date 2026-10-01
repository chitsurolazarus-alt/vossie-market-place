import Link from "next/link";
import Logo from "./Logo";
import LowDataToggle from "./LowDataToggle";
import MessagesBadge from "./MessagesBadge";
import NotificationBell from "./NotificationBell";
import { ThemeIconButton } from "./ThemeToggle";
import { getUnreadCounts } from "@/lib/inbox-data";
import { getLowData } from "@/lib/viewer";

export const NAV = [
  { href: "/", label: "Home", icon: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V11z" },
  { href: "/browse", label: "Browse", icon: "M11 4a7 7 0 1 0 4.4 12.4l4.6 4.6 1.4-1.4-4.6-4.6A7 7 0 0 0 11 4z" },
  { href: "/messages", label: "Messages", icon: "M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z", badge: true },
  { href: "/saved", label: "Saved", icon: "M12 21s-7.5-4.6-9.5-9.2C1.3 8.6 3 5.5 6.2 5.5c1.9 0 3.2 1 3.8 2 .6-1 1.9-2 3.8-2 3.2 0 4.9 3.1 3.7 6.3C19.5 16.4 12 21 12 21z" },
  { href: "/looking-for", label: "Looking For", icon: "M12 2l3 6.5 7 .9-5.1 4.9 1.3 7L12 17.8 5.8 21.3l1.3-7L2 9.4l7-.9L12 2z", desktopOnly: true },
  { href: "/account", label: "Account", icon: "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v3h16v-3c0-2.8-3.6-5-8-5z" },
];

export default async function Header() {
  const [lowData, unread] = await Promise.all([getLowData(), getUnreadCounts()]);
  return (
    <header className="sticky top-0 z-40 border-b border-navy/10 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
        <Logo />
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <nav aria-label="Main" className="hidden gap-1 md:flex">
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
