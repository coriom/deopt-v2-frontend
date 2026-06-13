"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/lib/wallet";
import {
  ANON_WALLET_KEY,
  type WidgetInstance,
  type WidgetSize,
  type WidgetType,
  type WorkspaceId,
} from "@/lib/workspace-types";
import {
  loadWorkspaceLayout,
  pruneExpiredLayouts,
  resetWorkspaceLayout,
  saveWorkspaceLayout,
  walletKeyFor,
} from "@/lib/workspace-storage";
import { SelectedOptionProvider } from "@/lib/workspace-selected-option";
import { defaultWidgetsFor, WIDGET_REGISTRY } from "./registry";
import { WidgetFrame } from "./WidgetFrame";
import { AddWidgetMenu } from "./AddWidgetMenu";

function newId(): string {
  return `w-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function buildDefault(workspaceId: WorkspaceId): WidgetInstance[] {
  return defaultWidgetsFor(workspaceId).map((d) => ({
    id: newId(),
    type: d.type,
    size: d.size,
  }));
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

  // Hydrate on mount + when wallet changes. Microtask-defer the
  // setState so the React Compiler's `set-state-in-effect` check stays
  // green (same pattern used by useSeriesById elsewhere).
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
        const cur = prev ?? buildDefault(workspaceId);
        const next: WidgetInstance[] = [
          ...cur,
          { id: newId(), type, size: WIDGET_REGISTRY[type].defaultSize },
        ];
        persist(next);
        return next;
      });
    },
    [persist, workspaceId],
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

  const resizeWidget = useCallback(
    (id: string, size: WidgetSize) => {
      setWidgets((prev) => {
        if (!prev) return prev;
        const next = prev.map((w) => (w.id === id ? { ...w, size } : w));
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const moveWidget = useCallback(
    (id: string, delta: -1 | 1) => {
      setWidgets((prev) => {
        if (!prev) return prev;
        const idx = prev.findIndex((w) => w.id === id);
        if (idx < 0) return prev;
        const target = idx + delta;
        if (target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[idx], next[target]] = [next[target], next[idx]];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    resetWorkspaceLayout(walletKey, workspaceId);
    const fresh = buildDefault(workspaceId);
    setWidgets(fresh);
  }, [walletKey, workspaceId]);

  const isAnon = walletKey === ANON_WALLET_KEY;

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

  return (
    <SelectedOptionProvider>
      <div
        data-testid={`workspace-${workspaceId}`}
        data-wallet-key={walletKey}
        className="flex flex-col gap-2"
      >
        <header
          data-testid={`workspace-toolbar-${workspaceId}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">
              {title}
            </span>
            {subtitle ? (
              <span className="text-[10px] text-zinc-500">· {subtitle}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {isAnon ? (
              <span
                data-testid="workspace-anon-warning"
                className="rounded border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-200"
              >
                Anonymous layout — temporary. Connect wallet to save longer.
              </span>
            ) : (
              <span
                data-testid="workspace-wallet-badge"
                className="rounded border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-200"
              >
                Saved per wallet
              </span>
            )}
            <AddWidgetMenu workspaceId={workspaceId} onAdd={addWidget} />
            <button
              type="button"
              onClick={reset}
              data-testid="workspace-reset"
              className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
            >
              Reset layout
            </button>
          </div>
        </header>

        {widgets.length === 0 ? (
          <div
            data-testid={`workspace-empty-${workspaceId}`}
            className="grid place-items-center rounded border border-dashed border-zinc-800 bg-zinc-950 p-8 text-center text-[11px] text-zinc-500"
            style={{
              backgroundImage:
                "radial-gradient(rgb(24 24 27) 1px, transparent 1px)",
              backgroundSize: "12px 12px",
            }}
          >
            <div className="flex flex-col gap-2">
              <span>This workspace is empty.</span>
              <span className="text-zinc-600">
                Use{" "}
                <strong className="text-emerald-300">Add widget</strong> in the
                toolbar above to start. Suggested widgets:{" "}
                <span className="text-zinc-400">
                  Options chain · Balances · Positions · Docs · Feedback
                </span>
                .
              </span>
            </div>
          </div>
        ) : (
          <div
            data-testid={`workspace-grid-${workspaceId}`}
            className="grid grid-cols-12 gap-2"
          >
            {widgets.map((w) => {
              const def = WIDGET_REGISTRY[w.type];
              if (!def) return null;
              return (
                <WidgetFrame
                  key={w.id}
                  instance={w}
                  def={def}
                  onRemove={() => removeWidget(w.id)}
                  onResize={(size) => resizeWidget(w.id, size)}
                  onMoveUp={() => moveWidget(w.id, -1)}
                  onMoveDown={() => moveWidget(w.id, 1)}
                />
              );
            })}
          </div>
        )}
      </div>
    </SelectedOptionProvider>
  );
}
