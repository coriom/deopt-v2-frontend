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
  resolveWidgetRect,
  snapPx,
  type CanvasSize,
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
  const maxBottom = rects.reduce((m, e) => Math.max(m, e.y + e.h), 0);
  return {
    xPct: 0,
    yPct: Math.min(1 - hPct, maxBottom / Math.max(1, canvas.height)),
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
        const next: WidgetInstance[] = [
          ...cur,
          {
            id: newId(),
            type,
            xPct: slot.xPct,
            yPct: slot.yPct,
            wPct: slot.wPct,
            hPct: slot.hPct,
            minWPx: def.minWPx,
            minHPx: def.minHPx,
          },
        ];
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
    let nextRect = { ...drag.startRectPx };
    if (drag.kind === "move") {
      nextRect = {
        ...drag.startRectPx,
        x: snapPx(drag.startRectPx.x + dx),
        y: snapPx(drag.startRectPx.y + dy),
      };
    } else {
      nextRect = {
        ...drag.startRectPx,
        w: snapPx(drag.startRectPx.w + dx),
        h: snapPx(drag.startRectPx.h + dy),
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
      if (prev) persist(prev);
      return prev;
    });
  }, [persist]);

  const bridgeHandle = useMemo(
    () => ({ workspaceId, addWidget }),
    [workspaceId, addWidget],
  );
  useRegisterWorkspace(bridgeHandle);

  const ready = isCanvasReady(canvasSize);
  const renderWidgets = hydrated && widgets !== null && ready;

  const backdropStyle: React.CSSProperties = ready
    ? {
        backgroundImage:
          "radial-gradient(circle, rgba(110, 231, 183, 0.10) 1px, transparent 1px)",
        backgroundSize: `${CANVAS_SNAP_PX}px ${CANVAS_SNAP_PX}px`,
        backgroundPosition: "0 0",
      }
    : {};

  return (
    <SelectedOptionProvider>
      <div
        data-testid={`workspace-${workspaceId}`}
        data-wallet-key={walletKey}
        data-workspace-title={title}
        data-workspace-subtitle={subtitle ?? ""}
        className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
      >
        <div
          ref={canvasRef}
          data-testid={`workspace-canvas-${workspaceId}`}
          data-canvas-width={Math.round(canvasSize.width)}
          data-canvas-height={Math.round(canvasSize.height)}
          data-canvas-snap-px={CANVAS_SNAP_PX}
          data-canvas-ready={ready ? "true" : "false"}
          data-hydrated={hydrated ? "true" : "false"}
          data-widget-count={widgets?.length ?? 0}
          className="relative h-full w-full"
          style={backdropStyle}
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
                const rect = resolveWidgetRect(w, canvasSize);
                const isDragging = dragId === w.id;
                return (
                  <div
                    key={w.id}
                    data-testid={`widget-container-${w.id}`}
                    data-widget-type={w.type}
                    data-x-pct={w.xPct.toFixed(4)}
                    data-y-pct={w.yPct.toFixed(4)}
                    data-w-pct={w.wPct.toFixed(4)}
                    data-h-pct={w.hPct.toFixed(4)}
                    className="absolute"
                    style={{
                      left: `${rect.x}px`,
                      top: `${rect.y}px`,
                      width: `${rect.w}px`,
                      height: `${rect.h}px`,
                      zIndex: isDragging ? 30 : 10,
                      willChange: isDragging
                        ? "left, top, width, height"
                        : undefined,
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
