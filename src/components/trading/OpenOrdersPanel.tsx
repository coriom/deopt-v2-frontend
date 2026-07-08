"use client";

// FRONTEND-LIFECYCLE-OBSERVABILITY-V1 — Open Orders panel.
//
// REST snapshot (canonical source of truth) + live `account.orders`
// lifecycle deltas applied on top. The per-row cancel button builds a
// fresh EIP-712 `OPTION_ORDER_CANCEL` envelope. Reconnect triggers a
// REST resync via the `resyncToken` from `useLifecycleStream`.
//
// No mock rows. No fake statuses. Empty / loading / error / disconnected
// states are surfaced explicitly.

import { useCallback, useEffect, useState } from "react";
import {
  cancelOptionOrder,
  listAccountOptionOrders,
  TradingApiError,
  type OptionOrderRow,
} from "@/lib/trading-api";
import { useWallet } from "@/lib/wallet";
import { buildAuthorization, canonical, canonicalV2 } from "@/lib/write-auth";
import { useLifecycleStream } from "@/hooks/useLifecycleStream";
import type { LifecycleEvent } from "@/lib/lifecycle-types";
import { LifecycleStatusBadge } from "./LifecycleStatusBadge";

const POLL_INTERVAL_MS = 5_000;

export interface OpenOrdersPanelProps {
  /** Connected wallet address. `null` ⇒ disabled state. */
  address: string | null;
}

export function OpenOrdersPanel({ address }: OpenOrdersPanelProps) {
  const { isExpectedChain, signTypedData, activeSubaccountId } = useWallet();
  const { status, statusDetail, resyncToken, subscribe } = useLifecycleStream();
  const [orders, setOrders] = useState<OptionOrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelInFlight, setCancelInFlight] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!address) return;
      try {
        const rows = await listAccountOptionOrders(address, {
          subaccountId: activeSubaccountId,
          signal,
        });
        // Stable sort: most-recent first.
        rows.sort((a, b) => b.created_at_ms - a.created_at_ms);
        setOrders(rows);
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
      setOrders(null);
      return;
    }
    // Clear rows the moment the subaccount changes so the operator
    // never sees a mixed state while the refetch is in flight.
    setOrders(null);
    const ctrl = new AbortController();
    void refresh(ctrl.signal);
    const handle = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      ctrl.abort();
      window.clearInterval(handle);
    };
  }, [address, activeSubaccountId, refresh]);

  // Reconnect → trigger an immediate REST resync to bridge any missed deltas.
  useEffect(() => {
    if (resyncToken === 0 || !address) return;
    void refresh();
  }, [resyncToken, address, refresh]);

  // Apply `account.orders` deltas: merge into local state by order_id.
  // SUBACCOUNTS-OPTIONS-WS-PAYLOAD-V1 — check the delta's
  // `subaccount_id` against the active subaccount:
  //   * match     → merge as before.
  //   * mismatch  → ignore (delta belongs to a different subaccount).
  //   * missing   → REFETCH (older backend; can't attribute safely).
  // The existing merge is already safe when the local cache is
  // subaccount-scoped (we only refetched rows for `activeSubaccountId`
  // so unknown ids stay ignored), but the explicit gate closes the
  // window where a stale delta for a switched-away subaccount could
  // still overwrite a row.
  useEffect(() => {
    if (!address) return;
    const unsubscribe = subscribe("account.orders", (event: LifecycleEvent) => {
      if (event.payload.type !== "order_updated") return;
      const delta = event.payload;
      if (delta.subaccount_id === undefined) {
        void refresh();
        return;
      }
      if (delta.subaccount_id !== activeSubaccountId) {
        return;
      }
      setOrders((prev) => {
        if (prev === null) return prev;
        const idx = prev.findIndex((o) => o.order_id === delta.order_id);
        if (idx < 0) {
          // Unknown id — refetch will pick it up on next poll or
          // on the resync triggered by reconnect. Don't fabricate a row.
          return prev;
        }
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          status: delta.status,
          remaining_size_1e8: delta.remaining_size_1e8,
          size_1e8: delta.size_1e8,
          updated_at_ms: event.emitted_at_ms,
        };
        return updated;
      });
    });
    return unsubscribe;
  }, [address, subscribe, activeSubaccountId, refresh]);

  const handleCancel = async (
    orderId: string,
    account: string,
    rowSubaccountId: number | undefined,
  ) => {
    if (!isExpectedChain) {
      setCancelError("Switch to Base Sepolia to sign the cancel envelope.");
      return;
    }
    setCancelInFlight(orderId);
    setCancelError(null);
    try {
      // Prefer the row's own subaccount so the ownership check aligns
      // even if the operator switched between fetch and click.
      const effectiveSubaccountId = rowSubaccountId ?? activeSubaccountId;
      const useV2 = effectiveSubaccountId > 1;
      const canonicalBytes = useV2
        ? canonicalV2.optionOrderCancel({
            account: account as `0x${string}`,
            subaccountId: effectiveSubaccountId,
            orderId,
          })
        : canonical.optionOrderCancel({
            account: account as `0x${string}`,
            orderId,
          });
      const authorization = await buildAuthorization({
        account: account as `0x${string}`,
        action: "OPTION_ORDER_CANCEL",
        canonical: canonicalBytes,
        signTypedData,
        version: useV2 ? 2 : undefined,
      });
      await cancelOptionOrder(orderId, {
        authorization,
        subaccount_id: effectiveSubaccountId,
      });
      await refresh();
    } catch (err) {
      const message =
        err instanceof TradingApiError ? err.message : (err as Error).message;
      setCancelError(message);
    } finally {
      setCancelInFlight(null);
    }
  };

  return (
    <section
      data-testid="open-orders-panel"
      className="flex flex-col gap-2 rounded border border-zinc-800 bg-black/60 p-3 text-zinc-200"
    >
      <header className="flex items-center justify-between border-b border-zinc-900 pb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
          Open orders
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
        <p
          data-testid="open-orders-disconnected"
          className="text-[11px] text-zinc-500"
        >
          Connect a wallet to view your open option orders.
        </p>
      ) : error ? (
        <p
          data-testid="open-orders-error"
          className="text-[11px] text-rose-400"
          role="alert"
        >
          Failed to load orders: {error}
        </p>
      ) : orders === null ? (
        <p
          data-testid="open-orders-loading"
          className="text-[11px] text-zinc-500"
        >
          Loading orders…
        </p>
      ) : orders.length === 0 ? (
        <p
          data-testid="open-orders-empty"
          className="text-[11px] text-zinc-500"
        >
          No open orders. Submit one via the trade ticket and it will appear here.
        </p>
      ) : (
        <table className="w-full text-[11px]" data-testid="open-orders-table">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              <th className="py-1">Series</th>
              <th className="py-1">Side</th>
              <th className="py-1 text-right">Price</th>
              <th className="py-1 text-right">Size</th>
              <th className="py-1 text-right">Remaining</th>
              <th className="py-1">TIF</th>
              <th className="py-1">Status</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const cancelable =
                o.status === "open" || o.status === "partially_filled";
              return (
                <tr
                  key={o.order_id}
                  data-testid="open-orders-row"
                  data-order-id={o.order_id}
                  data-status={o.status}
                  className="border-t border-zinc-900"
                >
                  <td
                    className="truncate py-1 pr-2 font-mono text-[10px] text-zinc-400"
                    title={o.option_series_id}
                  >
                    {o.option_series_id.slice(0, 14)}…
                  </td>
                  <td
                    data-side={o.side}
                    className={`py-1 pr-2 ${o.side === "buy" ? "text-emerald-300" : "text-rose-300"}`}
                  >
                    {o.side}
                  </td>
                  <td className="py-1 pr-2 text-right font-mono text-zinc-200">
                    {o.price_1e8}
                  </td>
                  <td className="py-1 pr-2 text-right font-mono text-zinc-200">
                    {o.size_1e8}
                  </td>
                  <td className="py-1 pr-2 text-right font-mono text-zinc-400">
                    {o.remaining_size_1e8}
                  </td>
                  <td className="py-1 pr-2 uppercase tracking-[0.12em] text-zinc-400">
                    {o.time_in_force}
                  </td>
                  <td className="py-1 pr-2">{o.status}</td>
                  <td className="py-1 text-right">
                    {cancelable && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleCancel(
                            o.order_id,
                            o.account,
                            o.subaccount_id,
                          )
                        }
                        disabled={cancelInFlight === o.order_id}
                        data-testid="open-orders-cancel"
                        className="rounded border border-rose-500/30 px-2 py-0.5 text-[10px] text-rose-200 hover:border-rose-400/60 hover:text-rose-100 disabled:opacity-40"
                      >
                        {cancelInFlight === o.order_id ? "…" : "Cancel"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {cancelError && (
        <p
          data-testid="open-orders-cancel-error"
          className="text-[11px] text-rose-400"
          role="alert"
        >
          Cancel failed: {cancelError}
        </p>
      )}
    </section>
  );
}
