// HISTORY-V2-FAILURE-REASONS-V1 — pure helpers that map order /
// conditional-order outcomes to a small, user-facing reason model.
//
// Important honest-data invariant: regular options orders do NOT
// persist an explicit `cancel_reason` / `failure_code` column in the
// `option_orders` table (see `migrations/0013_option_orders.sql`).
// The matching engine surfaces stable rejection messages
// synchronously at submit time — those orders never enter the
// database, so we cannot recover them from history. For orders that
// DO land in the table and later terminate, the only history-visible
// signals we have are:
//
//   * `status` (open / partially_filled / filled / cancelled /
//     rejected / failed / expired)
//   * `time_in_force` (gtc / ioc / fok), exposed via
//     `HistoryV2Item.order_type` for the Orders tab
//   * `post_only` (boolean), surfaced via `HistoryV2Item.post_only`
//     in HISTORY-V2-FAILURE-REASONS-V1
//
// `deriveOrderReason` infers a user-facing label from those three
// signals only; it NEVER fabricates a reason for a successful or
// active order. The returned `code` is a safe canonical token (no
// secrets, no DB identifiers). The conditional-order path delegates
// to `failure_code` / `failure_message` which the backend already
// persists explicitly.

import type { HistoryV2Item } from "./trading-api";

export type ReasonSeverity = "info" | "warning" | "error";

export interface HistoryReason {
  /** Canonical, safe-to-render code token (no secrets). */
  code: string;
  /** Pre-formatted user-facing label. */
  message: string;
  severity: ReasonSeverity;
}

/**
 * Stable code → label map. Keeping the mapping in one table makes it
 * easy to add new persisted codes later without changing the call
 * sites. Unknown codes fall back to the raw token + a generic label.
 */
const REASON_LABELS: Record<string, { message: string; severity: ReasonSeverity }> = {
  // Matching-engine TIF outcomes (derived from status + tif).
  ioc_remainder_cancelled: {
    message: "IOC remainder cancelled (cannot rest)",
    severity: "info",
  },
  fok_not_fillable: {
    message: "Fill-or-kill order was not fully fillable",
    severity: "warning",
  },
  fok_cancelled: {
    message: "Fill-or-kill order cancelled",
    severity: "info",
  },
  post_only_would_cross: {
    message: "Post-only order would immediately match",
    severity: "warning",
  },
  // Generic order outcomes.
  cancelled: { message: "Cancelled", severity: "info" },
  user_cancelled: { message: "Cancelled by user", severity: "info" },
  system_cancelled: { message: "Cancelled by system", severity: "info" },
  rejected: { message: "Rejected", severity: "error" },
  failed: { message: "Failed", severity: "error" },
  expired: { message: "Expired", severity: "info" },
  // Write-auth / idempotency (returned by the cancel endpoint; not
  // currently persisted on the order row, but listed here so the same
  // table can be reused if the field ever lands).
  write_auth_conflict: {
    message: "Write authorization conflict",
    severity: "error",
  },
  duplicate_idempotency_key: {
    message: "Duplicate idempotency key",
    severity: "warning",
  },
  // Conditional-order worker codes (mirror
  // `src/options/conditional_orders.rs`).
  oco_sibling_triggered: {
    message: "OCO sibling triggered first",
    severity: "info",
  },
  position_closed: {
    message: "Position already closed",
    severity: "info",
  },
  execution_rejected: {
    message: "Child order rejected by matching",
    severity: "error",
  },
};

/**
 * Sanity-bound the upstream `failure_message` so a malicious or
 * mis-configured row can't render arbitrarily long blobs into the
 * tooltip. Keeps things visually controlled without filtering content.
 */
function clampMessage(message: string | null | undefined, max = 240): string | null {
  if (!message) return null;
  const trimmed = message.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/**
 * Look up a known code; if unknown, fall back to a generic label that
 * surfaces the raw code (which is server-controlled and safe — it
 * comes from a fixed enum on the order / worker side).
 */
function resolveReason(code: string): { message: string; severity: ReasonSeverity } {
  const known = REASON_LABELS[code];
  if (known) return known;
  // Unknown but server-emitted — show the raw code with an `unknown`
  // severity so future codes don't silently misrender.
  return {
    message: code,
    severity: "warning",
  };
}

/**
 * Statuses that are TERMINAL (the order will not change again) AND
 * NOT a successful execution. These are the only statuses for which
 * a Reason row should ever render.
 */
const TERMINAL_NON_SUCCESS_STATUSES = new Set([
  "cancelled",
  "rejected",
  "failed",
  "expired",
]);

/**
 * Statuses that mean the order is still live or successfully done.
 * The Reason column renders `null` for these — no fabricated reason.
 */
const NO_REASON_STATUSES = new Set([
  "open",
  "partially_filled",
  "filled",
]);

function parseAmount(s: string | undefined): bigint | null {
  if (s === undefined || s === null || s === "") return null;
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}

/**
 * Pure derivation of a user-facing reason for an Orders-tab row. The
 * function NEVER returns a reason for a successful or active order;
 * a `null` return means "show `—`" in the UI.
 *
 * The TIF (`item.order_type`) and the post-only flag
 * (`item.post_only`) refine the message; the status alone is the
 * fallback. We never invent context the row doesn't carry.
 */
export function deriveOrderReason(item: HistoryV2Item): HistoryReason | null {
  const status = (item.status ?? "").toLowerCase();
  if (status === "" || NO_REASON_STATUSES.has(status)) return null;
  if (!TERMINAL_NON_SUCCESS_STATUSES.has(status)) return null;

  const tif = (item.order_type ?? "").toLowerCase();
  const postOnly = item.post_only === true;
  const sized = parseAmount(item.amount);
  const filled = parseAmount(item.filled);
  const hasUnfilled = sized !== null && filled !== null && filled < sized;

  // Specific TIF interpretations come first; they are the most
  // user-meaningful explanations we can give from the available data.
  if (status === "cancelled" && tif === "ioc" && hasUnfilled) {
    const { message, severity } = resolveReason("ioc_remainder_cancelled");
    return { code: "ioc_remainder_cancelled", message, severity };
  }
  if (status === "cancelled" && tif === "fok") {
    const { message, severity } = resolveReason("fok_cancelled");
    return { code: "fok_cancelled", message, severity };
  }
  if (status === "rejected" && tif === "fok") {
    const { message, severity } = resolveReason("fok_not_fillable");
    return { code: "fok_not_fillable", message, severity };
  }
  if (status === "rejected" && postOnly) {
    const { message, severity } = resolveReason("post_only_would_cross");
    return { code: "post_only_would_cross", message, severity };
  }

  // Fallback to the bare status as a safe canonical code.
  const { message, severity } = resolveReason(status);
  return { code: status, message, severity };
}

/**
 * Conditional-order reason — pulls directly from the persisted
 * `failure_code` / `failure_message` columns. Unlike orders, the
 * worker explicitly records these.
 */
export function deriveConditionalReason(args: {
  failure_code: string | null;
  failure_message?: string | null;
}): HistoryReason | null {
  if (!args.failure_code) return null;
  const code = args.failure_code;
  const message = clampMessage(args.failure_message);
  const known = resolveReason(code);
  // Prefer the row's `failure_message` if present — it's the
  // worker's actual context — otherwise fall back to the table.
  return {
    code,
    message: message ?? known.message,
    severity: known.severity,
  };
}
