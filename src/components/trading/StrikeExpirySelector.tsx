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
    <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
      {seriesIds.map((id) => {
        const s = resolveSeries(id);
        const isSelected = id === selected;
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => onSelect(id)}
              className={`w-full rounded border px-3 py-2 text-left text-xs ${
                isSelected
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              <div className="font-mono">{s ? `K=${formatStrike1e8(s.strike_1e8)}` : id}</div>
              {s && (
                <div className="mt-1 text-[10px] opacity-75">
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
