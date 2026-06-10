"use client";

import { useOrderbook } from "@/hooks/trading";
import { ErrorState, LoadingState, EmptyState } from "@/components/ui";

export function OrderbookPanel({ seriesId }: { seriesId: string | null }) {
  const { data, error, isLoading, refetch } = useOrderbook(seriesId);

  if (!seriesId) {
    return (
      <EmptyState
        title="No series selected"
        description="Pick a strike to see its orderbook."
      />
    );
  }
  if (isLoading && !data) return <LoadingState label="Loading orderbook…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const top = data?.data.orderbook_top;
  if (!top) {
    return (
      <EmptyState
        title="Orderbook empty"
        description="No orders for this series yet."
      />
    );
  }
  return (
    <div className="rounded border border-zinc-200 bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">
        Best bid / ask
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded bg-emerald-50 px-2 py-1 dark:bg-emerald-950">
          <div className="text-[10px] text-emerald-700 dark:text-emerald-300">bid</div>
          <div className="font-mono">{top.best_bid_price_1e8 ?? "—"}</div>
          <div className="text-[10px] text-zinc-500">size {top.best_bid_size ?? "—"}</div>
        </div>
        <div className="rounded bg-red-50 px-2 py-1 dark:bg-red-950">
          <div className="text-[10px] text-red-700 dark:text-red-300">ask</div>
          <div className="font-mono">{top.best_ask_price_1e8 ?? "—"}</div>
          <div className="text-[10px] text-zinc-500">size {top.best_ask_size ?? "—"}</div>
        </div>
      </div>
    </div>
  );
}
