import Link from "next/link";
import Logo from "./Logo";

export const NAV = [
  { href: "/", label: "Home", icon: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V11z" },
  { href: "/browse", label: "Browse", icon: "M11 4a7 7 0 1 0 4.4 12.4l4.6 4.6 1.4-1.4-4.6-4.6A7 7 0 0 0 11 4z" },
  { href: "/looking-for", label: "Looking For", icon: "M12 2l3 6.5 7 .9-5.1 4.9 1.3 7L12 17.8 5.8 21.3l1.3-7L2 9.4l7-.9L12 2z" },
  { href: "/account", label: "Account", icon: "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v3h16v-3c0-2.8-3.6-5-8-5z" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-navy/10">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-2">
        <Logo />
        <nav aria-label="Main" className="hidden md:flex gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="min-h-11 inline-flex items-center px-4 rounded-md font-medium text-navy hover:bg-mist">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
