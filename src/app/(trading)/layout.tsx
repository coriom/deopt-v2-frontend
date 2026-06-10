import type { ReactNode } from "react";
import Link from "next/link";
import { WalletProvider } from "@/lib/wallet";
import {
  MainnetDisabledBanner,
  NetworkBadge,
  TestnetUnauditedBanner,
} from "@/components/banners";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";

export default function TradingLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <TestnetUnauditedBanner />
        <MainnetDisabledBanner />
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="font-semibold">
              DeOpt
            </Link>
            <Link href="/markets" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Markets
            </Link>
            <Link href="/portfolio" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Portfolio
            </Link>
            <Link href="/history" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              History
            </Link>
            <Link href="/health" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Health
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <NetworkBadge />
            <WalletConnectButton />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </div>
    </WalletProvider>
  );
}
