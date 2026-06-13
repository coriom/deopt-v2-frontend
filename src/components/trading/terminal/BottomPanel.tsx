"use client";

import { useState } from "react";
import { BalancesCard } from "@/components/trading/BalancesCard";
import { PositionsTable } from "@/components/trading/PositionsTable";
import { TradeHistoryTable } from "@/components/trading/TradeHistoryTable";

type Tab = "balances" | "positions" | "trades" | "events";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "balances", label: "Balances" },
  { id: "positions", label: "Positions" },
  { id: "trades", label: "Trades" },
  { id: "events", label: "Events" },
];

export function BottomPanel() {
  const [tab, setTab] = useState<Tab>("balances");
  return (
    <section
      data-testid="bottom-panel"
      aria-label="Account"
      className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4"
    >
      <nav
        role="tablist"
        aria-label="Account tabs"
        data-testid="bottom-panel-tabs"
        className="flex flex-wrap gap-1 border-b border-zinc-800 pb-2"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            data-testid={`bottom-tab-${t.id}`}
            data-selected={tab === t.id ? "true" : "false"}
            className={`rounded px-2 py-0.5 text-[11px] font-medium ${
              tab === t.id
                ? "border border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                : "border border-transparent text-zinc-400 hover:text-emerald-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div data-testid={`bottom-panel-content-${tab}`}>
        {tab === "balances" && <BalancesCard />}
        {tab === "positions" && <PositionsTable />}
        {tab === "trades" && <TradeHistoryTable />}
        {tab === "events" && (
          <div
            data-testid="bottom-panel-events-placeholder"
            className="rounded border border-emerald-500/30 bg-black/40 p-3 text-[11px] text-emerald-200"
          >
            <div className="font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Events stream — coming soon
            </div>
            <p className="mt-2 text-zinc-400">
              The backend indexer reconciles on-chain events into a public
              status view; the per-wallet event feed (deposits, trades,
              settlements, exercise) lands in a follow-up milestone. Use the
              transactions page (
              <code className="rounded border border-emerald-500/30 bg-black/40 px-1 text-emerald-200">
                /transactions/&lt;intent_id&gt;
              </code>
              ) to inspect a specific trade lifecycle.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
