import { Workspace } from "@/components/workspace/Workspace";
import { PerpsSymbolProvider } from "@/lib/perps-symbol";

export default function PerpsPage() {
  return (
    <div
      data-testid="perps-terminal-shell"
      className="flex h-full min-h-0 flex-col"
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
            cancel are disabled; stats are placeholders. Options trade
            on{" "}
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
      <PerpsSymbolProvider>
        <Workspace
          workspaceId="perps"
          title="Perps workspace"
          subtitle="modular · v2 · resizable"
        />
      </PerpsSymbolProvider>
    </div>
  );
}
