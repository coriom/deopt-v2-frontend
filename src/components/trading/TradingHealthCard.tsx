"use client";

import { useTradingHealth } from "@/hooks/trading";
import { ErrorState, LoadingState } from "@/components/ui";

const STATUS_COLOR: Record<string, string> = {
  ok: "bg-emerald-500",
  degraded: "bg-emerald-700",
  unhealthy: "bg-red-600",
};

export function TradingHealthCard() {
  const { data, error, isLoading, refetch } = useTradingHealth();
  if (isLoading && !data) return <LoadingState label="Checking health…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;
  const h = data.data;
  const dot = STATUS_COLOR[h.overall_status] ?? "bg-zinc-400";
  return (
    <div className="flex flex-col gap-3 rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-full ${dot}`} />
        <span className="text-sm font-medium uppercase">{h.overall_status}</span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <dt className="text-zinc-500">Chain id</dt>
        <dd className="text-right font-mono">{h.chain_id}</dd>
        <dt className="text-zinc-500">RPC reachable</dt>
        <dd className="text-right">{h.rpc_reachable ? "yes" : "no"}</dd>
        <dt className="text-zinc-500">Indexer lag (blocks)</dt>
        <dd className="text-right font-mono">{h.indexer_lag_blocks ?? "—"}</dd>
        <dt className="text-zinc-500">Indexed block</dt>
        <dd className="text-right font-mono">{h.indexed_block ?? "—"}</dd>
      </dl>
    </div>
  );
}
