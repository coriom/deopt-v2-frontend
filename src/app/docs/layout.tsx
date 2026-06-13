import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { PublicBetaFooter } from "@/components/PublicBetaFooter";

/**
 * Shared layout for the /docs/* routes.
 *
 * Posture: public testnet beta. Renders the same dark / emerald
 * background as the trading app and a slim docs header. No wallet
 * context, no admin links, no network gate.
 */
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-black text-zinc-100">
      <div
        role="status"
        data-testid="docs-disclaimer-banner"
        className="border-b border-emerald-500/30 bg-zinc-950 px-4 py-2 text-center text-[11px] font-medium tracking-wide text-emerald-100"
      >
        <span className="text-emerald-300">Public testnet beta</span>{" "}
        <span className="text-zinc-300">—</span>{" "}
        <strong className="text-emerald-200">UNAUDITED</strong>
        <span className="text-zinc-400">
          , experimental, Base Sepolia only. No real funds.
        </span>
      </div>
      <header className="flex flex-wrap items-center justify-between gap-y-2 border-b border-zinc-900 bg-zinc-950 px-4 py-3">
        <nav className="flex items-center gap-3 text-sm sm:gap-4">
          <Link
            href="/"
            data-testid="docs-header-home-link"
            className="flex items-center gap-2 font-semibold text-zinc-100"
          >
            <Image
              src="/favicon.png"
              alt="DeOpt"
              width={22}
              height={28}
              priority
            />
            <span className="tracking-tight">DeOpt</span>
          </Link>
          <Link href="/docs" className="text-zinc-400 hover:text-emerald-300">
            Docs
          </Link>
          <Link href="/markets" className="text-zinc-400 hover:text-emerald-300">
            Markets
          </Link>
          <Link
            href="/feedback"
            className="text-zinc-400 hover:text-emerald-300"
          >
            Feedback
          </Link>
        </nav>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          Base Sepolia · chain 84532
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
      <PublicBetaFooter />
    </div>
  );
}
