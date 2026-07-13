// OPTIONS-TRADE-WIDGET-TP-SL-UX-V1 — wire-contract tests for the
// simplified payload builder + validator. Re-implements the helpers
// in pure JS so the test never imports React or the trading-api
// client and stays runnable under `node --test`. Keep in lock-step
// with `src/lib/attached-tp-sl-payload.ts`.
//
// V1 UX: single per-side price (`tpPrice1e8` / `slPrice1e8`) maps to
// both `trigger_price_1e8` and `limit_price_1e8` on the wire, because
// the backend has no constraint that trigger and limit must differ.

import { test } from "node:test";
import assert from "node:assert/strict";

function parsePositive1e8(raw, label) {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { value: null, error: `${label} price is required` };
  if (!/^\d+$/.test(trimmed)) {
    return {
      value: null,
      error: `${label} price must be a non-negative integer (1e8 fixed-point)`,
    };
  }
  let parsed;
  try {
    parsed = BigInt(trimmed);
  } catch {
    return { value: null, error: `${label} price is not a valid integer` };
  }
  if (parsed <= BigInt(0)) return { value: null, error: `${label} price must be > 0` };
  return { value: trimmed, error: null };
}

function validateAttachedTpSl(state) {
  const tpError = state.tpEnabled
    ? parsePositive1e8(state.tpPrice1e8, "Take Profit").error
    : null;
  const slError = state.slEnabled
    ? parsePositive1e8(state.slPrice1e8, "Stop Loss").error
    : null;
  const ok = tpError === null && slError === null;
  return { tpError, slError, ok };
}

function buildAttachedTpSlPayload(state) {
  if (!state.tpEnabled && !state.slEnabled) return undefined;
  const validation = validateAttachedTpSl(state);
  if (!validation.ok) return undefined;
  const out = {};
  if (state.tpEnabled) {
    const price = state.tpPrice1e8.trim();
    out.take_profit = { trigger_price_1e8: price, limit_price_1e8: price };
  }
  if (state.slEnabled) {
    const price = state.slPrice1e8.trim();
    out.stop_loss = { trigger_price_1e8: price, limit_price_1e8: price };
  }
  if (state.tpEnabled && state.slEnabled) out.link_as_oco = true;
  return out;
}

const empty = {
  tpEnabled: false,
  slEnabled: false,
  tpPrice1e8: "",
  slPrice1e8: "",
};

test("neither leg enabled → payload undefined (ticket omits the field)", () => {
  assert.equal(buildAttachedTpSlPayload(empty), undefined);
});

test("TP-only payload maps single price to both trigger and limit, omits stop_loss and link_as_oco", () => {
  const out = buildAttachedTpSlPayload({
    ...empty,
    tpEnabled: true,
    tpPrice1e8: "1500000000",
  });
  assert.deepEqual(out, {
    take_profit: { trigger_price_1e8: "1500000000", limit_price_1e8: "1500000000" },
  });
  assert.equal(out.stop_loss, undefined);
  assert.equal(out.link_as_oco, undefined);
});

test("SL-only payload maps single price to both trigger and limit, omits take_profit and link_as_oco", () => {
  const out = buildAttachedTpSlPayload({
    ...empty,
    slEnabled: true,
    slPrice1e8: "500000000",
  });
  assert.deepEqual(out, {
    stop_loss: { trigger_price_1e8: "500000000", limit_price_1e8: "500000000" },
  });
});

test("TP+SL forces link_as_oco=true in the payload; both sides use their own single price", () => {
  const out = buildAttachedTpSlPayload({
    tpEnabled: true,
    slEnabled: true,
    tpPrice1e8: "1500000000",
    slPrice1e8: "500000000",
  });
  assert.equal(out.link_as_oco, true);
  assert.equal(out.take_profit.trigger_price_1e8, "1500000000");
  assert.equal(out.take_profit.limit_price_1e8, "1500000000");
  assert.equal(out.stop_loss.trigger_price_1e8, "500000000");
  assert.equal(out.stop_loss.limit_price_1e8, "500000000");
});

test("trigger and limit are equal on the wire (V1 UX guarantee)", () => {
  const out = buildAttachedTpSlPayload({
    tpEnabled: true,
    slEnabled: true,
    tpPrice1e8: "1234567890",
    slPrice1e8: "9876543210",
  });
  assert.equal(out.take_profit.trigger_price_1e8, out.take_profit.limit_price_1e8);
  assert.equal(out.stop_loss.trigger_price_1e8, out.stop_loss.limit_price_1e8);
});

test("any invalid enabled-leg price → payload undefined (UI surfaces per-side error)", () => {
  // Empty TP price when TP is enabled.
  assert.equal(
    buildAttachedTpSlPayload({ ...empty, tpEnabled: true, tpPrice1e8: "" }),
    undefined,
  );
  // Non-digit input.
  assert.equal(
    buildAttachedTpSlPayload({ ...empty, slEnabled: true, slPrice1e8: "0.5" }),
    undefined,
  );
  // Zero price.
  assert.equal(
    buildAttachedTpSlPayload({ ...empty, tpEnabled: true, tpPrice1e8: "0" }),
    undefined,
  );
});

test("validator returns per-side error using the visible field wording", () => {
  const v = validateAttachedTpSl({
    ...empty,
    tpEnabled: true,
    tpPrice1e8: "",
    slEnabled: true,
    slPrice1e8: "12abc",
  });
  assert.equal(v.ok, false);
  assert.match(v.tpError, /Take Profit price is required/);
  assert.match(v.slError, /non-negative integer/);
});

test("validator with neither leg enabled reports ok=true (no required fields)", () => {
  const v = validateAttachedTpSl(empty);
  assert.equal(v.ok, true);
  assert.equal(v.tpError, null);
  assert.equal(v.slError, null);
});

test("whitespace is trimmed before being sent on the wire", () => {
  const out = buildAttachedTpSlPayload({
    ...empty,
    tpEnabled: true,
    tpPrice1e8: "  1500000000  ",
  });
  assert.equal(out.take_profit.trigger_price_1e8, "1500000000");
  assert.equal(out.take_profit.limit_price_1e8, "1500000000");
});
