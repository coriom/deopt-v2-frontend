// Workspace V5 — adaptive freeform grid + visible dotted backdrop.
//
// V5 replaces V4's static `GRID_COLS = 48` with a column count derived
// from the actual container width:
//   cols = clamp(round(width / TARGET_CELL_PX), MIN_COLS, MAX_COLS)
// so that snap units stay near a fixed pixel target across viewports
// (~36px per cell on every monitor; 53 cols on 1920px, 71 cols on
// 2560px). The visible grid backdrop renders at the SAME cell size
// via CSS variables, so the user sees exactly where widgets snap.
//
// Posture: localStorage-only persistence. NO secrets, NO private keys,
// NO RPC URLs, NO bearer tokens, NO DATABASE_URL, NO signatures.

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

export interface WorkspaceLayout {
  workspaceId: WorkspaceId;
  widgets: WidgetInstance[];
  /** Column count this layout was saved at — used to rescale x/w
   *  proportionally when the user loads the layout under a different
   *  viewport (and therefore a different `cols`). */
  cols: number;
  updatedAt: number;
  expiresAt: number;
}

export interface StoredWorkspaces {
  version: number;
  walletKey: string;
  workspaces: Partial<Record<WorkspaceId, WorkspaceLayout>>;
}

export const WORKSPACE_LAYOUT_VERSION = 5;
export const WORKSPACE_STORAGE_PREFIX = "deopt:v2:workspace:";
export const ANON_WALLET_KEY = "anon";
export const WALLET_LAYOUT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const ANON_LAYOUT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Adaptive grid bounds. Target ~36px per cell so the placement grid
 *  feels free without becoming pixel-precise. */
export const GRID_MIN_COLS = 48;
export const GRID_MAX_COLS = 120;
export const GRID_TARGET_CELL_PX = 36;
export const GRID_ROW_HEIGHT_PX = 30;
export const GRID_ITEM_MARGIN_PX = 4;

/** Compute the column count for a given container width (in px). */
export function computeCols(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return GRID_MIN_COLS;
  }
  const raw = Math.round(containerWidth / GRID_TARGET_CELL_PX);
  return Math.max(GRID_MIN_COLS, Math.min(GRID_MAX_COLS, raw));
}

/** Compute the per-cell width in px for the visible grid backdrop.
 *  Mirrors RGL's calc: width = cellWidth*cols + margin*(cols+1). */
export function computeCellWidth(containerWidth: number, cols: number): number {
  if (cols <= 0) return 0;
  const usable = containerWidth - GRID_ITEM_MARGIN_PX * (cols + 1);
  return Math.max(0, usable / cols);
}
