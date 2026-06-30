// HISTORY-V2-FAILURE-REASONS-V1 / HISTORY-V2-TERMINAL-REASONS-V1 —
// pure helpers that map order / conditional-order outcomes to a small,
// user-facing reason model.
//
// As of HISTORY-V2-TERMINAL-REASONS-V1 the backend persists a real
// terminal reason on `option_orders` for the two transitions whose
// cause is known at write-time: user cancel (`user_cancelled`) and
// IOC remainder cancel (`ioc_remainder_cancelled`). When
// `HistoryV2Item.terminal_reason_code` is present, the helper uses
// that token + the optional `terminal_reason_message` /
// `terminal_reason_source` directly.
//
// Pre-persistence rejections (post-only would cross, FOK not
// fillable, matching rejections) are still NOT recoverable from
// history — they error synchronously at submit time and no row is
// ever inserted. Equally, rows written BEFORE migration 0030 carry
// NULL reason fields. For both of those cases the helper falls back
// to TIF-derived inference from the historical signals we DO have on
// the row (`status` + `order_type` (=TIF) + `post_only`). It NEVER
// fabricates a reason for a successful or active order. The returned
// `code` is always a safe canonical token (no secrets, no DB ids).

import type { HistoryV2Item } from "./trading-api";

export type ReasonSeverity = "info" | "warning" | "error";

export interface HistoryReason {
  /** Canonical, safe-to-render code token (no secrets). */
  code: string;
  /** Pre-formatted user-facing label. */
  message: string;
  severity: ReasonSeverity;
  /**
   * Where the terminal transition was authored, when known. Only set
   * for rows whose reason was persisted by the backend (i.e. NOT for
   * rows whose reason came from TIF fallback inference). Surfaced on
   * the DOM as `data-reason-source` for debuggability and to let
   * tests pin the persisted-vs-inferred distinction.
   */
  source?: string;
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
  // HISTORY-V2-REJECTED-ATTEMPTS-FEED-V1 — backend-side rejection
  // codes for pre-persistence attempts. These rows arrive on the
  // Orders tab with `status="rejected"` and `terminal_reason_code`
  // set to one of the entries below.
  post_only_would_match: {
    message: "Post-only order would immediately match",
    severity: "warning",
  },
  self_trade: {
    message: "Order would self-trade",
    severity: "warning",
  },
  deadline_expired: {
    message: "Order deadline passed before submit",
    severity: "warning",
  },
  zero_price: {
    message: "Price must be > 0",
    severity: "warning",
  },
  zero_size: {
    message: "Size must be > 0",
    severity: "warning",
  },
  unsupported_tif: {
    message: "Time-in-force is not supported",
    severity: "warning",
  },
  invalid_tif_combination: {
    message: "Invalid time-in-force + post-only combination",
    severity: "warning",
  },
  option_series_inactive: {
    message: "Option series is not active",
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
 * Priority (HISTORY-V2-TERMINAL-REASONS-V1):
 *   1. `item.terminal_reason_code` — persisted backend reason. Wins
 *      whenever it is present, even if TIF-inference would have
 *      chosen a different code. The `source` field is carried
 *      through.
 *   2. TIF-derived inference from `status` + `order_type` + `post_only`
 *      — used for rows written before migration 0030 (which left the
 *      persisted fields NULL) and as a safety net for any
 *      terminal-non-success row whose backend reason wasn't stamped.
 *
 * We never invent context the row doesn't carry.
 */
export function deriveOrderReason(item: HistoryV2Item): HistoryReason | null {
  const status = (item.status ?? "").toLowerCase();
  if (status === "" || NO_REASON_STATUSES.has(status)) return null;
  if (!TERMINAL_NON_SUCCESS_STATUSES.has(status)) return null;

  // 1) Persisted backend reason wins.
  const persistedCode = (item.terminal_reason_code ?? "").trim();
  if (persistedCode.length > 0) {
    const { message: tableMessage, severity } = resolveReason(persistedCode);
    const rowMessage = clampMessage(item.terminal_reason_message);
    const source = (item.terminal_reason_source ?? "").trim();
    return {
      code: persistedCode,
      message: rowMessage ?? tableMessage,
      severity,
      ...(source.length > 0 ? { source } : {}),
    };
  }

  // 2) Fallback inference for legacy rows / pre-persistence outcomes.
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
