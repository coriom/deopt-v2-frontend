"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GridLayout, noCompactor, useContainerWidth } from "react-grid-layout";

interface RGLItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

import { useWallet } from "@/lib/wallet";
import {
  computeCellWidth,
  computeCols,
  GRID_ITEM_MARGIN_PX,
  GRID_MAX_COLS,
  GRID_MIN_COLS,
  GRID_ROW_HEIGHT_PX,
  GRID_TARGET_CELL_PX,
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

function newId(): string {
  return `w-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function buildDefault(workspaceId: WorkspaceId, cols: number): WidgetInstance[] {
  return defaultWidgetsFor(workspaceId, cols).map((d) => {
    const def = WIDGET_REGISTRY[d.type];
    return {
      id: newId(),
      type: d.type,
      x: d.x,
      y: d.y,
      w: d.w,
      h: d.h,
      minW: def.minW,
      minH: def.minH,
    };
  });
}

function placeAtBottom(existing: WidgetInstance[]): { x: number; y: number } {
  if (existing.length === 0) return { x: 0, y: 0 };
  const maxY = Math.max(...existing.map((wi) => wi.y + wi.h));
  return { x: 0, y: maxY };
}

/** Rescale a stored layout to a new column count. Preserves user
 *  proportions (`x' = round(x * new/old)`, `w' = round(w * new/old)`)
 *  and clamps so `x + w <= newCols`. Heights are unchanged. */
function rescaleLayout(
  widgets: WidgetInstance[],
  oldCols: number,
  newCols: number,
): WidgetInstance[] {
  if (oldCols <= 0 || newCols <= 0 || oldCols === newCols) return widgets;
  const k = newCols / oldCols;
  return widgets.map((w) => {
    const minW = w.minW ?? 1;
    const scaledX = Math.max(0, Math.round(w.x * k));
    const scaledW = Math.max(minW, Math.round(w.w * k));
    const clampedW = Math.min(scaledW, newCols);
    const clampedX = Math.min(scaledX, Math.max(0, newCols - clampedW));
    return { ...w, x: clampedX, w: clampedW };
  });
}

interface WorkspaceProps {
  workspaceId: WorkspaceId;
  title: string;
  subtitle?: string;
}

export function Workspace({ workspaceId, title, subtitle }: WorkspaceProps) {
  const { address } = useWallet();
  const walletKey = useMemo(() => walletKeyFor(address), [address]);
  const [widgets, setWidgets] = useState<WidgetInstance[] | null>(null);
  const [storedCols, setStoredCols] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { width: containerWidth, containerRef } = useContainerWidth();

  // Adaptive cols + cell width are derived from the measured container.
  const cols = useMemo(() => computeCols(containerWidth), [containerWidth]);
  const cellWidth = useMemo(
    () => computeCellWidth(containerWidth, cols),
    [containerWidth, cols],
  );

  // Hydrate on mount + when wallet changes. Microtask-defer the
  // setState pair to satisfy `react-hooks/set-state-in-effect`.
  useEffect(() => {
    pruneExpiredLayouts();
    const stored = loadWorkspaceLayout(walletKey, workspaceId);
    const initialCols = stored?.cols ?? cols;
    const next = stored
      ? stored.widgets
      : buildDefault(workspaceId, initialCols);
    Promise.resolve().then(() => {
      setWidgets(next);
      setStoredCols(initialCols);
      setHydrated(true);
    });
    // Intentionally NOT depending on `cols` — we want to rescale via
    // the next effect rather than re-hydrate on every viewport change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletKey, workspaceId]);

  // Rescale on cols change.
  useEffect(() => {
    if (!hydrated) return;
    if (widgets === null) return;
    if (storedCols === null) return;
    if (storedCols === cols) return;
    const rescaled = rescaleLayout(widgets, storedCols, cols);
    Promise.resolve().then(() => {
      setWidgets(rescaled);
      setStoredCols(cols);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, hydrated]);

  const persist = useCallback(
    (next: WidgetInstance[], colsAtSave: number) => {
      saveWorkspaceLayout(walletKey, workspaceId, next, colsAtSave);
    },
    [walletKey, workspaceId],
  );

  const addWidget = useCallback(
    (type: WidgetType) => {
      setWidgets((prev) => {
        const cur = prev ?? [];
        const def = WIDGET_REGISTRY[type];
        const { x, y } = placeAtBottom(cur);
        // Cap default w to cols so new widget always fits the canvas.
        const w = Math.min(def.defaultW, cols);
        const next: WidgetInstance[] = [
          ...cur,
          {
            id: newId(),
            type,
            x: Math.min(x, Math.max(0, cols - w)),
            y,
            w,
            h: def.defaultH,
            minW: def.minW,
            minH: def.minH,
          },
        ];
        persist(next, cols);
        return next;
      });
    },
    [persist, cols],
  );

  const removeWidget = useCallback(
    (id: string) => {
      setWidgets((prev) => {
        if (!prev) return prev;
        const next = prev.filter((w) => w.id !== id);
        persist(next, cols);
        return next;
      });
    },
    [persist, cols],
  );

  const onLayoutChange = useCallback(
    (next: ReadonlyArray<RGLItem>) => {
      setWidgets((prev) => {
        if (!prev) return prev;
        const byId = new Map(prev.map((w) => [w.id, w]));
        const merged: WidgetInstance[] = next
          .map((l) => {
            const w = byId.get(l.i);
            if (!w) return null;
            if (w.x === l.x && w.y === l.y && w.w === l.w && w.h === l.h) {
              return w;
            }
            return { ...w, x: l.x, y: l.y, w: l.w, h: l.h };
          })
          .filter((x): x is WidgetInstance => x !== null);
        const changed = merged.some(
          (m, i) =>
            !prev[i] ||
            prev[i].id !== m.id ||
            prev[i].x !== m.x ||
            prev[i].y !== m.y ||
            prev[i].w !== m.w ||
            prev[i].h !== m.h,
        );
        if (!changed) return prev;
        persist(merged, cols);
        return merged;
      });
    },
    [persist, cols],
  );

  const bridgeHandle = useMemo(
    () => ({ workspaceId, addWidget }),
    [workspaceId, addWidget],
  );
  useRegisterWorkspace(bridgeHandle);

  if (!hydrated || widgets === null) {
    return (
      <div
        data-testid={`workspace-loading-${workspaceId}`}
        className="rounded border border-zinc-800 bg-zinc-950 p-3 text-[11px] text-zinc-500"
      >
        Loading workspace…
      </div>
    );
  }

  const rglLayout: RGLItem[] = widgets.map((w) => ({
    i: w.id,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
    minW: w.minW,
    minH: w.minH,
  }));

  // CSS variables drive the visible-grid backdrop so the dot spacing
  // tracks RGL's actual cell size 1-to-1. The backdrop only renders
  // when we have a real measurement; otherwise we hide it to avoid
  // a flash of mis-spaced dots on first paint.
  const showBackdrop = containerWidth > 0 && cellWidth > 0;
  const cellStyle = showBackdrop
    ? ({
        "--workspace-cell-width": `${cellWidth + GRID_ITEM_MARGIN_PX}px`,
        "--workspace-row-height": `${GRID_ROW_HEIGHT_PX + GRID_ITEM_MARGIN_PX}px`,
        backgroundImage:
          "radial-gradient(circle, rgba(110, 231, 183, 0.10) 1px, transparent 1px)",
        backgroundSize:
          "var(--workspace-cell-width) var(--workspace-row-height)",
        backgroundPosition: `${GRID_ITEM_MARGIN_PX}px ${GRID_ITEM_MARGIN_PX}px`,
      } as React.CSSProperties)
    : undefined;

  return (
    <SelectedOptionProvider>
      <div
        data-testid={`workspace-${workspaceId}`}
        data-wallet-key={walletKey}
        data-workspace-title={title}
        data-workspace-subtitle={subtitle ?? ""}
        data-grid-cols={cols}
        data-container-width={containerWidth}
        data-cell-width={Math.round(cellWidth)}
        data-grid-min-cols={GRID_MIN_COLS}
        data-grid-max-cols={GRID_MAX_COLS}
        data-grid-target-cell-px={GRID_TARGET_CELL_PX}
        className="flex h-full min-h-0 w-full flex-col overflow-y-auto overflow-x-hidden"
        style={{ scrollbarGutter: "stable" }}
      >
        {widgets.length === 0 ? (
          <div
            data-testid={`workspace-empty-${workspaceId}`}
            className="grid flex-1 place-items-center rounded border border-dashed border-zinc-800 bg-zinc-950 p-8 text-center text-[11px] text-zinc-500"
            style={cellStyle}
          >
            <div className="flex flex-col gap-2">
              <span>This workspace is empty.</span>
              <span className="text-zinc-600">
                Open the{" "}
                <strong className="text-emerald-300">Widget</strong> button in
                the top navbar to add a widget. Suggested:{" "}
                <span className="text-zinc-400">
                  Options chain · Trade · detail · Account dock · Docs ·
                  Feedback
                </span>
                .
              </span>
            </div>
          </div>
        ) : (
          <div
            data-testid={`workspace-grid-${workspaceId}`}
            ref={containerRef}
            className="w-full"
            style={cellStyle}
          >
            {containerWidth > 0 ? (
              <GridLayout
                className="layout"
                layout={rglLayout}
                width={containerWidth}
                gridConfig={{
                  cols,
                  rowHeight: GRID_ROW_HEIGHT_PX,
                  margin: [GRID_ITEM_MARGIN_PX, GRID_ITEM_MARGIN_PX],
                  containerPadding: [0, 0],
                }}
                compactor={noCompactor}
                dragConfig={{
                  enabled: true,
                  handle: ".deopt-widget-drag-handle",
                  cancel: "button",
                }}
                resizeConfig={{ enabled: true }}
                onLayoutChange={onLayoutChange}
              >
                {widgets.map((w) => {
                  const def = WIDGET_REGISTRY[w.type];
                  if (!def) return <div key={w.id} />;
                  return (
                    <div key={w.id}>
                      <WidgetFrame
                        instance={w}
                        def={def}
                        onRemove={() => removeWidget(w.id)}
                      />
                    </div>
                  );
                })}
              </GridLayout>
            ) : null}
          </div>
        )}
      </div>
    </SelectedOptionProvider>
  );
}
