// Widget registry. Maps WidgetType → metadata + render component.

import type { ComponentType } from "react";
import type { WidgetType, WidgetSize, WorkspaceId } from "@/lib/workspace-types";
import {
  BalancesWidget,
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
  description: string;
  /** Which workspaces this widget is offered in via the Add Widget menu. */
  workspaces: WorkspaceId[];
  defaultSize: WidgetSize;
  /** `true` = real functionality. `false` = honest placeholder. */
  implemented: boolean;
  Render: ComponentType;
}

const ALL_WS: WorkspaceId[] = [
  "options",
  "perps",
  "custom-1",
  "custom-2",
  "custom-3",
];

const OPTIONS_WS: WorkspaceId[] = ["options", "custom-1", "custom-2", "custom-3"];
const PERPS_WS: WorkspaceId[] = ["perps", "custom-1", "custom-2", "custom-3"];

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDef> = {
  "options-chain": {
    type: "options-chain",
    title: "Options chain",
    description: "Calls | Strike | Puts ladder with underlying + expiry pills.",
    workspaces: OPTIONS_WS,
    defaultSize: "xl",
    implemented: true,
    Render: OptionsChainWidget,
  },
  "option-details": {
    type: "option-details",
    title: "Selected option",
    description: "5-tab panel: Trade / Payoff / Greeks / Details / Risk.",
    workspaces: OPTIONS_WS,
    defaultSize: "lg",
    implemented: true,
    Render: OptionDetailsWidget,
  },
  payoff: {
    type: "payoff",
    title: "Payoff",
    description: "Schematic payoff for the selected option.",
    workspaces: OPTIONS_WS,
    defaultSize: "md",
    implemented: true,
    Render: PayoffWidget,
  },
  balances: {
    type: "balances",
    title: "Balances",
    description: "Per-token testnet balances for the connected wallet.",
    workspaces: ALL_WS,
    defaultSize: "md",
    implemented: true,
    Render: BalancesWidget,
  },
  positions: {
    type: "positions",
    title: "Positions",
    description: "Open option positions for the connected wallet.",
    workspaces: ALL_WS,
    defaultSize: "md",
    implemented: true,
    Render: PositionsWidget,
  },
  orders: {
    type: "orders",
    title: "Orders",
    description: "Resting limit-order book — not live in this testnet beta.",
    workspaces: ALL_WS,
    defaultSize: "md",
    implemented: false,
    Render: OrdersWidget,
  },
  trades: {
    type: "trades",
    title: "Trades",
    description: "Trade history for the connected wallet.",
    workspaces: ALL_WS,
    defaultSize: "md",
    implemented: true,
    Render: TradesWidget,
  },
  greeks: {
    type: "greeks",
    title: "Greeks",
    description: "Portfolio greeks — coming later.",
    workspaces: ALL_WS,
    defaultSize: "md",
    implemented: false,
    Render: GreeksWidget,
  },
  events: {
    type: "events",
    title: "Events",
    description: "Per-wallet event stream — coming soon.",
    workspaces: ALL_WS,
    defaultSize: "md",
    implemented: false,
    Render: EventsWidget,
  },
  "perps-stats": {
    type: "perps-stats",
    title: "Perps stats",
    description: "Underlying / mark / 24h Δ / volume / funding / OI strip — not live.",
    workspaces: PERPS_WS,
    defaultSize: "xl",
    implemented: false,
    Render: PerpsStatsWidget,
  },
  "perps-chart": {
    type: "perps-chart",
    title: "Perps chart",
    description: "Schematic sparkline — not live in this testnet beta.",
    workspaces: PERPS_WS,
    defaultSize: "lg",
    implemented: false,
    Render: PerpsChartWidget,
  },
  "perps-orderbook": {
    type: "perps-orderbook",
    title: "Perps order book",
    description: "5-row Bid/Size/Ask placeholder — not live.",
    workspaces: PERPS_WS,
    defaultSize: "md",
    implemented: false,
    Render: PerpsOrderbookWidget,
  },
  "perps-trade-form": {
    type: "perps-trade-form",
    title: "Perps trade ticket",
    description: "Long/Short/size/leverage form — disabled in this testnet beta.",
    workspaces: PERPS_WS,
    defaultSize: "md",
    implemented: false,
    Render: PerpsTradeFormWidget,
  },
  "perps-trade-feed": {
    type: "perps-trade-feed",
    title: "Perps trade feed",
    description: "Public trade feed — not live.",
    workspaces: PERPS_WS,
    defaultSize: "md",
    implemented: false,
    Render: PerpsTradeFeedWidget,
  },
  "docs-help": {
    type: "docs-help",
    title: "Docs · help",
    description: "Quickstart / Testing guide / Limitations / FAQ links.",
    workspaces: ALL_WS,
    defaultSize: "sm",
    implemented: true,
    Render: DocsHelpWidget,
  },
  feedback: {
    type: "feedback",
    title: "Feedback",
    description: "Report a bug + open Discord.",
    workspaces: ALL_WS,
    defaultSize: "sm",
    implemented: true,
    Render: FeedbackWidget,
  },
};

export const WIDGET_TYPES: WidgetType[] = Object.keys(WIDGET_REGISTRY) as WidgetType[];

export function widgetsForWorkspace(workspaceId: WorkspaceId): WidgetDef[] {
  return WIDGET_TYPES.filter((t) =>
    WIDGET_REGISTRY[t].workspaces.includes(workspaceId),
  ).map((t) => WIDGET_REGISTRY[t]);
}

/** Default widget set for a workspace when nothing is persisted yet. */
export function defaultWidgetsFor(
  workspaceId: WorkspaceId,
): { type: WidgetType; size: WidgetSize }[] {
  switch (workspaceId) {
    case "options":
      return [
        { type: "options-chain", size: "xl" },
        { type: "option-details", size: "lg" },
        { type: "balances", size: "md" },
        { type: "positions", size: "md" },
        { type: "trades", size: "md" },
        { type: "events", size: "md" },
      ];
    case "perps":
      return [
        { type: "perps-stats", size: "xl" },
        { type: "perps-chart", size: "lg" },
        { type: "perps-orderbook", size: "md" },
        { type: "perps-trade-form", size: "md" },
        { type: "perps-trade-feed", size: "md" },
        { type: "balances", size: "md" },
      ];
    case "custom-1":
    case "custom-2":
    case "custom-3":
      return [];
  }
}
