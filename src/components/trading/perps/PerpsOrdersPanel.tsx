"use client";

// PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 — Perps orders panel.
//
// REST snapshot (`GET /accounts/:address/perps/orders`) + live refresh
// on `account.perp_orders` lifecycle deltas (`PerpOrderUpdated` /
// `PerpOrderRejected`). No table patching — we refetch the snapshot
// on every delta so the panel is always canonical.
//
// States (all honest — no fake rows):
//   * disconnected: "Connect wallet to view Perps orders."
//   * loading: "Loading…"
//   * error: brief banner + retry via Refresh.
//   * empty:  "No Perps orders. Trading is not live yet."
//   * populated: dense per-order row.
//
// Trading remains disabled elsewhere; this panel adds no mutation.

import { useCallback, useEffect, useState } from "react";
import {
  listPerpOrders,
  TradingApiError,
  type PerpOrderView,
} from "@/lib/trading-api";
import { useLifecycleStream } from "@/hooks/useLifecycleStream";
import { useWallet } from "@/lib/wallet";
import { LifecycleStatusBadge } from "../LifecycleStatusBadge";
import { formatSigned1e8, formatTimeOfDay } from "./PerpsFormat";

const POLL_INTERVAL_MS = 20_000;

interface Props {
  /** Optional override for tests; falls back to `useWallet().address`. */
  address?: string | null;
}

export function PerpsOrdersPanel({ address: addressProp }: Props) {
  const { address: walletAddress } = useWallet();
  const address = addressProp ?? walletAddress;
  const { status, statusDetail, resyncToken, subscribe } = useLifecycleStream();
  const [rows, setRows] = useState<PerpOrderView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!address) return;
      try {
        const resp = await listPerpOrders(address, signal);
        // Newest-first per the backend contract; sort defensively.
        const sorted = [...resp.orders].sort(
          (a, b) => b.updated_at_ms - a.updated_at_ms,
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
    [address],
  );

  useEffect(() => {
    if (!address) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows(null);
      return;
    }
    const ctrl = new AbortController();
    void refresh(ctrl.signal);
    const handle = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      ctrl.abort();
      window.clearInterval(handle);
    };
  }, [address, refresh]);

  useEffect(() => {
    if (resyncToken === 0 || !address) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [resyncToken, address, refresh]);

  useEffect(() => {
    if (!address) return;
    const unsubscribe = subscribe("account.perp_orders", (event) => {
      // Refresh on either `perp_order_updated` or `perp_order_rejected`
      // — both signal orders-table state change.
      if (
        event.payload.type === "perp_order_updated" ||
        event.payload.type === "perp_order_rejected"
      ) {
        void refresh();
      }
    });
    return unsubscribe;
  }, [address, subscribe, refresh]);

  return (
    <section
      data-testid="perps-orders-panel"
      className="flex flex-col gap-2 rounded border border-zinc-800 bg-black/60 p-3 text-zinc-200"
    >
      <header className="flex items-center justify-between border-b border-zinc-900 pb-1">
        <div className="flex flex-col">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
            Perps orders
          </h3>
          <p className="text-[9px] leading-snug text-zinc-500">
            Read-only. Trading is not enabled yet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LifecycleStatusBadge status={status} detail={statusDetail} />
          <button
            type="button"
            data-testid="perps-orders-refresh"
            onClick={() => void refresh()}
            disabled={!address}
            className="rounded border border-zinc-800 bg-black/40 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-emerald-500/40 disabled:opacity-40"
          >
            Refresh
          </button>
        </div>
      </header>

      {!address ? (
        <p data-testid="perps-orders-disconnected" className="text-[11px] text-zinc-500">
          Connect wallet to view Perps orders.
        </p>
      ) : error ? (
        <p
          data-testid="perps-orders-error"
          role="alert"
          className="text-[11px] text-rose-400"
        >
          Failed to load Perps orders: {error}
        </p>
      ) : rows === null ? (
        <p data-testid="perps-orders-loading" className="text-[11px] text-zinc-500">
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <p data-testid="perps-orders-empty" className="text-[11px] text-zinc-500">
          No Perps orders. Trading is not live yet.
        </p>
      ) : (
        <table
          data-testid="perps-orders-table"
          className="w-full border-collapse text-[11px]"
        >
          <thead>
            <tr className="text-left text-[9px] uppercase tracking-[0.1em] text-zinc-500">
              <th className="px-2 py-1">Time</th>
              <th className="px-2 py-1">Market</th>
              <th className="px-2 py-1">Side</th>
              <th className="px-2 py-1 text-right">Price</th>
              <th className="px-2 py-1 text-right">Size</th>
              <th className="px-2 py-1 text-right">Filled</th>
              <th className="px-2 py-1 text-right">Rem</th>
              <th className="px-2 py-1">TIF</th>
              <th className="px-2 py-1">PO</th>
              <th className="px-2 py-1">RO</th>
              <th className="px-2 py-1">Status</th>
              <th className="px-2 py-1">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((row) => {
              const sideTone =
                row.side === "buy" ? "text-emerald-300" : "text-rose-300";
              return (
                <tr
                  key={row.order_id}
                  data-testid="perps-orders-row"
                  data-perps-order-id={row.order_id}
                  data-perps-order-status={row.status}
                  className="border-t border-zinc-900"
                >
                  <td className="px-2 py-1 font-mono text-[10px] text-zinc-400">
                    {formatTimeOfDay(row.updated_at_ms)}
                  </td>
                  <td className="px-2 py-1 font-mono">{row.market_id}</td>
                  <td className={`px-2 py-1 font-semibold ${sideTone}`}>
                    {row.side}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {formatSigned1e8(row.price_1e8)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {formatSigned1e8(row.size_1e8)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {formatSigned1e8(row.filled_size_1e8)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {formatSigned1e8(row.remaining_size_1e8)}
                  </td>
                  <td className="px-2 py-1 uppercase">{row.time_in_force}</td>
                  <td className="px-2 py-1">{row.post_only ? "PO" : "—"}</td>
                  <td className="px-2 py-1">{row.reduce_only ? "RO" : "—"}</td>
                  <td className="px-2 py-1">{row.status}</td>
                  <td
                    className="px-2 py-1 font-mono text-[10px] text-zinc-400"
                    title={row.terminal_reason_message ?? undefined}
                  >
                    {row.terminal_reason_code ?? "—"}
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
