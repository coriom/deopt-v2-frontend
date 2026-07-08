"use client";

// PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 — Perps fills panel.
//
// REST snapshot (`GET /accounts/:address/perps/fills`) + live refresh
// on `account.perp_fills` deltas (`PerpFillCreated`).

import { useCallback, useEffect, useState } from "react";
import {
  listPerpFills,
  TradingApiError,
  type PerpFillView,
} from "@/lib/trading-api";
import { useLifecycleStream } from "@/hooks/useLifecycleStream";
import { useWallet } from "@/lib/wallet";
import { LifecycleStatusBadge } from "../LifecycleStatusBadge";
import { formatSigned1e8, formatTimeOfDay } from "./PerpsFormat";

const POLL_INTERVAL_MS = 20_000;

interface Props {
  address?: string | null;
}

export function PerpsFillsPanel({ address: addressProp }: Props) {
  const { address: walletAddress, activeSubaccountId } = useWallet();
  const address = addressProp ?? walletAddress;
  const { status, statusDetail, resyncToken, subscribe } = useLifecycleStream();
  const [rows, setRows] = useState<PerpFillView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // PERPS-SUBACCOUNTS-FRONTEND-ROUTING-V1 — read passes the active
  // subaccount. Backend fills endpoint filters rows where either the
  // taker or maker matches (two-sided). Query key includes
  // `(address, activeSubaccountId)`.
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!address) return;
      try {
        const resp = await listPerpFills(
          address,
          { subaccountId: activeSubaccountId },
          signal,
        );
        const sorted = [...resp.fills].sort(
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
    // Clear on switch so Account 1's fills don't leak into Account 2.
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
    // PERPS-SUBACCOUNTS-FRONTEND-ROUTING-V1 — two-sided fill filter:
    // refetch when either side matches the active subaccount, ignore
    // when neither side matches, refetch when both fields are missing.
    const unsubscribe = subscribe("account.perp_fills", (event) => {
      if (event.payload.type !== "perp_fill_created") return;
      const takerSubaccountId = event.payload.taker_subaccount_id;
      const makerSubaccountId = event.payload.maker_subaccount_id;
      if (takerSubaccountId === undefined && makerSubaccountId === undefined) {
        void refresh();
        return;
      }
      if (
        takerSubaccountId === activeSubaccountId ||
        makerSubaccountId === activeSubaccountId
      ) {
        void refresh();
      }
    });
    return unsubscribe;
  }, [address, subscribe, activeSubaccountId, refresh]);

  return (
    <section
      data-testid="perps-fills-panel"
      className="flex flex-col gap-2 rounded border border-zinc-800 bg-black/60 p-3 text-zinc-200"
    >
      <header className="flex items-center justify-between border-b border-zinc-900 pb-1">
        <div className="flex flex-col">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
            Perps fills
          </h3>
          <p className="text-[9px] leading-snug text-zinc-500">
            Read-only. Trading is not enabled yet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LifecycleStatusBadge status={status} detail={statusDetail} />
          <button
            type="button"
            data-testid="perps-fills-refresh"
            onClick={() => void refresh()}
            disabled={!address}
            className="rounded border border-zinc-800 bg-black/40 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-emerald-500/40 disabled:opacity-40"
          >
            Refresh
          </button>
        </div>
      </header>

      {!address ? (
        <p data-testid="perps-fills-disconnected" className="text-[11px] text-zinc-500">
          Connect wallet to view Perps fills.
        </p>
      ) : error ? (
        <p
          data-testid="perps-fills-error"
          role="alert"
          className="text-[11px] text-rose-400"
        >
          Failed to load Perps fills: {error}
        </p>
      ) : rows === null ? (
        <p data-testid="perps-fills-loading" className="text-[11px] text-zinc-500">
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <p data-testid="perps-fills-empty" className="text-[11px] text-zinc-500">
          No Perps fills. Trading is not live yet.
        </p>
      ) : (
        <table
          data-testid="perps-fills-table"
          className="w-full border-collapse text-[11px]"
        >
          <thead>
            <tr className="text-left text-[9px] uppercase tracking-[0.1em] text-zinc-500">
              <th className="px-2 py-1">Time</th>
              <th className="px-2 py-1">Market</th>
              <th className="px-2 py-1">Side</th>
              <th className="px-2 py-1">Role</th>
              <th className="px-2 py-1 text-right">Price</th>
              <th className="px-2 py-1 text-right">Size</th>
              <th className="px-2 py-1">Order</th>
              <th className="px-2 py-1">Counterparty</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((row) => {
              const sideTone =
                row.side === "buy" ? "text-emerald-300" : "text-rose-300";
              const ownOrderId =
                row.liquidity_role === "taker"
                  ? row.taker_order_id
                  : row.maker_order_id;
              const counterpartyOrderId =
                row.liquidity_role === "taker"
                  ? row.maker_order_id
                  : row.taker_order_id;
              return (
                <tr
                  key={row.fill_id}
                  data-testid="perps-fills-row"
                  data-perps-fill-id={row.fill_id}
                  className="border-t border-zinc-900"
                >
                  <td className="px-2 py-1 font-mono text-[10px] text-zinc-400">
                    {formatTimeOfDay(row.created_at_ms)}
                  </td>
                  <td className="px-2 py-1 font-mono">{row.market_id}</td>
                  <td className={`px-2 py-1 font-semibold ${sideTone}`}>
                    {row.side}
                  </td>
                  <td className="px-2 py-1 uppercase text-zinc-400">
                    {row.liquidity_role}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {formatSigned1e8(row.price_1e8)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {formatSigned1e8(row.size_1e8)}
                  </td>
                  <td
                    className="px-2 py-1 font-mono text-[10px] text-zinc-400"
                    title={ownOrderId}
                  >
                    {ownOrderId.slice(0, 8)}…
                  </td>
                  <td
                    className="px-2 py-1 font-mono text-[10px] text-zinc-400"
                    title={counterpartyOrderId}
                  >
                    {counterpartyOrderId.slice(0, 8)}…
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
