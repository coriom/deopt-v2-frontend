"use client";

import type { OptionRfqResponse, OptionRfqStatus } from "@/lib/trading-api";

interface RfqStatusPanelProps {
  rfqs: readonly OptionRfqResponse[];
  loading: boolean;
  error: string | null;
  selectedRfqId: string | null;
  onSelect: (rfqId: string) => void;
  onCancel: (rfqId: string) => void;
  onRefresh: () => void;
}

const STATUS_STYLES: Record<OptionRfqStatus, string> = {
  Open: "border-emerald-500/40 bg-emerald-500/5 text-emerald-300",
  Expired: "border-zinc-700 bg-zinc-900 text-zinc-400",
  Accepted: "border-sky-500/40 bg-sky-500/5 text-sky-300",
  Cancelled: "border-zinc-700 bg-zinc-900 text-zinc-500",
  Failed: "border-red-500/40 bg-red-500/5 text-red-300",
};

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

function shortSeries(id: string): string {
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

export function RfqStatusPanel({
  rfqs,
  loading,
  error,
  selectedRfqId,
  onSelect,
  onCancel,
  onRefresh,
}: RfqStatusPanelProps) {
  return (
    <div
      data-testid="rfq-strategy-status-panel"
      className="mt-3 flex flex-col gap-2 rounded border border-zinc-800 bg-zinc-950 p-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          Your RFQs
        </span>
        <button
          type="button"
          data-testid="rfq-strategy-status-refresh"
          onClick={onRefresh}
          disabled={loading}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p
          data-testid="rfq-strategy-status-error"
          className="rounded border border-red-500/40 bg-red-500/5 px-2 py-1 text-[10px] text-red-300"
        >
          {error}
        </p>
      )}

      {!error && rfqs.length === 0 && !loading && (
        <p
          data-testid="rfq-strategy-status-empty"
          className="rounded border border-zinc-800 bg-black/30 px-2 py-2 text-center text-[10px] text-zinc-500"
        >
          No RFQs yet. Submit one via <em>Request Quote</em> above.
        </p>
      )}

      {rfqs.length > 0 && (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {rfqs.map((r) => {
            const selected = r.option_rfq_id === selectedRfqId;
            const cancellable = r.status === "Open";
            return (
              <li key={r.option_rfq_id}>
                <div
                  data-testid={`rfq-strategy-status-row-${r.option_rfq_id}`}
                  data-selected={selected ? "true" : "false"}
                  data-status={r.status}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-[10px] font-mono transition-colors ${
                    selected
                      ? "border border-emerald-500/40 bg-emerald-500/5"
                      : "border border-transparent hover:bg-black/40"
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 text-left"
                    data-testid={`rfq-strategy-status-select-${r.option_rfq_id}`}
                    onClick={() => onSelect(r.option_rfq_id)}
                  >
                    <span className="text-zinc-300">{shortId(r.option_rfq_id)}</span>
                    <span className="ml-2 text-zinc-500">
                      {r.side} {r.size_1e8} · {shortSeries(r.option_series_id)}
                    </span>
                  </button>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${STATUS_STYLES[r.status]}`}
                  >
                    {r.status}
                  </span>
                  {cancellable && (
                    <button
                      type="button"
                      data-testid={`rfq-strategy-status-cancel-${r.option_rfq_id}`}
                      onClick={() => onCancel(r.option_rfq_id)}
                      className="rounded border border-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-300 hover:border-red-500/60 hover:text-red-300"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
