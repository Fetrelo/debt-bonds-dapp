import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SolanaProviders } from "@/components/SolanaProviders";
import { Header } from "@/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Debt Bonds",
  description: "Debt Bonds dApp on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="relative min-h-full">
        <div className="app-bg pointer-events-none fixed inset-0 -z-10" />
        <div className="app-grid pointer-events-none fixed inset-0 -z-10 opacity-40 dark:opacity-30" />

        <SolanaProviders>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex flex-1 flex-col">{children}</main>
            <footer className="border-t border-black/5 py-6 text-center text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-500">
              Built with Next.js, Anchor, and Solana wallet adapter.
            </footer>
          </div>
        </SolanaProviders>
      </body>
    </html>
  );
}
