import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { WalletProvider } from "@/lib/wallet";
import {
  MainnetDisabledBanner,
  NetworkBadge,
  TestnetUnauditedBanner,
  WrongNetworkBanner,
} from "@/components/banners";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { PublicBetaFooter } from "@/components/PublicBetaFooter";
import { ReportIssueButton } from "@/components/ReportIssueButton";

export default function TradingLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <div className="flex min-h-screen flex-col bg-black text-zinc-100">
        <TestnetUnauditedBanner />
        <MainnetDisabledBanner />
        <WrongNetworkBanner />
        <header className="flex flex-wrap items-center justify-between gap-y-2 border-b border-zinc-900 bg-zinc-950 px-4 py-3">
          <nav className="flex items-center gap-3 text-sm sm:gap-4">
            <Link
              href="/"
              data-testid="header-home-link"
              className="flex items-center gap-2 font-semibold text-zinc-100"
            >
              <Image
                src="/favicon.png"
                alt="DeOpt"
                width={22}
                height={28}
                priority
                data-testid="header-logo"
              />
              <span className="tracking-tight">DeOpt</span>
            </Link>
            <Link
              href="/markets"
              className="text-zinc-400 hover:text-emerald-300"
            >
              Markets
            </Link>
            <Link
              href="/portfolio"
              className="text-zinc-400 hover:text-emerald-300"
            >
              Portfolio
            </Link>
            <Link
              href="/history"
              className="hidden text-zinc-400 hover:text-emerald-300 sm:inline"
            >
              History
            </Link>
            <Link
              href="/health"
              className="hidden text-zinc-400 hover:text-emerald-300 sm:inline"
            >
              Health
            </Link>
          </nav>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline">
              <ReportIssueButton label="Report a bug" variant="compact" />
            </span>
            <NetworkBadge />
            <WalletConnectButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <PublicBetaFooter />
      </div>
    </WalletProvider>
  );
}
