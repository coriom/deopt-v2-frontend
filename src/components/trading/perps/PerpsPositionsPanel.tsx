"use client";

// PERPS-ISOLATED-MARGIN-POSITION-ENGINE-V1 — read-only positions panel.
//
// States (all honest — no fake rows, no fake PnL):
//   * disconnected: "Connect wallet to view Perps positions."
//   * loading: subtle "Loading…"
//   * error: brief error banner + retry.
//   * empty:  "No Perps positions. Trading is not live yet."
//   * populated: dense row-per-position with side, size, entry, mark,
//     margin, unrealised PnL, margin ratio, est. liq price, status.
//     Risk fields render `—` when the backend reports null (price
//     stale/unavailable). Never a fabricated number.
//
// Submit remains disabled elsewhere; this panel does not add any
// mutation surface.

import { useCallback, useEffect, useState } from "react";
import {
  getPerpsAccountPositions,
  TradingApiError,
  type PerpPositionView,
} from "@/lib/trading-api";
import { useWallet } from "@/lib/wallet";

interface Props {
  /** Optional override for tests; falls back to `useWallet().address`. */
  address?: string | null;
}

const POLL_INTERVAL_MS = 20_000;

function formatSigned1e8(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return "—";
  if (!/^-?\d+$/.test(raw)) return "—";
  const negative = raw.startsWith("-");
  const digits = negative ? raw.slice(1) : raw;
  if (digits.length > 20) return raw;
  const asBigInt = BigInt(digits);
  const scale = BigInt(100_000_000);
  const whole = asBigInt / scale;
  const frac = asBigInt % scale;
  const twoDp = frac / BigInt(1_000_000);
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${wholeStr}.${twoDp.toString().padStart(2, "0")}`;
}

function formatMarginRatioBps(raw: string | null): string {
  if (raw === null || raw === undefined) return "—";
  if (!/^\d+$/.test(raw)) return "—";
  const asNumber = Number(BigInt(raw));
  if (!Number.isFinite(asNumber)) return "—";
  const pct = asNumber / 100; // bps → percent
  return `${pct.toFixed(2)}%`;
}

export function PerpsPositionsPanel({ address: addressProp }: Props) {
  const { address: walletAddress, activeSubaccountId } = useWallet();
  const address = addressProp ?? walletAddress;
  const [rows, setRows] = useState<PerpPositionView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // PERPS-SUBACCOUNTS-FRONTEND-ROUTING-V1 — read passes the active
  // subaccount so the backend filters server-side. Query key includes
  // `(address, activeSubaccountId)` so switching the switcher clears
  // and refetches.
  const refresh = useCallback(async () => {
    if (!address) {
      setRows(null);
      return;
    }
    setError(null);
    try {
      const resp = await getPerpsAccountPositions(address, {
        subaccountId: activeSubaccountId,
      });
      setRows(resp.positions);
    } catch (err) {
      const message =
        err instanceof TradingApiError ? err.message : (err as Error).message;
      setError(message);
      setRows(null);
    }
  }, [address, activeSubaccountId]);

  useEffect(() => {
    // Clear the previous account's rows immediately on switch so we
    // never render Account 1's positions while Account 2's fetch is
    // in flight.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(null);
    void refresh();
    const handle = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(handle);
    };
  }, [refresh]);

  return (
    <section
      data-testid="perps-positions-panel"
      className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-black/30 p-3 text-zinc-100"
    >
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-emerald-200">
            Perps positions
          </h3>
          <p className="text-[10px] leading-snug text-zinc-500">
            Read-only view. Trading is not enabled yet — position rows
            only appear if the backend ledger has entries for this
            wallet.
          </p>
        </div>
      </header>

      {!address ? (
        <p
          data-testid="perps-positions-disconnected"
          className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-500"
        >
          Connect wallet to view Perps positions.
        </p>
      ) : error ? (
        <p
          data-testid="perps-positions-error"
          role="alert"
          className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-[11px] text-red-100"
        >
          Failed to load Perps positions: {error}
        </p>
      ) : rows === null ? (
        <p data-testid="perps-positions-loading" className="text-[11px] text-zinc-500">
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <p
          data-testid="perps-positions-empty"
          className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-500"
        >
          No Perps positions. Trading is not live yet.
        </p>
      ) : (
        <table
          data-testid="perps-positions-table"
          className="w-full border-collapse text-[11px]"
        >
          <thead>
            <tr className="text-left text-[9px] uppercase tracking-[0.1em] text-zinc-500">
              <th className="px-2 py-1">Market</th>
              <th className="px-2 py-1">Side</th>
              <th className="px-2 py-1">Size</th>
              <th className="px-2 py-1">Entry</th>
              <th className="px-2 py-1">Mark</th>
              <th className="px-2 py-1">Margin</th>
              <th className="px-2 py-1">uPnL</th>
              <th className="px-2 py-1">MR</th>
              <th className="px-2 py-1">Est. Liq</th>
              <th className="px-2 py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const sideTone =
                row.side === "long"
                  ? "text-emerald-300"
                  : "text-red-300";
              return (
                <tr
                  key={row.id}
                  data-testid={`perps-positions-row-${row.id}`}
                  data-perps-row-status={row.status}
                  data-perps-row-price-stale={row.price_stale ? "true" : "false"}
                  className="border-t border-zinc-900"
                >
                  <td className="px-2 py-1 font-mono">{row.market_id}</td>
                  <td className={`px-2 py-1 font-semibold ${sideTone}`}>
                    {row.side}
                  </td>
                  <td className="px-2 py-1 font-mono">
                    {formatSigned1e8(row.size_1e8)}
                  </td>
                  <td className="px-2 py-1 font-mono">
                    {formatSigned1e8(row.entry_price_1e8)}
                  </td>
                  <td className="px-2 py-1 font-mono">
                    {formatSigned1e8(row.mark_price_1e8)}
                  </td>
                  <td className="px-2 py-1 font-mono">
                    {formatSigned1e8(row.margin_1e8)}
                  </td>
                  <td className="px-2 py-1 font-mono">
                    {formatSigned1e8(row.unrealized_pnl_1e8)}
                  </td>
                  <td className="px-2 py-1 font-mono">
                    {formatMarginRatioBps(row.margin_ratio_bps)}
                  </td>
                  <td className="px-2 py-1 font-mono">
                    {formatSigned1e8(row.estimated_liquidation_price_1e8)}
                  </td>
                  <td className="px-2 py-1">{row.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
