"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PublicBetaFooter } from "@/components/PublicBetaFooter";

/**
 * Routes considered "terminal-style". On these routes:
 *   - <main> fills the viewport (no centered max-width gutter)
 *   - PublicBetaFooter is NOT rendered
 *   - Workspace widgets can resize all the way to the right edge
 *
 * /trade, /perps, /custom: full modular workspaces.
 * /markets, /portfolio:    trading utility surfaces with their own
 *                          dense layouts; the bottom marketing footer
 *                          is unwanted here per operator feedback.
 * /history:                dense terminal-style history screen
 *                          (FRONTEND-BACKEND-HISTORY-V1) — the bottom
 *                          marketing footer is removed per operator
 *                          feedback so the table can use the full
 *                          viewport height.
 *
 * /, /health and all routes outside the (trading) group stay in
 * "page mode" with the original max-w-screen-2xl + footer.
 */
const TERMINAL_ROUTES = [
  "/trade",
  "/perps",
  "/custom",
  "/markets",
  "/portfolio",
  "/history",
  "/leaderboard",
  "/api",
];

function isTerminalRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return TERMINAL_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
}

export function TradingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const terminal = isTerminalRoute(pathname);
  return (
    <>
      {terminal ? (
        <main
          data-testid="trading-main-terminal"
          data-route-mode="terminal"
          className="min-h-0 flex-1 overflow-hidden p-0"
        >
          {children}
        </main>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <main
            data-testid="trading-main"
            data-route-mode="page"
            className="mx-auto w-full max-w-screen-2xl flex-1 px-3 py-3 lg:px-4 lg:py-4"
          >
            {children}
          </main>
          <PublicBetaFooter />
        </div>
      )}
    </>
  );
}
