"use client";

// Workspace ↔ navbar bridge.
//
// The Workspace component registers a callback {workspaceId,
// addWidget(type)} when it mounts. The navbar's `Widget` button reads
// the active workspace via useActiveWorkspace() and shows its Add
// Widget menu. If no workspace is mounted (non-trading routes), the
// button hides itself.
//
// Posture: pure in-memory context. NEVER persists or transmits
// anything. NO secrets, NO RPC URLs, NO bearer tokens.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearWorkspaceLayouts,
  pruneExpiredLayouts,
} from "./workspace-storage";
import type { WidgetType, WorkspaceId } from "./workspace-types";

interface ActiveWorkspace {
  workspaceId: WorkspaceId;
  addWidget: (type: WidgetType) => void;
  /** Re-seed the workspace from `defaultWidgetsFor(workspaceId)` and
   *  persist the new layout. Called by the navbar's `Widget` menu. */
  resetLayout: () => void;
}

interface WorkspaceBridgeValue {
  active: ActiveWorkspace | null;
  /** Workspace components call this on mount with their own handlers
   *  + a cleanup function that the navbar's `useActiveWorkspace`
   *  invokes on unmount. */
  registerActive: (handle: ActiveWorkspace) => () => void;
}

const Ctx = createContext<WorkspaceBridgeValue | null>(null);

export function WorkspaceBridgeProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveWorkspace | null>(null);

  // On first mount, prune any expired / invalid buckets and expose a
  // console-only recovery helper for users with corrupted layouts.
  // No UI surface — terminal stays clean.
  useEffect(() => {
    pruneExpiredLayouts();
    if (typeof window !== "undefined") {
      (window as unknown as { __deoptClearWorkspaceLayouts?: () => number })
        .__deoptClearWorkspaceLayouts = clearWorkspaceLayouts;
    }
  }, []);

  const registerActive = useCallback((handle: ActiveWorkspace) => {
    setActive(handle);
    return () => {
      // Only clear if the unmounting workspace is the currently-active
      // one — protects against race conditions during route changes.
      setActive((prev) => (prev === handle ? null : prev));
    };
  }, []);

  const value = useMemo<WorkspaceBridgeValue>(
    () => ({ active, registerActive }),
    [active, registerActive],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Read the currently-mounted workspace, if any. */
export function useActiveWorkspace(): ActiveWorkspace | null {
  const v = useContext(Ctx);
  return v?.active ?? null;
}

/** Called by Workspace on mount to register itself with the navbar. */
export function useRegisterWorkspace(handle: ActiveWorkspace): void {
  const v = useContext(Ctx);
  useEffect(() => {
    if (!v) return;
    return v.registerActive(handle);
  }, [v, handle]);
}
