// ATTACHED-TP-SL-TICKET-UI-V1 — wire-contract tests for the
// payload builder + validator. Re-implements the helpers in pure
// JS so the test never imports React or the trading-api client
// and stays runnable under `node --test`. Keep in lock-step with
// `src/lib/attached-tp-sl-payload.ts`.

import { test } from "node:test";
import assert from "node:assert/strict";

function parsePositive1e8(raw, label) {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { value: null, error: `${label} is required` };
  if (!/^\d+$/.test(trimmed)) {
    return {
      value: null,
      error: `${label} must be a non-negative integer (1e8 fixed-point)`,
    };
  }
  let parsed;
  try {
    parsed = BigInt(trimmed);
  } catch {
    return { value: null, error: `${label} is not a valid integer` };
  }
  if (parsed <= BigInt(0)) return { value: null, error: `${label} must be > 0` };
  return { value: trimmed, error: null };
}

function validateAttachedTpSl(state) {
  let tpTriggerError = null;
  let tpLimitError = null;
  let slTriggerError = null;
  let slLimitError = null;
  if (state.tpEnabled) {
    tpTriggerError = parsePositive1e8(state.tpTrigger1e8, "TP trigger").error;
    tpLimitError = parsePositive1e8(state.tpLimit1e8, "TP limit").error;
  }
  if (state.slEnabled) {
    slTriggerError = parsePositive1e8(state.slTrigger1e8, "SL trigger").error;
    slLimitError = parsePositive1e8(state.slLimit1e8, "SL limit").error;
  }
  const ok =
    tpTriggerError === null &&
    tpLimitError === null &&
    slTriggerError === null &&
    slLimitError === null;
  return { tpTriggerError, tpLimitError, slTriggerError, slLimitError, ok };
}

function buildAttachedTpSlPayload(state) {
  if (!state.tpEnabled && !state.slEnabled) return undefined;
  const validation = validateAttachedTpSl(state);
  if (!validation.ok) return undefined;
  const out = {};
  if (state.tpEnabled) {
    out.take_profit = {
      trigger_price_1e8: state.tpTrigger1e8.trim(),
      limit_price_1e8: state.tpLimit1e8.trim(),
    };
  }
  if (state.slEnabled) {
    out.stop_loss = {
      trigger_price_1e8: state.slTrigger1e8.trim(),
      limit_price_1e8: state.slLimit1e8.trim(),
    };
  }
  if (state.tpEnabled && state.slEnabled) out.link_as_oco = true;
  return out;
}

const empty = {
  tpEnabled: false,
  slEnabled: false,
  tpTrigger1e8: "",
  tpLimit1e8: "",
  slTrigger1e8: "",
  slLimit1e8: "",
};

test("neither leg enabled → payload undefined (ticket omits the field)", () => {
  assert.equal(buildAttachedTpSlPayload(empty), undefined);
});

test("TP-only payload includes take_profit, omits stop_loss and link_as_oco", () => {
  const out = buildAttachedTpSlPayload({
    ...empty,
    tpEnabled: true,
    tpTrigger1e8: "1500000000",
    tpLimit1e8: "1500000000",
  });
  assert.deepEqual(out, {
    take_profit: { trigger_price_1e8: "1500000000", limit_price_1e8: "1500000000" },
  });
  assert.equal(out.stop_loss, undefined);
  assert.equal(out.link_as_oco, undefined);
});

test("SL-only payload includes stop_loss, omits take_profit and link_as_oco", () => {
  const out = buildAttachedTpSlPayload({
    ...empty,
    slEnabled: true,
    slTrigger1e8: "500000000",
    slLimit1e8: "500000000",
  });
  assert.deepEqual(out, {
    stop_loss: { trigger_price_1e8: "500000000", limit_price_1e8: "500000000" },
  });
});

test("TP+SL forces link_as_oco=true in the payload", () => {
  const out = buildAttachedTpSlPayload({
    tpEnabled: true,
    slEnabled: true,
    tpTrigger1e8: "1500000000",
    tpLimit1e8: "1500000000",
    slTrigger1e8: "500000000",
    slLimit1e8: "500000000",
  });
  assert.equal(out.link_as_oco, true);
  assert.equal(out.take_profit.trigger_price_1e8, "1500000000");
  assert.equal(out.stop_loss.trigger_price_1e8, "500000000");
});

test("any invalid enabled-leg field → payload undefined (UI surfaces per-field error)", () => {
  // Empty trigger when TP is enabled.
  assert.equal(
    buildAttachedTpSlPayload({
      ...empty,
      tpEnabled: true,
      tpTrigger1e8: "",
      tpLimit1e8: "1500000000",
    }),
    undefined,
  );
  // Non-digit input.
  assert.equal(
    buildAttachedTpSlPayload({
      ...empty,
      slEnabled: true,
      slTrigger1e8: "0.5",
      slLimit1e8: "500000000",
    }),
    undefined,
  );
  // Zero price.
  assert.equal(
    buildAttachedTpSlPayload({
      ...empty,
      tpEnabled: true,
      tpTrigger1e8: "0",
      tpLimit1e8: "1500000000",
    }),
    undefined,
  );
});

test("validator returns per-field errors that the UI renders inline", () => {
  const v = validateAttachedTpSl({
    ...empty,
    tpEnabled: true,
    tpTrigger1e8: "",
    tpLimit1e8: "0",
    slEnabled: true,
    slTrigger1e8: "12abc",
    slLimit1e8: "100",
  });
  assert.equal(v.ok, false);
  assert.match(v.tpTriggerError, /required/);
  assert.match(v.tpLimitError, /> 0/);
  assert.match(v.slTriggerError, /non-negative integer/);
  assert.equal(v.slLimitError, null);
});

test("validator with neither leg enabled reports ok=true (no required fields)", () => {
  const v = validateAttachedTpSl(empty);
  assert.equal(v.ok, true);
  assert.equal(v.tpTriggerError, null);
  assert.equal(v.tpLimitError, null);
  assert.equal(v.slTriggerError, null);
  assert.equal(v.slLimitError, null);
});

test("whitespace is trimmed before being sent on the wire", () => {
  const out = buildAttachedTpSlPayload({
    ...empty,
    tpEnabled: true,
    tpTrigger1e8: "  1500000000  ",
    tpLimit1e8: "1500000000",
  });
  assert.equal(out.take_profit.trigger_price_1e8, "1500000000");
});
