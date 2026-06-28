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
