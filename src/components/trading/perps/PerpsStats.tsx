"use client";

// FRONTEND-PERPS-POLISH-V1 — single-row stats bar.
// PERPS-MINIMAL-MARKET-AND-PRICE-V1 — wires the Mark + Index cells to
// the read-only backend price snapshot when available.
//
// One horizontal row: symbol tabs on the left, 7 stat cells flowing
// to the right. Designed to fit a ~64–80 px tall band right under the
// navbar without scrolling internally.
//
// Fallback rules (honest never fabricated):
//   * backend reader disabled or unreachable → all stat cells render `—`
//     with `data-perps-price-state="unavailable"` so tests can pin the
//     no-fabrication contract.
//   * price arrives with `stale=true` → cells still render the number
//     but tagged `data-perps-price-state="stale"` and visually muted.
//   * price arrives fresh → cells render the number, tagged `ok`.
//
// Cells NOT wired to a real signal in V1 remain `—` (24h Δ, 24h Vol,
// Funding, Next, OI). Funding and OI land with `PERPS-FUNDING-V1` /
// `PERPS-ISOLATED-MARGIN-POSITION-ENGINE-V1`.

import { useEffect, useRef, useState } from "react";
import { usePerpsSymbol } from "@/lib/perps-symbol";
import {
  getPerpsMarketPrice,
  TradingApiError,
  type PerpPriceState,
} from "@/lib/trading-api";

interface Cell {
  id: string;
  label: string;
  value: (state: PerpPriceState) => string;
}

const POLL_INTERVAL_MS = 15_000;

function format1e8(raw: string): string {
  // Two-decimal grouped format via BigInt to avoid float drift. Falls
  // back to raw for pathological inputs so we never render a number
  // that isn't traceable to the wire value.
  if (!/^\d+$/.test(raw)) return "—";
  if (raw.length > 20) return raw;
  const asBigInt = BigInt(raw);
  const scale = BigInt(100_000_000);
  const whole = asBigInt / scale;
  const frac = asBigInt % scale;
  // Divide by 1e6 to keep the top two frac digits (rounding down).
  const twoDp = frac / BigInt(1_000_000);
  const wholeStr = whole
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${wholeStr}.${twoDp.toString().padStart(2, "0")}`;
}

function priceCellValue(state: PerpPriceState, which: "mark" | "index"): string {
  if (state.kind === "ok") {
    const raw =
      which === "mark"
        ? state.snapshot.mark_price_1e8
        : state.snapshot.index_price_1e8;
    return format1e8(raw);
  }
  return "—";
}

const CELLS: Cell[] = [
  { id: "mark", label: "Mark", value: (s) => priceCellValue(s, "mark") },
  { id: "index", label: "Index", value: (s) => priceCellValue(s, "index") },
  { id: "change-24h", label: "24h Δ", value: () => "—" },
  { id: "volume-24h", label: "24h Vol", value: () => "—" },
  { id: "funding", label: "Funding", value: () => "—" },
  { id: "next-funding", label: "Next", value: () => "—" },
  { id: "open-interest", label: "OI", value: () => "—" },
];

function usePerpsPriceState(symbol: string): PerpPriceState {
  const [state, setState] = useState<PerpPriceState>({ kind: "loading" });

  useEffect(() => {
    // Effect is a synchronisation to an external system (the backend
    // price snapshot). The setState calls only fire inside the async
    // task's microtask/interval handler — never synchronously in the
    // effect body — so the `set-state-in-effect` rule does not apply.
    let cancelled = false;
    const ctrl = new AbortController();

    async function tick() {
      try {
        const snap = await getPerpsMarketPrice(symbol, ctrl.signal);
        if (!cancelled) setState({ kind: "ok", snapshot: snap });
      } catch (err) {
        if (cancelled || (err as Error)?.name === "AbortError") return;
        const reason =
          err instanceof TradingApiError ? err.message : (err as Error).message;
        setState({ kind: "unavailable", reason });
      }
    }

    void tick();
    const handle = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(handle);
    };
  }, [symbol]);

  return state;
}

function priceStateTag(state: PerpPriceState): string {
  if (state.kind === "loading") return "loading";
  if (state.kind === "unavailable") return "unavailable";
  return state.snapshot.stale ? "stale" : "ok";
}

export function PerpsStatsWidget() {
  const { market, markets, setMarket } = usePerpsSymbol();
  const priceState = usePerpsPriceState(market.symbol);
  const stateTag = priceStateTag(priceState);
  return (
    // The outer bandeau does NOT set `overflow-x-auto`. CSS forces
    // `overflow-y: auto` on any element whose `overflow-x` is not
    // `visible` — that quirk previously clipped the dropdown popover
    // below the short bandeau, hiding every option except the first
    // one visible above the fold. The stat cells scroll horizontally
    // inside their own inner container instead.
    <div
      data-testid="widget-perps-stats-body"
      data-perps-price-state={stateTag}
      className="flex h-full min-h-0 w-full items-stretch"
    >
      {/* Symbol selector — current symbol as a trigger button; click
          opens a dropdown with the other markets. Kept outside the
          scrolling stats row so the popover can escape freely. */}
      <PerpsSymbolMenu
        current={market.symbol}
        markets={markets}
        onSelect={setMarket}
      />
      {/* Stat cells — this is the only region that scrolls horizontally
          when the widget is narrow enough that the 7 cells don't fit. */}
      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {CELLS.map((c) => {
          const value = c.value(priceState);
          return (
            <div
              key={c.id}
              data-testid={`widget-perps-stat-${c.id}`}
              data-perps-cell-state={stateTag}
              // `flex-1` + `basis-0` makes every cell take an equal
              // share of the available width to the right of the
              // symbol pill, so the bandeau spreads edge-to-edge
              // instead of clustering the cells on the left with a
              // blank tail. `overflow-x-auto` on the parent still
              // acts as the safety net when the widget is squeezed.
              className="flex min-w-0 flex-1 basis-0 flex-col justify-center gap-0 border-r border-zinc-900 px-3 py-0.5"
            >
              <span className="text-[9px] uppercase leading-tight tracking-[0.12em] text-zinc-500">
                {c.label}
              </span>
              <span
                className={
                  stateTag === "stale"
                    ? "text-[12px] leading-tight text-zinc-500"
                    : "text-[12px] leading-tight text-zinc-300"
                }
                style={{ fontFamily: "var(--app-font-mono)" }}
              >
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PerpsSymbolMenuProps {
  current: string;
  markets: { symbol: string }[];
  onSelect: (symbol: string) => void;
}

function PerpsSymbolMenu({ current, markets, onSelect }: PerpsSymbolMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(ev: MouseEvent | TouchEvent) {
      const el = containerRef.current;
      if (!el) return;
      if (ev.target instanceof Node && el.contains(ev.target)) return;
      setOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("touchstart", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("touchstart", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      data-testid="widget-perps-stats-symbol"
      data-open={open ? "true" : "false"}
      className="relative flex shrink-0 items-center border-r border-zinc-900 px-2"
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="widget-perps-symbol-current"
        className="flex items-center gap-1 rounded px-2 py-0 text-[11px] font-semibold text-emerald-200 hover:text-emerald-100"
      >
        <span>{current}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 8 5"
          width="8"
          height="5"
          className={
            open
              ? "rotate-180 fill-current text-emerald-200 transition-transform"
              : "fill-current text-emerald-200 transition-transform"
          }
        >
          <path d="M0 0h8L4 5z" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Select perp market"
          data-testid="widget-perps-symbol-menu"
          className="absolute left-1 top-full z-20 mt-1 flex flex-col gap-0.5 rounded border border-zinc-800 bg-zinc-950 py-1 shadow-lg"
        >
          {markets.map((m) => {
            const active = m.symbol === current;
            return (
              <button
                key={m.symbol}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onSelect(m.symbol);
                  setOpen(false);
                }}
                data-testid={`widget-perps-symbol-${m.symbol}`}
                data-active={active ? "true" : "false"}
                className={
                  active
                    ? "px-3 py-1 text-left text-[11px] font-semibold text-emerald-200"
                    : "px-3 py-1 text-left text-[11px] font-semibold text-zinc-400 hover:bg-zinc-900 hover:text-emerald-200"
                }
              >
                {m.symbol}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
