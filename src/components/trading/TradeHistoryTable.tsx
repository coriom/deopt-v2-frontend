"use client";

import { useWallet } from "@/lib/wallet";
import { useTradeHistory } from "@/hooks/trading";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";

export function TradeHistoryTable() {
  const { address } = useWallet();
  const { data, error, isLoading, refetch } = useTradeHistory(address);
  if (!address) return <EmptyState title="Connect your wallet" />;
  if (isLoading && !data) return <LoadingState label="Loading history…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;
  const items = data.data.items;
  if (items.length === 0) return <EmptyState title="No history" />;
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-zinc-500">
        <tr>
          <th className="py-1 pr-2">When</th>
          <th className="py-1 pr-2">Kind</th>
          <th className="py-1 pr-2">Series</th>
          <th className="py-1 pr-2">Side</th>
          <th className="py-1 pr-2 text-right">Size</th>
          <th className="py-1 pr-2 text-right">Price (1e8)</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, idx) => (
          <tr key={idx} className="border-t border-zinc-200 dark:border-zinc-800">
            <td className="py-1 pr-2 text-zinc-500">
              {it.created_at_ms ? new Date(it.created_at_ms).toISOString().slice(0, 19).replace("T", " ") : "—"}
            </td>
            <td className="py-1 pr-2">{it.event_kind}</td>
            <td className="py-1 pr-2 font-mono">{it.series_id ?? "—"}</td>
            <td className="py-1 pr-2">{it.side ?? "—"}</td>
            <td className="py-1 pr-2 text-right font-mono">{it.size_1e8 ?? it.size ?? "—"}</td>
            <td className="py-1 pr-2 text-right font-mono">{it.price_1e8 ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
