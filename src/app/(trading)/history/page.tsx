import { TradeHistoryTable } from "@/components/trading/TradeHistoryTable";

export default function HistoryPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">History</h1>
      <TradeHistoryTable />
    </div>
  );
}
