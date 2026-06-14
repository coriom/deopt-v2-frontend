// Workspace V2 — resizable + draggable widget grid.
//
// V2 replaces the V1 size-preset model (`sm/md/lg/xl` enum) with real
// grid coordinates {x, y, w, h, minW?, minH?} so widgets can be
// dragged/resized with the mouse via react-grid-layout.
//
// Posture: localStorage-only persistence. NO secrets, NO private keys,
// NO RPC URLs, NO bearer tokens, NO DATABASE_URL, NO signatures.
// Wallet address (lowercased) is the only identity-bearing field; the
// anonymous bucket has a tighter expiry. V1 buckets are version-bumped
// → wiped on load and replaced with the V2 default.

/** All widget kinds supported by V2. Placeholders ALWAYS surface
 *  honest "not live" / "coming later" copy — they never fabricate
 *  Greeks / bid / ask / liquidity. */
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
  | "bottom-dock"
  | "perps-stats"
  | "perps-chart"
  | "perps-orderbook"
  | "perps-trade-form"
  | "perps-trade-feed"
  | "docs-help"
  | "feedback";

export type WorkspaceId =
  | "options"
  | "perps"
  | "custom-1"
  | "custom-2"
  | "custom-3";

/** A single placed widget. Coordinates are in 12-col grid units; `h`
 *  is in `rowHeight` units (30px in the current shell). */
export interface WidgetInstance {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

/** A single workspace's layout. */
export interface WorkspaceLayout {
  workspaceId: WorkspaceId;
  widgets: WidgetInstance[];
  updatedAt: number;
  /** Absolute ms epoch. Bucket pruned on load after this point. */
  expiresAt: number;
}

/** The full localStorage payload per wallet (or anon). */
export interface StoredWorkspaces {
  version: number;
  /** Lower-cased 0x… address OR the literal `"anon"`. */
  walletKey: string;
  workspaces: Partial<Record<WorkspaceId, WorkspaceLayout>>;
}

export const WORKSPACE_LAYOUT_VERSION = 4;
export const WORKSPACE_STORAGE_PREFIX = "deopt:v2:workspace:";
export const ANON_WALLET_KEY = "anon";
export const WALLET_LAYOUT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const ANON_LAYOUT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Grid model constants used by the Workspace + WidgetFrame.
 *  V5 doubles cols from 24 → 48 to make the snap units fine enough
 *  on large external monitors (2560px+) that placement feels truly
 *  freeform, AND to make the "invisible grid" reach the right edge
 *  without operator-visible step gaps. */
export const GRID_COLS = 48;
export const GRID_ROW_HEIGHT_PX = 30;
