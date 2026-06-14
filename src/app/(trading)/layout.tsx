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
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { TradingShell } from "@/components/TradingShell";
import { WorkspaceBridgeProvider } from "@/lib/workspace-bridge";
import { WidgetMenuButton } from "@/components/workspace/WidgetMenuButton";

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
     <WorkspaceBridgeProvider>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-black text-zinc-100">
        <TestnetUnauditedBanner />
        <MainnetDisabledBanner />
        <WrongNetworkBanner />
        <header className="flex flex-wrap items-center justify-between gap-y-1 border-b border-zinc-900 bg-zinc-950 px-3 py-2">
          <nav
            aria-label="Primary"
            className="flex items-center gap-2 text-[13px] sm:gap-3"
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
            <Link
              href="/custom"
              data-testid="navbar-link-custom"
              className="text-zinc-400 hover:text-emerald-300"
            >
              Custom
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
            <WidgetMenuButton />
            <HamburgerMenu />
          </div>
        </header>
        <TradingShell>{children}</TradingShell>
      </div>
     </WorkspaceBridgeProvider>
    </WalletProvider>
  );
}
