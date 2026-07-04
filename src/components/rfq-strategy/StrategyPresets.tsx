"use client";

import { STRATEGY_PRESETS, type StrategyPresetId } from "@/lib/rfq-strategy-model";

export function StrategyPresets({
  active,
  onSelect,
}: {
  active: StrategyPresetId;
  onSelect: (id: StrategyPresetId) => void;
}) {
  return (
    <div
      data-testid="rfq-strategy-presets"
      role="tablist"
      aria-label="Strategy preset"
      className="flex flex-wrap gap-1"
    >
      {STRATEGY_PRESETS.map((p) => {
        const isActive = p.id === active;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`rfq-strategy-preset-${p.id}`}
            data-selected={isActive ? "true" : "false"}
            onClick={() => onSelect(p.id)}
            title={p.description}
            className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
              isActive
                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
                : "border-zinc-800 bg-black/40 text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
