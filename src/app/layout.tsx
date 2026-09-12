import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { NavLinks } from "@/components/NavLinks";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Visa Application Portal",
  description:
    "Submit and track visa applications through the background check, payment and approval workflow.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/immigration-logo.png"
                alt="Tanzania Immigration Department"
                width={80}
                height={80}
                priority
                sizes="40px"
                // The emblem's navy banners sit close to the dark ground, so
                // it gets a light plate there and none in light mode.
                className="h-10 w-auto rounded-md dark:bg-white/90 dark:p-0.5"
              />
              <span className="leading-tight">
                <span className="block text-sm font-semibold tracking-tight">
                  Visa Application Portal
                </span>
                <span className="block text-[11px] text-muted">
                  Tanzania Immigration Department
                </span>
              </span>
            </Link>
            <NavLinks />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>

        <footer className="border-t border-line px-4 py-5 text-center text-xs text-muted sm:px-6">
          Microservices demo · Application · Security &amp; Background · Payment
          · fees charged in TZS
        </footer>
      </body>
    </html>
  );
}
