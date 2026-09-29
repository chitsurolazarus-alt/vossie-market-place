import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import RegisterSW from "@/components/RegisterSW";
import { WelcomeGate } from "@/components/Tours";
import { getLowData } from "@/lib/viewer";

const display = Playfair_Display({ variable: "--font-display-face", subsets: ["latin"] });
const body = Inter({ variable: "--font-body-face", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Vossie Market Place", template: "%s | Vossie Market Place" },
  description: "Student hustles. Campus customers. The Eduvos Incubation Hub marketplace.",
  applicationName: "Vossie Market Place",
  appleWebApp: { capable: true, title: "Vossie", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#16305e",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lowData = await getLowData();
  return (
    <html lang="en" data-lowdata={lowData ? "true" : "false"} className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <a href="#main" className="skip-link">Skip to content</a>
        <Header />
        <main id="main" className="flex-1 pb-24 md:pb-0">{children}</main>
        <Footer />
        <BottomNav />
        <RegisterSW />
        <WelcomeGate />
      </body>
    </html>
  );
}
