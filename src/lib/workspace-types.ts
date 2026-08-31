// Workspace V8 — pixel/percentage canvas + strict geometry validation.
//
// V8 renames the legacy `option-details` widget to `trade` to reflect
// the FRONTEND-TRADE-WIDGET-V1 redesign (compact options order ticket
// with Book / RFQ modes). Buckets persisted under V7 may still carry
// the old type string, so the version bump alone invalidates them at
// load time and the workspace falls back to its default layout — which
// now seeds a `trade` widget instead of `option-details`.
//
// Posture: localStorage-only persistence. NO secrets, NO private keys,
// NO RPC URLs, NO bearer tokens, NO DATABASE_URL, NO signatures.

export type WidgetType =
  | "options-chain"
  | "trade"
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
  | "perps-book-feed";

export type WorkspaceId =
  | "options"
  | "perps"
  | "custom-1"
  | "custom-2"
  | "custom-3";

/** Set of WidgetType values for runtime validation of loaded layouts. */
export const KNOWN_WIDGET_TYPES: ReadonlySet<WidgetType> = new Set<WidgetType>([
  "options-chain",
  "trade",
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
  "perps-book-feed",
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

// V8 bump invalidates any V7 bucket that still references the
// legacy `option-details` widget type — the rename to `trade` is not
// backwards-compatible at the type-string layer, so the cleanest
// migration is a version bump + fall-back to the default layout.
export const WORKSPACE_LAYOUT_VERSION = 8;
export const WORKSPACE_STORAGE_PREFIX = "deopt:v2:workspace:";
export const ANON_WALLET_KEY = "anon";
export const WALLET_LAYOUT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const ANON_LAYOUT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Pixel snap step for both drag/resize AND the visible dotted
 *  backdrop. Keep them equal — they MUST share this constant so the
 *  user sees the same grid they land on. */
export const CANVAS_SNAP_PX = 32;

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

/** Upper bound on a widget's vertical position. The workspace
 *  canvas grows downward to fit; 50 viewport-heights is plenty for
 *  any realistic scroll session and still guards against runaway
 *  values from corrupted state. */
export const MAX_Y_PCT = 50;

export function snapPx(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / CANVAS_SNAP_PX) * CANVAS_SNAP_PX;
}

/** Resolve the effective snap step for a specific canvas dimension.
 *
 *  A fixed 32px grid is fine visually, but no real viewport is a
 *  perfect multiple of 32 — so snapping widget geometry to the fixed
 *  grid causes the last row / column to fall a few pixels short of
 *  (or overshoot) the canvas edge. That was the source of the black
 *  band visible below the perps default layout: `hPct=0.66` chart +
 *  `hPct=0.34` bottom-dock snapped to fixed 32px multiples that
 *  summed 8-24 px past the canvas height, then the workspace's
 *  `virtualHeightPx` reserved a scroll buffer to accommodate the
 *  overshoot.
 *
 *  This helper returns a snap step CLOSE to `CANVAS_SNAP_PX` but
 *  chosen so the canvas dimension divides evenly into it. E.g. a
 *  canvas 823 px tall snapped with ideal 32 resolves to `823 / 26 =
 *  31.65 px` per row, giving 26 exact rows. Every widget snapped
 *  with this step lands exactly on the canvas edge — no residual
 *  drift, no scroll buffer required. */
export function resolveAdaptiveSnap(
  canvasSize: number,
  ideal: number = CANVAS_SNAP_PX,
): number {
  if (!Number.isFinite(canvasSize) || canvasSize <= 0) return ideal;
  if (!Number.isFinite(ideal) || ideal <= 0) return canvasSize;
  const rows = Math.max(1, Math.round(canvasSize / ideal));
  return canvasSize / rows;
}

/** Snap a raw pixel value to the nearest multiple of `snap`. When
 *  `snap` is the canvas-adaptive value from `resolveAdaptiveSnap`,
 *  a snapped canvas edge (`value == canvasSize`) lands exactly on
 *  the last row boundary. */
export function snapPxTo(value: number, snap: number): number {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(snap) || snap <= 0) return value;
  return Math.round(value / snap) * snap;
}

export function pxToPct(px: number, canvasPx: number): number {
  if (!Number.isFinite(canvasPx) || canvasPx <= 0) return 0;
  if (!Number.isFinite(px)) return 0;
  const pct = px / canvasPx;
  if (!Number.isFinite(pct)) return 0;
  // Lower clamp only — Y positions may legitimately exceed 1 since
  // the workspace canvas scrolls vertically.
  return Math.max(0, pct);
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
  // Y can extend past the initial viewport — the canvas scrolls. We
  // still bound it so corrupted state can't claim absurd positions.
  if (yPct > MAX_Y_PCT) return false;
  if (yPct + hPct > MAX_Y_PCT + 1 + MAX_GEOMETRY_OVERFLOW) return false;
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
  // Y is intentionally not clamped against the canvas bottom — the
  // workspace canvas grows vertically to fit the lowest widget, so a
  // user can drag a widget past the initial viewport and the page
  // scrolls down.
  const y = Math.max(0, reqY);
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

/** Snap a widget's percentage geometry to the canvas grid so its
 *  pixel rect lands exactly on `CANVAS_SNAP_PX` multiples. Used at
 *  seed time and on hydration so every widget — not just the ones
 *  the user drags or resizes — visually aligns with the backdrop
 *  dot grid. */
export function snapWidgetGeometry(
  widget: WidgetInstance,
  canvas: CanvasSize,
): WidgetInstance {
  if (!isCanvasReady(canvas)) return widget;
  const raw = geometryToRect(widget, canvas);
  const minW = widget.minWPx ?? DEFAULT_MIN_W_PX;
  const minH = widget.minHPx ?? DEFAULT_MIN_H_PX;
  // Adaptive snap per axis: each dimension is divided into an
  // integer number of rows/cols close to `CANVAS_SNAP_PX`, so a
  // widget whose stored geometry reaches the canvas edge (e.g.
  // hPct=1.0 or a bottom dock at yPct=0.66 + hPct=0.34) snaps
  // exactly to `canvas.height`. Without this, fixed 32-px snapping
  // rounded past the edge and left a visible scroll gap on load.
  const snapX = resolveAdaptiveSnap(canvas.width);
  const snapY = resolveAdaptiveSnap(canvas.height);
  const snapped: PixelRect = {
    x: snapPxTo(raw.x, snapX),
    y: snapPxTo(raw.y, snapY),
    w: Math.max(snapPxTo(raw.w, snapX), Math.ceil(minW / snapX) * snapX),
    h: Math.max(snapPxTo(raw.h, snapY), Math.ceil(minH / snapY) * snapY),
  };
  const clamped = clampRectToCanvas(snapped, canvas, minW, minH);
  return {
    ...widget,
    ...rectToPctGeometry(clamped, canvas),
  };
}
