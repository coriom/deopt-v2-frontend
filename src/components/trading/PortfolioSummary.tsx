"use client";

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

  if (!address) return <EmptyState title="Connect your wallet" />;
  if (isLoading && !data) return <LoadingState label="Loading portfolio…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;
  const p = data.data;
  if (!isPortfolio(p)) {
    return (
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
        <div className="font-medium">Portfolio not yet wired</div>
        <p className="mt-1">{p.reason}</p>
      </div>
    );
  }
  return (
    <dl className="grid grid-cols-2 gap-2 rounded border border-zinc-200 bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-3">
      <Cell label="Equity" value={p.equity} />
      <Cell label="IM" value={p.im} />
      <Cell label="MM" value={p.mm} />
      <Cell label="Free collateral" value={p.free_collateral} />
      <Cell label="Notional" value={p.total_notional ?? "—"} />
      <Cell label="Open positions" value={String(p.open_positions_count ?? 0)} />
    </dl>
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
