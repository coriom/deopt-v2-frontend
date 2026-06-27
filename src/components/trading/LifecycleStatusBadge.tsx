// FRONTEND-LIFECYCLE-OBSERVABILITY-V1 — visual indicator for the
// shared lifecycle WebSocket connection state. Mounted by each panel
// so the user can tell at a glance whether deltas are Live, falling
// back to polling, reconnecting, or offline.

"use client";

import type { LifecycleConnectionStatus } from "@/lib/lifecycle-types";

const COLORS: Record<LifecycleConnectionStatus, string> = {
  disconnected: "border-zinc-700 bg-zinc-900 text-zinc-400",
  connecting: "border-amber-500/40 bg-amber-950/40 text-amber-200",
  authenticating: "border-amber-500/40 bg-amber-950/40 text-amber-200",
  subscribed: "border-emerald-500/40 bg-emerald-950/40 text-emerald-200",
  reconnecting: "border-amber-500/40 bg-amber-950/40 text-amber-200",
  polling_fallback: "border-zinc-700 bg-zinc-900 text-zinc-300",
  error: "border-rose-500/40 bg-rose-950/40 text-rose-200",
};

const LABELS: Record<LifecycleConnectionStatus, string> = {
  disconnected: "Offline",
  connecting: "Connecting",
  authenticating: "Signing",
  subscribed: "Live",
  reconnecting: "Reconnecting",
  polling_fallback: "Polling",
  error: "Polling",
};

export interface LifecycleStatusBadgeProps {
  status: LifecycleConnectionStatus;
  detail?: string | null;
}

export function LifecycleStatusBadge({
  status,
  detail,
}: LifecycleStatusBadgeProps) {
  const title = detail ? `${LABELS[status]} — ${detail}` : LABELS[status];
  return (
    <span
      data-testid="lifecycle-status-badge"
      data-status={status}
      title={title}
      className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${COLORS[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
