"use client";

// FRONTEND-LIFECYCLE-OBSERVABILITY-V1 — Fills panel.
//
// REST snapshot (`GET /options/fills?account=…`) + live
// `account.fills` lifecycle deltas. Dedupes by `fill_id`. Sorts
// newest first. Reconnect triggers a REST resync via
// `useLifecycleStream`'s `resyncToken`.

import { useCallback, useEffect, useState } from "react";
import {
  listAccountOptionFills,
  TradingApiError,
  type OptionFillRow,
} from "@/lib/trading-api";
import { useWallet } from "@/lib/wallet";
import { useLifecycleStream } from "@/hooks/useLifecycleStream";
import type { LifecycleEvent } from "@/lib/lifecycle-types";
import { LifecycleStatusBadge } from "./LifecycleStatusBadge";

const POLL_INTERVAL_MS = 5_000;

export interface FillsPanelProps {
  /** Connected wallet address. `null` ⇒ disabled state. */
  address: string | null;
}

export function FillsPanel({ address }: FillsPanelProps) {
  const { activeSubaccountId } = useWallet();
  const { status, statusDetail, resyncToken, subscribe } = useLifecycleStream();
  const [fills, setFills] = useState<OptionFillRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!address) return;
      try {
        const rows = await listAccountOptionFills(address, {
          subaccountId: activeSubaccountId,
          signal,
        });
        rows.sort((a, b) => b.created_at_ms - a.created_at_ms);
        setFills(rows);
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
      // Reset to "disconnected" view when the wallet goes away —
      // exactly the dependency-driven external-sync pattern this rule
      // is conservatively flagging.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFills(null);
      return;
    }
    // Wipe rows on subaccount switch so a stale mixed view can't be
    // observed while the refetch is in flight.
    setFills(null);
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
    // Triggered by the WS client's onResync — REST refetch is the
    // recovery path for missed deltas; the state update happens
    // inside `refresh` which is the external-system sync we want.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [resyncToken, address, refresh]);

  // Apply `account.fills` deltas. SUBACCOUNTS-FRONTEND-SWITCHER-V1:
  // WS payloads don't yet carry `subaccount_id`, so a wallet-level
  // event is ambiguous under the subaccount-scoped filter. We refetch
  // instead of poisoning the cache with a possibly cross-subaccount
  // synthesised row. The REST fetch is subaccount-scoped and remains
  // the source of truth.
  useEffect(() => {
    if (!address) return;
    const unsubscribe = subscribe("account.fills", (event: LifecycleEvent) => {
      if (event.payload.type !== "fill_created") return;
      void refresh();
    });
    return unsubscribe;
  }, [address, subscribe, refresh]);

  return (
    <section
      data-testid="fills-panel"
      className="flex flex-col gap-2 rounded border border-zinc-800 bg-black/60 p-3 text-zinc-200"
    >
      <header className="flex items-center justify-between border-b border-zinc-900 pb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
          Fills
        </h3>
        <div className="flex items-center gap-2">
          <LifecycleStatusBadge status={status} detail={statusDetail} />
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={!address}
            className="rounded border border-zinc-800 bg-black/40 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-emerald-500/40 disabled:opacity-40"
          >
            Refresh
          </button>
        </div>
      </header>

      {!address ? (
        <p data-testid="fills-disconnected" className="text-[11px] text-zinc-500">
          Connect a wallet to view your fills.
        </p>
      ) : error ? (
        <p
          data-testid="fills-error"
          className="text-[11px] text-rose-400"
          role="alert"
        >
          Failed to load fills: {error}
        </p>
      ) : fills === null ? (
        <p data-testid="fills-loading" className="text-[11px] text-zinc-500">
          Loading fills…
        </p>
      ) : fills.length === 0 ? (
        <p data-testid="fills-empty" className="text-[11px] text-zinc-500">
          No fills yet.
        </p>
      ) : (
        <table className="w-full text-[11px]" data-testid="fills-table">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              <th className="py-1">Time</th>
              <th className="py-1">Series</th>
              <th className="py-1">Order</th>
              <th className="py-1">Side</th>
              <th className="py-1 text-right">Price</th>
              <th className="py-1 text-right">Size</th>
            </tr>
          </thead>
          <tbody>
            {fills.slice(0, 200).map((f) => (
              <tr
                key={f.fill_id}
                data-testid="fills-row"
                data-fill-id={f.fill_id}
                className="border-t border-zinc-900"
              >
                <td className="py-1 pr-2 font-mono text-[10px] text-zinc-400">
                  {new Date(f.created_at_ms).toISOString().slice(11, 19)}
                </td>
                <td
                  className="truncate py-1 pr-2 font-mono text-[10px] text-zinc-400"
                  title={f.option_series_id}
                >
                  {f.option_series_id.slice(0, 14)}…
                </td>
                <td
                  className="py-1 pr-2 font-mono text-[10px] text-zinc-400"
                  title={f.buy_order_id || f.sell_order_id}
                >
                  {(f.buy_order_id || f.sell_order_id).slice(0, 8)}…
                </td>
                <td
                  data-side={f.taker_side}
                  className={`py-1 pr-2 ${f.taker_side === "buy" ? "text-emerald-300" : "text-rose-300"}`}
                >
                  {f.taker_side}
                </td>
                <td className="py-1 pr-2 text-right font-mono text-zinc-200">
                  {f.price_1e8}
                </td>
                <td className="py-1 pr-2 text-right font-mono text-zinc-200">
                  {f.size_1e8}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
