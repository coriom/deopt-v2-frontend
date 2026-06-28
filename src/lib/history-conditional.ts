// HISTORY-LIFECYCLE-V2 — pure helpers for the `/history` Conditional /
// TP-SL tab. Keeping these as side-effect-free pure functions so the
// node-test harness can cover the slicing / sorting / classification
// rules end-to-end without React or fetch.

import type { ConditionalOrderResponse } from "./trading-types";
import type { HistoryRange } from "./trading-api";

/**
 * Conditional-order statuses that are FINAL: they no longer evaluate,
 * no longer fire, and no longer hold an OCO sibling. We render these
 * in a muted style and never bind a Cancel action to them.
 *
 * `armed` is the only currently-active state in the worker. Future
 * extensions (e.g. `pending`) should be added to this module so the
 * UI stays in lock-step with the worker contract.
 */
export const TERMINAL_CONDITIONAL_STATUSES = new Set<string>([
  "triggered",
  "completed",
  "cancelled",
  "failed",
  "expired",
]);

export function isTerminalConditionalStatus(status: string): boolean {
  return TERMINAL_CONDITIONAL_STATUSES.has(status);
}

/**
 * Lower bound, in epoch ms, for which rows the user should see at a
 * given range filter. `all` returns null which the caller treats as
 * "no lower bound". Mirrors the backend `HistoryRange::since_ms`
 * semantics so the conditional tab feels consistent with the other
 * history tabs that pre-filter server-side.
 */
export function rangeSinceMs(range: HistoryRange, nowMs: number): number | null {
  switch (range) {
    case "last_day":
      return nowMs - 24 * 60 * 60 * 1000;
    case "last_week":
      return nowMs - 7 * 24 * 60 * 60 * 1000;
    case "last_month":
      return nowMs - 30 * 24 * 60 * 60 * 1000;
    case "last_quarter":
      return nowMs - 90 * 24 * 60 * 60 * 1000;
    case "all":
      return null;
  }
}

/**
 * Filter + sort the conditional-orders list for one history-page
 * request. We rank by `updated_at_ms` desc so that recently-triggered
 * rows surface to the top — this matches operator expectation of "what
 * just happened to my TP/SLs" without needing the user to scroll.
 *
 * Pagination is applied last so range-filter + sort are stable across
 * `page` / `pageSize` changes within the same dataset.
 */
export interface ConditionalHistorySlice {
  total: number;
  page_items: ConditionalOrderResponse[];
}

export function sliceConditionalHistory(
  rows: ConditionalOrderResponse[],
  opts: { range: HistoryRange; nowMs: number; page: number; pageSize: number },
): ConditionalHistorySlice {
  const since = rangeSinceMs(opts.range, opts.nowMs);
  const filtered = since === null
    ? rows.slice()
    : rows.filter((r) => r.updated_at_ms >= since);
  filtered.sort((a, b) => b.updated_at_ms - a.updated_at_ms);
  const page = Math.max(1, opts.page);
  const pageSize = Math.max(1, opts.pageSize);
  const start = (page - 1) * pageSize;
  const end = Math.min(filtered.length, start + pageSize);
  const page_items = start >= filtered.length ? [] : filtered.slice(start, end);
  return { total: filtered.length, page_items };
}

/**
 * Short, copy-safe ID renderer for fill / order / child-order /
 * OCO-group identifiers. The conditional-orders worker emits UUIDs
 * (36 chars) and the matching engine emits 32-byte hex (66 chars
 * with `0x` prefix). Both want the same "first 6 … last 4" shape so
 * the table stays dense at small widths.
 */
export function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}
