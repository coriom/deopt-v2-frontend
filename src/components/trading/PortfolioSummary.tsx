"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { usePortfolio } from "@/hooks/trading";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import type { NotReadyData, PortfolioData } from "@/lib/trading-types";

function isPortfolio(x: PortfolioData | NotReadyData): x is PortfolioData {
  return !("not_ready" in x);
}

export function PortfolioSummary() {
  const { address } = useWallet();
  const { data, error, isLoading, refetch } = usePortfolio(address);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!data) return;
    Promise.resolve().then(() => setLastUpdatedAt(Date.now()));
  }, [data]);

  if (!address) return <EmptyState title="Connect your wallet" />;
  if (isLoading && !data) return <LoadingState label="Loading portfolio…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;
  const p = data.data;

  const isPartial = data.status === "partial";

  return (
    <div className="flex flex-col gap-2">
      {!isPortfolio(p) ? (
        <div
          data-testid="portfolio-not-ready"
          className="rounded border border-emerald-500/30 bg-zinc-950 p-3 text-xs text-emerald-200"
        >
          <div className="font-medium">Portfolio not yet wired</div>
          <p className="mt-1">{p.reason}</p>
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-2 rounded border border-zinc-200 bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-3">
          <Cell label="Equity" value={p.equity} />
          <Cell label="IM" value={p.im} />
          <Cell label="MM" value={p.mm} />
          <Cell label="Free collateral" value={p.free_collateral} />
          <Cell label="Notional" value={p.total_notional ?? "—"} />
          <Cell
            label="Open positions"
            value={String(p.open_positions_count ?? 0)}
          />
        </dl>
      )}
      {isPartial && (
        <div
          data-testid="portfolio-partial-warning"
          className="rounded border border-emerald-500/30 bg-zinc-950 p-2 text-[11px] text-emerald-200"
        >
          Portfolio returned <strong>partial</strong> — some upstream data
          source is starting up. The numbers above may be missing the latest
          tick. Refresh in a moment.
        </div>
      )}
      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span
          data-testid="portfolio-last-updated-at"
          title="Last time the portfolio data was refreshed"
        >
          {lastUpdatedAt
            ? `Last refreshed at ${new Date(lastUpdatedAt).toISOString()}`
            : "Not yet refreshed"}
        </span>
        <button
          type="button"
          data-testid="portfolio-refresh-button"
          onClick={refetch}
          className="rounded border border-zinc-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-mono">{value}</dd>
    </>
  );
}
