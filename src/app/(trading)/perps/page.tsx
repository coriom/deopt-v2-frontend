import { Workspace } from "@/components/workspace/Workspace";
import { PerpsSymbolProvider } from "@/lib/perps-symbol";
import { PerpsPositionsPanel } from "@/components/trading/perps/PerpsPositionsPanel";
import { PerpsOrdersPanel } from "@/components/trading/perps/PerpsOrdersPanel";
import { PerpsFillsPanel } from "@/components/trading/perps/PerpsFillsPanel";
import { PerpsLiquidationsPanel } from "@/components/trading/perps/PerpsLiquidationsPanel";
import { PerpsFundingPanel } from "@/components/trading/perps/PerpsFundingPanel";

export default function PerpsPage() {
  return (
    <div
      data-testid="perps-terminal-shell"
      className="flex h-full min-h-0 flex-col overflow-y-auto"
    >
      {/*
       * Both the page-level "Perps · not live" banner and the V1
       * disclosures banner were retired for visual polish. The not-live
       * posture is still guaranteed end-to-end by: (a) the trade form
       * submit button hard-disabled with "Perps not live",
       * (b) `PERPS_PUBLIC_TRADING_ENABLED=false` default + startup
       * mainnet guard, (c) the backend returning `503 PerpsNotLive` on
       * every one of the 9 Perps mutation URLs, and (d) the readiness
       * probe reporting `perps_public_routes: fail_closed`.
       */}
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
