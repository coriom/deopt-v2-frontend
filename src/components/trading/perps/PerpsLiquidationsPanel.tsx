"use client";

// PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 — Perps liquidations panel.
//
// REST snapshot (`GET /accounts/:address/perps/liquidations`) + refresh
// on `account.perp_positions` deltas of type `perp_position_liquidated`.

import { useCallback, useEffect, useState } from "react";
import {
  listPerpLiquidations,
  TradingApiError,
  type PerpLiquidationEventView,
} from "@/lib/trading-api";
import { useLifecycleStream } from "@/hooks/useLifecycleStream";
import { useWallet } from "@/lib/wallet";
import { LifecycleStatusBadge } from "../LifecycleStatusBadge";
import { formatSigned1e8, formatTimeOfDay } from "./PerpsFormat";

const POLL_INTERVAL_MS = 20_000;

interface Props {
  address?: string | null;
}

export function PerpsLiquidationsPanel({ address: addressProp }: Props) {
  const { address: walletAddress, activeSubaccountId } = useWallet();
  const address = addressProp ?? walletAddress;
  const { status, statusDetail, resyncToken, subscribe } = useLifecycleStream();
  const [rows, setRows] = useState<PerpLiquidationEventView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // PERPS-SUBACCOUNTS-FRONTEND-ROUTING-V1 — read is subaccount-scoped;
  // query key includes `(address, activeSubaccountId)`.
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!address) return;
      try {
        const resp = await listPerpLiquidations(
          address,
          { subaccountId: activeSubaccountId },
          signal,
        );
        const sorted = [...resp.liquidations].sort(
          (a, b) => b.created_at_ms - a.created_at_ms,
        );
        setRows(sorted);
        setError(null);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        const message =
          err instanceof TradingApiError ? err.message : (err as Error).message;
        setError(message);
      }
    },
    [address, activeSubaccountId],
  );

  useEffect(() => {
    if (!address) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows(null);
      return;
    }
    // Clear on switch so cross-subaccount liquidations don't leak.
    setRows(null);
    const ctrl = new AbortController();
    void refresh(ctrl.signal);
    const handle = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      ctrl.abort();
      window.clearInterval(handle);
    };
  }, [address, activeSubaccountId, refresh]);

  useEffect(() => {
    if (resyncToken === 0 || !address) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [resyncToken, address, refresh]);

  useEffect(() => {
    if (!address) return;
    // PERPS-SUBACCOUNTS-FRONTEND-ROUTING-V1 — safe WS filter, same
    // semantics as orders (match → refetch, mismatch → ignore,
    // missing → refetch).
    const unsubscribe = subscribe("account.perp_positions", (event) => {
      if (event.payload.type !== "perp_position_liquidated") return;
      const eventSubaccountId = event.payload.subaccount_id;
      if (
        eventSubaccountId === undefined ||
        eventSubaccountId === activeSubaccountId
      ) {
        void refresh();
      }
    });
    return unsubscribe;
  }, [address, subscribe, activeSubaccountId, refresh]);

  return (
    <section
      data-testid="perps-liquidations-panel"
      className="flex flex-col gap-2 rounded border border-zinc-800 bg-black/60 p-3 text-zinc-200"
    >
      <header className="flex items-center justify-between border-b border-zinc-900 pb-1">
        <div className="flex flex-col">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
            Perps liquidations
          </h3>
          <p className="text-[9px] leading-snug text-zinc-500">
            Read-only. Trading is not enabled yet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LifecycleStatusBadge status={status} detail={statusDetail} />
          <button
            type="button"
            data-testid="perps-liquidations-refresh"
            onClick={() => void refresh()}
            disabled={!address}
            className="rounded border border-zinc-800 bg-black/40 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-emerald-500/40 disabled:opacity-40"
          >
            Refresh
          </button>
        </div>
      </header>

      {!address ? (
        <p data-testid="perps-liquidations-disconnected" className="text-[11px] text-zinc-500">
          Connect wallet to view Perps liquidations.
        </p>
      ) : error ? (
        <p
          data-testid="perps-liquidations-error"
          role="alert"
          className="text-[11px] text-rose-400"
        >
          Failed to load Perps liquidations: {error}
        </p>
      ) : rows === null ? (
        <p data-testid="perps-liquidations-loading" className="text-[11px] text-zinc-500">
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <p data-testid="perps-liquidations-empty" className="text-[11px] text-zinc-500">
          No Perps liquidations.
        </p>
      ) : (
        <table
          data-testid="perps-liquidations-table"
          className="w-full border-collapse text-[11px]"
        >
          <thead>
            <tr className="text-left text-[9px] uppercase tracking-[0.1em] text-zinc-500">
              <th className="px-2 py-1">Time</th>
              <th className="px-2 py-1">Market</th>
              <th className="px-2 py-1">Side</th>
              <th className="px-2 py-1 text-right">Size</th>
              <th className="px-2 py-1 text-right">Entry</th>
              <th className="px-2 py-1 text-right">Mark</th>
              <th className="px-2 py-1 text-right">Equity</th>
              <th className="px-2 py-1 text-right">MMR</th>
              <th className="px-2 py-1 text-right">Realized</th>
              <th className="px-2 py-1 text-right">Bad debt</th>
              <th className="px-2 py-1 text-right">Fee</th>
              <th className="px-2 py-1">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((row) => {
              const sideTone =
                row.side === "long" ? "text-emerald-300" : "text-rose-300";
              return (
                <tr
                  key={row.liquidation_id}
                  data-testid="perps-liquidations-row"
                  data-perps-liquidation-id={row.liquidation_id}
                  data-perps-liquidation-status={row.status}
                  className="border-t border-zinc-900"
                >
                  <td className="px-2 py-1 font-mono text-[10px] text-zinc-400">
                    {formatTimeOfDay(row.created_at_ms)}
                  </td>
                  <td className="px-2 py-1 font-mono">{row.market_id}</td>
                  <td className={`px-2 py-1 font-semibold ${sideTone}`}>
                    {row.side}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {formatSigned1e8(row.size_1e8)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {formatSigned1e8(row.entry_price_1e8)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {formatSigned1e8(row.mark_price_1e8)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {formatSigned1e8(row.equity_1e8)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {formatSigned1e8(row.maintenance_margin_requirement_1e8)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {formatSigned1e8(row.realized_pnl_1e8)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {formatSigned1e8(row.bad_debt_1e8)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {formatSigned1e8(row.liquidation_fee_1e8)}
                  </td>
                  <td className="px-2 py-1 font-mono text-[10px] text-zinc-400">
                    {row.reason_code}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
