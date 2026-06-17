"use client";

import { usePathname } from "next/navigation";

/**
 * Surface the currently active page in the navbar when that page is
 * NOT one of the primary nav tabs (Options / Perps / Markets /
 * RFQ/Strategy / Custom / DeOpt Academy). For drawer-only surfaces
 * like /history, /leaderboard, /settings, … the chip tells the user
 * which page they are on without needing a big page title below the
 * navbar.
 */
interface IndicatorEntry {
  href: string;
  label: string;
}

const INDICATOR_ROUTES: IndicatorEntry[] = [
  { href: "/history",      label: "History" },
  { href: "/leaderboard",  label: "Leaderboard" },
  { href: "/api",          label: "API" },
  { href: "/fees",         label: "Fees" },
  { href: "/fundings",     label: "Fundings" },
  { href: "/settings",     label: "Settings" },
  { href: "/portfolio",    label: "Portfolio" },
  { href: "/feedback",     label: "Support" },
];

function matches(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function NavbarRouteIndicator() {
  const pathname = usePathname();
  const entry = INDICATOR_ROUTES.find((r) => matches(pathname, r.href));
  if (!entry) return null;
  return (
    <span
      data-testid="navbar-route-indicator"
      data-route={entry.href}
      className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200"
    >
      {entry.label}
    </span>
  );
}
