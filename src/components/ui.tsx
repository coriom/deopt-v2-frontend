"use client";

import type { ReactNode } from "react";
import type { TradingApiError } from "@/lib/trading-api";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      data-testid="loading-state"
      className="flex items-center justify-center rounded border border-zinc-200 bg-white px-4 py-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
    >
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
    <div
      data-testid="empty-state"
      className="flex flex-col items-center justify-center rounded border border-dashed border-zinc-300 bg-zinc-50 px-4 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</div>
      {description && (
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Human-friendly hint for a given backend error code. Keeps the testnet
 * "this is expected on Sepolia" framing consistent without claiming the
 * fault is the user's.
 */
function hintForCode(code: string): string | null {
  switch (code) {
    case "NETWORK":
      return "The frontend can't reach the trading backend. This is usually a backend-side outage during testnet warm-up — try again shortly.";
    case "SOURCE_UNAVAILABLE":
      return "One of the backend data sources is still warming up. Common during testnet starts; retry in a moment.";
    case "RPC_UNAVAILABLE":
      return "The backend can't currently reach the Base Sepolia RPC. Backend-side issue; retry shortly.";
    case "INDEXER_STALE":
      return "The on-chain indexer is behind real-time. Wait a moment and refresh; the worker ticks periodically.";
    case "QUOTE_STALE":
      return "The quote relied on a stale oracle reading. Wait for the next price refresh and retry.";
    case "INVALID_ADDRESS":
      return "The address you supplied isn't a valid Base Sepolia EOA. Check for typos.";
    case "INSUFFICIENT_BALANCE":
      return "The connected wallet doesn't have enough mUSDC for this trade. Top up via the mUSDC faucet path (see quickstart).";
    case "INSUFFICIENT_COLLATERAL":
      return "The seller side doesn't have enough mUSDC deposited in the vault to cover the short. Deposit more before retrying.";
    case "RATE_LIMITED":
      return "The backend rate-limit kicked in. Wait a few seconds and retry.";
    default:
      return null;
  }
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: TradingApiError;
  onRetry?: () => void;
}) {
  const isNotReady = error.code === "SOURCE_UNAVAILABLE";
  // Not-ready = neutral zinc card with emerald accent (testnet warm-up,
  // not a true error). True errors keep a controlled red treatment.
  const className = isNotReady
    ? "rounded border border-emerald-500/30 bg-zinc-950 px-4 py-4 text-zinc-100"
    : "rounded border border-red-500/40 bg-red-950/40 px-4 py-4 text-red-100";
  const textClassName = isNotReady
    ? "text-emerald-200"
    : "text-red-200";
  const hint = hintForCode(error.code);
  return (
    <div data-testid="error-state" data-error-code={error.code} className={className}>
      <div className={`text-sm font-medium ${textClassName}`}>{error.code}</div>
      <div className={`mt-1 text-xs ${textClassName}`}>{error.message}</div>
      {hint && (
        <div className={`mt-2 text-[11px] ${textClassName}`}>{hint}</div>
      )}
      {error.request_id && (
        <div className="mt-2 font-mono text-[10px] text-zinc-500">
          request_id: {error.request_id}
        </div>
      )}
      {onRetry && (
        <button
          type="button"
          className="mt-3 rounded bg-emerald-500 px-3 py-1 text-xs font-medium text-black hover:bg-emerald-400"
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
    <span className="ml-2 inline-flex items-center rounded border border-emerald-500/40 bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
      stale {sec}s
    </span>
  );
}
