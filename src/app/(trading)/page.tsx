import { MarketSelector } from "@/components/trading/MarketSelector";

export default function TradingLanding() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">DeOpt v2 — Trading MVP (testnet beta)</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Browse option products below. Mainnet trading is disabled.
      </p>
      <MarketSelector />
    </div>
  );
}
