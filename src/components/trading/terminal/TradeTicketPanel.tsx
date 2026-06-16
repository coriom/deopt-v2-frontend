"use client";

// TradeTicketPanel — FRONTEND-TRADE-WIDGET-V1
//
// Compact options order ticket rendered as the `trade` workspace
// widget. Two modes: `book` (default) shows a Buy/Sell-to-Open ticket
// with order fields and a 4-tab body (Payoff / Greeks / Trades /
// Book). `rfq` shows a compact request-for-quote row.
//
// Honest data posture: this is a visual/polish milestone. Numbers in
// the cost breakdown and the Trades / Book bodies are local mock
// values intentionally surfaced as illustrative — the actual signing +
// executor flow lives in `/markets/[productId]` (TradeTicket). No fake
// live-market claims, no positive-claim language. No amber / yellow /
// orange brand classes.

import { useMemo, useState } from "react";
import type { OptionLeg, OptionsChainRow } from "@/lib/options-chain-model";
import { useSelectedOption } from "@/lib/workspace-selected-option";
import { PayoffSvg } from "./PayoffSvg";

type TicketMode = "book" | "rfq";
type Side = "buy" | "sell";
type Tab = "payoff" | "greeks" | "trades" | "book";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "payoff", label: "Payoff" },
  { id: "greeks", label: "Greeks" },
  { id: "trades", label: "Trades" },
  { id: "book", label: "Book" },
];

const SAMPLE_BOOK_ASKS = [
  { price: "$2,000", size: "0.01000", total: "12.73244", depthPct: 0.95 },
  { price: "$956",   size: "1.20244", total: "12.72244", depthPct: 0.95 },
  { price: "$814",   size: "5.00000", total: "11.52000", depthPct: 0.86 },
  { price: "$700",   size: "5.52000", total: "6.52000",  depthPct: 0.48 },
  { price: "$680",   size: "1.00000", total: "1.00000",  depthPct: 0.07 },
];
const SAMPLE_BOOK_BIDS = [
  { price: "$622", size: "5.52000", total: "5.52000",  depthPct: 0.41 },
  { price: "$610", size: "0.12000", total: "5.64000",  depthPct: 0.42 },
  { price: "$604", size: "6.86748", total: "12.50748", depthPct: 0.93 },
  { price: "$555", size: "1.00000", total: "13.50748", depthPct: 1.00 },
];

const SAMPLE_TRADES = [
  { time: "Jun 16 18:50", inst: "BTC Strangle Jun 17 $65500/66000", amount: "+0.005",   price: "$429.00",    positive: true,  amountAccent: true },
  { time: "Jun 16 18:21", inst: "BTC $50000 Put Aug 28",            amount: "+1.6",     price: "$602.00",    positive: true,  amountAccent: true },
  { time: "Jun 16 18:15", inst: "BTC $60000 Put Jul 31",            amount: "-1.7998",  price: "$1,249.00",  positive: true,  amountAccent: false },
  { time: "Jun 16 17:23", inst: "BTC $65000 Put Jul 31",            amount: "-0.1",     price: "-$2,855.03", positive: false, amountAccent: false },
  { time: "Jun 16 17:13", inst: "BTC $72000 Call Jun 19",           amount: "+0.5",     price: "$6.00",      positive: true,  amountAccent: true },
  { time: "Jun 16 17:12", inst: "BTC $60000 Put Jun 19",            amount: "+1",       price: "$40.00",     positive: true,  amountAccent: true },
];

const SAMPLE_GREEKS: Array<{ id: string; label: string; value: string }> = [
  { id: "delta", label: "Delta", value: "0.43123" },
  { id: "gamma", label: "Gamma", value: "0.00021" },
  { id: "vega",  label: "Vega",  value: "21.89914" },
  { id: "theta", label: "Theta", value: "-137.86267" },
  { id: "rho",   label: "Rho",   value: "4.16046" },
];

function fallbackInstrumentTitle(): string {
  return "BTC $66000 Call Jun 19";
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

  const instrumentTitle = useMemo(
    () => deriveInstrumentTitle(leg, row),
    [leg, row],
  );

  const [mode, setMode] = useState<TicketMode>("book");
  const [side, setSide] = useState<Side>("buy");
  const [orderType, setOrderType] = useState<"limit" | "market">("limit");
  const [limitPrice, setLimitPrice] = useState("723");
  const [amount, setAmount] = useState("");
  const [post, setPost] = useState(false);
  const [tif, setTif] = useState<"GTC" | "IOC" | "FOK">("GTC");
  const [tab, setTab] = useState<Tab>("payoff");

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
        {mode === "book" ? (
          <BookTicketBody
            side={side}
            setSide={setSide}
            orderType={orderType}
            setOrderType={setOrderType}
            limitPrice={limitPrice}
            setLimitPrice={setLimitPrice}
            amount={amount}
            setAmount={setAmount}
            post={post}
            setPost={setPost}
            tif={tif}
            setTif={setTif}
            tab={tab}
            setTab={setTab}
            leg={leg}
            row={row}
          />
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
          <option value="book">Book</option>
          <option value="rfq">RFQ</option>
        </select>
      </label>
    </header>
  );
}

// ---------- Book mode ----------

interface BookTicketBodyProps {
  side: Side;
  setSide: (s: Side) => void;
  orderType: "limit" | "market";
  setOrderType: (t: "limit" | "market") => void;
  limitPrice: string;
  setLimitPrice: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  post: boolean;
  setPost: (v: boolean) => void;
  tif: "GTC" | "IOC" | "FOK";
  setTif: (v: "GTC" | "IOC" | "FOK") => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  leg: OptionLeg | null;
  row: OptionsChainRow | null;
}

function BookTicketBody(props: BookTicketBodyProps) {
  const {
    side,
    setSide,
    orderType,
    setOrderType,
    limitPrice,
    setLimitPrice,
    amount,
    setAmount,
    post,
    setPost,
    tif,
    setTif,
    tab,
    setTab,
    leg,
    row,
  } = props;

  return (
    <div data-testid="trade-body-book" className="flex flex-col">
      <div className="grid grid-cols-2" role="group" aria-label="Order side">
        <button
          type="button"
          onClick={() => setSide("buy")}
          data-testid="trade-side-buy"
          data-selected={side === "buy" ? "true" : "false"}
          className={`h-8 text-[12px] font-semibold transition-colors ${
            side === "buy"
              ? "bg-emerald-600/90 text-black"
              : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
          }`}
        >
          Buy to Open
        </button>
        <button
          type="button"
          onClick={() => setSide("sell")}
          data-testid="trade-side-sell"
          data-selected={side === "sell" ? "true" : "false"}
          className={`h-8 text-[12px] font-semibold transition-colors ${
            side === "sell"
              ? "bg-emerald-600/90 text-black"
              : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
          }`}
        >
          Sell to Open
        </button>
      </div>

      <div className="flex flex-col gap-2 border-b border-zinc-800 px-3 py-3">
        <FieldRow label="Order Type" htmlFor="trade-order-type">
          <select
            id="trade-order-type"
            data-testid="trade-order-type"
            value={orderType}
            onChange={(e) =>
              setOrderType(e.target.value as "limit" | "market")
            }
            className="w-full cursor-pointer rounded border border-zinc-800 bg-black/40 px-2 py-1 text-right text-[11px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          >
            <option value="limit">Limit</option>
            <option value="market">Market</option>
          </select>
        </FieldRow>

        <FieldRow
          label="Limit Price"
          htmlFor="trade-limit-price"
          hint={
            <span data-testid="trade-ask-hint" className="text-[10px] text-zinc-500">
              Ask: $705
            </span>
          }
        >
          <div className="flex w-full items-center rounded border border-zinc-800 bg-black/40 text-[12px] focus-within:border-emerald-500/60">
            <span className="pl-2 pr-1 text-zinc-500">$</span>
            <input
              id="trade-limit-price"
              data-testid="trade-limit-price"
              type="text"
              inputMode="decimal"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className="w-full bg-transparent py-1 pr-2 text-right text-zinc-100 outline-none"
            />
          </div>
        </FieldRow>

        <FieldRow label="Amount" htmlFor="trade-amount">
          <input
            id="trade-amount"
            data-testid="trade-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 text-right text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/60 focus:outline-none"
          />
        </FieldRow>

        <div className="flex items-center justify-between gap-3 pt-1">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-300">
            <input
              type="checkbox"
              data-testid="trade-post-checkbox"
              checked={post}
              onChange={(e) => setPost(e.target.checked)}
              className="h-3 w-3 cursor-pointer accent-emerald-500"
            />
            Post
          </label>
          <label className="flex items-center gap-1 text-[11px] text-zinc-400">
            <span className="sr-only">Time in force</span>
            <select
              data-testid="trade-tif-select"
              value={tif}
              onChange={(e) => setTif(e.target.value as "GTC" | "IOC" | "FOK")}
              className="cursor-pointer rounded border border-zinc-800 bg-black/40 px-2 py-0.5 text-[11px] text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
            >
              <option value="GTC">GTC</option>
              <option value="IOC">IOC</option>
              <option value="FOK">FOK</option>
            </select>
          </label>
        </div>
      </div>

      <div
        data-testid="trade-channel-notice"
        className="mx-3 mt-3 flex items-start gap-2 rounded border border-zinc-800 bg-zinc-950/80 px-2 py-2 text-[11px] text-zinc-300"
      >
        <span
          aria-hidden="true"
          className="mt-[2px] grid h-3 w-3 shrink-0 place-items-center rounded-full border border-emerald-500/50 text-emerald-300"
        >
          <span className="text-[8px] leading-none">i</span>
        </span>
        <div className="flex flex-col gap-0.5">
          <span>Open a decentralized channel for gas-free and instantaneous trading.</span>
          <span className="text-zinc-500">This signature is gas-free to send.</span>
        </div>
      </div>

      <button
        type="button"
        data-testid="trade-enable-button"
        className="mx-3 mt-3 flex h-9 items-center justify-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/80 text-[12px] font-semibold text-zinc-200 transition-colors hover:bg-zinc-700"
      >
        <span
          aria-hidden="true"
          className="grid h-3.5 w-3.5 place-items-center rounded-full border border-zinc-500 text-[8px] text-zinc-400"
        >
          !
        </span>
        Enable Trading
      </button>

      <dl
        data-testid="trade-cost-breakdown"
        className="mx-3 mt-3 grid grid-cols-[1fr_auto] gap-y-1 border-t border-zinc-800 pt-3 text-[11px]"
      >
        <dt className="text-zinc-200">Max Cost</dt>
        <dd
          data-testid="trade-cost-max"
          className="text-right font-mono text-zinc-100"
        >
          $0.00
        </dd>
        <dt className="text-zinc-500">Margin Required</dt>
        <dd className="text-right font-mono text-zinc-400">$0.00</dd>
        <dt className="text-zinc-500">Buying Power</dt>
        <dd className="text-right font-mono text-zinc-400">$0.00</dd>
        <dt className="text-zinc-500">Est. Fee</dt>
        <dd className="text-right font-mono text-zinc-400">$0.00</dd>
        <dt
          data-testid="trade-cost-rewards-label"
          className="text-zinc-500 underline decoration-emerald-500/30 decoration-dotted underline-offset-2"
          title="Reward token estimates surface once the rebate policy is finalised."
        >
          Est. Rewards
        </dt>
        <dd className="text-right font-mono text-zinc-400">0 DRV</dd>
      </dl>

      <nav
        role="tablist"
        aria-label="Trade tabs"
        data-testid="trade-tabs"
        className="mt-3 flex shrink-0 items-center border-b border-zinc-800 px-3"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            data-testid={`trade-tab-${t.id}`}
            data-selected={tab === t.id ? "true" : "false"}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b px-3 py-2 text-[11px] font-medium transition-colors ${
              tab === t.id
                ? "border-zinc-100 text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div
        role="tabpanel"
        aria-label={tab}
        data-testid={`trade-panel-content-${tab}`}
        className="flex min-h-0 flex-col gap-3 p-3"
      >
        {tab === "payoff" && <PayoffTabBody side={side} leg={leg} row={row} />}
        {tab === "greeks" && <GreeksTabBody />}
        {tab === "trades" && <TradesTabBody />}
        {tab === "book" && <BookTabBody />}
      </div>
    </div>
  );
}

// ---------- Field row helper ----------

function FieldRow({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2">
      <label htmlFor={htmlFor} className="flex flex-col text-[11px] text-zinc-300">
        <span>{label}</span>
        {hint}
      </label>
      <div>{children}</div>
    </div>
  );
}

// ---------- Tab bodies ----------

function PayoffTabBody({
  side,
  leg,
  row,
}: {
  side: Side;
  leg: OptionLeg | null;
  row: OptionsChainRow | null;
}) {
  const isCall = leg ? leg.isCall : true;
  const strikeLabel = row ? row.strikeLabel : "$66,000";
  return (
    <div data-testid="trade-payoff-body" className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div data-testid="trade-payoff-max-loss" className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Max Loss
          </span>
          <span className="font-mono text-[12px] text-zinc-100">$596</span>
        </div>
        <div data-testid="trade-payoff-breakeven" className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Break Even
          </span>
          <span className="font-mono text-[12px] text-zinc-100">$66,596</span>
        </div>
        <div data-testid="trade-payoff-max-profit" className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Max Profit
          </span>
          <span className="font-mono text-[12px] text-emerald-300">Infinity</span>
        </div>
      </div>
      <div className="rounded border border-zinc-900 bg-black/60 p-2">
        <PayoffSvg
          isCall={isCall}
          isBuy={side === "buy"}
          strikeLabel={strikeLabel}
        />
      </div>
      <p className="text-[10px] text-zinc-500">
        Schematic only. The break-even and ladder values above are local mock
        figures used to compose the ticket layout.
      </p>
    </div>
  );
}

function GreeksTabBody() {
  return (
    <div data-testid="trade-greeks-body" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
        {SAMPLE_GREEKS.map((g) => (
          <div
            key={g.id}
            data-testid={`trade-greek-${g.id}`}
            className="flex items-center justify-between border-b border-zinc-900 py-1"
          >
            <span className="text-zinc-500">{g.label}</span>
            <span className="font-mono text-zinc-100">{g.value}</span>
          </div>
        ))}
      </div>
      <p data-testid="trade-greeks-mock-disclaimer" className="text-[10px] text-zinc-500">
        Local mock values for layout. The pricing service has not shipped yet;
        the live chain renders &ldquo;—&rdquo; for greeks.
      </p>
    </div>
  );
}

function TradesTabBody() {
  return (
    <div data-testid="trade-trades-body" className="flex flex-col gap-2">
      <div className="grid grid-cols-[6rem_minmax(0,1fr)_5rem_5rem] gap-2 border-b border-zinc-800 pb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
        <span>Time</span>
        <span>Instrument</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Price</span>
      </div>
      <div className="flex flex-col">
        {SAMPLE_TRADES.map((t, i) => (
          <div
            key={i}
            data-testid={`trade-trades-row-${i}`}
            className="grid grid-cols-[6rem_minmax(0,1fr)_5rem_5rem] gap-2 border-b border-zinc-900/70 py-1 font-mono text-[11px] last:border-b-0"
          >
            <span className="text-zinc-400">{t.time}</span>
            <span className="truncate text-zinc-300" title={t.inst}>
              {t.inst}
            </span>
            <span
              className={`text-right ${
                t.amountAccent ? "text-emerald-300" : "text-red-400"
              }`}
            >
              {t.amount}
            </span>
            <span
              className={`text-right ${
                t.positive ? "text-zinc-100" : "text-red-400"
              }`}
            >
              {t.price}
            </span>
          </div>
        ))}
      </div>
      <p data-testid="trade-trades-mock-disclaimer" className="text-[10px] text-zinc-500">
        Local mock prints used to compose the trades feed. No live tape.
      </p>
    </div>
  );
}

function BookTabBody() {
  return (
    <div data-testid="trade-book-body" className="flex flex-col gap-1">
      <div className="grid grid-cols-3 gap-2 border-b border-zinc-800 pb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>
      <div className="flex flex-col gap-[2px]">
        {SAMPLE_BOOK_ASKS.map((r, i) => (
          <BookRow key={`ask-${i}`} row={r} kind="ask" testid={`trade-book-ask-${i}`} />
        ))}
      </div>
      <div
        data-testid="trade-book-spread"
        className="my-1 flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 font-mono text-[11px] text-zinc-200"
      >
        <span className="text-zinc-400">Spread</span>
        <span className="text-zinc-100">$58</span>
        <span className="text-zinc-400">8.91%</span>
      </div>
      <div className="flex flex-col gap-[2px]">
        {SAMPLE_BOOK_BIDS.map((r, i) => (
          <BookRow key={`bid-${i}`} row={r} kind="bid" testid={`trade-book-bid-${i}`} />
        ))}
      </div>
      <p data-testid="trade-book-mock-disclaimer" className="pt-1 text-[10px] text-zinc-500">
        Local mock book — there is no resting limit-order book in this testnet
        beta yet.
      </p>
    </div>
  );
}

function BookRow({
  row,
  kind,
  testid,
}: {
  row: { price: string; size: string; total: string; depthPct: number };
  kind: "ask" | "bid";
  testid: string;
}) {
  const accent = kind === "ask" ? "text-red-300" : "text-emerald-300";
  const depthColor = kind === "ask" ? "rgba(127, 29, 29, 0.35)" : "rgba(6, 78, 59, 0.35)";
  return (
    <div
      data-testid={testid}
      data-book-kind={kind}
      className="relative grid grid-cols-3 gap-2 px-1 py-[2px] font-mono text-[11px]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 -z-0 rounded-[2px]"
        style={{
          width: `${Math.max(4, Math.min(100, row.depthPct * 100))}%`,
          backgroundColor: depthColor,
        }}
      />
      <span className={`relative z-10 ${accent}`}>{row.price}</span>
      <span className="relative z-10 text-right text-zinc-300">{row.size}</span>
      <span className="relative z-10 text-right text-zinc-400">{row.total}</span>
    </div>
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
        live in this testnet beta — submission is disabled.
      </p>
    </div>
  );
}
