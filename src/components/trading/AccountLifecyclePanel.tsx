"use client";

// FRONTEND-LIFECYCLE-OBSERVABILITY-V1 — 3-tab account lifecycle panel.
//
// Compact tab strip wrapping the three real-data panels (Open orders,
// Fills, Conditional orders / TP-SL). Each panel owns its REST poll +
// WS delta merge; this wrapper just switches which one is visible.
//
// Mount in `TradeTicketPanel.tsx` below the existing trade ticket +
// TpSlManager so the user sees their order/fill/conditional lifecycle
// in context without leaving the trade workspace.

import { useState } from "react";
import { OpenOrdersPanel } from "./OpenOrdersPanel";
import { FillsPanel } from "./FillsPanel";
import { ConditionalOrdersPanel } from "./ConditionalOrdersPanel";

type Tab = "orders" | "fills" | "conditional";

const TABS: { id: Tab; label: string }[] = [
  { id: "orders", label: "Open orders" },
  { id: "fills", label: "Fills" },
  { id: "conditional", label: "TP / SL" },
];

export interface AccountLifecyclePanelProps {
  address: string | null;
}

export function AccountLifecyclePanel({ address }: AccountLifecyclePanelProps) {
  const [active, setActive] = useState<Tab>("orders");
  return (
    <section
      data-testid="account-lifecycle-panel"
      data-active-tab={active}
      className="flex flex-col gap-2"
    >
      <nav
        role="tablist"
        aria-label="Account lifecycle"
        className="flex items-center gap-1 border-b border-zinc-900 pb-1"
      >
        {TABS.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              data-testid={`account-lifecycle-tab-${t.id}`}
              onClick={() => setActive(t.id)}
              className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                selected
                  ? "bg-emerald-600/90 text-black"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>
      <div role="tabpanel">
        {active === "orders" && <OpenOrdersPanel address={address} />}
        {active === "fills" && <FillsPanel address={address} />}
        {active === "conditional" && (
          <ConditionalOrdersPanel address={address} />
        )}
      </div>
    </section>
  );
}
