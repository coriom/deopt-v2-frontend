"use client";

// FRONTEND-PERPS-POLISH-V1 — dense stats bar widget.

import { usePerpsSymbol } from "@/lib/perps-symbol";

interface Cell {
  id: string;
  label: string;
  mono?: boolean;
}

const CELLS: Cell[] = [
  { id: "mark", label: "Mark", mono: true },
  { id: "index", label: "Index", mono: true },
  { id: "change-24h", label: "24h Δ", mono: true },
  { id: "volume-24h", label: "24h Vol", mono: true },
  { id: "funding", label: "Funding", mono: true },
  { id: "next-funding", label: "Next Funding", mono: true },
  { id: "open-interest", label: "OI", mono: true },
];

export function PerpsStatsWidget() {
  const { market, markets, setMarket } = usePerpsSymbol();
  return (
    <div
      data-testid="widget-perps-stats-body"
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex flex-wrap items-center gap-1 px-2 py-1">
        <div
          role="tablist"
          aria-label="Perp market"
          data-testid="widget-perps-stats-symbol"
          className="flex items-center gap-1"
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
      </div>
      <div className="grid flex-1 grid-cols-2 overflow-x-auto sm:grid-cols-3 lg:grid-cols-7">
        {CELLS.map((c) => (
          <div
            key={c.id}
            data-testid={`widget-perps-stat-${c.id}`}
            className="flex flex-col gap-0.5 px-3 py-1.5"
          >
            <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              {c.label}
            </span>
            <span
              className="text-[14px] text-zinc-300"
              style={c.mono ? { fontFamily: "var(--app-font-mono)" } : undefined}
            >
              —
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
