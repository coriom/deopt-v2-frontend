"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listOptionsRfqFills,
  TradingApiError,
  type OptionRfqFillResponse,
} from "@/lib/trading-api";

interface RfqTradesTabProps {
  rfqEnabled: boolean;
  /** Connected wallet address (lowercased) or `null` when
   *  disconnected. The Trades feed is scoped to the wallet — the
   *  backend endpoint matches any of buyer / seller / taker /
   *  mm_account so both takers AND makers see their own trades. */
  account: string | null;
  /** When present, narrows the feed to a single RFQ's fills. */
  selectedRfqId: string | null;
  /** Bumped by the parent workspace after a successful accept OR
   *  maker submit so the feed refetches from the backend. */
  refreshNonce: number;
}

const ONE_E8 = BigInt("100000000");

function fmt1e8(v: string): string {
  try {
    const big = BigInt(v);
    const whole = big / ONE_E8;
    const frac = (big % ONE_E8).toString().padStart(8, "0");
    return `${whole}.${frac}`;
  } catch {
    return v;
  }
}

function shortAddr(a: string): string {
  if (a.length <= 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function shortId(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/**
 * OPTIONS-RFQ-TRADES-FEED-V1 — Trades tab.
 *
 * Reads real, backend-persisted RFQ fills from
 * `GET /options/rfq-fills?account=&option_rfq_id=&limit=`. No
 * session-local fallback: the backend is the source of truth so a
 * refresh (or a new tab) shows the same history the taker + maker
 * can independently query.
 */
export function RfqTradesTab({
  rfqEnabled,
  account,
  selectedRfqId,
  refreshNonce,
}: RfqTradesTabProps) {
  const [fills, setFills] = useState<OptionRfqFillResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!rfqEnabled) return;
    if (!account) {
      setFills([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listOptionsRfqFills({
        account,
        option_rfq_id: selectedRfqId ?? undefined,
        limit: 50,
      });
      setFills(rows);
    } catch (e) {
      setError(
        e instanceof TradingApiError
          ? e.message
          : (e as Error).message || "Failed to load RFQ trades.",
      );
    } finally {
      setLoading(false);
    }
  }, [rfqEnabled, account, selectedRfqId]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshNonce]);

  if (!rfqEnabled) {
    return (
      <div
        data-testid="rfq-strategy-trades-disabled"
        className="rounded border border-zinc-800 bg-black/40 p-4 text-[11px] text-zinc-500"
      >
        RFQ trades are not enabled in this environment. Backend routes
        exist but are gated by the operator.
      </div>
    );
  }

  if (!account) {
    return (
      <div
        data-testid="rfq-strategy-trades-disconnected"
        className="rounded border border-zinc-800 bg-black/40 p-4 text-[11px] text-zinc-500"
      >
        Connect a Base Sepolia wallet to view your RFQ trades.
      </div>
    );
  }

  return (
    <div
      data-testid="rfq-strategy-trades-list"
      data-scope-rfq={selectedRfqId ?? ""}
      className="flex min-h-0 flex-1 flex-col gap-2 rounded border border-zinc-800 bg-black/40 p-2"
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          {selectedRfqId
            ? `RFQ trades — this RFQ (${fills.length})`
            : `Your accepted RFQ trades (${fills.length})`}
        </span>
        <button
          type="button"
          data-testid="rfq-strategy-trades-refresh"
          onClick={refresh}
          disabled={loading}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p
          data-testid="rfq-strategy-trades-error"
          className="rounded border border-red-500/40 bg-red-500/5 px-2 py-1 text-[10px] text-red-300"
        >
          {error}
        </p>
      )}

      {!error && fills.length === 0 && !loading && (
        <p
          data-testid="rfq-strategy-trades-empty"
          className="rounded border border-zinc-800 bg-black/30 px-2 py-3 text-center text-[10px] text-zinc-500"
        >
          No accepted RFQ trades yet.
        </p>
      )}

      {fills.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[10px]">
            <thead className="text-[9px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-1 py-1 text-left">Fill id</th>
                <th className="px-1 py-1 text-left">RFQ</th>
                <th className="px-1 py-1 text-left">Series</th>
                <th className="px-1 py-1 text-left">Side</th>
                <th className="px-1 py-1 text-left">Taker</th>
                <th className="px-1 py-1 text-left">Maker</th>
                <th className="px-1 py-1 text-right">Price</th>
                <th className="px-1 py-1 text-right">Size</th>
              </tr>
            </thead>
            <tbody>
              {fills.map((r) => (
                <tr
                  key={r.fill_id}
                  data-testid={`rfq-strategy-trades-row-${r.fill_id}`}
                  className="border-t border-zinc-900"
                >
                  <td className="px-1 py-1 text-zinc-300">
                    {shortId(r.fill_id)}
                  </td>
                  <td className="px-1 py-1 text-zinc-400">
                    {shortId(r.option_rfq_id)}
                  </td>
                  <td className="px-1 py-1 text-zinc-500">
                    {shortId(r.option_series_id)}
                  </td>
                  <td className="px-1 py-1 uppercase tracking-wide text-zinc-300">
                    {r.taker_side}
                  </td>
                  <td className="px-1 py-1 text-zinc-400">
                    {shortAddr(r.taker)}
                  </td>
                  <td className="px-1 py-1 text-zinc-400">
                    {shortAddr(r.mm_account)}
                  </td>
                  <td className="px-1 py-1 text-right text-zinc-100">
                    {fmt1e8(r.price_1e8)}
                  </td>
                  <td className="px-1 py-1 text-right text-zinc-100">
                    {fmt1e8(r.size_1e8)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
