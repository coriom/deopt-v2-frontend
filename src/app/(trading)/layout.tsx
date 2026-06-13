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
import { HamburgerMenu } from "@/components/HamburgerMenu";

function ComingSoonNavLink({
  label,
  testid,
  title,
}: {
  label: string;
  testid: string;
  title: string;
}) {
  return (
    <span
      data-testid={testid}
      data-placeholder="true"
      aria-disabled="true"
      title={title}
      className="cursor-not-allowed text-zinc-600"
    >
      {label}
    </span>
  );
}

export default function TradingLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <div className="flex min-h-screen flex-col bg-black text-zinc-100">
        <TestnetUnauditedBanner />
        <MainnetDisabledBanner />
        <WrongNetworkBanner />
        <header className="flex flex-wrap items-center justify-between gap-y-2 border-b border-zinc-900 bg-zinc-950 px-4 py-3">
          <nav
            aria-label="Primary"
            className="flex items-center gap-3 text-sm sm:gap-4"
          >
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
              href="/trade"
              data-testid="navbar-link-options"
              className="text-zinc-400 hover:text-emerald-300"
            >
              Options
            </Link>
            <Link
              href="/perps"
              data-testid="navbar-link-perps"
              className="text-zinc-400 hover:text-emerald-300"
            >
              Perps
            </Link>
            <Link
              href="/markets"
              data-testid="navbar-link-markets"
              className="text-zinc-400 hover:text-emerald-300"
            >
              Markets
            </Link>
            <Link
              href="/portfolio"
              data-testid="navbar-link-portfolio"
              className="text-zinc-400 hover:text-emerald-300"
            >
              Portfolio
            </Link>
            <ComingSoonNavLink
              label="API"
              testid="navbar-link-api"
              title="DeOpt public API documentation — coming soon in the testnet beta cycle"
            />
            <ComingSoonNavLink
              label="DeOpt Académie"
              testid="navbar-link-academie"
              title="DeOpt Académie — educational tracks coming soon in the testnet beta cycle"
            />
          </nav>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <NetworkBadge />
            <WalletConnectButton />
            <HamburgerMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
        <PublicBetaFooter />
      </div>
    </WalletProvider>
  );
}
