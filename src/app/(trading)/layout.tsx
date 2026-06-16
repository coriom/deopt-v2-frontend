import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { WalletProvider } from "@/lib/wallet";
import {
  MainnetDisabledBanner,
  TestnetUnauditedBanner,
  WrongNetworkBanner,
} from "@/components/banners";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { PrimaryNavLinks } from "@/components/PrimaryNavLinks";
import { TradingShell } from "@/components/TradingShell";
import { WorkspaceBridgeProvider } from "@/lib/workspace-bridge";
import { WidgetMenuButton } from "@/components/workspace/WidgetMenuButton";

interface NavItem {
  testid: string;
  label: string;
  href: string;
}

const PRIMARY_NAV: NavItem[] = [
  { testid: "navbar-link-options",      label: "Options",        href: "/trade" },
  { testid: "navbar-link-perps",        label: "Perps",          href: "/perps" },
  { testid: "navbar-link-markets",      label: "Markets",        href: "/markets" },
  { testid: "navbar-link-rfq-strategy", label: "RFQ/Strategy",   href: "/rfq-strategy" },
  { testid: "navbar-link-custom",       label: "Custom",         href: "/custom" },
  { testid: "navbar-link-academy",      label: "DeOpt Academy",  href: "/docs" },
];

export default function TradingLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
     <WorkspaceBridgeProvider>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-black text-zinc-100">
        <TestnetUnauditedBanner />
        <MainnetDisabledBanner />
        <WrongNetworkBanner />
        <header
          data-testid="terminal-navbar"
          style={{ fontFamily: "var(--app-font-nav)" }}
          className="flex flex-wrap items-center justify-between gap-y-1 border-b border-zinc-900 bg-zinc-950 px-3 py-2"
        >
          <nav
            aria-label="Primary"
            className="flex items-center gap-2 text-[15px] sm:gap-3"
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
            <HamburgerMenu />
            <PrimaryNavLinks items={PRIMARY_NAV} />
          </nav>
          <div
            data-testid="terminal-navbar-actions"
            className="flex flex-wrap items-center gap-2 sm:gap-3"
          >
            <WidgetMenuButton />
            <WalletConnectButton />
          </div>
        </header>
        <TradingShell>{children}</TradingShell>
      </div>
     </WorkspaceBridgeProvider>
    </WalletProvider>
  );
}
