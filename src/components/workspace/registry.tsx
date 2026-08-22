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
  PerpsBookFeedWidget,
  PerpsChartWidget,
  PerpsOrderbookWidget,
  PerpsStatsWidget,
  PerpsTradeFeedWidget,
  PerpsTradeFormWidget,
  PositionsWidget,
  TradeWidget,
  TradesWidget,
} from "./widgets";
import { OptionsChainMenuActions } from "@/components/trading/terminal/OptionsChainMenuActions";

export interface WidgetMenuActionsProps {
  /** Close the widget's kebab menu. Call after an action commits so
   *  the popover dismisses cleanly. */
  close: () => void;
}

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
  /** Optional per-widget menu items rendered above the shared
   *  "Remove widget" action in the kebab (⋯) menu. Each widget owns
   *  its own settings surface — the shared menu framework only
   *  provides the trigger + popover + Remove action. */
  MenuActions?: ComponentType<WidgetMenuActionsProps>;
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
    MenuActions: OptionsChainMenuActions,
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
    implemented: true, Render: PerpsStatsWidget,
  },
  "perps-chart": {
    type: "perps-chart", title: "Perps chart",
    description: "Schematic sparkline — not live.",
    workspaces: PERPS_WS,
    defaultWPct: 0.6, defaultHPct: 0.45, minWPx: 360, minHPx: 200,
    implemented: true, Render: PerpsChartWidget,
  },
  "perps-orderbook": {
    type: "perps-orderbook", title: "Perps order book",
    description: "5-row Bid/Size/Ask placeholder — not live.",
    workspaces: PERPS_WS,
    defaultWPct: 0.4, defaultHPct: 0.3, minWPx: 240, minHPx: 160,
    implemented: true, Render: PerpsOrderbookWidget,
  },
  "perps-trade-form": {
    type: "perps-trade-form", title: "Trade Perps",
    description: "Long/Short/size/leverage — disabled in this testnet beta.",
    workspaces: PERPS_WS,
    defaultWPct: 0.28, defaultHPct: 0.92, minWPx: 240, minHPx: 240,
    implemented: true, Render: PerpsTradeFormWidget,
  },
  "perps-trade-feed": {
    type: "perps-trade-feed", title: "Perps Feed",
    description: "Public trade feed — not live.",
    workspaces: PERPS_WS,
    defaultWPct: 0.4, defaultHPct: 0.4, minWPx: 240, minHPx: 160,
    implemented: true, Render: PerpsTradeFeedWidget,
  },
  "perps-book-feed": {
    type: "perps-book-feed", title: "Order Book / Feed",
    description: "Combined orderbook ladder + perps trade feed with internal tabs.",
    workspaces: PERPS_WS,
    defaultWPct: 0.22, defaultHPct: 0.62, minWPx: 220, minHPx: 200,
    implemented: true, Render: PerpsBookFeedWidget,
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
      // Payoff no longer ships as a separate widget — it lives as a
      // tab inside the Trade ticket ("Payoff/Greeks/Trades/Book"), so
      // the right column is a single Trade ticket at full height,
      // avoiding the overlap the split layout produced when the
      // ticket needed more vertical room than 58% of the canvas.
      //
      //   ┌───────────────────────┬──────────────┐
      //   │  OPTIONS CHAIN        │  TRADE       │
      //   │  72% × 72%            │  TICKET      │
      //   │                       │  (Payoff /   │
      //   │                       │   Greeks /   │
      //   ├───────────────────────│   Trades /   │
      //   │  BOTTOM DOCK          │   Book tabs) │
      //   │  72% × 28%            │  28% × 100%  │
      //   └───────────────────────┴──────────────┘
      //
      // Existing users keep their saved layout — only first-time
      // visitors and explicit resets land on this seed.
      return [
        { type: "options-chain", xPct: 0,    yPct: 0,     wPct: 0.72, hPct: 0.72 },
        { type: "bottom-dock",   xPct: 0,    yPct: 0.72,  wPct: 0.72, hPct: 0.28 },
        { type: "trade",         xPct: 0.72, yPct: 0,     wPct: 0.28, hPct: 1.0  },
      ];
    case "perps":
      // 3-column layout. The combined Order Book / Perps Feed widget
      // sits between the chart and the trade ticket, with internal
      // tabs. Both side columns span the full height down to the
      // bottom edge — bottom dock only sits under the chart.
      //
      //   ┌──────────────────────┬─────────┬─────────┐
      //   │ Chart (stats merged) │ OB /    │ Trade   │
      //   │ 66% × 70%            │ Feed    │ Perps   │
      //   │                      │ (tabs)  │ (full   │
      //   │                      │ (full   │  height,│
      //   ├──────────────────────│  height,│  17%    │
      //   │ Bottom dock          │  17%    │  × 100%)│
      //   │ 66% × 30%            │  × 100%)│         │
      //   └──────────────────────┴─────────┴─────────┘
      return [
        // Stats are merged INSIDE the chart widget (Derive-style),
        // so the perps-stats tile is no longer part of the default
        // seed. Chart sits top-left with bottom dock under it; both
        // side columns (OB/Feed and Trade Perps) span the full
        // height from top to bottom of the canvas.
        { type: "perps-chart",      xPct: 0,     yPct: 0,     wPct: 0.66, hPct: 0.66 },
        { type: "perps-book-feed",  xPct: 0.66,  yPct: 0,     wPct: 0.17, hPct: 1.0  },
        { type: "perps-trade-form", xPct: 0.83,  yPct: 0,     wPct: 0.17, hPct: 1.0  },
        { type: "bottom-dock",      xPct: 0,     yPct: 0.66,  wPct: 0.66, hPct: 0.34 },
      ];
    case "custom-1":
    case "custom-2":
    case "custom-3":
      return [];
  }
}
