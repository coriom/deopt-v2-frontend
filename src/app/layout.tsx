import type { Metadata, Viewport } from "next";
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
    // Apple touch icon powers "Add to Home Screen" on iOS Safari,
    // which is Apple's PWA install path. Chrome / Edge / Firefox
    // consume the web manifest below instead.
    apple: "/logo-deopt.png",
  },
  // PWA manifest — makes the site installable as a standalone
  // desktop / home-screen app. Once installed, every `window.open`
  // launched from the app opens in a chromeless standalone frame
  // (no address bar, no tab strip, no browser buttons). This is
  // what powers the navbar `+` button's "terminal window" feel.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DeOpt",
  },
};

// Next 16 requires `themeColor` on the `viewport` export, not
// on `metadata` (moved out of metadata in Next 14). The pure-black
// theme colour matches the terminal background so the browser /
// OS chrome does not flash a light strip on load.
export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${nav.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply the user's saved brightness preference synchronously
            before first paint to avoid a flash of default brightness.
            The formula is duplicated from
            `brightnessPctToFilter()` in src/lib/brightness.ts — keep
            in sync if the mapping ever changes. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var v=parseInt(localStorage.getItem('deopt:brightness'),10);if(!isFinite(v))v=50;if(v<0)v=0;if(v>100)v=100;document.documentElement.style.filter='brightness('+(0.5+v/100).toFixed(3)+')';}catch(e){}})();",
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
