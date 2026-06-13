// Workspace V1 — modular widget grid for the DeOpt trading frontend.
//
// Posture: localStorage-only persistence. NO secrets, NO private keys,
// NO RPC URLs, NO bearer tokens, NO DATABASE_URL, NO signatures.
// Wallet address (lowercased) is the only identity-bearing field; if
// no wallet is connected, an anonymous bucket is used with a tighter
// expiry.
//
// V1 covers: types, registry, grid + chrome, localStorage persistence,
// add/remove/reset, per-wallet bucket, expiry. Out of scope for V1:
// drag-and-drop, server-side sync, multi-monitor split-pane.

/** All widget kinds supported by V1. Coming-soon widgets are honest
 *  placeholders — they NEVER fabricate Greeks / bid / ask / liquidity. */
export type WidgetType =
  | "options-chain"
  | "option-details"
  | "payoff"
  | "balances"
  | "positions"
  | "orders"
  | "trades"
  | "greeks"
  | "events"
  | "perps-stats"
  | "perps-chart"
  | "perps-orderbook"
  | "perps-trade-form"
  | "perps-trade-feed"
  | "docs-help"
  | "feedback";

export type WidgetSize = "sm" | "md" | "lg" | "xl";

export const WIDGET_SIZES: readonly WidgetSize[] = ["sm", "md", "lg", "xl"];

export type WorkspaceId = "options" | "perps" | "custom-1" | "custom-2" | "custom-3";

/** A single placed widget. `id` is unique within the workspace. */
export interface WidgetInstance {
  id: string;
  type: WidgetType;
  size: WidgetSize;
}

/** A single workspace's layout. */
export interface WorkspaceLayout {
  workspaceId: WorkspaceId;
  widgets: WidgetInstance[];
  updatedAt: number;
  /** Absolute ms epoch. After this point the bucket is pruned on load. */
  expiresAt: number;
}

/** The full localStorage payload per wallet (or anon). */
export interface StoredWorkspaces {
  version: number;
  /** Lower-cased 0x… address OR the literal `"anon"`. */
  walletKey: string;
  workspaces: Partial<Record<WorkspaceId, WorkspaceLayout>>;
}

export const WORKSPACE_LAYOUT_VERSION = 1;
export const WORKSPACE_STORAGE_PREFIX = "deopt:v2:workspace:";
export const ANON_WALLET_KEY = "anon";
export const WALLET_LAYOUT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const ANON_LAYOUT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
