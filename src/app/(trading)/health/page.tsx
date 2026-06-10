import { TradingHealthCard } from "@/components/trading/TradingHealthCard";

export default function HealthPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Trading health</h1>
      <p className="text-xs text-zinc-500">
        Read-only subset of the backend executor health. NO signer / KMS /
        mainnet-defence internals are surfaced here.
      </p>
      <TradingHealthCard />
    </div>
  );
}
