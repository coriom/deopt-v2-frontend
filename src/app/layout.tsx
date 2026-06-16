import type { Metadata } from "next";
import { Manrope, Nunito, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Rounder grotesk for UI text — slightly softer than the prior default
// Arial stack while staying technical at 12–14px. Monospace is kept
// strictly for numbers, addresses, tickers, prices, hashes. The
// navbar opts into a rounder Nunito via `--app-font-nav` for a softer
// terminal-header feel without making the whole product look like a
// consumer app.
const sans = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--app-font-sans",
});
const nav = Nunito({
  subsets: ["latin"],
  display: "swap",
  variable: "--app-font-nav",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--app-font-mono",
});

export const metadata: Metadata = {
  title: "DeOpt",
  description: "DeOpt — programmable derivatives infrastructure.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${nav.variable} ${mono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
