"use client";

import { useWallet } from "@/lib/wallet";
import { useBalances } from "@/hooks/trading";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import type { BalancesData, NotReadyData } from "@/lib/trading-types";

function isBalances(x: BalancesData | NotReadyData): x is BalancesData {
  return !("not_ready" in x);
}

export function BalancesCard() {
  const { address } = useWallet();
  const { data, error, isLoading, refetch } = useBalances(address);
  if (!address) return <EmptyState title="Connect your wallet" />;
  if (isLoading && !data) return <LoadingState label="Loading balances…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;
  const b = data.data;
  if (!isBalances(b)) {
    return (
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
        <div className="font-medium">Balances not yet wired</div>
        <p className="mt-1">{b.reason}</p>
      </div>
    );
  }
  if (b.balances.length === 0) return <EmptyState title="No balances" />;
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-zinc-500">
        <tr>
          <th className="py-1 pr-2">Token</th>
          <th className="py-1 pr-2 text-right">Balance</th>
          <th className="py-1 pr-2 text-right">With yield</th>
        </tr>
      </thead>
      <tbody>
        {b.balances.map((row) => (
          <tr key={row.token} className="border-t border-zinc-200 dark:border-zinc-800">
            <td className="py-1 pr-2 font-mono text-[10px]">{row.symbol ?? row.token}</td>
            <td className="py-1 pr-2 text-right font-mono">{row.balance}</td>
            <td className="py-1 pr-2 text-right font-mono">{row.balance_with_yield ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
