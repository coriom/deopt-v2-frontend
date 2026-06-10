"use client";

import type { ReactNode } from "react";
import type { TradingApiError } from "@/lib/trading-api";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center rounded border border-zinc-200 bg-white px-4 py-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      <span className="animate-pulse">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-dashed border-zinc-300 bg-zinc-50 px-4 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</div>
      {description && (
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: TradingApiError;
  onRetry?: () => void;
}) {
  const isNotReady = error.code === "SOURCE_UNAVAILABLE";
  const className = isNotReady
    ? "rounded border border-amber-300 bg-amber-50 px-4 py-4 dark:border-amber-800 dark:bg-amber-950"
    : "rounded border border-red-300 bg-red-50 px-4 py-4 dark:border-red-800 dark:bg-red-950";
  const textClassName = isNotReady
    ? "text-amber-700 dark:text-amber-300"
    : "text-red-700 dark:text-red-300";
  return (
    <div className={className}>
      <div className={`text-sm font-medium ${textClassName}`}>{error.code}</div>
      <div className={`mt-1 text-xs ${textClassName}`}>{error.message}</div>
      {error.request_id && (
        <div className="mt-2 font-mono text-[10px] text-zinc-500">
          request_id: {error.request_id}
        </div>
      )}
      {onRetry && (
        <button
          type="button"
          className="mt-3 rounded bg-zinc-900 px-3 py-1 text-xs text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function StaleDataBadge({ ageMs }: { ageMs?: number }) {
  if (ageMs === undefined || ageMs < 30_000) return null;
  const sec = Math.floor(ageMs / 1000);
  return (
    <span className="ml-2 inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
      stale {sec}s
    </span>
  );
}
