"use client";

import type { StrategyLeg } from "@/lib/rfq-strategy-model";

interface LegEditorProps {
  legs: StrategyLeg[];
  onUpdate: (id: string, patch: Partial<Omit<StrategyLeg, "id">>) => void;
}

export function StrategyLegEditor({ legs, onUpdate }: LegEditorProps) {
  if (legs.length === 0) {
    return (
      <div
        data-testid="rfq-strategy-leg-empty"
        className="rounded border border-dashed border-zinc-800 bg-black/30 p-3 text-center text-[11px] text-zinc-500"
      >
        No legs yet — pick a preset above or start from Custom to add legs
        manually.
      </div>
    );
  }
  return (
    <div
      data-testid="rfq-strategy-leg-editor"
      className="flex flex-col gap-2 text-[11px] text-zinc-200"
    >
      <div className="grid grid-cols-[3rem_3rem_1fr_3rem_5rem] gap-2 border-b border-zinc-900 pb-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
        <span>Side</span>
        <span>Type</span>
        <span>Strike</span>
        <span>Ratio</span>
        <span className="text-right">Premium</span>
      </div>
      {legs.map((leg) => (
        <div
          key={leg.id}
          data-testid={`rfq-strategy-leg-${leg.id}`}
          className="grid grid-cols-[3rem_3rem_1fr_3rem_5rem] items-center gap-2"
        >
          <select
            aria-label="Side"
            value={leg.side}
            onChange={(e) =>
              onUpdate(leg.id, { side: e.target.value as StrategyLeg["side"] })
            }
            data-testid={`rfq-strategy-leg-${leg.id}-side`}
            className="rounded border border-zinc-800 bg-black/40 px-1 py-0.5 text-[11px] text-zinc-100"
          >
            <option value="buy" className="bg-zinc-950">
              Buy
            </option>
            <option value="sell" className="bg-zinc-950">
              Sell
            </option>
          </select>
          <select
            aria-label="Option type"
            value={leg.optionType}
            onChange={(e) =>
              onUpdate(leg.id, {
                optionType: e.target.value as StrategyLeg["optionType"],
              })
            }
            data-testid={`rfq-strategy-leg-${leg.id}-type`}
            className="rounded border border-zinc-800 bg-black/40 px-1 py-0.5 text-[11px] text-zinc-100"
          >
            <option value="call" className="bg-zinc-950">
              Call
            </option>
            <option value="put" className="bg-zinc-950">
              Put
            </option>
          </select>
          <input
            type="number"
            inputMode="decimal"
            value={leg.strike}
            onChange={(e) =>
              onUpdate(leg.id, { strike: Number(e.target.value) })
            }
            data-testid={`rfq-strategy-leg-${leg.id}-strike`}
            className="rounded border border-zinc-800 bg-black/40 px-1 py-0.5 text-right font-mono text-[11px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
          <input
            type="number"
            inputMode="decimal"
            min={1}
            value={leg.ratio}
            onChange={(e) =>
              onUpdate(leg.id, { ratio: Number(e.target.value) })
            }
            data-testid={`rfq-strategy-leg-${leg.id}-ratio`}
            className="rounded border border-zinc-800 bg-black/40 px-1 py-0.5 text-right font-mono text-[11px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="—"
            value={leg.premium ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              onUpdate(leg.id, {
                premium: raw === "" ? null : Number(raw),
              });
            }}
            data-testid={`rfq-strategy-leg-${leg.id}-premium`}
            className="rounded border border-zinc-800 bg-black/40 px-1 py-0.5 text-right font-mono text-[11px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
        </div>
      ))}
    </div>
  );
}
