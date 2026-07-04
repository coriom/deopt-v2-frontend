"use client";

import { useCallback, useMemo, useState } from "react";
import {
  applyPreset,
  initialStrategyState,
  summariseStrategy,
  updateLeg,
  type StrategyPresetId,
  type StrategyState,
  type StrategyUnderlying,
} from "@/lib/rfq-strategy-model";
import { strategyToJson } from "@/lib/rfq-strategy-payoff";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { StrategyPresets } from "./StrategyPresets";
import { StrategyLegEditor } from "./StrategyLegEditor";
import { StrategyPayoffChart } from "./StrategyPayoffChart";

type Tab = "payoff" | "greeks" | "trades" | "book";

const TABS: readonly { id: Tab; label: string }[] = [
  { id: "payoff", label: "Payoff" },
  { id: "greeks", label: "Greeks" },
  { id: "trades", label: "Trades" },
  { id: "book", label: "Book" },
] as const;

export function RfqStrategyWorkspace() {
  const [state, setState] = useState<StrategyState>(() => initialStrategyState("BTC"));
  const [tab, setTab] = useState<Tab>("payoff");
  const [copied, setCopied] = useState(false);

  const summary = useMemo(() => summariseStrategy(state), [state]);

  const onPreset = useCallback(
    (id: StrategyPresetId) => setState((s) => applyPreset(s, id)),
    [],
  );
  const onLegUpdate = useCallback(
    (id: string, patch: Parameters<typeof updateLeg>[2]) =>
      setState((s) => updateLeg(s, id, patch)),
    [],
  );

  const onCopyStrategy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(strategyToJson(state));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked; the JSON stays inline for manual copy.
    }
  }, [state]);

  return (
    <div
      data-testid="rfq-strategy-workspace"
      className="flex h-full min-h-0 flex-col gap-3 p-4 text-zinc-200"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-[13px] font-semibold text-zinc-100">
            RFQ / Strategy
          </h1>
          <span
            data-testid="rfq-strategy-status-pill"
            className="rounded border border-zinc-700 bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400"
          >
            builder foundation — Request Quote not live yet
          </span>
        </div>
        <NativeSelect
          aria-label="Underlying"
          data-testid="rfq-strategy-underlying"
          value={state.underlying}
          onChange={(e) =>
            setState((s) => ({
              ...s,
              underlying: e.target.value as StrategyUnderlying,
            }))
          }
          variant="bordered"
        >
          <option value="BTC" className="bg-zinc-950">
            BTC
          </option>
          <option value="ETH" className="bg-zinc-950">
            ETH
          </option>
        </NativeSelect>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(320px,1fr)_minmax(360px,1.4fr)]">
        {/* Left panel: builder */}
        <section
          data-testid="rfq-strategy-builder"
          className="flex flex-col gap-3 rounded border border-zinc-800 bg-black/40 p-3"
        >
          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              Preset
            </label>
            <StrategyPresets active={state.presetId} onSelect={onPreset} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              Amount
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={state.amount}
                onChange={(e) =>
                  setState((s) => ({ ...s, amount: Number(e.target.value) }))
                }
                data-testid="rfq-strategy-amount"
                className="rounded border border-zinc-800 bg-black/40 px-2 py-1 text-right font-mono text-[12px] normal-case tracking-normal text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              Expiry (ISO)
              <input
                type="text"
                value={new Date(state.expiryMs).toISOString().slice(0, 10)}
                readOnly
                data-testid="rfq-strategy-expiry"
                className="rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-[12px] normal-case tracking-normal text-zinc-400"
                title="V1 uses the public-beta seed expiry (2026-12-31 UTC)"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              Legs
            </span>
            <StrategyLegEditor legs={state.legs} onUpdate={onLegUpdate} />
          </div>

          <div className="mt-auto flex flex-col gap-2 border-t border-zinc-900 pt-3">
            <button
              type="button"
              disabled
              data-testid="rfq-strategy-request-quote"
              data-ticket-mode="disabled"
              title="RFQ creation is not live yet — deferred to OPTIONS-RFQ-CREATE-AND-LIFECYCLE-V1"
              className="cursor-not-allowed rounded bg-zinc-800 px-3 py-2 text-[12px] font-semibold text-zinc-500"
            >
              Request Quote — not live yet
            </button>
            <button
              type="button"
              onClick={onCopyStrategy}
              data-testid="rfq-strategy-copy"
              className="rounded border border-emerald-500/40 px-3 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/10"
            >
              {copied ? "Copied!" : "Copy strategy JSON"}
            </button>
            <p className="text-[10px] text-zinc-500">
              RFQ creation is not live yet. The backend supports Options RFQ
              routes end-to-end; wiring is deferred to
              <code className="mx-1 rounded bg-zinc-900 px-1 text-emerald-300">
                OPTIONS-RFQ-CREATE-AND-LIFECYCLE-V1
              </code>
              so counter-party discovery + signing UX land in one milestone.
            </p>
          </div>
        </section>

        {/* Right panel: summary + tabs */}
        <section
          data-testid="rfq-strategy-preview"
          className="flex flex-col gap-3 rounded border border-zinc-800 bg-black/40 p-3"
        >
          <div
            data-testid="rfq-strategy-summary"
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[12px] text-zinc-100"
          >
            {summary}
          </div>

          <div
            role="tablist"
            aria-label="Strategy preview"
            data-testid="rfq-strategy-tabs"
            className="flex gap-1 border-b border-zinc-800"
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`rfq-strategy-tab-${t.id}`}
                  data-selected={active ? "true" : "false"}
                  onClick={() => setTab(t.id)}
                  className={`rounded-t px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? "border-b-2 border-emerald-400 text-zinc-100"
                      : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            data-testid={`rfq-strategy-tab-body-${tab}`}
            className="flex min-h-0 flex-1 flex-col"
          >
            {tab === "payoff" && <StrategyPayoffChart state={state} />}
            {tab === "greeks" && (
              <div className="rounded border border-zinc-800 bg-black/40 p-4 text-[11px] text-zinc-500">
                Greeks will populate when live pricing/RFQ data is available.
                V1 keeps the chain-level dashes honest rather than inventing
                Δ/Γ/ν/Θ from a placeholder IV.
              </div>
            )}
            {tab === "trades" && (
              <div className="rounded border border-zinc-800 bg-black/40 p-4 text-[11px] text-zinc-500">
                No RFQ trades yet. Once RFQ creation lands, executed trades
                will show here per-strategy.
              </div>
            )}
            {tab === "book" && (
              <div className="rounded border border-zinc-800 bg-black/40 p-4 text-[11px] text-zinc-500">
                RFQ quote book is not live yet. Backend routes
                (<code className="rounded bg-zinc-900 px-1 text-emerald-300">
                  /options/rfqs
                </code>
                ) exist but no counter-party maker has quoted here.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
