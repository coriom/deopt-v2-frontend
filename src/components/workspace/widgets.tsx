"use client";

// Workspace V1 widget implementations.
//
// Each widget is a tight wrapper over existing trading components or a
// honest placeholder. NO fake liquidity. NO fake Greeks. NO fake perps
// fills. No external chart / icon / animation lib.

import { BalancesCard } from "@/components/trading/BalancesCard";
import { PositionsTable } from "@/components/trading/PositionsTable";
import { TradeHistoryTable } from "@/components/trading/TradeHistoryTable";
import { BottomPanel } from "@/components/trading/terminal/BottomPanel";
import { OptionsChainTerminalCore } from "@/components/trading/terminal/OptionsChainTerminalCore";
import { PayoffSvg } from "@/components/trading/terminal/PayoffSvg";
import { TradeTicketPanel } from "@/components/trading/terminal/TradeTicketPanel";
import { useSelectedOption } from "@/lib/workspace-selected-option";
import Link from "next/link";

function PlaceholderBody({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-emerald-500/30 bg-black/40 p-3 text-[11px] text-emerald-200">
      <div className="font-semibold uppercase tracking-[0.18em] text-emerald-300">
        {title}
      </div>
      <p className="mt-2 text-zinc-400">{body}</p>
    </div>
  );
}

export function OptionsChainWidget() {
  return <OptionsChainTerminalCore />;
}

export function BottomDockWidget() {
  return <BottomPanel />;
}

export function TradeWidget() {
  return <TradeTicketPanel />;
}

export function PayoffWidget() {
  const { selected } = useSelectedOption();
  if (!selected) {
    return (
      <PlaceholderBody
        title="Payoff — pick an option"
        body="Click a call or put in the chain to render a payoff schematic here."
      />
    );
  }
  return (
    <div
      data-testid="widget-payoff-body"
      className="flex flex-col gap-2 rounded border border-zinc-800 bg-zinc-950 p-3"
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">
        Payoff · schematic
      </div>
      <PayoffSvg isCall={selected.leg.isCall} isBuy strikeLabel={selected.row.strikeLabel} />
      <p className="text-[10px] text-zinc-500">
        Schematic only. No real premium, no live IV. See the detail panel&apos;s
        Greeks tab for honest &ldquo;coming soon&rdquo; status.
      </p>
    </div>
  );
}

export function BalancesWidget() {
  return <BalancesCard />;
}

export function PositionsWidget() {
  return <PositionsTable />;
}

export function TradesWidget() {
  return <TradeHistoryTable />;
}

export function OrdersWidget() {
  return (
    <PlaceholderBody
      title="Orders — not live in this testnet beta"
      body="The options trade flow is intent → sign → executor-broadcast; there is no resting limit-order book yet. Inspect a specific trade lifecycle via /transactions/<intent_id>."
    />
  );
}

export function GreeksWidget() {
  return (
    <PlaceholderBody
      title="Greeks — coming later in the testnet beta"
      body="Delta / Gamma / Vega / Theta are not exposed by the current backend. The chain and detail panel already render honest dashes for greeks; this widget will surface portfolio-level greeks once the pricing service ships."
    />
  );
}

export function EventsWidget() {
  return (
    <PlaceholderBody
      title="Events stream — coming soon"
      body="The backend indexer reconciles on-chain events into a public status view; the per-wallet event feed (deposits, trades, settlements, exercise) lands in a follow-up milestone. Use /transactions/<intent_id> to inspect a specific trade lifecycle."
    />
  );
}

export function PerpsStatsWidget() {
  const cells = [
    { id: "underlying", label: "Underlying" },
    { id: "mark", label: "Mark" },
    { id: "change-24h", label: "24h Δ" },
    { id: "volume-24h", label: "24h Vol" },
    { id: "funding", label: "Funding" },
    { id: "open-interest", label: "OI" },
  ];
  return (
    <div
      data-testid="widget-perps-stats-body"
      className="grid grid-cols-2 overflow-hidden rounded border border-zinc-800 bg-zinc-950 sm:grid-cols-3 lg:grid-cols-6"
    >
      {cells.map((c) => (
        <div
          key={c.id}
          data-testid={`widget-perps-stat-${c.id}`}
          className="flex flex-col gap-0.5 border-r border-zinc-900 px-3 py-1.5 last:border-r-0"
        >
          <span className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">
            {c.label}
          </span>
          <span className="font-mono text-[13px] text-zinc-400">—</span>
          <span className="text-[9px] text-zinc-600">not live</span>
        </div>
      ))}
    </div>
  );
}

export function PerpsChartWidget() {
  return (
    <div
      data-testid="widget-perps-chart-body"
      className="flex h-56 flex-col gap-2 rounded border border-zinc-800 bg-zinc-950 p-3"
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        <span>Chart</span>
        <span className="text-emerald-300">schematic only</span>
      </div>
      <svg
        data-testid="widget-perps-chart-svg"
        viewBox="0 0 600 200"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="h-full w-full"
      >
        <defs>
          <pattern
            id="perps-widget-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgb(24 24 27)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="600" height="200" fill="url(#perps-widget-grid)" />
        <path
          d="M0,140 C60,135 100,150 140,120 S220,80 260,110 S360,160 420,90 S520,40 600,70"
          fill="none"
          stroke="rgb(52 211 153)"
          strokeOpacity="0.45"
          strokeWidth="1.5"
        />
      </svg>
      <p className="text-[10px] text-zinc-500">
        Perps are not live in this testnet beta yet. No real price feed.
      </p>
    </div>
  );
}

export function PerpsOrderbookWidget() {
  return (
    <div
      data-testid="widget-perps-orderbook-body"
      className="flex flex-col gap-1 rounded border border-zinc-800 bg-zinc-950 p-2"
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        <span>Order book</span>
        <span className="text-emerald-300">not live</span>
      </div>
      <div className="grid grid-cols-3 text-[10px] text-zinc-500">
        <span className="text-right">Bid</span>
        <span className="text-center">Size</span>
        <span className="text-right">Ask</span>
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="grid grid-cols-3 border-b border-zinc-900 py-1 font-mono text-[11px] text-zinc-700 last:border-b-0"
        >
          <span className="text-right">—</span>
          <span className="text-center">—</span>
          <span className="text-right">—</span>
        </div>
      ))}
    </div>
  );
}

export function PerpsTradeFormWidget() {
  return (
    <div
      data-testid="widget-perps-trade-form-body"
      className="flex flex-col gap-2 rounded border border-zinc-800 bg-zinc-950 p-3"
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        <span>Trade ticket</span>
        <span className="text-emerald-300">not live</span>
      </div>
      <div className="flex gap-1" role="group" aria-label="Side">
        <button
          type="button"
          disabled
          className="flex-1 cursor-not-allowed rounded border border-emerald-500/30 bg-black/40 py-1.5 text-[11px] text-emerald-200/60"
        >
          Long
        </button>
        <button
          type="button"
          disabled
          className="flex-1 cursor-not-allowed rounded border border-zinc-800 bg-black/40 py-1.5 text-[11px] text-zinc-500"
        >
          Short
        </button>
      </div>
      <input
        type="text"
        disabled
        placeholder="Size"
        className="cursor-not-allowed rounded border border-zinc-800 bg-black/40 px-2 py-1.5 text-[11px] text-zinc-500"
      />
      <input
        type="text"
        disabled
        placeholder="Leverage"
        className="cursor-not-allowed rounded border border-zinc-800 bg-black/40 px-2 py-1.5 text-[11px] text-zinc-500"
      />
      <button
        type="button"
        disabled
        className="cursor-not-allowed rounded border border-zinc-800 bg-black/40 py-1.5 text-[11px] text-zinc-500"
      >
        Perps trading not live
      </button>
    </div>
  );
}

export function PerpsTradeFeedWidget() {
  return (
    <PlaceholderBody
      title="Perps trade feed — not live"
      body="The public trade feed for perps will land alongside the perps backend. No fake prints in this beta."
    />
  );
}

export function DocsHelpWidget() {
  return (
    <div
      data-testid="widget-docs-help-body"
      className="flex flex-col gap-2 rounded border border-emerald-500/30 bg-zinc-950 p-3 text-[11px] text-zinc-300"
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">
        Docs · help
      </div>
      <ul className="ml-4 list-disc space-y-0.5 text-zinc-400">
        <li>
          <Link href="/docs/quickstart" className="text-emerald-300 hover:underline">
            Quickstart
          </Link>{" "}
          — Base Sepolia setup.
        </li>
        <li>
          <Link href="/docs/testing-guide" className="text-emerald-300 hover:underline">
            Testing guide
          </Link>{" "}
          — end-to-end trade walkthrough.
        </li>
        <li>
          <Link href="/docs/limitations" className="text-emerald-300 hover:underline">
            Known limitations
          </Link>{" "}
          — what is NOT covered by this beta.
        </li>
        <li>
          <Link href="/docs/faq" className="text-emerald-300 hover:underline">
            FAQ
          </Link>
        </li>
      </ul>
    </div>
  );
}

export function FeedbackWidget() {
  return (
    <div
      data-testid="widget-feedback-body"
      className="flex flex-col gap-2 rounded border border-emerald-500/30 bg-zinc-950 p-3 text-[11px] text-zinc-300"
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">
        Feedback
      </div>
      <p className="text-zinc-400">
        Found a bug or have feedback? Use the public-safe report template at{" "}
        <Link href="/feedback" className="text-emerald-300 hover:underline">
          /feedback
        </Link>
        . Never share private keys, seed phrases, or RPC URLs.
      </p>
      <a
        data-testid="widget-feedback-discord"
        href="https://discord.gg/zaEMvWuxu"
        target="_blank"
        rel="noopener noreferrer"
        className="self-start rounded border border-emerald-500/40 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/10"
      >
        Open Discord
      </a>
    </div>
  );
}
