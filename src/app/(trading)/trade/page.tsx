import { OptionsChainTerminal } from "@/components/trading/terminal/OptionsChainTerminal";

export default function TradePage() {
  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Options chain
          </h1>
          <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">
            terminal · v1
          </span>
        </div>
        <p className="text-[11px] text-zinc-400">
          Calls on the left, strike ladder in the center, puts on the right.
          Click a cell to open the detail panel. Public testnet beta on Base
          Sepolia (chain 84532) — no real funds.
        </p>
      </header>
      <OptionsChainTerminal />
    </div>
  );
}
