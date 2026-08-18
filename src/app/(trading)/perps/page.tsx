import { Workspace } from "@/components/workspace/Workspace";
import { PerpsSymbolProvider } from "@/lib/perps-symbol";

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
       *
       * The bottom "read-only account activity" strip (positions /
       * orders / fills / liquidations / funding) was removed for
       * visual polish. Every one of those panels rendered the same
       * "Trading is not enabled yet" chrome and repeated the same
       * empty-state copy — pure noise while Perps stays fail-closed.
       * The corresponding backend read endpoints remain live for
       * operators; when Perps trading is authorized they can be
       * remounted from git history.
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
      </PerpsSymbolProvider>
    </div>
  );
}
