"use client";

// FRONTEND-PERPS-POLISH-V1 — orderbook ladder widget.
//
// No public orderbook source exists yet; every cell renders `—`.
// The hamburger popover lets the user toggle columns and change the
// tick grouping; selections persist via localStorage.

import { useEffect, useRef, useState } from "react";
import {
  ORDERBOOK_COLUMNS,
  GROUPING_OPTIONS,
  useOrderbookPrefs,
  type OrderbookColumnId,
  type OrderbookPrefs,
} from "@/hooks/useOrderbookPrefs";
import { usePerpsSymbol } from "@/lib/perps-symbol";

const LEVELS = 12; // 12 bids + 12 asks placeholder rows

export function PerpsOrderbookWidget() {
  const prefs = useOrderbookPrefs();
  const { market } = usePerpsSymbol();
  const visible = prefs.visibleOrdered;
  return (
    <div
      data-testid="widget-perps-orderbook-body"
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex items-center justify-between px-2 py-1">
        <span
          data-testid="widget-perps-orderbook-symbol"
          className="font-mono text-[11px] text-zinc-400"
          style={{ fontFamily: "var(--app-font-mono)" }}
        >
          {market.symbol}
        </span>
        <OrderbookMenu prefs={prefs} />
      </div>

      <HeaderRow visible={visible} />

      {/* Asks (descending — top-down) */}
      <div role="rowgroup" data-testid="widget-perps-orderbook-asks">
        {Array.from({ length: LEVELS }).map((_, i) => (
          <Row key={`a-${i}`} side="ask" idx={i} visible={visible} />
        ))}
      </div>

      {/* Mid / spread band */}
      <div
        data-testid="widget-perps-orderbook-mid"
        className="flex items-center justify-between border-y border-zinc-800 bg-black/40 px-2 py-1 text-[11px]"
      >
        <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">
          Mid
        </span>
        <span
          className="font-mono text-zinc-500"
          style={{ fontFamily: "var(--app-font-mono)" }}
        >
          —
        </span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">
          Spread —
        </span>
      </div>

      {/* Bids */}
      <div role="rowgroup" data-testid="widget-perps-orderbook-bids">
        {Array.from({ length: LEVELS }).map((_, i) => (
          <Row key={`b-${i}`} side="bid" idx={i} visible={visible} />
        ))}
      </div>

      <p className="border-t border-zinc-900 px-2 py-1 text-[10px] text-zinc-500">
        Live ladder activates when the perps matching engine ships.
      </p>
    </div>
  );
}

function HeaderRow({ visible }: { visible: OrderbookColumnId[] }) {
  const tpl = visible.map(() => "minmax(0,1fr)").join(" ");
  return (
    <div
      className="grid border-b border-zinc-900 bg-black/30 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500"
      style={{ gridTemplateColumns: tpl || "1fr" }}
    >
      {visible.map((id) => {
        const def = ORDERBOOK_COLUMNS.find((c) => c.id === id)!;
        return (
          <span
            key={id}
            className="text-right"
            data-testid={`widget-perps-orderbook-header-${id}`}
          >
            {def.label}
          </span>
        );
      })}
    </div>
  );
}

function Row({
  side,
  idx,
  visible,
}: {
  side: "ask" | "bid";
  idx: number;
  visible: OrderbookColumnId[];
}) {
  const tpl = visible.map(() => "minmax(0,1fr)").join(" ");
  const priceColor = side === "ask" ? "text-red-300" : "text-emerald-300";
  return (
    <div
      data-testid={`widget-perps-orderbook-row-${side}-${idx}`}
      className="grid px-2 py-0.5 font-mono text-[11px] text-zinc-600"
      style={{
        gridTemplateColumns: tpl || "1fr",
        fontFamily: "var(--app-font-mono)",
      }}
    >
      {visible.map((id) => (
        <span
          key={id}
          className={`text-right ${id === "price" ? `${priceColor} opacity-40` : ""}`}
        >
          —
        </span>
      ))}
    </div>
  );
}

function OrderbookMenu({ prefs }: { prefs: OrderbookPrefs }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      data-testid="widget-perps-orderbook-menu"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Orderbook options"
        aria-expanded={open}
        data-testid="widget-perps-orderbook-menu-button"
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-800 bg-black/40 text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
      >
        <Hamburger />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Orderbook columns"
          data-testid="widget-perps-orderbook-menu-panel"
          className="absolute right-0 z-40 mt-1 w-52 rounded border border-zinc-800 bg-zinc-950 p-2 text-[12px] text-zinc-200 shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-zinc-900 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Columns
            </span>
            <button
              type="button"
              onClick={prefs.resetDefaults}
              data-testid="widget-perps-orderbook-menu-reset"
              className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-200"
            >
              Reset
            </button>
          </div>
          <ul className="mt-1 flex flex-col">
            {ORDERBOOK_COLUMNS.map((c) => {
              const checked = prefs.visible.has(c.id);
              return (
                <li key={c.id}>
                  <label
                    data-testid={`widget-perps-orderbook-menu-item-${c.id}`}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-emerald-500/5"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => prefs.toggle(c.id)}
                      data-testid={`widget-perps-orderbook-menu-toggle-${c.id}`}
                      className="h-3.5 w-3.5 accent-emerald-500"
                    />
                    <span>{c.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 border-t border-zinc-900 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Grouping
            </span>
            <select
              value={prefs.groupBps}
              onChange={(e) => prefs.setGroupBps(Number(e.target.value))}
              data-testid="widget-perps-orderbook-menu-grouping"
              className="mt-1 w-full cursor-pointer rounded border border-zinc-800 bg-black/40 px-2 py-1 text-[11px] text-zinc-200"
            >
              {GROUPING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Hamburger() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <line x1="2" y1="3.5" x2="10" y2="3.5" />
      <line x1="2" y1="6" x2="10" y2="6" />
      <line x1="2" y1="8.5" x2="10" y2="8.5" />
    </svg>
  );
}
