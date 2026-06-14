"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GridLayout, useContainerWidth } from "react-grid-layout";

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
  GRID_COLS,
  GRID_ROW_HEIGHT_PX,
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

function buildDefault(workspaceId: WorkspaceId): WidgetInstance[] {
  return defaultWidgetsFor(workspaceId).map((d) => {
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

/** Find the next available `(x, y)` for a widget of width `w`. Simple
 *  bottom-of-current-layout placement — react-grid-layout will then
 *  let the user drag it anywhere. */
function placeAtBottom(existing: WidgetInstance[]): { x: number; y: number } {
  if (existing.length === 0) return { x: 0, y: 0 };
  const maxY = Math.max(...existing.map((wi) => wi.y + wi.h));
  return { x: 0, y: maxY };
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
  const [hydrated, setHydrated] = useState(false);
  const { width: containerWidth, containerRef } = useContainerWidth();

  // Hydrate on mount + when wallet changes. Microtask-defer the
  // setState pair to satisfy `react-hooks/set-state-in-effect`.
  useEffect(() => {
    pruneExpiredLayouts();
    const stored = loadWorkspaceLayout(walletKey, workspaceId);
    const next = stored ? stored.widgets : buildDefault(workspaceId);
    Promise.resolve().then(() => {
      setWidgets(next);
      setHydrated(true);
    });
  }, [walletKey, workspaceId]);

  const persist = useCallback(
    (next: WidgetInstance[]) => {
      saveWorkspaceLayout(walletKey, workspaceId, next);
    },
    [walletKey, workspaceId],
  );

  const addWidget = useCallback(
    (type: WidgetType) => {
      setWidgets((prev) => {
        const cur = prev ?? [];
        const def = WIDGET_REGISTRY[type];
        const { x, y } = placeAtBottom(cur);
        const next: WidgetInstance[] = [
          ...cur,
          {
            id: newId(),
            type,
            x,
            y,
            w: def.defaultW,
            h: def.defaultH,
            minW: def.minW,
            minH: def.minH,
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
        // If nothing changed coordinate-wise, skip persist.
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
        persist(merged);
        return merged;
      });
    },
    [persist],
  );

  // Register with the bridge so the navbar `Widget` button can target
  // this workspace. The bridge dedupes via the cleanup it returns.
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

  return (
    <SelectedOptionProvider>
      <div
        data-testid={`workspace-${workspaceId}`}
        data-wallet-key={walletKey}
        data-workspace-title={title}
        data-workspace-subtitle={subtitle ?? ""}
        className="flex h-full min-h-0 w-full flex-col"
      >
        {widgets.length === 0 ? (
          <div
            data-testid={`workspace-empty-${workspaceId}`}
            className="grid flex-1 place-items-center rounded border border-dashed border-zinc-800 bg-zinc-950 p-8 text-center text-[11px] text-zinc-500"
            style={{
              backgroundImage:
                "radial-gradient(rgb(24 24 27) 1px, transparent 1px)",
              backgroundSize: "12px 12px",
            }}
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
            className="min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto"
          >
            {containerWidth > 0 ? (
              <GridLayout
                className="layout"
                layout={rglLayout}
                width={containerWidth}
                gridConfig={{
                  cols: GRID_COLS,
                  rowHeight: GRID_ROW_HEIGHT_PX,
                  margin: [4, 4],
                  containerPadding: [0, 0],
                }}
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
