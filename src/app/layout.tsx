import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import ToastProvider from "@/components/Toast";
import RegisterSW from "@/components/RegisterSW";
import AccountNotice from "@/components/AccountNotice";
import { WelcomeGate } from "@/components/Tours";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { getLowData } from "@/lib/viewer";

const display = Playfair_Display({ variable: "--font-display-face", subsets: ["latin"] });
const body = Inter({ variable: "--font-body-face", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "HustleHub", template: "%s | HustleHub" },
  description: "Student hustles. Nationwide. Buy and sell from student businesses, built for the Eduvos Incubation Hub.",
  applicationName: "HustleHub",
  appleWebApp: { capable: true, title: "HustleHub", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#16305e" }, { media: "(prefers-color-scheme: dark)", color: "#0b1322" }],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lowData = await getLowData();
  return (
    // data-theme is set by the inline script below before first paint (saved choice, else the device setting).
    <html lang="en" suppressHydrationWarning data-lowdata={lowData ? "true" : "false"} className={`${display.variable} ${body.variable} h-full antialiased`}>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>
      <body className="min-h-full flex flex-col font-sans">
        <ToastProvider>
        <a href="#main" className="skip-link">Skip to content</a>
        <Header />
        <AccountNotice />
        <main id="main" className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
        <BottomNav />
        <RegisterSW />
        <WelcomeGate />
        </ToastProvider>
      </body>
    </html>
  );
}
