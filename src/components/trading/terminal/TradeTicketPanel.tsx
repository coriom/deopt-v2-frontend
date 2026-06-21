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
import { DirectOrderbookForm } from "@/components/trading/DirectOrderbookForm";
import { TpSlManager } from "@/components/trading/TpSlManager";

type TicketMode = "orderbook" | "rfq";
type Side = "buy" | "sell";

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
        {mode === "orderbook" ? (
          <div
            data-testid="trade-body-orderbook"
            className="flex flex-col gap-3 p-3"
          >
            <DirectOrderbookForm
              key={leg?.seriesId ?? "__no_selection__"}
              initialSeriesId={leg?.seriesId ?? undefined}
            />
            <TpSlManager address={address} seriesId={leg?.seriesId ?? null} />
          </div>
        ) : (
          <RfqTicketBody
            side={side}
            setSide={setSide}
            instrumentTitle={instrumentTitle}
            amount={amount}
            setAmount={setAmount}
          />
        )}
      </div>
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
          aria-hidden="true"
          data-testid="trade-header-grip"
          className="grid h-5 w-3 shrink-0 grid-cols-2 gap-[2px] text-zinc-600"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="h-[2px] w-[2px] rounded-full bg-current" />
          ))}
        </span>
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
        <select
          data-testid="trade-mode-select"
          value={mode}
          onChange={(e) => onModeChange(e.target.value as TicketMode)}
          className="cursor-pointer rounded border border-zinc-800 bg-black/40 px-2 py-0.5 text-[11px] text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
        >
          <option value="orderbook">Orderbook</option>
          <option value="rfq">RFQ</option>
        </select>
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
        Request a private quote on this instrument. The RFQ executor is not
        live in this testnet beta — submission is disabled. TIF and post-only
        do not apply to paired RFQ execution and are intentionally absent
        here.
      </p>
    </div>
  );
}
