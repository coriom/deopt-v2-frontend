// HISTORY-V2-FAILURE-REASONS-V1 — wire-contract tests for the
// reason-derivation helper. Re-implemented in pure JS so the test
// suite never imports React and stays runnable under `node --test`.
// Keep this file in lock-step with `src/lib/history-reasons.ts`.

import { test } from "node:test";
import assert from "node:assert/strict";

const REASON_LABELS = {
  ioc_remainder_cancelled: { message: "IOC remainder cancelled (cannot rest)", severity: "info" },
  fok_not_fillable:        { message: "Fill-or-kill order was not fully fillable", severity: "warning" },
  fok_cancelled:           { message: "Fill-or-kill order cancelled", severity: "info" },
  post_only_would_cross:   { message: "Post-only order would immediately match", severity: "warning" },
  // HISTORY-V2-REJECTED-ATTEMPTS-FEED-V1 (mirror src/lib/history-reasons.ts)
  post_only_would_match:   { message: "Post-only order would immediately match", severity: "warning" },
  self_trade:              { message: "Order would self-trade", severity: "warning" },
  deadline_expired:        { message: "Order deadline passed before submit", severity: "warning" },
  zero_price:              { message: "Price must be > 0", severity: "warning" },
  zero_size:               { message: "Size must be > 0", severity: "warning" },
  unsupported_tif:         { message: "Time-in-force is not supported", severity: "warning" },
  invalid_tif_combination: { message: "Invalid time-in-force + post-only combination", severity: "warning" },
  option_series_inactive:  { message: "Option series is not active", severity: "warning" },
  cancelled:               { message: "Cancelled", severity: "info" },
  user_cancelled:          { message: "Cancelled by user", severity: "info" },
  system_cancelled:        { message: "Cancelled by system", severity: "info" },
  rejected:                { message: "Rejected", severity: "error" },
  failed:                  { message: "Failed", severity: "error" },
  expired:                 { message: "Expired", severity: "info" },
  write_auth_conflict:     { message: "Write authorization conflict", severity: "error" },
  duplicate_idempotency_key: { message: "Duplicate idempotency key", severity: "warning" },
  oco_sibling_triggered:   { message: "OCO sibling triggered first", severity: "info" },
  position_closed:         { message: "Position already closed", severity: "info" },
  execution_rejected:      { message: "Child order rejected by matching", severity: "error" },
};

const TERMINAL_NON_SUCCESS = new Set(["cancelled", "rejected", "failed", "expired"]);
const NO_REASON = new Set(["open", "partially_filled", "filled"]);

function resolveReason(code) {
  return REASON_LABELS[code] ?? { message: code, severity: "warning" };
}

function parseAmount(s) {
  if (s === undefined || s === null || s === "") return null;
  try { return BigInt(s); } catch { return null; }
}

function deriveOrderReason(item) {
  const status = (item.status ?? "").toLowerCase();
  if (status === "" || NO_REASON.has(status)) return null;
  if (!TERMINAL_NON_SUCCESS.has(status)) return null;
  // HISTORY-V2-TERMINAL-REASONS-V1 — persisted backend reason wins.
  const persisted = (item.terminal_reason_code ?? "").trim();
  if (persisted.length > 0) {
    const r = resolveReason(persisted);
    const rowMessage = clamp(item.terminal_reason_message);
    const source = (item.terminal_reason_source ?? "").trim();
    const out = {
      code: persisted,
      message: rowMessage ?? r.message,
      severity: r.severity,
    };
    if (source.length > 0) out.source = source;
    return out;
  }
  const tif = (item.order_type ?? "").toLowerCase();
  const postOnly = item.post_only === true;
  const sized = parseAmount(item.amount);
  const filled = parseAmount(item.filled);
  const hasUnfilled = sized !== null && filled !== null && filled < sized;
  if (status === "cancelled" && tif === "ioc" && hasUnfilled) {
    const r = resolveReason("ioc_remainder_cancelled");
    return { code: "ioc_remainder_cancelled", ...r };
  }
  if (status === "cancelled" && tif === "fok") {
    const r = resolveReason("fok_cancelled");
    return { code: "fok_cancelled", ...r };
  }
  if (status === "rejected" && tif === "fok") {
    const r = resolveReason("fok_not_fillable");
    return { code: "fok_not_fillable", ...r };
  }
  if (status === "rejected" && postOnly) {
    const r = resolveReason("post_only_would_cross");
    return { code: "post_only_would_cross", ...r };
  }
  const r = resolveReason(status);
  return { code: status, ...r };
}

function clamp(message, max = 240) {
  if (!message) return null;
  const t = message.trim();
  if (t.length === 0) return null;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function deriveConditionalReason(args) {
  if (!args.failure_code) return null;
  const code = args.failure_code;
  const message = clamp(args.failure_message);
  const known = resolveReason(code);
  return { code, message: message ?? known.message, severity: known.severity };
}

// ---------- Orders-tab derivation ----------

test("filled order has no reason (success has no failure)", () => {
  assert.equal(deriveOrderReason({ status: "filled", order_type: "gtc" }), null);
});

test("open order has no reason (still active)", () => {
  assert.equal(deriveOrderReason({ status: "open", order_type: "gtc" }), null);
  assert.equal(deriveOrderReason({ status: "partially_filled", order_type: "ioc" }), null);
});

test("missing status returns null (don't crash on incomplete rows)", () => {
  assert.equal(deriveOrderReason({}), null);
  assert.equal(deriveOrderReason({ status: "" }), null);
});

test("unrecognised status returns null (don't fabricate)", () => {
  assert.equal(deriveOrderReason({ status: "queued" }), null);
});

test("IOC cancelled with unfilled remainder → ioc_remainder_cancelled (info)", () => {
  const r = deriveOrderReason({
    status: "cancelled", order_type: "ioc",
    amount: "100", filled: "30",
  });
  assert.equal(r.code, "ioc_remainder_cancelled");
  assert.equal(r.severity, "info");
  assert.match(r.message, /IOC remainder cancelled/);
});

test("IOC cancelled fully filled does NOT pin ioc_remainder reason (no unfilled)", () => {
  const r = deriveOrderReason({
    status: "cancelled", order_type: "ioc",
    amount: "100", filled: "100",
  });
  // No unfilled remainder → falls back to bare `cancelled`, not IOC-specific.
  assert.equal(r.code, "cancelled");
});

test("FOK cancelled → fok_cancelled (info)", () => {
  const r = deriveOrderReason({ status: "cancelled", order_type: "fok" });
  assert.equal(r.code, "fok_cancelled");
});

test("FOK rejected → fok_not_fillable (warning)", () => {
  const r = deriveOrderReason({ status: "rejected", order_type: "fok" });
  assert.equal(r.code, "fok_not_fillable");
  assert.equal(r.severity, "warning");
});

test("post-only rejected → post_only_would_cross (warning)", () => {
  const r = deriveOrderReason({ status: "rejected", order_type: "gtc", post_only: true });
  assert.equal(r.code, "post_only_would_cross");
  assert.equal(r.severity, "warning");
});

test("post-only that did NOT cross (filled) returns null — success has no reason", () => {
  assert.equal(
    deriveOrderReason({ status: "filled", order_type: "gtc", post_only: true }),
    null,
  );
});

test("GTC cancelled (no TIF context) → bare `cancelled` (info)", () => {
  const r = deriveOrderReason({ status: "cancelled", order_type: "gtc" });
  assert.equal(r.code, "cancelled");
  assert.equal(r.severity, "info");
});

test("expired → `expired` (info)", () => {
  const r = deriveOrderReason({ status: "expired", order_type: "gtc" });
  assert.equal(r.code, "expired");
  assert.equal(r.severity, "info");
});

test("failed → `failed` (error)", () => {
  const r = deriveOrderReason({ status: "failed" });
  assert.equal(r.severity, "error");
});

// ---------- Conditional-order derivation ----------

test("conditional row with no failure_code returns null", () => {
  assert.equal(deriveConditionalReason({ failure_code: null }), null);
  assert.equal(deriveConditionalReason({ failure_code: null, failure_message: null }), null);
});

test("conditional known code uses table label when message missing", () => {
  const r = deriveConditionalReason({ failure_code: "oco_sibling_triggered" });
  assert.equal(r.code, "oco_sibling_triggered");
  assert.match(r.message, /OCO sibling triggered first/);
  assert.equal(r.severity, "info");
});

test("conditional row prefers the worker's failure_message over the table fallback", () => {
  const r = deriveConditionalReason({
    failure_code: "execution_rejected",
    failure_message: "live reducible size is zero",
  });
  assert.equal(r.code, "execution_rejected");
  assert.equal(r.message, "live reducible size is zero");
  assert.equal(r.severity, "error"); // severity still comes from table
});

test("conditional unknown code falls back to safe warning severity", () => {
  const r = deriveConditionalReason({ failure_code: "made_up_xyz" });
  assert.equal(r.code, "made_up_xyz");
  assert.equal(r.severity, "warning");
});

test("very long failure_message is clamped to <= 240 chars with ellipsis", () => {
  const long = "x".repeat(400);
  const r = deriveConditionalReason({ failure_code: "execution_rejected", failure_message: long });
  assert.ok(r.message.length <= 240);
  assert.ok(r.message.endsWith("…"));
});

// ---------- TP/SL behaviour unchanged ----------

test("TP/SL reason behaviour unchanged: armed status has no reason", () => {
  // Conditional rows that have no failure_code (e.g. status=armed)
  // must continue to produce no reason — the TP/SL tab's existing
  // status colour handles their colour, not the reason column.
  assert.equal(deriveConditionalReason({ failure_code: null }), null);
});

// ---------- Trades/Fills tab honesty ----------

test("trades/fills row with status=filled has NO derived order reason (success)", () => {
  // A fill row always carries status=filled; we must NOT label it as
  // failed even if the parent order later had an IOC remainder cancel.
  assert.equal(deriveOrderReason({ status: "filled", order_type: "ioc" }), null);
});

// ---------- HISTORY-V2-TERMINAL-REASONS-V1: persisted backend reason ----------

test("persisted user_cancelled wins for a GTC cancelled row (where inference would say bare `cancelled`)", () => {
  const r = deriveOrderReason({
    status: "cancelled",
    order_type: "gtc",
    terminal_reason_code: "user_cancelled",
    terminal_reason_source: "user",
  });
  assert.equal(r.code, "user_cancelled");
  assert.equal(r.severity, "info");
  assert.equal(r.source, "user");
});

test("persisted reason wins even when TIF inference would have chosen a different code", () => {
  // Row looks like an IOC cancelled with unfilled remainder (would
  // otherwise infer `ioc_remainder_cancelled`), but backend says it
  // was a user cancel — backend MUST win.
  const r = deriveOrderReason({
    status: "cancelled",
    order_type: "ioc",
    amount: "100",
    filled: "30",
    terminal_reason_code: "user_cancelled",
    terminal_reason_source: "user",
  });
  assert.equal(r.code, "user_cancelled");
  assert.equal(r.source, "user");
});

test("persisted ioc_remainder_cancelled tagged with source `tif_policy`", () => {
  const r = deriveOrderReason({
    status: "cancelled",
    order_type: "ioc",
    amount: "100",
    filled: "30",
    terminal_reason_code: "ioc_remainder_cancelled",
    terminal_reason_source: "tif_policy",
  });
  assert.equal(r.code, "ioc_remainder_cancelled");
  assert.equal(r.source, "tif_policy");
});

test("persisted unknown code renders raw token + warning severity (no fabrication)", () => {
  const r = deriveOrderReason({
    status: "cancelled",
    order_type: "gtc",
    terminal_reason_code: "future_unknown_code",
    terminal_reason_source: "system",
  });
  assert.equal(r.code, "future_unknown_code");
  assert.equal(r.severity, "warning");
  assert.equal(r.message, "future_unknown_code");
  assert.equal(r.source, "system");
});

test("persisted row prefers terminal_reason_message over the table fallback when present", () => {
  const r = deriveOrderReason({
    status: "cancelled",
    order_type: "gtc",
    terminal_reason_code: "user_cancelled",
    terminal_reason_message: "cancelled from /options ticket",
    terminal_reason_source: "user",
  });
  assert.equal(r.code, "user_cancelled");
  assert.equal(r.message, "cancelled from /options ticket");
});

test("persisted reason on a SUCCESSFUL row is still suppressed (success has no failure)", () => {
  // The terminal_reason_code field would be a backend bug here, but
  // the helper's contract is "never invent a reason for success".
  assert.equal(
    deriveOrderReason({
      status: "filled",
      order_type: "gtc",
      terminal_reason_code: "user_cancelled",
    }),
    null,
  );
});

test("no persisted reason → TIF inference still applies (legacy rows continue to render)", () => {
  // Pre-migration rows have NULL terminal_reason_* fields; the
  // fallback inference must still produce the IOC-remainder label.
  const r = deriveOrderReason({
    status: "cancelled",
    order_type: "ioc",
    amount: "100",
    filled: "30",
  });
  assert.equal(r.code, "ioc_remainder_cancelled");
  assert.equal(r.source, undefined);
});

test("persisted reason without source omits the source field on the returned reason", () => {
  const r = deriveOrderReason({
    status: "cancelled",
    order_type: "gtc",
    terminal_reason_code: "user_cancelled",
  });
  assert.equal(r.code, "user_cancelled");
  assert.equal(r.source, undefined);
});

test("long persisted terminal_reason_message is clamped to <= 240 chars", () => {
  const long = "y".repeat(400);
  const r = deriveOrderReason({
    status: "cancelled",
    order_type: "gtc",
    terminal_reason_code: "user_cancelled",
    terminal_reason_message: long,
    terminal_reason_source: "user",
  });
  assert.ok(r.message.length <= 240);
  assert.ok(r.message.endsWith("…"));
});

// =====================================================================
// HISTORY-V2-REJECTED-ATTEMPTS-FEED-V1 — verify the new rejection
// codes render through the same `deriveOrderReason` helper that the
// Orders tab uses.
// =====================================================================

test("rejected post_only_would_match row renders the post-only message", () => {
  const r = deriveOrderReason({
    status: "rejected",
    order_type: "gtc",
    post_only: true,
    terminal_reason_code: "post_only_would_match",
    terminal_reason_source: "matching_policy",
  });
  assert.equal(r.code, "post_only_would_match");
  assert.equal(r.message, "Post-only order would immediately match");
  assert.equal(r.severity, "warning");
  assert.equal(r.source, "matching_policy");
});

test("rejected fok_not_fillable row renders the FOK message", () => {
  const r = deriveOrderReason({
    status: "rejected",
    order_type: "fok",
    terminal_reason_code: "fok_not_fillable",
    terminal_reason_source: "matching_policy",
  });
  assert.equal(r.code, "fok_not_fillable");
  assert.equal(r.message, "Fill-or-kill order was not fully fillable");
  assert.equal(r.severity, "warning");
  assert.equal(r.source, "matching_policy");
});

test("rejected deadline_expired row renders the deadline message", () => {
  const r = deriveOrderReason({
    status: "rejected",
    order_type: "gtc",
    terminal_reason_code: "deadline_expired",
    terminal_reason_source: "request_validation",
  });
  assert.equal(r.code, "deadline_expired");
  assert.equal(r.message, "Order deadline passed before submit");
  assert.equal(r.source, "request_validation");
});

test("rejected invalid_tif_combination row renders the TIF-combo message", () => {
  const r = deriveOrderReason({
    status: "rejected",
    order_type: "ioc",
    post_only: true,
    terminal_reason_code: "invalid_tif_combination",
    terminal_reason_source: "request_validation",
  });
  assert.equal(r.code, "invalid_tif_combination");
  assert.equal(r.message, "Invalid time-in-force + post-only combination");
});

test("rejected option_series_inactive renders the series-state message", () => {
  const r = deriveOrderReason({
    status: "rejected",
    order_type: "gtc",
    terminal_reason_code: "option_series_inactive",
    terminal_reason_source: "series_state",
  });
  assert.equal(r.code, "option_series_inactive");
  assert.equal(r.message, "Option series is not active");
  assert.equal(r.source, "series_state");
});

test("unknown rejection code falls back to raw token + warning severity", () => {
  // Defends against a backend-side rejection_reason addition the
  // frontend hasn't shipped a label for yet — we must NOT silently
  // drop the row.
  const r = deriveOrderReason({
    status: "rejected",
    order_type: "gtc",
    terminal_reason_code: "future_unknown_code",
    terminal_reason_source: "matching_policy",
  });
  assert.equal(r.code, "future_unknown_code");
  assert.equal(r.message, "future_unknown_code");
  assert.equal(r.severity, "warning");
});

test("expired status keeps its own label and is not conflated with rejected", () => {
  // OPTION-ORDER-EXPIRY-SWEEP-V1 + this milestone share the Orders
  // tab; the Expired terminal reason must not be rebranded as a
  // pre-persistence rejection.
  const r = deriveOrderReason({
    status: "expired",
    order_type: "gtc",
    terminal_reason_code: "expired",
    terminal_reason_source: "expiry_sweep",
  });
  assert.equal(r.code, "expired");
  assert.equal(r.message, "Expired");
  assert.equal(r.severity, "info");
  assert.equal(r.source, "expiry_sweep");
});
