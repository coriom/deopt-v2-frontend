"use client";

// TradeTicketPanel — OPTIONS-CHAIN-MULTISELECT-EXECUTION-UX-V1
//
// The trade widget is now driven by the multi-leg chain selection
// (`useSelectedLegs`) and a single `Execution` dropdown:
//
//   * `Auto` (default) — routes based on how many legs the user has
//                        selected in the chain:
//                          - 0 legs → picker guidance (form kept as
//                            an advanced fallback for testers).
//                          - 1 leg → single-leg Book (existing
//                            DirectOrderbookForm).
//                          - 2+ legs → multi-leg RFQ; the backend
//                            does not ship atomic multi-leg RFQ
//                            yet so the ticket surfaces an honest
//                            blocker with the forward milestone
//                            `OPTIONS-MULTI-LEG-ATOMIC-RFQ-V1`.
//   * `Book` — single-leg orderbook only. Multi-leg surfaces the
//              honest `Use RFQ for strategies` blocker.
//   * `RFQ`  — single-leg RFQ create flow (gated on
//              `NEXT_PUBLIC_OPTIONS_RFQ_ENABLED`) or the honest
//              multi-leg blocker.
//
// The Payoff / Greeks / Trades / Book tabs remain unchanged and
// keep reading the legacy single-leg `useSelectedOption()` view so
// existing coverage passes without churn.

import { useMemo, useState } from "react";
import type { OptionLeg, OptionsChainRow } from "@/lib/options-chain-model";
import {
  useSelectedLegs,
  useSelectedOption,
} from "@/lib/workspace-selected-option";
import { DirectOrderbookForm } from "@/components/trading/DirectOrderbookForm";
import { TradeHistoryTable } from "@/components/trading/TradeHistoryTable";
import { PayoffSvg } from "@/components/trading/terminal/PayoffSvg";
import { NativeSelect } from "@/components/ui/NativeSelect";
import {
  resolveExecutionMode,
  type RequestedExecutionMode,
  type SelectedOptionLeg,
} from "@/lib/execution-mode";
import { isOptionsRfqEnabled } from "@/lib/options-rfq-flag";

type TradeTab = "payoff" | "greeks" | "trades" | "book";
type Side = "buy" | "sell";

const TRADE_TABS: readonly { id: TradeTab; label: string }[] = [
  { id: "payoff", label: "Payoff" },
  { id: "greeks", label: "Greeks" },
  { id: "trades", label: "Trades" },
  { id: "book", label: "Book" },
] as const;

function fallbackInstrumentTitle(): string {
  return "Pick a series from the chain";
}

function deriveInstrumentTitle(
  leg: OptionLeg | null,
  row: OptionsChainRow | null,
): string {
  if (!leg || !row) return fallbackInstrumentTitle();
  const kind = leg.isCall ? "Call" : "Put";
  return `K = ${row.strikeLabel} ${kind} · exp ${row.expiryLabel}`;
}

function strategyTitle(legs: SelectedOptionLeg[]): string | null {
  if (legs.length < 2) return null;
  const sameUnderlying = legs.every((l) => l.underlying === legs[0].underlying);
  const sameExpiry = legs.every((l) => l.expiry === legs[0].expiry);
  const strikes = legs.map((l) => l.strike).join("/");
  const underlying = sameUnderlying && legs[0].underlying
    ? legs[0].underlying
    : "Multi";
  const expiry = sameExpiry ? ` · exp ${legs[0].expiry}` : "";
  return `${underlying} · legs ${strikes}${expiry}`;
}

export function TradeTicketPanel() {
  const { selected } = useSelectedOption();
  const { legs, removeLegAt, updateLegRatio, clearLegs } = useSelectedLegs();
  const leg = selected?.leg ?? null;
  const row = selected?.row ?? null;

  const primaryTitle = useMemo(
    () => strategyTitle(legs) ?? deriveInstrumentTitle(leg, row),
    [legs, leg, row],
  );

  const [mode, setMode] = useState<RequestedExecutionMode>("auto");
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState<TradeTab>("payoff");

  const rfqEnabled = isOptionsRfqEnabled();
  const resolved = useMemo(
    () =>
      resolveExecutionMode({
        requestedMode: mode,
        selectedLegs: legs,
        rfqEnabled,
      }),
    [mode, legs, rfqEnabled],
  );

  return (
    <div
      data-testid="trade-panel"
      data-trade-mode={mode}
      data-resolved-mode={resolved.kind}
      data-leg-count={legs.length}
      data-trade-side={side}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-zinc-800 bg-black/60 text-zinc-200"
    >
      <TradeHeader
        instrumentTitle={primaryTitle}
        mode={mode}
        onModeChange={setMode}
      />

      <SelectedLegsStrip
        legs={legs}
        onRemove={removeLegAt}
        onRatioChange={updateLegRatio}
        onClear={clearLegs}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <TradeBody
          resolved={resolved}
          leg={leg}
          side={side}
          setSide={setSide}
          instrumentTitle={primaryTitle}
          amount={amount}
          setAmount={setAmount}
        />

        <TradeTabsSection
          active={activeTab}
          onChange={setActiveTab}
          leg={leg}
          row={row}
        />
      </div>
    </div>
  );
}

// ---------- Body router ----------

interface TradeBodyProps {
  resolved: ReturnType<typeof resolveExecutionMode>;
  leg: OptionLeg | null;
  side: Side;
  setSide: (s: Side) => void;
  instrumentTitle: string;
  amount: string;
  setAmount: (v: string) => void;
}

function TradeBody(props: TradeBodyProps) {
  const {
    resolved,
    leg,
    side,
    setSide,
    instrumentTitle,
    amount,
    setAmount,
  } = props;

  if (resolved.kind === "book" || resolved.kind === "empty") {
    // For both `empty` (no leg selected) and `book` (single leg), we
    // render the DirectOrderbookForm. In the `empty` case the form
    // is a manual fallback available via the Advanced toggle, so
    // testers can still submit an arbitrary series id.
    const prefill =
      resolved.kind === "book" ? resolved.leg.seriesId : leg?.seriesId;
    return (
      <div
        data-testid="trade-body-orderbook"
        data-testid-alias="trade-body-book"
        className="flex flex-col gap-3 p-3"
      >
        <DirectOrderbookForm
          key={prefill ?? "__no_selection__"}
          initialSeriesId={prefill ?? undefined}
        />
      </div>
    );
  }

  if (resolved.kind === "book_blocked_multileg") {
    return (
      <div
        data-testid="trade-body-book-blocked-multileg"
        role="alert"
        className="flex flex-col gap-2 p-3 text-[11px]"
      >
        <p className="rounded border border-amber-500/40 bg-amber-950/30 p-3 text-amber-200">
          Book execution supports one leg at a time. Switch execution to{" "}
          <span className="font-semibold">RFQ</span> to price a strategy across
          your selected legs.
        </p>
      </div>
    );
  }

  if (resolved.kind === "rfq_multileg_blocked") {
    return (
      <div
        data-testid="trade-body-rfq-multileg-blocked"
        role="alert"
        className="flex flex-col gap-2 p-3 text-[11px]"
      >
        <p className="rounded border border-amber-500/40 bg-amber-950/30 p-3 text-amber-200">
          Multi-leg RFQ execution is not live yet. The backend ships one leg
          per RFQ today; atomic multi-leg RFQ is tracked as{" "}
          <span className="font-mono">OPTIONS-MULTI-LEG-ATOMIC-RFQ-V1</span>.
        </p>
      </div>
    );
  }

  if (resolved.kind === "rfq_disabled") {
    return (
      <div
        data-testid="trade-body-rfq-disabled"
        role="note"
        className="flex flex-col gap-2 p-3 text-[11px]"
      >
        <p className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-zinc-400">
          RFQ create is disabled by default. Enable{" "}
          <span className="font-mono">NEXT_PUBLIC_OPTIONS_RFQ_ENABLED</span> to
          surface the single-leg RFQ ticket. Multi-leg RFQ remains gated on{" "}
          <span className="font-mono">OPTIONS-MULTI-LEG-ATOMIC-RFQ-V1</span>.
        </p>
      </div>
    );
  }

  // rfq_single
  return (
    <RfqTicketBody
      side={side}
      setSide={setSide}
      instrumentTitle={instrumentTitle}
      amount={amount}
      setAmount={setAmount}
    />
  );
}

// ---------- Selected Legs strip ----------

interface SelectedLegsStripProps {
  legs: SelectedOptionLeg[];
  onRemove: (index: number) => void;
  onRatioChange: (index: number, ratio: string) => void;
  onClear: () => void;
}

function SelectedLegsStrip({
  legs,
  onRemove,
  onRatioChange,
  onClear,
}: SelectedLegsStripProps) {
  if (legs.length === 0) return null;
  return (
    <div
      data-testid="ticket-legs-list"
      data-leg-count={legs.length}
      className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-2 py-1.5"
    >
      {legs.map((l, index) => {
        const dirLabel = l.side === "buy" ? "Buy" : "Sell";
        const dirColor =
          l.side === "buy" ? "text-emerald-300" : "text-red-300";
        return (
          <div
            key={`${l.seriesId}-${l.sourcePriceSide}-${index}`}
            data-testid={`ticket-leg-${index}`}
            data-leg-side={l.side}
            className="flex items-center gap-1 rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px]"
          >
            <span
              data-testid={`ticket-leg-${index}-direction`}
              className={`font-semibold ${dirColor}`}
            >
              {dirLabel}
            </span>
            <span
              data-testid={`ticket-leg-${index}-instrument`}
              className="text-zinc-200"
              title={`${l.underlying} ${l.strike} ${l.optionType} · exp ${l.expiry}`}
            >
              {l.strike} {l.optionType === "call" ? "C" : "P"}
              {l.expiry ? ` · ${l.expiry}` : ""}
            </span>
            <label className="flex items-center gap-0.5 text-[10px] text-zinc-500">
              <span className="uppercase tracking-[0.16em]">×</span>
              <input
                type="text"
                inputMode="decimal"
                value={l.ratio}
                onChange={(e) => onRatioChange(index, e.target.value)}
                data-testid={`ticket-leg-${index}-ratio`}
                className="w-8 rounded border border-zinc-800 bg-black/40 px-1 text-right font-mono text-[10px] text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => onRemove(index)}
              data-testid={`ticket-leg-${index}-remove`}
              aria-label={`Remove ${dirLabel} ${l.strike} ${l.optionType}`}
              className="rounded border border-transparent px-1 text-zinc-500 hover:border-zinc-700 hover:text-red-300"
            >
              ✕
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onClear}
        data-testid="ticket-legs-clear"
        className="ml-auto text-[10px] uppercase tracking-[0.16em] text-zinc-500 hover:text-red-300"
      >
        Clear all
      </button>
    </div>
  );
}

// ---------- Payoff/Greeks/Trades/Book tabs ----------

interface TradeTabsSectionProps {
  active: TradeTab;
  onChange: (t: TradeTab) => void;
  leg: OptionLeg | null;
  row: OptionsChainRow | null;
}

function TradeTabsSection({ active, onChange, leg, row }: TradeTabsSectionProps) {
  return (
    <section
      data-testid="trade-tabs-section"
      className="flex flex-col border-t border-zinc-800"
    >
      <div
        role="tablist"
        aria-label="Trade details"
        data-testid="trade-tabs-strip"
        className="flex items-center gap-1 px-2 pt-2"
      >
        {TRADE_TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.id)}
              data-testid={`trade-tab-${t.id}`}
              data-selected={isActive ? "true" : "false"}
              className={`rounded-t px-2.5 py-1 text-[11px] font-medium transition-colors ${
                isActive
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
        data-testid={`trade-tab-body-${active}`}
        className="border-t border-zinc-800 p-3"
      >
        <TradeTabBody active={active} leg={leg} row={row} />
      </div>
    </section>
  );
}

function TradeTabBody({
  active,
  leg,
  row,
}: {
  active: TradeTab;
  leg: OptionLeg | null;
  row: OptionsChainRow | null;
}) {
  if (active === "payoff") {
    if (!leg || !row) {
      return <PickInstrumentEmpty tab="Payoff" />;
    }
    return (
      <div
        data-testid="trade-tab-payoff-body"
        className="flex flex-col gap-2"
      >
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em]">
          <span className="text-emerald-300">
            {leg.isCall ? "Long call" : "Long put"} · K = {row.strikeLabel}
          </span>
          <span className="text-zinc-500">exp {row.expiryLabel}</span>
        </div>
        <PayoffSvg isCall={leg.isCall} isBuy strikeLabel={row.strikeLabel} />
      </div>
    );
  }
  if (active === "greeks") {
    if (!leg || !row) return <PickInstrumentEmpty tab="Greeks" />;
    return (
      <div
        data-testid="trade-tab-greeks-body"
        className="rounded border border-zinc-800 bg-black/40 p-3 text-[11px] text-zinc-500"
      >
        Greeks are not available yet for this instrument.
      </div>
    );
  }
  if (active === "trades") {
    return (
      <div data-testid="trade-tab-trades-body" className="min-h-[6rem]">
        <TradeHistoryTable />
      </div>
    );
  }
  // book
  return (
    <div
      data-testid="trade-tab-book-body"
      className="rounded border border-zinc-800 bg-black/40 p-3 text-[11px] text-zinc-500"
    >
      {leg && row
        ? `Orderbook for ${row.strikeLabel} ${leg.isCall ? "Call" : "Put"} — coming soon.`
        : "Pick an instrument to preview its book."}
    </div>
  );
}

function PickInstrumentEmpty({ tab }: { tab: string }) {
  return (
    <div
      data-testid="trade-tab-empty-state"
      className="flex flex-col items-center gap-2 py-6 text-center text-zinc-500"
    >
      <span
        aria-hidden="true"
        className="grid h-8 w-8 place-items-center rounded border border-zinc-800 text-lg text-zinc-600"
      >
        +
      </span>
      <span className="text-[11px]">Select an instrument to view {tab}</span>
    </div>
  );
}

// ---------- Header ----------

interface TradeHeaderProps {
  instrumentTitle: string;
  mode: RequestedExecutionMode;
  onModeChange: (m: RequestedExecutionMode) => void;
}

function TradeHeader({ instrumentTitle, mode, onModeChange }: TradeHeaderProps) {
  return (
    <header
      data-testid="trade-header"
      // The right padding (`pr-8`) reserves room for the widget
      // frame's kebab (⋮) menu that sits at `top-1 right-1.5` on
      // the section — without it the execution-mode select docked
      // under / next to the kebab. `bordered` was replaced by
      // `halo` on the select so the mode dropdown blends into the
      // header instead of competing with the widget frame border.
      className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-zinc-800 pl-2 pr-8"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          data-testid="trade-instrument-title"
          className="truncate text-[13px] font-semibold tracking-tight text-zinc-100"
          title={instrumentTitle}
        >
          {instrumentTitle}
        </span>
      </div>
      <label className="flex items-center gap-1">
        <span className="sr-only">Execution</span>
        <NativeSelect
          data-testid="trade-mode-select"
          aria-label="Execution"
          value={mode}
          onChange={(e) =>
            onModeChange(e.target.value as RequestedExecutionMode)
          }
          variant="halo"
        >
          <option value="auto" className="bg-zinc-950 text-zinc-100">
            Auto
          </option>
          <option value="book" className="bg-zinc-950 text-zinc-100">
            Book
          </option>
          <option value="rfq" className="bg-zinc-950 text-zinc-100">
            RFQ
          </option>
        </NativeSelect>
      </label>
    </header>
  );
}

// ---------- RFQ mode ----------

interface RfqTicketBodyProps {
  side: Side;
  setSide: (s: Side) => void;
  instrumentTitle: string;
  amount: string;
  setAmount: (v: string) => void;
}

function RfqTicketBody(props: RfqTicketBodyProps) {
  const { side, setSide, instrumentTitle, amount, setAmount } = props;
  return (
    <div
      data-testid="trade-body-rfq"
      className="flex flex-col gap-3 p-3 text-[11px]"
    >
      <div className="grid grid-cols-[6rem_minmax(0,1fr)_4rem] gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            Direction
          </span>
          <div className="grid grid-cols-2 overflow-hidden rounded border border-zinc-800">
            <button
              type="button"
              onClick={() => setSide("buy")}
              data-testid="trade-rfq-side-buy"
              data-selected={side === "buy" ? "true" : "false"}
              className={`h-7 text-[11px] font-semibold transition-colors ${
                side === "buy"
                  ? "bg-emerald-600/90 text-black"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setSide("sell")}
              data-testid="trade-rfq-side-sell"
              data-selected={side === "sell" ? "true" : "false"}
              className={`h-7 text-[11px] font-semibold transition-colors ${
                side === "sell"
                  ? "bg-emerald-600/90 text-black"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              Sell
            </button>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            Instrument
          </span>
          <div
            data-testid="trade-rfq-instrument"
            className="flex h-7 items-center truncate rounded border border-zinc-800 bg-black/40 px-2 text-[11px] text-zinc-100"
            title={instrumentTitle}
          >
            {instrumentTitle}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            Ratio
          </span>
          <div className="flex h-7 items-center justify-between rounded border border-zinc-800 bg-black/40 px-2 text-[11px] text-zinc-100">
            <span data-testid="trade-rfq-ratio">1</span>
            <button
              type="button"
              aria-label="Clear ratio"
              data-testid="trade-rfq-ratio-clear"
              className="rounded border border-transparent px-1 text-zinc-500 hover:border-zinc-700 hover:text-zinc-200"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-end gap-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="trade-rfq-amount"
            className="text-[10px] uppercase tracking-[0.16em] text-zinc-500"
          >
            Amount
          </label>
          <input
            id="trade-rfq-amount"
            data-testid="trade-rfq-amount"
            type="text"
            inputMode="decimal"
            value={amount || "1"}
            onChange={(e) => setAmount(e.target.value)}
            className="h-7 rounded border border-zinc-800 bg-black/40 px-2 text-right text-[11px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
        </div>
        <span />
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Filter quotes"
            data-testid="trade-rfq-filter"
            className="grid h-7 w-7 place-items-center rounded border border-zinc-800 bg-black/40 text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-200"
          >
            <span aria-hidden="true" className="text-[12px]">⌕</span>
          </button>
          <button
            type="button"
            aria-label="Expand"
            data-testid="trade-rfq-expand"
            className="grid h-7 w-7 place-items-center rounded border border-zinc-800 bg-black/40 text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-200"
          >
            <span aria-hidden="true" className="text-[12px]">⤢</span>
          </button>
        </div>
      </div>

      <p className="text-[10px] text-zinc-500">
        RFQ submit is not enabled in this environment.
      </p>
    </div>
  );
}
