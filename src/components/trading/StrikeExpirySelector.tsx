"use client";

import type { Series } from "@/lib/trading-types";

function formatStrike1e8(s: string): string {
  // Display strike with optional fractional digits; 1e8 normalization.
  try {
    const big = BigInt(s);
    const ONE_E_8 = BigInt(100000000);
    const ZERO = BigInt(0);
    const whole = big / ONE_E_8;
    const frac = big % ONE_E_8;
    return frac === ZERO
      ? whole.toString()
      : `${whole.toString()}.${frac.toString().padStart(8, "0").replace(/0+$/, "")}`;
  } catch {
    return s;
  }
}

export function StrikeExpirySelector({
  seriesIds,
  selected,
  onSelect,
  resolveSeries,
}: {
  seriesIds: string[];
  selected: string | null;
  onSelect: (seriesId: string) => void;
  resolveSeries: (seriesId: string) => Series | undefined;
}) {
  if (seriesIds.length === 0) {
    return <p className="text-sm text-zinc-500">No series in this product.</p>;
  }
  return (
    <ul
      data-testid="strike-expiry-selector"
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      {seriesIds.map((id) => {
        const s = resolveSeries(id);
        const isSelected = id === selected;
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => onSelect(id)}
              data-testid={`series-button-${id}`}
              data-selected={isSelected ? "true" : "false"}
              className={`w-full rounded border px-3 py-2 text-left text-xs transition ${
                isSelected
                  ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100"
                  : "border-zinc-800 bg-black/40 text-zinc-200 hover:border-emerald-500/40 hover:bg-emerald-500/5"
              }`}
            >
              <div className="font-mono text-zinc-100">
                {s ? `K=${formatStrike1e8(s.strike_1e8)}` : id}
              </div>
              {s && (
                <div className="mt-1 text-[10px] text-zinc-400">
                  exp {new Date(s.expiry_ms).toISOString().slice(0, 16).replace("T", " ")}
                </div>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
