// Workspace V7 — pixel/percentage canvas + strict geometry validation.
//
// V7 builds on V6's pixel/percentage freeform canvas by adding hard
// validation and clamping at every load/render boundary so a stale or
// corrupted layout cannot render as a stack of collapsed 0×0 widgets
// in the top-left corner.
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

/** Set of WidgetType values for runtime validation of loaded layouts. */
export const KNOWN_WIDGET_TYPES: ReadonlySet<WidgetType> = new Set<WidgetType>([
  "options-chain",
  "option-details",
  "payoff",
  "balances",
  "positions",
  "orders",
  "trades",
  "greeks",
  "events",
  "bottom-dock",
  "perps-stats",
  "perps-chart",
  "perps-orderbook",
  "perps-trade-form",
  "perps-trade-feed",
  "docs-help",
  "feedback",
]);

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  minWPx?: number;
  minHPx?: number;
}

export interface WorkspaceLayout {
  workspaceId: WorkspaceId;
  widgets: WidgetInstance[];
  canvasWidthPx: number;
  canvasHeightPx: number;
  updatedAt: number;
  expiresAt: number;
}

export interface StoredWorkspaces {
  version: number;
  walletKey: string;
  workspaces: Partial<Record<WorkspaceId, WorkspaceLayout>>;
}

// V7 bump invalidates any in-flight V6 bucket that may have been saved
// with the broken hydration-render geometry (rect 0×0 at top-left).
export const WORKSPACE_LAYOUT_VERSION = 7;
export const WORKSPACE_STORAGE_PREFIX = "deopt:v2:workspace:";
export const ANON_WALLET_KEY = "anon";
export const WALLET_LAYOUT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const ANON_LAYOUT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Pixel snap step for both drag/resize AND the visible dotted
 *  backdrop. Keep them equal — they MUST share this constant so the
 *  user sees the same grid they land on. */
export const CANVAS_SNAP_PX = 24;

/** Default per-widget minimum sizes when the widget registry does not
 *  override them. Prevents widgets from collapsing below a usable
 *  rectangle during resize. */
export const DEFAULT_MIN_W_PX = 200;
export const DEFAULT_MIN_H_PX = 120;

/** Minimum canvas size that is considered "valid" for rendering
 *  widgets. Below these thresholds we render a placeholder so widgets
 *  cannot collapse into the top-left corner during first paint or on
 *  pathologically-narrow viewports. */
export const MIN_CANVAS_WIDTH_PX = 320;
export const MIN_CANVAS_HEIGHT_PX = 240;

/** Smallest percentage size a saved widget is allowed to claim. Below
 *  this the widget would not be readable even on a 4K monitor, so we
 *  reject the layout on load. */
export const MIN_WIDGET_PCT = 0.04; // 4% — ~77px on a 1920px canvas
export const MAX_GEOMETRY_OVERFLOW = 0.01; // tolerate 1% float drift

export function snapPx(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / CANVAS_SNAP_PX) * CANVAS_SNAP_PX;
}

export function pxToPct(px: number, canvasPx: number): number {
  if (!Number.isFinite(canvasPx) || canvasPx <= 0) return 0;
  if (!Number.isFinite(px)) return 0;
  const pct = px / canvasPx;
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(1, pct));
}

export function pctToPx(pct: number, canvasPx: number): number {
  if (!Number.isFinite(canvasPx) || canvasPx <= 0) return 0;
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, pct) * canvasPx;
}

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

/** True iff the canvas has been measured to a size large enough to
 *  render readable widgets. Below this threshold the workspace shows
 *  a placeholder rather than risk collapsing widgets into the corner. */
export function isCanvasReady(canvas: CanvasSize): boolean {
  return (
    Number.isFinite(canvas.width) &&
    Number.isFinite(canvas.height) &&
    canvas.width >= MIN_CANVAS_WIDTH_PX &&
    canvas.height >= MIN_CANVAS_HEIGHT_PX
  );
}

/** Validate a single widget instance shape + geometry. Returns true
 *  only when every field is sane enough to render. */
export function isValidWidgetInstance(value: unknown): value is WidgetInstance {
  if (typeof value !== "object" || value === null) return false;
  const w = value as Record<string, unknown>;
  if (typeof w.id !== "string" || w.id.length === 0) return false;
  if (typeof w.type !== "string") return false;
  if (!KNOWN_WIDGET_TYPES.has(w.type as WidgetType)) return false;
  for (const k of ["xPct", "yPct", "wPct", "hPct"] as const) {
    const v = w[k];
    if (typeof v !== "number" || !Number.isFinite(v)) return false;
  }
  const xPct = w.xPct as number;
  const yPct = w.yPct as number;
  const wPct = w.wPct as number;
  const hPct = w.hPct as number;
  if (xPct < 0 || yPct < 0) return false;
  if (wPct < MIN_WIDGET_PCT || hPct < MIN_WIDGET_PCT) return false;
  if (wPct > 1 + MAX_GEOMETRY_OVERFLOW || hPct > 1 + MAX_GEOMETRY_OVERFLOW) return false;
  if (xPct + wPct > 1 + MAX_GEOMETRY_OVERFLOW) return false;
  if (yPct + hPct > 1 + MAX_GEOMETRY_OVERFLOW) return false;
  if (w.minWPx !== undefined && (typeof w.minWPx !== "number" || w.minWPx < 0)) {
    return false;
  }
  if (w.minHPx !== undefined && (typeof w.minHPx !== "number" || w.minHPx < 0)) {
    return false;
  }
  return true;
}

/** Validate a full WorkspaceLayout. Used by the storage loader to
 *  reject any layout that would render as collapsed/overlapping
 *  garbage. */
export function isValidWorkspaceLayout(value: unknown): value is WorkspaceLayout {
  if (typeof value !== "object" || value === null) return false;
  const layout = value as Record<string, unknown>;
  if (typeof layout.workspaceId !== "string") return false;
  if (!Array.isArray(layout.widgets)) return false;
  if (typeof layout.updatedAt !== "number" || !Number.isFinite(layout.updatedAt)) return false;
  if (typeof layout.expiresAt !== "number" || !Number.isFinite(layout.expiresAt)) return false;
  // canvasWidthPx / canvasHeightPx are debug-only — accept missing/zero
  // but require non-negative numbers if present.
  for (const k of ["canvasWidthPx", "canvasHeightPx"] as const) {
    const v = layout[k];
    if (v !== undefined && (typeof v !== "number" || v < 0 || !Number.isFinite(v))) {
      return false;
    }
  }
  for (const w of layout.widgets) {
    if (!isValidWidgetInstance(w)) return false;
  }
  return true;
}

/** Clamp a pixel rect to canvas bounds while honoring widget minimums.
 *  If the canvas is too small to fit the minimum, the rect collapses
 *  to (0, 0) with the maximum size that fits — never below 0. */
export function clampRectToCanvas(
  rect: PixelRect,
  canvas: CanvasSize,
  minW: number,
  minH: number,
): PixelRect {
  const cw = Math.max(0, Number.isFinite(canvas.width) ? canvas.width : 0);
  const ch = Math.max(0, Number.isFinite(canvas.height) ? canvas.height : 0);
  const safeMinW = Math.max(1, Math.min(minW, cw || minW));
  const safeMinH = Math.max(1, Math.min(minH, ch || minH));
  const reqW = Number.isFinite(rect.w) ? rect.w : safeMinW;
  const reqH = Number.isFinite(rect.h) ? rect.h : safeMinH;
  const w = Math.max(safeMinW, Math.min(reqW, cw));
  const h = Math.max(safeMinH, Math.min(reqH, ch));
  const reqX = Number.isFinite(rect.x) ? rect.x : 0;
  const reqY = Number.isFinite(rect.y) ? rect.y : 0;
  const x = Math.max(0, Math.min(reqX, Math.max(0, cw - w)));
  const y = Math.max(0, Math.min(reqY, Math.max(0, ch - h)));
  return { x, y, w, h };
}

export function rectToPctGeometry(
  rect: PixelRect,
  canvas: CanvasSize,
): Pick<WidgetInstance, "xPct" | "yPct" | "wPct" | "hPct"> {
  return {
    xPct: pxToPct(rect.x, canvas.width),
    yPct: pxToPct(rect.y, canvas.height),
    wPct: pxToPct(rect.w, canvas.width),
    hPct: pxToPct(rect.h, canvas.height),
  };
}

export function geometryToRect(
  widget: WidgetInstance,
  canvas: CanvasSize,
): PixelRect {
  return {
    x: pctToPx(widget.xPct, canvas.width),
    y: pctToPx(widget.yPct, canvas.height),
    w: pctToPx(widget.wPct, canvas.width),
    h: pctToPx(widget.hPct, canvas.height),
  };
}

/** Resolve a widget's stored geometry to a clamped pixel rect that
 *  honors per-widget minimums. Use this everywhere widgets are
 *  rendered — never call `geometryToRect` directly for layout, since
 *  it can return 0×0 for stale or pathological geometry. */
export function resolveWidgetRect(
  widget: WidgetInstance,
  canvas: CanvasSize,
): PixelRect {
  const raw = geometryToRect(widget, canvas);
  const minW = widget.minWPx ?? DEFAULT_MIN_W_PX;
  const minH = widget.minHPx ?? DEFAULT_MIN_H_PX;
  return clampRectToCanvas(raw, canvas, minW, minH);
}
