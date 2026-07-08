"use client";

// FRONTEND-LIFECYCLE-OBSERVABILITY-V1 — Conditional Orders panel.
//
// REST snapshot (`GET /accounts/:address/conditional-orders`) + live
// `account.conditional_orders` lifecycle deltas merged on top.
// Cancel button uses the existing EIP-712 `CONDITIONAL_ORDER_CANCEL`
// write-auth envelope. Active rows sort first; terminal rows go to
// the bottom in created-at-desc order inside each group.
//
// Distinct from `TpSlManager.tsx`, which is the *creation* widget
// embedded in the trade ticket. `TpSlManager` will keep showing its
// own inline list for the create-time context; this panel is the
// dedicated lifecycle view in the trade-terminal tab strip and is the
// one that consumes WS deltas.

import { useCallback, useEffect, useState } from "react";
import {
  cancelConditionalOrder,
  listConditionalOrders,
  TradingApiError,
} from "@/lib/trading-api";
import type { ConditionalOrderResponse } from "@/lib/trading-types";
import { useWallet } from "@/lib/wallet";
import { buildAuthorization, canonical, canonicalV2 } from "@/lib/write-auth";
import { useLifecycleStream } from "@/hooks/useLifecycleStream";
import type { LifecycleEvent } from "@/lib/lifecycle-types";
import { AttachedPlansPanel } from "./AttachedPlansPanel";
import { LifecycleStatusBadge } from "./LifecycleStatusBadge";

const POLL_INTERVAL_MS = 5_000;

const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "completed",
  "cancelled",
  "failed",
  "expired",
]);

export interface ConditionalOrdersPanelProps {
  address: string | null;
}

export function ConditionalOrdersPanel({ address }: ConditionalOrdersPanelProps) {
  const { isExpectedChain, signTypedData, activeSubaccountId } = useWallet();
  const { status, statusDetail, resyncToken, subscribe } = useLifecycleStream();
  const [rows, setRows] = useState<ConditionalOrderResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelInFlight, setCancelInFlight] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!address) return;
      try {
        // SUBACCOUNTS-FRONTEND-SWITCHER-V1 — filter client-side because
        // `/accounts/:address/conditional-orders` doesn't yet accept a
        // subaccount query param. The route stays wallet-aggregate;
        // the panel view is subaccount-scoped.
        const all = await listConditionalOrders(address, signal);
        const filtered = all.filter(
          (r) =>
            r.subaccount_id === undefined ||
            r.subaccount_id === activeSubaccountId,
        );
        filtered.sort((a, b) => {
          const at = TERMINAL_STATUSES.has(a.status);
          const bt = TERMINAL_STATUSES.has(b.status);
          if (at !== bt) return at ? 1 : -1;
          return b.created_at_ms - a.created_at_ms;
        });
        setRows(filtered);
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
      setRows(null);
      return;
    }
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
    void refresh();
  }, [resyncToken, address, refresh]);

  // Apply `account.conditional_orders` deltas: merge by id.
  // SUBACCOUNTS-OPTIONS-WS-PAYLOAD-V1 — same posture as
  // `OpenOrdersPanel`: subaccount match → merge; missing → refetch;
  // mismatch → ignore. Also handles the sibling `attachment_plan_
  // updated` event on the same channel with an unconditional refetch,
  // since attachment plans don't yet have a subaccount-scoped fetch
  // path (they refresh the parent conditional list).
  useEffect(() => {
    if (!address) return;
    const unsubscribe = subscribe(
      "account.conditional_orders",
      (event: LifecycleEvent) => {
        if (event.payload.type === "attachment_plan_updated") {
          if (
            event.payload.subaccount_id === undefined ||
            event.payload.subaccount_id === activeSubaccountId
          ) {
            void refresh();
          }
          return;
        }
        if (event.payload.type !== "conditional_order_updated") return;
        const delta = event.payload;
        if (delta.subaccount_id === undefined) {
          void refresh();
          return;
        }
        if (delta.subaccount_id !== activeSubaccountId) {
          return;
        }
        setRows((prev) => {
          if (prev === null) return prev;
          const idx = prev.findIndex((r) => r.id === delta.conditional_order_id);
          if (idx < 0) return prev; // refetch picks it up
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            status: delta.status as ConditionalOrderResponse["status"],
            child_order_id: delta.child_order_id ?? updated[idx].child_order_id,
            failure_code: delta.failure_code ?? updated[idx].failure_code,
            updated_at_ms: event.emitted_at_ms,
          };
          updated.sort((a, b) => {
            const at = TERMINAL_STATUSES.has(a.status);
            const bt = TERMINAL_STATUSES.has(b.status);
            if (at !== bt) return at ? 1 : -1;
            return b.created_at_ms - a.created_at_ms;
          });
          return updated;
        });
      },
    );
    return unsubscribe;
  }, [address, subscribe, activeSubaccountId, refresh]);

  const handleCancel = async (id: string, rowSubaccountId: number | undefined) => {
    if (!address) return;
    if (!isExpectedChain) {
      setCancelError("Switch to Base Sepolia to sign the cancel envelope.");
      return;
    }
    setCancelInFlight(id);
    setCancelError(null);
    try {
      const effectiveSubaccountId = rowSubaccountId ?? activeSubaccountId;
      const useV2 = effectiveSubaccountId > 1;
      const canonicalBytes = useV2
        ? canonicalV2.conditionalOrderCancel({
            account: address as `0x${string}`,
            subaccountId: effectiveSubaccountId,
            conditionalOrderId: id,
          })
        : canonical.conditionalOrderCancel({
            account: address as `0x${string}`,
            conditionalOrderId: id,
          });
      const authorization = await buildAuthorization({
        account: address as `0x${string}`,
        action: "CONDITIONAL_ORDER_CANCEL",
        canonical: canonicalBytes,
        signTypedData,
        version: useV2 ? 2 : undefined,
      });
      await cancelConditionalOrder(address, id, {
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
      data-testid="conditional-orders-panel"
      className="flex flex-col gap-2 rounded border border-zinc-800 bg-black/60 p-3 text-zinc-200"
    >
      <header className="flex items-center justify-between border-b border-zinc-900 pb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
          Conditional orders (TP / SL)
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
          data-testid="conditional-orders-disconnected"
          className="text-[11px] text-zinc-500"
        >
          Connect a wallet to view your conditional orders.
        </p>
      ) : error ? (
        <p
          data-testid="conditional-orders-error"
          className="text-[11px] text-rose-400"
          role="alert"
        >
          Failed to load conditional orders: {error}
        </p>
      ) : rows === null ? (
        <p
          data-testid="conditional-orders-loading"
          className="text-[11px] text-zinc-500"
        >
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <p
          data-testid="conditional-orders-empty"
          className="text-[11px] text-zinc-500"
        >
          No TP/SL conditional orders. Arm one from the trade ticket and it will appear here.
        </p>
      ) : (
        <table
          className="w-full text-[11px]"
          data-testid="conditional-orders-table"
        >
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              <th className="py-1">Series</th>
              <th className="py-1">Type</th>
              <th className="py-1 text-right">Trigger</th>
              <th className="py-1 text-right">Qty</th>
              <th className="py-1 text-right">Limit</th>
              <th className="py-1">Status</th>
              <th className="py-1">OCO</th>
              <th className="py-1">Child</th>
              <th className="py-1">Reason</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cancelable = r.status === "armed";
              return (
                <tr
                  key={r.id}
                  data-testid="conditional-orders-row"
                  data-conditional-id={r.id}
                  data-status={r.status}
                  className="border-t border-zinc-900"
                >
                  <td
                    className="truncate py-1 pr-2 font-mono text-[10px] text-zinc-400"
                    title={r.option_series_id}
                  >
                    {r.option_series_id.slice(0, 14)}…
                  </td>
                  <td className="py-1 pr-2 uppercase tracking-[0.12em] text-zinc-300">
                    {r.conditional_type === "take_profit" ? "TP" : "SL"}
                  </td>
                  <td className="py-1 pr-2 text-right font-mono text-zinc-200">
                    {r.trigger_price_1e8}
                  </td>
                  <td className="py-1 pr-2 text-right font-mono text-zinc-200">
                    {r.quantity_1e8}
                  </td>
                  <td className="py-1 pr-2 text-right font-mono text-zinc-200">
                    {r.limit_price_1e8}
                  </td>
                  <td className="py-1 pr-2">{r.status}</td>
                  <td
                    className="py-1 pr-2 font-mono text-[10px] text-zinc-400"
                    title={r.oco_group_id ?? undefined}
                  >
                    {r.oco_group_id ? `${r.oco_group_id.slice(0, 6)}…` : "—"}
                  </td>
                  <td
                    className="py-1 pr-2 font-mono text-[10px] text-zinc-400"
                    title={r.child_order_id ?? undefined}
                  >
                    {r.child_order_id ? `${r.child_order_id.slice(0, 8)}…` : "—"}
                  </td>
                  <td className="py-1 pr-2 text-[10px] text-rose-300/80">
                    {r.failure_code ?? ""}
                  </td>
                  <td className="py-1 text-right">
                    {cancelable && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleCancel(r.id, r.subaccount_id)
                        }
                        disabled={cancelInFlight === r.id}
                        data-testid="conditional-orders-cancel"
                        className="rounded border border-rose-500/30 px-2 py-0.5 text-[10px] text-rose-200 hover:border-rose-400/60 hover:text-rose-100 disabled:opacity-40"
                      >
                        {cancelInFlight === r.id ? "…" : "Cancel"}
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
          data-testid="conditional-orders-cancel-error"
          className="text-[11px] text-rose-400"
          role="alert"
        >
          Cancel failed: {cancelError}
        </p>
      )}
      {/* ATTACHED-TP-SL-PLAN-OBSERVABILITY-V1 — sibling subsection
          showing attachment plans (pending/active/cancelled/failed).
          Distinct from the conditional rows above; uses its own
          REST snapshot. */}
      <AttachedPlansPanel address={address} />
    </section>
  );
}
