"use client";

// FRONTEND-PERPS-POLISH-V1 — perps public trade feed.
//
// Backend exposes no public trade feed for perps yet; the table
// renders an honest empty state. Header row is rendered so the
// layout doesn't shift when fills start landing.

import { usePerpsSymbol } from "@/lib/perps-symbol";

const COLUMNS = ["Time", "Side", "Price", "Size"] as const;

export function PerpsTradeFeedWidget() {
  const { market } = usePerpsSymbol();
  return (
    <div
      data-testid="widget-perps-trade-feed-body"
      className="flex h-full min-h-0 flex-col"
    >
      <header className="flex items-center px-2 py-1">
        <span
          className="text-[11px] font-mono text-zinc-400"
          style={{ fontFamily: "var(--app-font-mono)" }}
        >
          {market.symbol}
        </span>
      </header>
      <div className="grid grid-cols-4 border-b border-zinc-900 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        {COLUMNS.map((c, i) => (
          <span
            key={c}
            className={i === 0 ? "text-left" : "text-right"}
            data-testid={`widget-perps-trade-feed-th-${c.toLowerCase()}`}
          >
            {c}
          </span>
        ))}
      </div>
      <div
        data-testid="widget-perps-trade-feed-empty"
        className="flex flex-1 flex-col items-center justify-center gap-1 px-3 py-6 text-center"
      >
        <span className="text-[12px] text-zinc-400">No fills yet</span>
        <span className="text-[10px] text-zinc-500">
          Live feed activates when the perps executor ships.
        </span>
      </div>
    </div>
  );
}
