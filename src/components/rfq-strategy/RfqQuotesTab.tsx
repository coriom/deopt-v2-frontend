"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listOptionsRfqQuotes,
  TradingApiError,
  type OptionRfqQuoteResponse,
  type OptionRfqResponse,
} from "@/lib/trading-api";
import { RfqMakerQuoteForm } from "./RfqMakerQuoteForm";

interface RfqQuotesTabProps {
  rfqEnabled: boolean;
  selectedRfq: OptionRfqResponse | null;
  /** Wallet address (lowercased) — used to gate the Accept CTA to
   *  the taker only. Null when disconnected / disabled. */
  takerAddress: string | null;
  /** Emitted when the taker clicks Accept on a specific quote row.
   *  Parent workspace opens the review modal + owns success/refresh. */
  onAcceptClick: (quote: OptionRfqQuoteResponse) => void;
  /** Bumped by the parent after a successful accept OR maker quote
   *  submit to force a re-fetch of the quote list. */
  refreshNonce: number;
  /** Emitted by the maker form after backend confirms a new quote.
   *  Parent owns the refreshNonce bump. */
  onMakerQuoteSubmitted: (quote: OptionRfqQuoteResponse) => void;
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

/**
 * Returns true when the connected wallet address is authorised to
 * accept `quote` for `rfq`. The gate is deliberately strict:
 *   - RFQ must be Open (not Expired/Accepted/Cancelled/Failed)
 *   - quote must be Active (not Expired/Accepted/Rejected/Cancelled)
 *   - connected wallet MUST equal the RFQ taker (case-insensitive)
 * The backend re-enforces all of the above via WriteAuthAction +
 * service checks; the frontend guard is a UX guard, not a security
 * boundary.
 */
function canAcceptQuote(args: {
  rfq: OptionRfqResponse;
  quote: OptionRfqQuoteResponse;
  takerAddress: string | null;
}): boolean {
  if (!args.takerAddress) return false;
  if (args.rfq.status !== "Open") return false;
  if (args.quote.status !== "Active") return false;
  return args.takerAddress.toLowerCase() === args.rfq.taker.toLowerCase();
}

export function RfqQuotesTab({
  rfqEnabled,
  selectedRfq,
  takerAddress,
  onAcceptClick,
  refreshNonce,
  onMakerQuoteSubmitted,
}: RfqQuotesTabProps) {
  const [quotes, setQuotes] = useState<OptionRfqQuoteResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRfqId = selectedRfq?.option_rfq_id ?? null;

  const refresh = useCallback(async () => {
    if (!selectedRfqId) {
      setQuotes([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listOptionsRfqQuotes(selectedRfqId);
      setQuotes(rows);
    } catch (e) {
      setError(
        e instanceof TradingApiError
          ? e.message
          : (e as Error).message || "Failed to load quotes.",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedRfqId]);

  useEffect(() => {
    if (!rfqEnabled) return;
    void refresh();
  }, [rfqEnabled, refresh, refreshNonce]);

  if (!rfqEnabled) {
    return (
      <div
        data-testid="rfq-strategy-book-disabled"
        className="rounded border border-zinc-800 bg-black/40 p-4 text-[11px] text-zinc-500"
      >
        RFQ quote book is not enabled in this environment. Backend routes
        (<code className="rounded bg-zinc-900 px-1 text-emerald-300">
          /options/rfqs
        </code>
        ) exist but are gated by the operator.
      </div>
    );
  }

  if (!selectedRfq) {
    return (
      <div
        data-testid="rfq-strategy-book-no-selection"
        className="rounded border border-zinc-800 bg-black/40 p-4 text-[11px] text-zinc-500"
      >
        Select an RFQ from the panel on the left to view its quote book.
      </div>
    );
  }

  // OPTIONS-RFQ-MAKER-QUOTE-SUBMIT-V1 — role gate.
  // Show the maker quote form ONLY when the RFQ is Open AND either
  // no wallet is connected (form will show connect-wallet blocker)
  // OR the connected wallet is not the taker. If wallet=taker, the
  // form is hidden entirely — the taker gets the Accept action per
  // row instead.
  const isTakerView =
    takerAddress != null &&
    takerAddress.toLowerCase() === selectedRfq.taker.toLowerCase();
  const showMakerForm = selectedRfq.status === "Open" && !isTakerView;

  return (
    <div
      data-testid="rfq-strategy-book-quotes"
      data-view-role={isTakerView ? "taker" : "maker"}
      className="flex min-h-0 flex-1 flex-col gap-2 rounded border border-zinc-800 bg-black/40 p-2"
    >
      {showMakerForm && (
        <RfqMakerQuoteForm
          rfq={selectedRfq}
          onSubmitted={onMakerQuoteSubmitted}
        />
      )}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          Quotes ({quotes.length})
        </span>
        <button
          type="button"
          data-testid="rfq-strategy-book-refresh"
          onClick={refresh}
          disabled={loading}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p
          data-testid="rfq-strategy-book-error"
          className="rounded border border-red-500/40 bg-red-500/5 px-2 py-1 text-[10px] text-red-300"
        >
          {error}
        </p>
      )}

      {!error && quotes.length === 0 && !loading && (
        <p
          data-testid="rfq-strategy-book-empty"
          className="rounded border border-zinc-800 bg-black/30 px-2 py-3 text-center text-[10px] text-zinc-500"
        >
          No maker quotes yet for this RFQ.
        </p>
      )}

      {quotes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[10px]">
            <thead className="text-[9px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-1 py-1 text-left">Quote id</th>
                <th className="px-1 py-1 text-left">Maker</th>
                <th className="px-1 py-1 text-right">Price</th>
                <th className="px-1 py-1 text-right">Size</th>
                <th className="px-1 py-1 text-left">Status</th>
                <th className="px-1 py-1 text-left">Sig</th>
                <th className="px-1 py-1 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const accept = canAcceptQuote({
                  rfq: selectedRfq,
                  quote: q,
                  takerAddress,
                });
                return (
                  <tr
                    key={q.quote_id}
                    data-testid={`rfq-strategy-book-row-${q.quote_id}`}
                    data-can-accept={accept ? "true" : "false"}
                    className="border-t border-zinc-900"
                  >
                    <td className="px-1 py-1 text-zinc-300">
                      {q.quote_id.slice(0, 8)}
                    </td>
                    <td className="px-1 py-1 text-zinc-400">
                      {q.mm_account.slice(0, 6)}…{q.mm_account.slice(-4)}
                    </td>
                    <td className="px-1 py-1 text-right text-zinc-100">
                      {fmt1e8(q.price_1e8)}
                    </td>
                    <td className="px-1 py-1 text-right text-zinc-100">
                      {fmt1e8(q.size_1e8)}
                    </td>
                    <td className="px-1 py-1 text-zinc-300">{q.status}</td>
                    <td className="px-1 py-1 text-zinc-500">
                      {q.signature_status}
                    </td>
                    <td className="px-1 py-1 text-right">
                      {accept ? (
                        <button
                          type="button"
                          data-testid={`rfq-strategy-book-accept-${q.quote_id}`}
                          onClick={() => onAcceptClick(q)}
                          className="rounded bg-emerald-500 px-2 py-0.5 text-[9px] font-semibold text-zinc-950 hover:bg-emerald-400"
                        >
                          Accept
                        </button>
                      ) : (
                        <span className="text-[9px] text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
