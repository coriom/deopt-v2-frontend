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
  if (!address)
    return <EmptyState title="Connect your wallet to see your testnet balances." />;
  if (isLoading && !data) return <LoadingState label="Loading balances…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;
  const b = data.data;
  if (!isBalances(b)) {
    return (
      <div
        data-testid="balances-not-ready"
        className="rounded border border-emerald-500/30 bg-zinc-950 p-3 text-xs text-emerald-200"
      >
        <div className="font-medium">Balances not yet wired</div>
        <p className="mt-1">{b.reason}</p>
      </div>
    );
  }
  if (b.balances.length === 0)
    return (
      <EmptyState
        title="No vault balances yet"
        description="Deposit testnet mUSDC into the CollateralVault from the trade ticket once a seller-side trade is in flight, or ask the operator on Discord to mint mUSDC to your wallet."
      />
    );
  return (
    <div
      data-testid="balances-card"
      className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
    >
      <table className="w-full text-xs">
        <thead className="bg-black/40 text-left text-zinc-500">
          <tr>
            <th className="py-2 pl-3 pr-2">Token</th>
            <th className="py-2 pr-2 text-right">Vault deposit</th>
            <th className="py-2 pr-3 text-right">With yield</th>
          </tr>
        </thead>
        <tbody>
          {b.balances.map((row) => (
            <tr
              key={row.token}
              data-testid={`balances-row-${row.symbol ?? row.token}`}
              className="border-t border-zinc-800"
            >
              <td className="py-2 pl-3 pr-2 font-mono text-[10px] text-zinc-200">
                {row.symbol ?? row.token}
              </td>
              <td className="py-2 pr-2 text-right font-mono text-zinc-100">
                {row.balance}
              </td>
              <td className="py-2 pr-3 text-right font-mono text-zinc-300">
                {row.balance_with_yield ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-zinc-800 bg-black/40 px-3 py-2 text-[10px] text-zinc-500">
        Testnet only — values are mUSDC mocks with zero real-world value.
      </p>
    </div>
  );
}
