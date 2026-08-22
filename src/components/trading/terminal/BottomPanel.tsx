"use client";

import { useState } from "react";
import { BalancesCard } from "@/components/trading/BalancesCard";
import { PositionsTable } from "@/components/trading/PositionsTable";
import { TradeHistoryTable } from "@/components/trading/TradeHistoryTable";

type Tab =
  | "balances"
  | "positions"
  | "orders"
  | "trades"
  | "greeks";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "balances", label: "Balances" },
  { id: "positions", label: "Positions" },
  { id: "orders", label: "Orders" },
  { id: "trades", label: "Trades" },
  { id: "greeks", label: "Greeks" },
];

function PlaceholderCard({
  id,
  title,
  body,
}: {
  id: Tab;
  title: string;
  body: string;
}) {
  return (
    <div
      data-testid={`bottom-panel-${id}-placeholder`}
      className="rounded border border-emerald-500/30 bg-black/40 p-3 text-[11px] text-emerald-200"
    >
      <div className="font-semibold uppercase tracking-[0.18em] text-emerald-300">
        {title}
      </div>
      <p className="mt-2 text-zinc-400">{body}</p>
    </div>
  );
}

export function BottomPanel() {
  const [tab, setTab] = useState<Tab>("balances");
  return (
    <section
      data-testid="bottom-panel"
      aria-label="Account"
      // Border removed — the widget frame's border already draws
      // the outer edge; adding a second one here rendered a
      // visible double-line seam right inside the widget.
      className="flex flex-col gap-2 rounded bg-zinc-950 p-2"
    >
      <nav
        role="tablist"
        aria-label="Account tabs"
        data-testid="bottom-panel-tabs"
        className="flex flex-wrap gap-1 border-b border-zinc-900 pb-1.5"
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
        {tab === "orders" && (
          <PlaceholderCard
            id="orders"
            title="Orders — not live in this testnet beta"
            body="The options trade flow is intent → sign → executor-broadcast; there is no resting limit-order book yet. Inspect a specific trade lifecycle via /transactions/<intent_id>."
          />
        )}
        {tab === "greeks" && (
          <PlaceholderCard
            id="greeks"
            title="Greeks — coming later in the testnet beta"
            body="Delta / Gamma / Vega / Theta are not exposed by the current backend. The chain and detail panel already render honest dashes for greeks; this dock will surface portfolio-level greeks once the backend pricing service ships."
          />
        )}
      </div>
    </section>
  );
}
