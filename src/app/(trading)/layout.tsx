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
import { SubaccountSwitcher } from "@/components/wallet/SubaccountSwitcher";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { NavbarRouteIndicator } from "@/components/NavbarRouteIndicator";
import { PrimaryNavLinks } from "@/components/PrimaryNavLinks";
import { TradingShell } from "@/components/TradingShell";
import { WorkspaceBridgeProvider } from "@/lib/workspace-bridge";
import { WidgetMenuButton } from "@/components/workspace/WidgetMenuButton";
import { NewWindowButton } from "@/components/workspace/NewWindowButton";

interface NavItem {
  testid: string;
  label: string;
  href: string;
}

const PRIMARY_NAV: NavItem[] = [
  { testid: "navbar-link-options",      label: "Options",        href: "/options" },
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
            <NavbarRouteIndicator />
          </nav>
          <div
            data-testid="terminal-navbar-actions"
            className="flex flex-wrap items-center gap-2 sm:gap-3"
          >
            <Link
              href="/settings"
              data-testid="navbar-settings-link"
              aria-label="Settings"
              title="Settings"
              className="flex cursor-pointer items-center justify-center rounded border border-transparent px-1.5 py-1 text-zinc-400 hover:border-zinc-700 hover:text-white"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.85a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.02A1.7 1.7 0 0 0 10 3.04V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.02c.31.74.99 1.22 1.79 1.24H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.04Z" />
              </svg>
            </Link>
            <WidgetMenuButton />
            <NewWindowButton />
            <SubaccountSwitcher />
            <WalletConnectButton />
          </div>
        </header>
        <TradingShell>{children}</TradingShell>
      </div>
     </WorkspaceBridgeProvider>
    </WalletProvider>
  );
}
