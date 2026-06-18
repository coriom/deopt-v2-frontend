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
// FRONTEND-PERPS-POLISH-V1 — perps widgets live in their own files now.
import { PerpsStatsWidget as PerpsStatsBody } from "@/components/trading/perps/PerpsStats";
import { PerpsChartWidget as PerpsChartBody } from "@/components/trading/perps/PerpsChart";
import { PerpsOrderbookWidget as PerpsOrderbookBody } from "@/components/trading/perps/PerpsOrderbook";
import { PerpsTradeFormWidget as PerpsTradeFormBody } from "@/components/trading/perps/PerpsTradeForm";
import { PerpsTradeFeedWidget as PerpsTradeFeedBody } from "@/components/trading/perps/PerpsTradeFeed";
import { PerpsBookFeedWidget as PerpsBookFeedBody } from "@/components/trading/perps/PerpsBookFeed";

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

// Perps widget bodies moved to `src/components/trading/perps/*` —
// this file only re-exports them for the workspace registry.
export function PerpsStatsWidget() {
  return <PerpsStatsBody />;
}
export function PerpsChartWidget() {
  return <PerpsChartBody />;
}
export function PerpsOrderbookWidget() {
  return <PerpsOrderbookBody />;
}
export function PerpsTradeFormWidget() {
  return <PerpsTradeFormBody />;
}
export function PerpsTradeFeedWidget() {
  return <PerpsTradeFeedBody />;
}
export function PerpsBookFeedWidget() {
  return <PerpsBookFeedBody />;
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
