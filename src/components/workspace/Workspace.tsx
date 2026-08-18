"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useWallet } from "@/lib/wallet";
import {
  CANVAS_SNAP_PX,
  DEFAULT_MIN_H_PX,
  DEFAULT_MIN_W_PX,
  MIN_CANVAS_HEIGHT_PX,
  MIN_CANVAS_WIDTH_PX,
  clampRectToCanvas,
  geometryToRect,
  isCanvasReady,
  rectToPctGeometry,
  resolveAdaptiveSnap,
  resolveWidgetRect,
  snapWidgetGeometry,
  type CanvasSize,
  type PixelRect,
  type WidgetInstance,
  type WidgetType,
  type WorkspaceId,
} from "@/lib/workspace-types";
import {
  loadWorkspaceLayout,
  pruneExpiredLayouts,
  saveWorkspaceLayout,
  walletKeyFor,
} from "@/lib/workspace-storage";
import { SelectedOptionProvider } from "@/lib/workspace-selected-option";
import { useRegisterWorkspace } from "@/lib/workspace-bridge";
import { defaultWidgetsFor, WIDGET_REGISTRY } from "./registry";
import { WidgetFrame } from "./WidgetFrame";

interface WorkspaceProps {
  workspaceId: WorkspaceId;
  title: string;
  subtitle?: string;
}

function newId(): string {
  return `w-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

type DragKind = "move" | "resize";

interface DragState {
  kind: DragKind;
  id: string;
  startPointerX: number;
  startPointerY: number;
  startRectPx: { x: number; y: number; w: number; h: number };
  pointerId: number;
  minWPx: number;
  minHPx: number;
}

/**
 * Compute a snap-style overlap preview for the widget currently being
 * dragged. If the dragged widget visually intrudes into exactly one
 * other widget's bounding box, we propose a "shrunk" rect for that
 * obstacle along the axis with the smallest intrusion — exactly how
 * Derive's workspace handles the same gesture.
 *
 * Returns:
 *   - `obstacleId` + `obstacleRect`: the displaced obstacle, rendered
 *     during drag so the user previews the resize visually
 *   - `valid`: false when the shrunk obstacle would fall below its min
 *     size OR when more than one widget would be displaced. The drag
 *     handler converts an invalid preview into a revert on release.
 */
interface OverlapPreview {
  obstacleId: string;
  obstacleRectPx: PixelRect;
  valid: boolean;
}
function computeOverlapPreview(
  widgets: WidgetInstance[],
  draggedId: string,
  canvas: CanvasSize,
): OverlapPreview | null {
  if (!isCanvasReady(canvas)) return null;
  const dragged = widgets.find((w) => w.id === draggedId);
  if (!dragged) return null;
  const dr = resolveWidgetRect(dragged, canvas);
  let hit: { id: string; rect: PixelRect; minW: number; minH: number } | null = null;
  for (const w of widgets) {
    if (w.id === draggedId) continue;
    const wr = resolveWidgetRect(w, canvas);
    const overlapX =
      Math.min(dr.x + dr.w, wr.x + wr.w) - Math.max(dr.x, wr.x);
    const overlapY =
      Math.min(dr.y + dr.h, wr.y + wr.h) - Math.max(dr.y, wr.y);
    if (overlapX <= 0 || overlapY <= 0) continue;
    if (hit) {
      // Two simultaneous obstacles — too complex to resolve in V1,
      // mark invalid so the drop is rejected.
      return {
        obstacleId: hit.id,
        obstacleRectPx: hit.rect,
        valid: false,
      };
    }
    hit = {
      id: w.id,
      rect: wr,
      minW: w.minWPx ?? DEFAULT_MIN_W_PX,
      minH: w.minHPx ?? DEFAULT_MIN_H_PX,
    };
  }
  if (!hit) return null;

  const wr = hit.rect;
  const overlapX = Math.min(dr.x + dr.w, wr.x + wr.w) - Math.max(dr.x, wr.x);
  const overlapY = Math.min(dr.y + dr.h, wr.y + wr.h) - Math.max(dr.y, wr.y);
  const draggedCenterX = dr.x + dr.w / 2;
  const draggedCenterY = dr.y + dr.h / 2;
  const obstacleCenterX = wr.x + wr.w / 2;
  const obstacleCenterY = wr.y + wr.h / 2;

  let shrunk: PixelRect;
  let valid: boolean;
  if (overlapX <= overlapY) {
    // Push horizontally — shrink obstacle on the side the dragged
    // widget is pushing from.
    if (draggedCenterX < obstacleCenterX) {
      shrunk = {
        x: dr.x + dr.w,
        y: wr.y,
        w: wr.x + wr.w - (dr.x + dr.w),
        h: wr.h,
      };
    } else {
      shrunk = {
        x: wr.x,
        y: wr.y,
        w: dr.x - wr.x,
        h: wr.h,
      };
    }
    valid = shrunk.w >= hit.minW;
  } else {
    if (draggedCenterY < obstacleCenterY) {
      shrunk = {
        x: wr.x,
        y: dr.y + dr.h,
        w: wr.w,
        h: wr.y + wr.h - (dr.y + dr.h),
      };
    } else {
      shrunk = {
        x: wr.x,
        y: wr.y,
        w: wr.w,
        h: dr.y - wr.y,
      };
    }
    valid = shrunk.h >= hit.minH;
  }
  return { obstacleId: hit.id, obstacleRectPx: shrunk, valid };
}

function findFreeSlot(
  existing: WidgetInstance[],
  canvas: CanvasSize,
  defaultWPct: number,
  defaultHPct: number,
): { xPct: number; yPct: number; wPct: number; hPct: number } {
  const wPct = Math.min(defaultWPct, 1);
  const hPct = Math.min(defaultHPct, 1);
  if (!isCanvasReady(canvas)) {
    return { xPct: 0, yPct: 0, wPct, hPct };
  }
  const wPx = wPct * canvas.width;
  const hPx = hPct * canvas.height;
  const stepX = Math.max(CANVAS_SNAP_PX, Math.floor(wPx / 4));
  const stepY = Math.max(CANVAS_SNAP_PX, Math.floor(hPx / 4));
  const rects = existing.map((w) => geometryToRect(w, canvas));
  for (let y = 0; y + hPx <= canvas.height; y += stepY) {
    for (let x = 0; x + wPx <= canvas.width; x += stepX) {
      const overlap = rects.some(
        (e) => x < e.x + e.w && x + wPx > e.x && y < e.y + e.h && y + hPx > e.y,
      );
      if (!overlap) {
        return { xPct: x / canvas.width, yPct: y / canvas.height, wPct, hPct };
      }
    }
  }
  // No free slot inside the viewport — drop the new widget on the
  // next row below the lowest existing widget. The canvas grows
  // vertically and the wrapper scrolls.
  const maxBottom = rects.reduce((m, e) => Math.max(m, e.y + e.h), 0);
  return {
    xPct: 0,
    yPct: maxBottom / Math.max(1, canvas.height),
    wPct,
    hPct,
  };
}

export function Workspace({ workspaceId, title, subtitle }: WorkspaceProps) {
  const { address } = useWallet();
  const walletKey = useMemo(() => walletKeyFor(address), [address]);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const canvasSizeRef = useRef<CanvasSize>({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [widgets, setWidgets] = useState<WidgetInstance[] | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    canvasSizeRef.current = canvasSize;
  }, [canvasSize]);

  // Measure the canvas BEFORE first paint via useLayoutEffect, and
  // keep measuring via ResizeObserver. The canvas div is always
  // rendered (no `hydrated` gate) so the ref attaches on the very
  // first paint and there is no "render before measurement" window.
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Hydrate from storage on mount + when wallet changes. Loaded
  // layouts have already passed strict validation in `loadBucket()` —
  // invalid layouts have been pruned and we fall back to defaults.
  useEffect(() => {
    pruneExpiredLayouts();
    const stored = loadWorkspaceLayout(walletKey, workspaceId);
    const next: WidgetInstance[] = stored
      ? stored.widgets
      : defaultWidgetsFor(workspaceId).map((d) => {
          const def = WIDGET_REGISTRY[d.type];
          return {
            id: newId(),
            type: d.type,
            xPct: d.xPct,
            yPct: d.yPct,
            wPct: d.wPct,
            hPct: d.hPct,
            minWPx: def.minWPx,
            minHPx: def.minHPx,
          };
        });
    Promise.resolve().then(() => {
      setWidgets(next);
      setHydrated(true);
    });
  }, [walletKey, workspaceId]);

  // Snap pass — runs once the canvas is measured. Aligns every widget
  // (seed positions + stored layouts that pre-date the snap step)
  // onto the `CANVAS_SNAP_PX` grid so widget edges land exactly on
  // the dot backdrop. No-op when nothing actually moved.
  useEffect(() => {
    if (!hydrated || !widgets) return;
    if (!isCanvasReady(canvasSize)) return;
    let changed = false;
    const snapped = widgets.map((w) => {
      const next = snapWidgetGeometry(w, canvasSize);
      if (
        next.xPct !== w.xPct ||
        next.yPct !== w.yPct ||
        next.wPct !== w.wPct ||
        next.hPct !== w.hPct
      ) {
        changed = true;
      }
      return next;
    });
    if (changed) {
      setWidgets(snapped);
      // Persist the snapped layout so the next reload skips the
      // re-snap pass.
      const c = canvasSize;
      if (isCanvasReady(c)) {
        saveWorkspaceLayout(walletKey, workspaceId, snapped, c.width, c.height);
      }
    }
    // We deliberately don't depend on `widgets` here — only on the
    // hydration moment and the canvas size. Re-running on every
    // widget mutation would loop forever (drag → snap → drag).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, canvasSize.width, canvasSize.height, walletKey, workspaceId]);

  const persist = useCallback(
    (next: WidgetInstance[]) => {
      const c = canvasSizeRef.current;
      // `saveWorkspaceLayout` itself refuses to persist when the
      // canvas is still measuring, so this is a defence in depth.
      if (!isCanvasReady(c)) return;
      saveWorkspaceLayout(walletKey, workspaceId, next, c.width, c.height);
    },
    [walletKey, workspaceId],
  );

  const addWidget = useCallback(
    (type: WidgetType) => {
      setWidgets((prev) => {
        const cur = prev ?? [];
        const def = WIDGET_REGISTRY[type];
        const c = canvasSizeRef.current;
        const slot = findFreeSlot(cur, c, def.defaultWPct, def.defaultHPct);
        const raw: WidgetInstance = {
          id: newId(),
          type,
          xPct: slot.xPct,
          yPct: slot.yPct,
          wPct: slot.wPct,
          hPct: slot.hPct,
          minWPx: def.minWPx,
          minHPx: def.minHPx,
        };
        const next: WidgetInstance[] = [...cur, snapWidgetGeometry(raw, c)];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const removeWidget = useCallback(
    (id: string) => {
      setWidgets((prev) => {
        if (!prev) return prev;
        const next = prev.filter((w) => w.id !== id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const beginDrag = useCallback(
    (kind: DragKind, widget: WidgetInstance, e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      const c = canvasSizeRef.current;
      if (!isCanvasReady(c)) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = resolveWidgetRect(widget, c);
      dragRef.current = {
        kind,
        id: widget.id,
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        startRectPx: rect,
        pointerId: e.pointerId,
        minWPx: widget.minWPx ?? DEFAULT_MIN_W_PX,
        minHPx: widget.minHPx ?? DEFAULT_MIN_H_PX,
      };
      setDragId(widget.id);
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        // ignore — pointer capture is best-effort.
      }
    },
    [],
  );

  const onPointerMoveCanvas = useCallback((e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (e.pointerId !== drag.pointerId) return;
    const c = canvasSizeRef.current;
    if (!isCanvasReady(c)) return;
    const dx = e.clientX - drag.startPointerX;
    const dy = e.clientY - drag.startPointerY;
    // During the drag the widget follows the pointer pixel-by-pixel.
    // We only snap on `endDrag` so movement feels fluid. The visible
    // dot grid still acts as a reference; the widget eases onto the
    // nearest snap position once the user releases.
    let nextRect = { ...drag.startRectPx };
    if (drag.kind === "move") {
      nextRect = {
        ...drag.startRectPx,
        x: drag.startRectPx.x + dx,
        y: drag.startRectPx.y + dy,
      };
    } else {
      nextRect = {
        ...drag.startRectPx,
        w: drag.startRectPx.w + dx,
        h: drag.startRectPx.h + dy,
      };
    }
    nextRect = clampRectToCanvas(nextRect, c, drag.minWPx, drag.minHPx);
    const geom = rectToPctGeometry(nextRect, c);
    setWidgets((prev) => {
      if (!prev) return prev;
      const idx = prev.findIndex((w) => w.id === drag.id);
      if (idx === -1) return prev;
      const cur = prev[idx];
      if (
        cur.xPct === geom.xPct &&
        cur.yPct === geom.yPct &&
        cur.wPct === geom.wPct &&
        cur.hPct === geom.hPct
      ) {
        return prev;
      }
      // Overlap is allowed during the drag — the render pass detects
      // it, shows a preview where the obstacle would be displaced,
      // and `endDrag` either commits the auto-resize or reverts the
      // whole gesture if it's not a viable resolution.
      const next = prev.slice();
      next[idx] = { ...cur, ...geom };
      return next;
    });
  }, []);

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setDragId(null);
    setWidgets((prev) => {
      if (!prev) return prev;
      const c = canvasSizeRef.current;
      const idx = prev.findIndex((w) => w.id === drag.id);
      if (idx === -1 || !isCanvasReady(c)) {
        persist(prev);
        return prev;
      }
      const preview = computeOverlapPreview(prev, drag.id, c);

      // Invalid overlap → revert the whole gesture. The dragged widget
      // returns to its starting rect; the obstacle was never mutated
      // in state, only previewed.
      if (preview && !preview.valid) {
        const reverted: WidgetInstance = {
          ...prev[idx],
          ...rectToPctGeometry(drag.startRectPx, c),
        };
        const next = prev.slice();
        next[idx] = reverted;
        persist(next);
        return next;
      }

      // Valid overlap → commit both the dragged widget AND the shrunk
      // obstacle. We snap both to the grid before persisting.
      if (preview && preview.valid) {
        const snappedDragged = snapWidgetGeometry(prev[idx], c);
        const obstacleIdx = prev.findIndex((w) => w.id === preview.obstacleId);
        const next = prev.slice();
        next[idx] = snappedDragged;
        if (obstacleIdx !== -1) {
          const obstacle = prev[obstacleIdx];
          const draftObstacle: WidgetInstance = {
            ...obstacle,
            ...rectToPctGeometry(preview.obstacleRectPx, c),
          };
          next[obstacleIdx] = snapWidgetGeometry(draftObstacle, c);
        }
        persist(next);
        return next;
      }

      // No overlap → Phase 1 behaviour: snap the dragged widget on
      // release, re-check overlap after snap as a safety net.
      const snapped = snapWidgetGeometry(prev[idx], c);
      const snappedRect = resolveWidgetRect(snapped, c);
      const overlapAfterSnap = prev.some((w, i) => {
        if (i === idx) return false;
        const o = resolveWidgetRect(w, c);
        return (
          snappedRect.x < o.x + o.w &&
          snappedRect.x + snappedRect.w > o.x &&
          snappedRect.y < o.y + o.h &&
          snappedRect.y + snappedRect.h > o.y
        );
      });
      const next = prev.slice();
      next[idx] = overlapAfterSnap ? prev[idx] : snapped;
      persist(next);
      return next;
    });
  }, [persist]);

  const resetLayout = useCallback(() => {
    const c = canvasSizeRef.current;
    const seeded: WidgetInstance[] = defaultWidgetsFor(workspaceId).map((d) => {
      const def = WIDGET_REGISTRY[d.type];
      const raw: WidgetInstance = {
        id: newId(),
        type: d.type,
        xPct: d.xPct,
        yPct: d.yPct,
        wPct: d.wPct,
        hPct: d.hPct,
        minWPx: def.minWPx,
        minHPx: def.minHPx,
      };
      return snapWidgetGeometry(raw, c);
    });
    setWidgets(seeded);
    persist(seeded);
  }, [workspaceId, persist]);

  const bridgeHandle = useMemo(
    () => ({ workspaceId, addWidget, resetLayout }),
    [workspaceId, addWidget, resetLayout],
  );
  useRegisterWorkspace(bridgeHandle);

  const ready = isCanvasReady(canvasSize);
  const renderWidgets = hydrated && widgets !== null && ready;

  // Derive-style snap-to-grid backdrop: emerald dots sitting exactly
  // on the snap positions. `radial-gradient(circle, ...)` centers
  // each dot in the middle of its tile by default, so we shift the
  // background by `-SNAP/2` on both axes to land the dot centers on
  // the widget snap grid instead of in between.
  //
  // The tile size uses the same canvas-adaptive snap as widget
  // placement (`resolveAdaptiveSnap`), so a canvas whose height /
  // width isn't a perfect multiple of the ideal 32-px step still
  // produces integer rows / columns that reach the canvas edge
  // exactly. Widgets snapped with `snapWidgetGeometry` now land
  // precisely on these dots — no visible drift.
  const backdropSnapX = ready ? resolveAdaptiveSnap(canvasSize.width) : CANVAS_SNAP_PX;
  const backdropSnapY = ready ? resolveAdaptiveSnap(canvasSize.height) : CANVAS_SNAP_PX;
  const backdropStyle: React.CSSProperties = ready
    ? {
        backgroundImage:
          "radial-gradient(circle, rgba(110, 231, 183, 0.22) 1px, transparent 1.4px)",
        backgroundSize: `${backdropSnapX}px ${backdropSnapY}px`,
        backgroundPosition: `-${backdropSnapX / 2}px -${backdropSnapY / 2}px`,
      }
    : {};

  // Virtual canvas height — grows to fit the lowest widget so the
  // workspace can scroll vertically beyond the initial viewport.
  // `canvasRef` is now attached to the SCROLLING wrapper (which is
  // what we measure for percentage math); the inner canvas div gets a
  // computed pixel height that extends below the viewport when widgets
  // are placed there.
  const virtualHeightPx = useMemo(() => {
    const baseline = canvasSize.height;
    if (!widgets || baseline <= 0) return baseline;
    let lowestBottom = 0;
    for (const w of widgets) {
      const r = resolveWidgetRect(w, canvasSize);
      if (r.y + r.h > lowestBottom) lowestBottom = r.y + r.h;
    }
    // A layout that already fits within the viewport (widgets summing
    // to `baseline` or less) does NOT need extra virtual height — the
    // default perps + options layouts fill the canvas exactly, and
    // adding a scroll buffer here left a ~128px black band below the
    // widgets on every page load. Only reserve the drop-buffer when
    // the user has already dragged a widget past the baseline; then
    // the buffer lets them drop the next one below without hitting
    // the edge.
    if (lowestBottom <= baseline) return baseline;
    const buffer = CANVAS_SNAP_PX * 4;
    return lowestBottom + buffer;
  }, [widgets, canvasSize]);

  // Overlap preview (Phase 2) — while a drag is in flight, propose a
  // shrunk rect for any obstacle the dragged widget pushes against.
  // `null` when nothing is being dragged or there is no overlap.
  const overlapPreview = useMemo<OverlapPreview | null>(() => {
    if (!dragId || !widgets) return null;
    return computeOverlapPreview(widgets, dragId, canvasSize);
  }, [dragId, widgets, canvasSize]);

  return (
    <SelectedOptionProvider>
      <div
        ref={canvasRef}
        data-testid={`workspace-${workspaceId}`}
        data-wallet-key={walletKey}
        data-workspace-title={title}
        data-workspace-subtitle={subtitle ?? ""}
        className="deopt-scroll-dark relative flex h-full min-h-0 w-full flex-col overflow-y-auto overflow-x-hidden"
        // `scrollbar-gutter: stable` reserves space for the vertical
        // scrollbar even when it's not visible, so the canvas inner
        // width stays constant. Without this the rightmost widget's
        // resize handle ends up sitting under the scrollbar gutter
        // and pointer events get hijacked by the browser scrollbar.
        style={{ scrollbarGutter: "stable" }}
      >
        <div
          data-testid={`workspace-canvas-${workspaceId}`}
          data-canvas-width={Math.round(canvasSize.width)}
          data-canvas-height={Math.round(canvasSize.height)}
          data-virtual-height={Math.round(virtualHeightPx)}
          data-canvas-snap-px={CANVAS_SNAP_PX}
          data-canvas-ready={ready ? "true" : "false"}
          data-hydrated={hydrated ? "true" : "false"}
          data-widget-count={widgets?.length ?? 0}
          className="relative w-full"
          style={{
            ...backdropStyle,
            height: ready ? `${virtualHeightPx}px` : "100%",
          }}
          onPointerMove={onPointerMoveCanvas}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {!ready ? (
            <div
              data-testid={`workspace-canvas-measuring-${workspaceId}`}
              className="absolute inset-0 grid place-items-center text-center text-[11px] text-zinc-500"
            >
              <div className="rounded border border-dashed border-zinc-800 bg-zinc-950/70 px-4 py-3">
                {hydrated
                  ? `Workspace canvas needs at least ${MIN_CANVAS_WIDTH_PX}×${MIN_CANVAS_HEIGHT_PX} px.`
                  : "Sizing workspace canvas…"}
              </div>
            </div>
          ) : null}
          {renderWidgets && widgets!.length === 0 ? (
            <div
              data-testid={`workspace-empty-${workspaceId}`}
              className="absolute inset-0 grid place-items-center text-center text-[11px] text-zinc-500"
            >
              <div className="flex flex-col gap-2 rounded border border-dashed border-zinc-800 bg-zinc-950/70 p-6">
                <span>This workspace is empty.</span>
                <span className="text-zinc-600">
                  Open the{" "}
                  <strong className="text-emerald-300">Widget</strong> button
                  in the top navbar to add a widget.
                </span>
              </div>
            </div>
          ) : null}
          {renderWidgets
            ? widgets!.map((w) => {
                const def = WIDGET_REGISTRY[w.type];
                if (!def) return null;
                const isDragging = dragId === w.id;
                const isObstacle =
                  !!overlapPreview && overlapPreview.obstacleId === w.id;
                // During the drag we render the obstacle at the
                // proposed shrunk rect so the user *sees* it making
                // room. Real state isn't touched until endDrag.
                const rect =
                  isObstacle && overlapPreview && overlapPreview.valid
                    ? overlapPreview.obstacleRectPx
                    : resolveWidgetRect(w, canvasSize);
                // Visual indicator boxShadow:
                //   - dragged widget + valid resolution → emerald glow
                //   - dragged widget + invalid resolution → red glow
                //   - obstacle being previewed → emerald dashed inset
                let boxShadow: string | undefined;
                let outline: string | undefined;
                if (isDragging && overlapPreview) {
                  boxShadow = overlapPreview.valid
                    ? "0 0 0 1px rgb(16 185 129 / 0.6)"
                    : "0 0 0 1px rgb(239 68 68 / 0.65)";
                }
                if (isObstacle && overlapPreview && overlapPreview.valid) {
                  outline = "1px dashed rgb(16 185 129 / 0.55)";
                }
                return (
                  <div
                    key={w.id}
                    data-testid={`widget-container-${w.id}`}
                    data-widget-type={w.type}
                    data-x-pct={w.xPct.toFixed(4)}
                    data-y-pct={w.yPct.toFixed(4)}
                    data-w-pct={w.wPct.toFixed(4)}
                    data-h-pct={w.hPct.toFixed(4)}
                    data-overlap-preview={
                      isDragging && overlapPreview
                        ? overlapPreview.valid
                          ? "valid"
                          : "invalid"
                        : isObstacle
                          ? "obstacle"
                          : undefined
                    }
                    className="absolute"
                    style={{
                      left: `${rect.x}px`,
                      top: `${rect.y}px`,
                      width: `${rect.w}px`,
                      height: `${rect.h}px`,
                      zIndex: isDragging ? 30 : isObstacle ? 20 : 10,
                      willChange: isDragging
                        ? "left, top, width, height"
                        : undefined,
                      boxShadow,
                      outline,
                      outlineOffset: outline ? "-1px" : undefined,
                      transition: isDragging
                        ? "none"
                        : "left 120ms ease-out, top 120ms ease-out, width 120ms ease-out, height 120ms ease-out",
                    }}
                  >
                    <WidgetFrame
                      instance={w}
                      def={def}
                      onRemove={() => removeWidget(w.id)}
                      onDragStart={(e) => beginDrag("move", w, e)}
                      onResizeStart={(e) => beginDrag("resize", w, e)}
                    />
                  </div>
                );
              })
            : null}
        </div>
      </div>
    </SelectedOptionProvider>
  );
}
