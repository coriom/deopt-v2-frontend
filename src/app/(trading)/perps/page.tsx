import { Workspace } from "@/components/workspace/Workspace";
import { PerpsSymbolProvider } from "@/lib/perps-symbol";
import { PerpsPositionsPanel } from "@/components/trading/perps/PerpsPositionsPanel";
import { PerpsOrdersPanel } from "@/components/trading/perps/PerpsOrdersPanel";
import { PerpsFillsPanel } from "@/components/trading/perps/PerpsFillsPanel";
import { PerpsLiquidationsPanel } from "@/components/trading/perps/PerpsLiquidationsPanel";
import { PerpsFundingPanel } from "@/components/trading/perps/PerpsFundingPanel";
import { PerpsV1DisclosuresBanner } from "@/components/trading/perps/PerpsV1DisclosuresBanner";

export default function PerpsPage() {
  return (
    <div
      data-testid="perps-terminal-shell"
      className="flex h-full min-h-0 flex-col overflow-y-auto"
    >
      {/*
       * TESTNET-SELF-SERVE-ONBOARDING-V1 — thin visible banner so a
       * tester landing on `/perps` immediately understands the surface
       * is a preview. The backend mutation routes already fail closed
       * with `PerpsNotLive` and the trade form button is hard-disabled
       * with the same label; this banner makes the not-live posture
       * legible at the page level too.
       */}
      <div
        data-testid="perps-not-live-banner"
        className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[12px] text-zinc-300"
      >
        <span className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <strong className="font-semibold text-zinc-100">Perps · not live</strong>
          <span className="text-zinc-400">
            in this Options-only public testnet beta. Order entry and
            cancel are disabled. Read-only market data may render live
            on Base Sepolia; trading is not enabled. Options trade on{" "}
            <a
              href="/options"
              data-testid="perps-not-live-options-link"
              className="text-emerald-300 underline-offset-2 hover:underline"
            >
              /options
            </a>
            .
          </span>
        </span>
      </div>
      {/*
       * PERPS-FRONTEND-TICKET-ENABLEMENT-V1 — V1 caveat disclosures.
       * Two honest statements the audit requires be visible on `/perps`
       * before any public unlock: (1) `mark == index` in V1;
       * (2) funding is wired but on-chain funding flag is off for
       * ETH-PERP + BTC-PERP so accrual is currently zero. Rendered
       * regardless of ticket-enablement flag.
       */}
      <PerpsV1DisclosuresBanner />
      <PerpsSymbolProvider>
        {/*
         * The Workspace measures its own container via
         * `getBoundingClientRect` and shows a "canvas needs at least
         * 320×240 px" fallback when squeezed. Give it a minimum
         * height so it always renders; the whole page scrolls when
         * content overflows.
         */}
        <div className="h-[560px] flex-shrink-0">
          <Workspace
            workspaceId="perps"
            title="Perps workspace"
            subtitle="modular · v2 · resizable"
          />
        </div>
        {/*
         * PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 —
         * read-only account activity area. `PerpsPositionsPanel`
         * remains here from `PERPS-ISOLATED-MARGIN-POSITION-ENGINE-V1`;
         * the four new panels (orders, fills, liquidations, funding)
         * all wire REST snapshots to `/accounts/:address/perps/*` and
         * refresh on their matching lifecycle channel delta. Empty
         * states are honest; no fake rows. Trading remains disabled.
         */}
        <div
          data-testid="perps-account-activity"
          className="flex flex-shrink-0 flex-col gap-2 border-t border-zinc-900 bg-black/40 p-2"
        >
          <PerpsPositionsPanel />
          <PerpsOrdersPanel />
          <PerpsFillsPanel />
          <PerpsLiquidationsPanel />
          <PerpsFundingPanel />
        </div>
      </PerpsSymbolProvider>
    </div>
  );
}
