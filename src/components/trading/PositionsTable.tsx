"use client";

import { useWallet } from "@/lib/wallet";
import { usePositions } from "@/hooks/trading";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import type { NotReadyData, PositionsData } from "@/lib/trading-types";

function isPositions(x: PositionsData | NotReadyData): x is PositionsData {
  return !("not_ready" in x);
}

function shortenSeries(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function PositionsTable() {
  const { address } = useWallet();
  const { data, error, isLoading, refetch } = usePositions(address);

  if (!address) {
    return (
      <EmptyState
        title="Connect your wallet"
        description="Connect to see your testnet positions."
      />
    );
  }
  if (isLoading && !data) return <LoadingState label="Loading positions…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  const payload = data.data;
  if (!isPositions(payload)) {
    return (
      <div
        data-testid="positions-not-ready"
        className="rounded border border-emerald-500/30 bg-zinc-950 p-3 text-xs text-emerald-200"
      >
        <div className="font-medium">Positions not yet wired</div>
        <p className="mt-1">{payload.reason}</p>
      </div>
    );
  }
  if (payload.positions.length === 0) {
    return (
      <EmptyState
        title="No open positions"
        description="Open a position from the trade ticket on a market page. Testnet only — all positions are denominated in mock tokens."
      />
    );
  }
  return (
    <div
      data-testid="positions-table"
      className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
    >
      <table className="w-full text-xs">
        <thead className="bg-black/40 text-left text-zinc-500">
          <tr>
            <th className="py-2 pl-3 pr-2">Series</th>
            <th className="py-2 pr-2">Side</th>
            <th className="py-2 pr-2 text-right">Size</th>
            <th className="py-2 pr-2 text-right">Mark</th>
            <th className="py-2 pr-3 text-right">PnL</th>
          </tr>
        </thead>
        <tbody>
          {payload.positions.map((p) => {
            const isLong = p.side === "long";
            return (
              <tr
                key={p.series_id}
                data-testid={`position-row-${p.series_id}`}
                data-side={p.side}
                className="border-t border-zinc-800"
              >
                <td className="py-2 pl-3 pr-2 font-mono text-[10px] text-zinc-200">
                  {shortenSeries(p.series_id)}
                </td>
                <td className="py-2 pr-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                      isLong
                        ? "border border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                        : "border border-red-500/40 bg-red-950/40 text-red-200"
                    }`}
                  >
                    {isLong ? "LONG" : "SHORT"}
                  </span>
                </td>
                <td className="py-2 pr-2 text-right font-mono text-zinc-100">
                  {p.size}
                </td>
                <td className="py-2 pr-2 text-right font-mono text-zinc-300">
                  {p.mark_price_1e8 ?? "—"}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-zinc-300">
                  {p.unrealised_pnl ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-zinc-800 bg-black/40 px-3 py-2 text-[10px] text-zinc-500">
        Testnet only — mark and PnL come from the testnet mock oracle.
      </p>
    </div>
  );
}
