"use client";

// FRONTEND-PERPS-POLISH-V1 — single-row stats bar.
//
// One horizontal row: symbol tabs on the left, 7 stat cells flowing
// to the right. Designed to fit a ~64–80 px tall band right under the
// navbar without scrolling internally.

import { usePerpsSymbol } from "@/lib/perps-symbol";

interface Cell {
  id: string;
  label: string;
}

const CELLS: Cell[] = [
  { id: "mark", label: "Mark" },
  { id: "index", label: "Index" },
  { id: "change-24h", label: "24h Δ" },
  { id: "volume-24h", label: "24h Vol" },
  { id: "funding", label: "Funding" },
  { id: "next-funding", label: "Next" },
  { id: "open-interest", label: "OI" },
];

export function PerpsStatsWidget() {
  const { market, markets, setMarket } = usePerpsSymbol();
  return (
    <div
      data-testid="widget-perps-stats-body"
      className="flex h-full min-h-0 w-full items-stretch overflow-x-auto"
    >
      {/* Symbol tabs */}
      <div
        role="tablist"
        aria-label="Perp market"
        data-testid="widget-perps-stats-symbol"
        className="flex shrink-0 items-center gap-1 border-r border-zinc-900 px-2"
      >
        {markets.map((m) => {
          const active = m.symbol === market.symbol;
          return (
            <button
              key={m.symbol}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMarket(m.symbol)}
              data-testid={`widget-perps-symbol-${m.symbol}`}
              data-active={active ? "true" : "false"}
              className={
                active
                  ? "rounded px-2 py-0.5 text-[12px] font-semibold text-emerald-200"
                  : "rounded px-2 py-0.5 text-[12px] font-semibold text-zinc-400 hover:text-emerald-200"
              }
            >
              {m.symbol}
            </button>
          );
        })}
      </div>
      {/* Stat cells */}
      {CELLS.map((c) => (
        <div
          key={c.id}
          data-testid={`widget-perps-stat-${c.id}`}
          className="flex min-w-0 shrink-0 flex-col justify-center gap-0 border-r border-zinc-900 px-3"
        >
          <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">
            {c.label}
          </span>
          <span
            className="text-[13px] text-zinc-300"
            style={{ fontFamily: "var(--app-font-mono)" }}
          >
            —
          </span>
        </div>
      ))}
    </div>
  );
}
