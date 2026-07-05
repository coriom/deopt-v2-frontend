"use client";

// TradeTicketPanel — FRONTEND-OPTIONS-DIRECT-ORDERBOOK-V1
//
// Workspace `trade` widget for the options terminal. Two clean modes:
//
//   * `orderbook` (default) — submits a real direct order to
//     `POST /options/orders` via the shared `DirectOrderbookForm`
//     component. Honours GTC / IOC / FOK + post-only end-to-end with
//     the deterministic matching engine (see
//     `MATCHING-TIF-SEMANTICS-OPTIONS-V1`).
//
//   * `rfq` — keeps the existing illustrative RFQ-style row. The
//     RFQ executor is not live in this testnet beta; the body
//     surfaces this explicitly via static copy. NO TIF / post-only
//     fields are exposed in this mode — they do not apply.
//
// The instrument title at the top reflects the user's current chain
// selection (via `useSelectedOption`) so the operator can paste-and-go
// into the orderbook form, but the form also accepts a manual series
// id for arbitrary submissions.

import { useMemo, useState } from "react";
import type { OptionLeg, OptionsChainRow } from "@/lib/options-chain-model";
import { useSelectedOption } from "@/lib/workspace-selected-option";
import { useWallet } from "@/lib/wallet";
import { AccountLifecyclePanel } from "@/components/trading/AccountLifecyclePanel";
import { DirectOrderbookForm } from "@/components/trading/DirectOrderbookForm";
import { OptionsTwapForm } from "@/components/trading/OptionsTwapForm";
import { TradeHistoryTable } from "@/components/trading/TradeHistoryTable";
import { PayoffSvg } from "@/components/trading/terminal/PayoffSvg";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { isOptionsTwapEnabled } from "@/lib/options-twap-flag";

type TicketMode = "orderbook" | "twap" | "rfq";
type Side = "buy" | "sell";
type TradeTab = "payoff" | "greeks" | "trades" | "book";

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

export function TradeTicketPanel() {
  const { selected } = useSelectedOption();
  const leg = selected?.leg ?? null;
  const row = selected?.row ?? null;
  const { address } = useWallet();

  const instrumentTitle = useMemo(
    () => deriveInstrumentTitle(leg, row),
    [leg, row],
  );

  const [mode, setMode] = useState<TicketMode>("orderbook");
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState<TradeTab>("payoff");

  return (
    <div
      data-testid="trade-panel"
      data-trade-mode={mode}
      data-trade-side={side}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-zinc-800 bg-black/60 text-zinc-200"
    >
      <TradeHeader
        instrumentTitle={instrumentTitle}
        mode={mode}
        onModeChange={setMode}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {mode === "orderbook" && (
          <div
            data-testid="trade-body-orderbook"
            className="flex flex-col gap-3 p-3"
          >
            <DirectOrderbookForm
              key={leg?.seriesId ?? "__no_selection__"}
              initialSeriesId={leg?.seriesId ?? undefined}
              onSwitchToTwap={
                isOptionsTwapEnabled() ? () => setMode("twap") : undefined
              }
            />
            <AccountLifecyclePanel address={address} />
          </div>
        )}
        {mode === "twap" && (
          <div data-testid="trade-body-twap" className="flex flex-col gap-3 p-3">
            <OptionsTwapForm optionSeriesId={leg?.seriesId ?? ""} />
            <AccountLifecyclePanel address={address} />
          </div>
        )}
        {mode === "rfq" && (
          <RfqTicketBody
            side={side}
            setSide={setSide}
            instrumentTitle={instrumentTitle}
            amount={amount}
            setAmount={setAmount}
          />
        )}

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
  mode: TicketMode;
  onModeChange: (m: TicketMode) => void;
}

function TradeHeader({ instrumentTitle, mode, onModeChange }: TradeHeaderProps) {
  return (
    <header
      data-testid="trade-header"
      className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-2"
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
        <span className="sr-only">Ticket mode</span>
        <NativeSelect
          data-testid="trade-mode-select"
          aria-label="Ticket mode"
          value={mode}
          onChange={(e) => onModeChange(e.target.value as TicketMode)}
          variant="bordered"
        >
          <option value="orderbook" className="bg-zinc-950 text-zinc-100">
            Orderbook
          </option>
          {isOptionsTwapEnabled() && (
            <option
              value="twap"
              className="bg-zinc-950 text-zinc-100"
              data-testid="trade-mode-option-twap"
            >
              TWAP
            </option>
          )}
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
