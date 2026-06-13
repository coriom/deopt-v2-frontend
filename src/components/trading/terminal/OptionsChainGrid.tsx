"use client";

import type { OptionLeg, OptionsChainRow } from "@/lib/options-chain-model";

interface OptionsChainGridProps {
  rows: OptionsChainRow[];
  selectedSeriesId: string | null;
  onSelect: (leg: OptionLeg, row: OptionsChainRow) => void;
}

function dash(s: string | null): string {
  if (s === null || s === undefined) return "—";
  if (s.trim().length === 0) return "—";
  return s;
}

function legCell(leg: OptionLeg): {
  bid: string;
  ask: string;
  mark: string;
  iv: string;
} {
  return {
    bid: leg.bidAvail === "live" ? dash(leg.bid) : "—",
    ask: leg.askAvail === "live" ? dash(leg.ask) : "—",
    mark: leg.markAvail === "live" ? dash(leg.mark1e8) : "—",
    iv: leg.ivAvail === "live" ? (leg.iv === null ? "—" : `${leg.iv}%`) : "—",
  };
}

export function OptionsChainGrid({
  rows,
  selectedSeriesId,
  onSelect,
}: OptionsChainGridProps) {
  if (rows.length === 0) {
    return (
      <div
        data-testid="options-chain-empty"
        className="rounded-lg border border-emerald-500/30 bg-zinc-950 p-5 text-[12px] text-emerald-200"
      >
        <strong>No active series for this product yet.</strong>
        <p className="mt-1 text-zinc-400">
          The protocol publishes series on chain; the chain will populate once
          the operator registers strikes + expiries for the selected
          underlying. This is expected during testnet warm-up.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="options-chain-grid"
      className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
    >
      <div className="grid grid-cols-[1fr_minmax(7rem,_auto)_1fr] border-b border-zinc-800 bg-black/40 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        <div className="px-3 py-2 text-center text-emerald-300">Calls</div>
        <div className="px-2 py-2 text-center text-zinc-400">Strike</div>
        <div className="px-3 py-2 text-center text-emerald-300">Puts</div>
      </div>
      <div className="grid grid-cols-[1fr_minmax(7rem,_auto)_1fr] border-b border-zinc-800 bg-black/20 text-[10px] text-zinc-500">
        <div className="grid grid-cols-4 px-3 py-1">
          <span className="text-right">Bid</span>
          <span className="text-right">Ask</span>
          <span className="text-right">Mark</span>
          <span className="text-right">IV</span>
        </div>
        <div className="px-2 py-1 text-center">—</div>
        <div className="grid grid-cols-4 px-3 py-1">
          <span className="text-right">Bid</span>
          <span className="text-right">Ask</span>
          <span className="text-right">Mark</span>
          <span className="text-right">IV</span>
        </div>
      </div>
      <div role="rowgroup">
        {rows.map((row) => {
          const callCells = legCell(row.call);
          const putCells = legCell(row.put);
          const callSelected =
            row.call.seriesId !== null &&
            row.call.seriesId === selectedSeriesId;
          const putSelected =
            row.put.seriesId !== null && row.put.seriesId === selectedSeriesId;
          const callDisabled = row.call.seriesId === null;
          const putDisabled = row.put.seriesId === null;
          return (
            <div
              key={`${row.strike1e8}-${row.expiryMs}`}
              data-testid={`chain-row-${row.strike1e8}-${row.expiryMs}`}
              className="grid grid-cols-[1fr_minmax(7rem,_auto)_1fr] border-b border-zinc-900 text-[11px] last:border-b-0"
            >
              <button
                type="button"
                onClick={() => !callDisabled && onSelect(row.call, row)}
                disabled={callDisabled}
                data-testid={`chain-call-${row.strike1e8}-${row.expiryMs}`}
                data-selected={callSelected ? "true" : "false"}
                data-available={callDisabled ? "false" : "true"}
                className={`grid grid-cols-4 px-3 py-2 text-right font-mono ${
                  callDisabled
                    ? "cursor-not-allowed text-zinc-700"
                    : callSelected
                      ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/40"
                      : "text-zinc-200 hover:bg-emerald-500/5 hover:text-emerald-200"
                }`}
              >
                <span>{callCells.bid}</span>
                <span>{callCells.ask}</span>
                <span>{callCells.mark}</span>
                <span>{callCells.iv}</span>
              </button>
              <div
                data-testid={`chain-strike-${row.strike1e8}-${row.expiryMs}`}
                className="flex flex-col items-center justify-center border-x border-zinc-900 bg-black/40 px-2 py-1 font-mono text-[12px] text-zinc-100"
              >
                <span>{row.strikeLabel}</span>
                <span className="text-[9px] text-zinc-500">{row.expiryLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => !putDisabled && onSelect(row.put, row)}
                disabled={putDisabled}
                data-testid={`chain-put-${row.strike1e8}-${row.expiryMs}`}
                data-selected={putSelected ? "true" : "false"}
                data-available={putDisabled ? "false" : "true"}
                className={`grid grid-cols-4 px-3 py-2 text-right font-mono ${
                  putDisabled
                    ? "cursor-not-allowed text-zinc-700"
                    : putSelected
                      ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/40"
                      : "text-zinc-200 hover:bg-emerald-500/5 hover:text-emerald-200"
                }`}
              >
                <span>{putCells.bid}</span>
                <span>{putCells.ask}</span>
                <span>{putCells.mark}</span>
                <span>{putCells.iv}</span>
              </button>
            </div>
          );
        })}
      </div>
      <div className="border-t border-zinc-800 bg-black/40 px-3 py-1.5 text-[10px] text-zinc-500">
        Bid / Ask / Mark / IV are <strong>not exposed by the testnet beta backend</strong>{" "}
        yet — every cell renders &ldquo;—&rdquo; honestly. Click a row to open the
        detail panel and exercise the trade flow against the underlying series.
      </div>
    </div>
  );
}
