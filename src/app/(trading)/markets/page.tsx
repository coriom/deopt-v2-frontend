import { MarketSelector } from "@/components/trading/MarketSelector";

export default function MarketsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Markets</h1>
      <MarketSelector />
    </div>
  );
}
