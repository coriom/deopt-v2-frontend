// Widget registry — maps WidgetType → metadata + render component.
//
// V5 doubles defaultW / minW from the V4 24-col baseline to the
// 48-col baseline. Heights are unchanged (the grid uses 30px row
// units).

import type { ComponentType } from "react";
import type { WidgetType, WorkspaceId } from "@/lib/workspace-types";
import {
  BalancesWidget,
  BottomDockWidget,
  DocsHelpWidget,
  EventsWidget,
  FeedbackWidget,
  GreeksWidget,
  OptionDetailsWidget,
  OptionsChainWidget,
  OrdersWidget,
  PayoffWidget,
  PerpsChartWidget,
  PerpsOrderbookWidget,
  PerpsStatsWidget,
  PerpsTradeFeedWidget,
  PerpsTradeFormWidget,
  PositionsWidget,
  TradesWidget,
} from "./widgets";

export interface WidgetDef {
  type: WidgetType;
  title: string;
  /** Long-form description; surfaced in docs/tests, NOT in the menu. */
  description: string;
  workspaces: WorkspaceId[];
  defaultW: number;
  defaultH: number;
  minW: number;
  minH: number;
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
    defaultW: 32, defaultH: 18, minW: 16, minH: 8,
    implemented: true, Render: OptionsChainWidget,
  },
  "option-details": {
    type: "option-details", title: "Trade · detail",
    description: "5-tab panel: Trade / Payoff / Greeks / Details / Risk.",
    workspaces: OPTIONS_WS,
    defaultW: 16, defaultH: 18, minW: 12, minH: 8,
    implemented: true, Render: OptionDetailsWidget,
  },
  "bottom-dock": {
    type: "bottom-dock", title: "Account dock",
    description: "Balances / Positions / Orders / Trades / Greeks / Events.",
    workspaces: ALL_WS,
    defaultW: 48, defaultH: 10, minW: 16, minH: 4,
    implemented: true, Render: BottomDockWidget,
  },
  payoff: {
    type: "payoff", title: "Payoff",
    description: "Schematic payoff for the selected option (also a tab inside Trade · detail).",
    workspaces: OPTIONS_WS,
    defaultW: 16, defaultH: 8, minW: 12, minH: 4,
    implemented: true, Render: PayoffWidget,
  },
  balances: {
    type: "balances", title: "Balances",
    description: "Per-token testnet balances for the connected wallet.",
    workspaces: ALL_WS,
    defaultW: 16, defaultH: 8, minW: 12, minH: 4,
    implemented: true, Render: BalancesWidget,
  },
  positions: {
    type: "positions", title: "Positions",
    description: "Open option positions for the connected wallet.",
    workspaces: ALL_WS,
    defaultW: 16, defaultH: 8, minW: 12, minH: 4,
    implemented: true, Render: PositionsWidget,
  },
  orders: {
    type: "orders", title: "Orders",
    description: "Resting limit-order book — not live in this testnet beta.",
    workspaces: ALL_WS,
    defaultW: 16, defaultH: 6, minW: 12, minH: 3,
    implemented: false, Render: OrdersWidget,
  },
  trades: {
    type: "trades", title: "Trades",
    description: "Trade history for the connected wallet.",
    workspaces: ALL_WS,
    defaultW: 16, defaultH: 8, minW: 12, minH: 4,
    implemented: true, Render: TradesWidget,
  },
  greeks: {
    type: "greeks", title: "Greeks",
    description: "Portfolio greeks — coming later (also a tab inside Trade · detail).",
    workspaces: ALL_WS,
    defaultW: 16, defaultH: 6, minW: 12, minH: 3,
    implemented: false, Render: GreeksWidget,
  },
  events: {
    type: "events", title: "Events",
    description: "Per-wallet event stream — coming soon.",
    workspaces: ALL_WS,
    defaultW: 16, defaultH: 6, minW: 12, minH: 3,
    implemented: false, Render: EventsWidget,
  },
  "perps-stats": {
    type: "perps-stats", title: "Perps stats",
    description: "Underlying / mark / 24h / volume / funding / OI — not live.",
    workspaces: PERPS_WS,
    defaultW: 48, defaultH: 3, minW: 24, minH: 2,
    implemented: false, Render: PerpsStatsWidget,
  },
  "perps-chart": {
    type: "perps-chart", title: "Perps chart",
    description: "Schematic sparkline — not live.",
    workspaces: PERPS_WS,
    defaultW: 28, defaultH: 14, minW: 16, minH: 6,
    implemented: false, Render: PerpsChartWidget,
  },
  "perps-orderbook": {
    type: "perps-orderbook", title: "Perps order book",
    description: "5-row Bid/Size/Ask placeholder — not live.",
    workspaces: PERPS_WS,
    defaultW: 20, defaultH: 10, minW: 12, minH: 4,
    implemented: false, Render: PerpsOrderbookWidget,
  },
  "perps-trade-form": {
    type: "perps-trade-form", title: "Perps trade ticket",
    description: "Long/Short/size/leverage — disabled in this testnet beta.",
    workspaces: PERPS_WS,
    defaultW: 20, defaultH: 12, minW: 12, minH: 6,
    implemented: false, Render: PerpsTradeFormWidget,
  },
  "perps-trade-feed": {
    type: "perps-trade-feed", title: "Perps trade feed",
    description: "Public trade feed — not live.",
    workspaces: PERPS_WS,
    defaultW: 28, defaultH: 8, minW: 16, minH: 4,
    implemented: false, Render: PerpsTradeFeedWidget,
  },
  "docs-help": {
    type: "docs-help", title: "Docs · help",
    description: "Quickstart / Testing guide / Limitations / FAQ links.",
    workspaces: ALL_WS,
    defaultW: 12, defaultH: 6, minW: 8, minH: 3,
    implemented: true, Render: DocsHelpWidget,
  },
  feedback: {
    type: "feedback", title: "Feedback",
    description: "Report a bug + open Discord.",
    workspaces: ALL_WS,
    defaultW: 12, defaultH: 6, minW: 8, minH: 3,
    implemented: true, Render: FeedbackWidget,
  },
};

export const WIDGET_TYPES: WidgetType[] = Object.keys(WIDGET_REGISTRY) as WidgetType[];

export function widgetsForWorkspace(workspaceId: WorkspaceId): WidgetDef[] {
  return WIDGET_TYPES.filter((t) =>
    WIDGET_REGISTRY[t].workspaces.includes(workspaceId),
  ).map((t) => WIDGET_REGISTRY[t]);
}

/** Default placement on the 48-col freeform canvas (rowHeight = 30px).
 *  With noCompactor, these coordinates are preserved exactly,
 *  including any intentional gaps. */
export interface DefaultPlacement {
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function defaultWidgetsFor(workspaceId: WorkspaceId): DefaultPlacement[] {
  switch (workspaceId) {
    case "options":
      return [
        { type: "options-chain", x: 0, y: 0, w: 32, h: 18 },
        { type: "option-details", x: 32, y: 0, w: 16, h: 18 },
        { type: "bottom-dock", x: 0, y: 18, w: 48, h: 10 },
      ];
    case "perps":
      return [
        { type: "perps-stats", x: 0, y: 0, w: 48, h: 3 },
        { type: "perps-chart", x: 0, y: 3, w: 28, h: 14 },
        { type: "perps-orderbook", x: 28, y: 3, w: 20, h: 10 },
        { type: "perps-trade-form", x: 28, y: 13, w: 20, h: 12 },
        { type: "perps-trade-feed", x: 0, y: 17, w: 28, h: 8 },
        { type: "bottom-dock", x: 0, y: 25, w: 48, h: 10 },
      ];
    case "custom-1":
    case "custom-2":
    case "custom-3":
      return [];
  }
}
