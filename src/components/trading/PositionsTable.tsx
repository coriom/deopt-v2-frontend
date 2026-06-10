"use client";

import { useWallet } from "@/lib/wallet";
import { usePositions } from "@/hooks/trading";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import type { NotReadyData, PositionsData } from "@/lib/trading-types";

function isPositions(x: PositionsData | NotReadyData): x is PositionsData {
  return !("not_ready" in x);
}

export function PositionsTable() {
  const { address } = useWallet();
  const { data, error, isLoading, refetch } = usePositions(address);

  if (!address) {
    return (
      <EmptyState
        title="Connect your wallet"
        description="Connect to see your positions."
      />
    );
  }
  if (isLoading && !data) return <LoadingState label="Loading positions…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  const payload = data.data;
  if (!isPositions(payload)) {
    return (
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
        <div className="font-medium">Positions not yet wired</div>
        <p className="mt-1">{payload.reason}</p>
      </div>
    );
  }
  if (payload.positions.length === 0) {
    return <EmptyState title="No open positions" description="Open a position from the trade ticket." />;
  }
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-zinc-500">
        <tr>
          <th className="py-1 pr-2">Series</th>
          <th className="py-1 pr-2">Side</th>
          <th className="py-1 pr-2 text-right">Size</th>
          <th className="py-1 pr-2 text-right">Mark</th>
          <th className="py-1 pr-2 text-right">PnL</th>
        </tr>
      </thead>
      <tbody>
        {payload.positions.map((p) => (
          <tr key={p.series_id} className="border-t border-zinc-200 dark:border-zinc-800">
            <td className="py-1 pr-2 font-mono">{p.series_id}</td>
            <td className="py-1 pr-2">{p.side}</td>
            <td className="py-1 pr-2 text-right font-mono">{p.size}</td>
            <td className="py-1 pr-2 text-right font-mono">{p.mark_price_1e8 ?? "—"}</td>
            <td className="py-1 pr-2 text-right font-mono">{p.unrealised_pnl ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
