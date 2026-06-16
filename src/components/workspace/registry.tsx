// Widget registry — maps WidgetType → metadata + render component.
//
// V6 expresses defaults in percentages of the canvas (xPct/yPct/wPct/
// hPct, all in [0, 1]). Defaults always fill the canvas edge-to-edge
// regardless of monitor size — there is no column count and no right
// gutter.

import type { ComponentType } from "react";
import type { WidgetType, WorkspaceId } from "@/lib/workspace-types";
import {
  BalancesWidget,
  BottomDockWidget,
  DocsHelpWidget,
  EventsWidget,
  FeedbackWidget,
  GreeksWidget,
  OptionsChainWidget,
  OrdersWidget,
  PayoffWidget,
  PerpsChartWidget,
  PerpsOrderbookWidget,
  PerpsStatsWidget,
  PerpsTradeFeedWidget,
  PerpsTradeFormWidget,
  PositionsWidget,
  TradeWidget,
  TradesWidget,
} from "./widgets";

export interface WidgetDef {
  type: WidgetType;
  title: string;
  /** Long-form description; surfaced in docs/tests, NOT in the menu. */
  description: string;
  workspaces: WorkspaceId[];
  /** Default percentage size when a user adds the widget via the menu. */
  defaultWPct: number;
  defaultHPct: number;
  /** Minimum pixel size enforced during resize. */
  minWPx: number;
  minHPx: number;
  implemented: boolean;
  Render: ComponentType;
}

const ALL_WS: WorkspaceId[] = ["options", "perps", "custom-1", "custom-2", "custom-3"];
const OPTIONS_WS: WorkspaceId[] = ["options", "custom-1", "custom-2", "custom-3"];
const PERPS_WS: WorkspaceId[] = ["perps", "custom-1", "custom-2", "custom-3"];

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDef> = {
  "options-chain": {
    type: "options-chain", title: "Options chain",
    description: "Calls | Strike | Puts ladder with underlying + expiry pills.",
    workspaces: OPTIONS_WS,
    defaultWPct: 0.7, defaultHPct: 0.7, minWPx: 360, minHPx: 240,
    implemented: true, Render: OptionsChainWidget,
  },
  trade: {
    type: "trade", title: "Trade",
    description: "Options order ticket — Buy/Sell, Limit, Post, GTC, Payoff/Greeks/Trades/Book tabs.",
    workspaces: OPTIONS_WS,
    defaultWPct: 0.3, defaultHPct: 0.7, minWPx: 300, minHPx: 360,
    implemented: true, Render: TradeWidget,
  },
  "bottom-dock": {
    type: "bottom-dock", title: "Account dock",
    description: "Balances / Positions / Orders / Trades / Greeks / Events.",
    workspaces: ALL_WS,
    defaultWPct: 1.0, defaultHPct: 0.3, minWPx: 360, minHPx: 140,
    implemented: true, Render: BottomDockWidget,
  },
  payoff: {
    type: "payoff", title: "Payoff",
    description: "Schematic payoff for the selected option (also a tab inside Trade).",
    workspaces: OPTIONS_WS,
    defaultWPct: 0.3, defaultHPct: 0.3, minWPx: 240, minHPx: 160,
    implemented: true, Render: PayoffWidget,
  },
  balances: {
    type: "balances", title: "Balances",
    description: "Per-token testnet balances for the connected wallet.",
    workspaces: ALL_WS,
    defaultWPct: 0.3, defaultHPct: 0.3, minWPx: 240, minHPx: 160,
    implemented: true, Render: BalancesWidget,
  },
  positions: {
    type: "positions", title: "Positions",
    description: "Open option positions for the connected wallet.",
    workspaces: ALL_WS,
    defaultWPct: 0.4, defaultHPct: 0.3, minWPx: 280, minHPx: 160,
    implemented: true, Render: PositionsWidget,
  },
  orders: {
    type: "orders", title: "Orders",
    description: "Resting limit-order book — not live in this testnet beta.",
    workspaces: ALL_WS,
    defaultWPct: 0.3, defaultHPct: 0.25, minWPx: 240, minHPx: 120,
    implemented: false, Render: OrdersWidget,
  },
  trades: {
    type: "trades", title: "Trades",
    description: "Trade history for the connected wallet.",
    workspaces: ALL_WS,
    defaultWPct: 0.4, defaultHPct: 0.3, minWPx: 280, minHPx: 160,
    implemented: true, Render: TradesWidget,
  },
  greeks: {
    type: "greeks", title: "Greeks",
    description: "Portfolio greeks — coming later (also a tab inside Trade).",
    workspaces: ALL_WS,
    defaultWPct: 0.3, defaultHPct: 0.25, minWPx: 240, minHPx: 120,
    implemented: false, Render: GreeksWidget,
  },
  events: {
    type: "events", title: "Events",
    description: "Per-wallet event stream — coming soon.",
    workspaces: ALL_WS,
    defaultWPct: 0.3, defaultHPct: 0.25, minWPx: 240, minHPx: 120,
    implemented: false, Render: EventsWidget,
  },
  "perps-stats": {
    type: "perps-stats", title: "Perps stats",
    description: "Underlying / mark / 24h / volume / funding / OI — not live.",
    workspaces: PERPS_WS,
    defaultWPct: 1.0, defaultHPct: 0.1, minWPx: 360, minHPx: 60,
    implemented: false, Render: PerpsStatsWidget,
  },
  "perps-chart": {
    type: "perps-chart", title: "Perps chart",
    description: "Schematic sparkline — not live.",
    workspaces: PERPS_WS,
    defaultWPct: 0.6, defaultHPct: 0.45, minWPx: 360, minHPx: 200,
    implemented: false, Render: PerpsChartWidget,
  },
  "perps-orderbook": {
    type: "perps-orderbook", title: "Perps order book",
    description: "5-row Bid/Size/Ask placeholder — not live.",
    workspaces: PERPS_WS,
    defaultWPct: 0.4, defaultHPct: 0.3, minWPx: 240, minHPx: 160,
    implemented: false, Render: PerpsOrderbookWidget,
  },
  "perps-trade-form": {
    type: "perps-trade-form", title: "Perps trade ticket",
    description: "Long/Short/size/leverage — disabled in this testnet beta.",
    workspaces: PERPS_WS,
    defaultWPct: 0.4, defaultHPct: 0.35, minWPx: 240, minHPx: 200,
    implemented: false, Render: PerpsTradeFormWidget,
  },
  "perps-trade-feed": {
    type: "perps-trade-feed", title: "Perps trade feed",
    description: "Public trade feed — not live.",
    workspaces: PERPS_WS,
    defaultWPct: 0.6, defaultHPct: 0.25, minWPx: 280, minHPx: 140,
    implemented: false, Render: PerpsTradeFeedWidget,
  },
  "docs-help": {
    type: "docs-help", title: "Docs · help",
    description: "Quickstart / Testing guide / Limitations / FAQ links.",
    workspaces: ALL_WS,
    defaultWPct: 0.25, defaultHPct: 0.25, minWPx: 220, minHPx: 140,
    implemented: true, Render: DocsHelpWidget,
  },
  feedback: {
    type: "feedback", title: "Feedback",
    description: "Report a bug + open Discord.",
    workspaces: ALL_WS,
    defaultWPct: 0.25, defaultHPct: 0.25, minWPx: 220, minHPx: 140,
    implemented: true, Render: FeedbackWidget,
  },
};

export const WIDGET_TYPES: WidgetType[] = Object.keys(WIDGET_REGISTRY) as WidgetType[];

export function widgetsForWorkspace(workspaceId: WorkspaceId): WidgetDef[] {
  return WIDGET_TYPES.filter((t) =>
    WIDGET_REGISTRY[t].workspaces.includes(workspaceId),
  ).map((t) => WIDGET_REGISTRY[t]);
}

/** Default placement on the pixel canvas. Positions are percentages so
 *  defaults always fill the canvas edge-to-edge regardless of monitor
 *  size, with no right gutter. */
export interface DefaultPlacement {
  type: WidgetType;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
}

export function defaultWidgetsFor(workspaceId: WorkspaceId): DefaultPlacement[] {
  switch (workspaceId) {
    case "options":
      // chain ≈ 70% wide, trade ticket ≈ 30%, both occupy the top 70%;
      // the bottom dock fills the remaining 30% across the full width.
      return [
        { type: "options-chain", xPct: 0,    yPct: 0,    wPct: 0.7, hPct: 0.7 },
        { type: "trade",         xPct: 0.7,  yPct: 0,    wPct: 0.3, hPct: 0.7 },
        { type: "bottom-dock",   xPct: 0,    yPct: 0.7,  wPct: 1.0, hPct: 0.3 },
      ];
    case "perps":
      return [
        { type: "perps-stats",      xPct: 0,    yPct: 0,    wPct: 1.0, hPct: 0.1 },
        { type: "perps-chart",      xPct: 0,    yPct: 0.1,  wPct: 0.6, hPct: 0.45 },
        { type: "perps-orderbook",  xPct: 0.6,  yPct: 0.1,  wPct: 0.4, hPct: 0.3 },
        { type: "perps-trade-form", xPct: 0.6,  yPct: 0.4,  wPct: 0.4, hPct: 0.3 },
        { type: "perps-trade-feed", xPct: 0,    yPct: 0.55, wPct: 0.6, hPct: 0.15 },
        { type: "bottom-dock",      xPct: 0,    yPct: 0.7,  wPct: 1.0, hPct: 0.3 },
      ];
    case "custom-1":
    case "custom-2":
    case "custom-3":
      return [];
  }
}
