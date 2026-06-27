// FRONTEND-LIFECYCLE-OBSERVABILITY-V1 — wire-contract test for the
// lifecycle frame parser.
//
// Re-implements `parseLifecycleFrame` in pure JS (matching
// `src/lib/lifecycle-parse.ts` exactly) and asserts that the
// fixtures the backend emits are accepted, malformed frames are
// rejected without throwing, and unknown payload variants return
// null so the UI can ignore them safely.
//
// If you change `src/lib/lifecycle-parse.ts`, change this file too.
// They are intentionally a wire contract pair.

import { test } from "node:test";
import assert from "node:assert/strict";

const LIFECYCLE_CHANNELS = new Set([
  "account.orders",
  "account.fills",
  "account.conditional_orders",
]);

function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function nullableString(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  return null;
}

function parseOrderUpdated(raw) {
  const { order_id, option_series_id, status, remaining_size_1e8, size_1e8 } = raw;
  if (
    typeof order_id !== "string" ||
    typeof option_series_id !== "string" ||
    typeof status !== "string" ||
    typeof remaining_size_1e8 !== "string" ||
    typeof size_1e8 !== "string"
  ) {
    return null;
  }
  return {
    type: "order_updated",
    order_id,
    option_series_id,
    status,
    remaining_size_1e8,
    size_1e8,
  };
}

function parseFillCreated(raw) {
  const {
    fill_id,
    option_series_id,
    order_id,
    side,
    price_1e8,
    size_1e8,
    created_at_ms,
  } = raw;
  if (
    typeof fill_id !== "string" ||
    typeof option_series_id !== "string" ||
    typeof order_id !== "string" ||
    !(side === "buy" || side === "sell") ||
    typeof price_1e8 !== "string" ||
    typeof size_1e8 !== "string" ||
    typeof created_at_ms !== "number"
  ) {
    return null;
  }
  return {
    type: "fill_created",
    fill_id,
    option_series_id,
    order_id,
    side,
    price_1e8,
    size_1e8,
    created_at_ms,
  };
}

function parseConditionalOrderUpdated(raw) {
  const { conditional_order_id, option_series_id, status } = raw;
  if (
    typeof conditional_order_id !== "string" ||
    typeof option_series_id !== "string" ||
    typeof status !== "string"
  ) {
    return null;
  }
  return {
    type: "conditional_order_updated",
    conditional_order_id,
    option_series_id,
    status,
    child_order_id: nullableString(raw.child_order_id),
    oco_group_id: nullableString(raw.oco_group_id),
    failure_code: nullableString(raw.failure_code),
  };
}

function parsePayload(raw) {
  if (!isObject(raw)) return null;
  const tag = raw.type;
  if (typeof tag !== "string") return null;
  switch (tag) {
    case "order_updated":
      return parseOrderUpdated(raw);
    case "fill_created":
      return parseFillCreated(raw);
    case "conditional_order_updated":
      return parseConditionalOrderUpdated(raw);
    default:
      return null;
  }
}

function parseLifecycleFrame(raw) {
  let frame;
  try {
    frame = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(frame)) return null;
  if (frame.method !== "subscription") return null;
  const params = frame.params;
  if (!isObject(params)) return null;
  const channel = params.channel;
  if (typeof channel !== "string") return null;
  if (!LIFECYCLE_CHANNELS.has(channel)) return null;
  const { event_id, seq, address, generated_at_ms, data } = params;
  if (typeof event_id !== "string") return null;
  if (typeof seq !== "number") return null;
  if (typeof address !== "string") return null;
  if (typeof generated_at_ms !== "number") return null;
  if (!isObject(data)) return null;
  if (data.type !== "lifecycle_delta") return null;
  if (typeof data.emitted_at_ms !== "number") return null;
  const payload = parsePayload(data.payload);
  if (!payload) return null;
  return {
    channel,
    event_id,
    seq,
    address,
    emitted_at_ms: data.emitted_at_ms,
    generated_at_ms,
    payload,
  };
}

function frame(channel, payload) {
  return JSON.stringify({
    jsonrpc: "2.0",
    method: "subscription",
    params: {
      subscription_id: "sub_test",
      channel,
      seq: 1,
      event_id: "evt_test_1",
      source: "backend",
      chain_id: 84532,
      generated_at_ms: 1782000000000,
      address: "0xabc",
      data: {
        type: "lifecycle_delta",
        emitted_at_ms: 1782000000000,
        payload,
      },
    },
  });
}

test("malformed JSON returns null, never throws", () => {
  assert.equal(parseLifecycleFrame("not-json"), null);
  assert.equal(parseLifecycleFrame(""), null);
  assert.equal(parseLifecycleFrame("[]"), null);
});

test("non-subscription frames are ignored", () => {
  const f = JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: true } });
  assert.equal(parseLifecycleFrame(f), null);
});

test("non-lifecycle channels are ignored (no public-channel leakage)", () => {
  const f = frame("trading.health", {
    type: "order_updated",
    order_id: "o1",
    option_series_id: "s1",
    status: "open",
    remaining_size_1e8: "100",
    size_1e8: "100",
  });
  assert.equal(parseLifecycleFrame(f), null);
});

test("unknown payload `type` returns null (forward-compat)", () => {
  const f = frame("account.orders", {
    type: "future_unknown_variant",
    foo: "bar",
  });
  assert.equal(parseLifecycleFrame(f), null);
});

test("valid OrderUpdated parses with full fields", () => {
  const f = frame("account.orders", {
    type: "order_updated",
    order_id: "o-123",
    option_series_id: "0xabc",
    status: "partially_filled",
    remaining_size_1e8: "50",
    size_1e8: "100",
  });
  const ev = parseLifecycleFrame(f);
  assert.equal(ev?.channel, "account.orders");
  assert.equal(ev?.payload.type, "order_updated");
  if (ev?.payload.type !== "order_updated") throw new Error("type narrow");
  assert.equal(ev.payload.order_id, "o-123");
  assert.equal(ev.payload.status, "partially_filled");
});

test("OrderUpdated missing remaining_size_1e8 returns null", () => {
  const f = frame("account.orders", {
    type: "order_updated",
    order_id: "o-1",
    option_series_id: "s",
    status: "open",
    size_1e8: "100",
  });
  assert.equal(parseLifecycleFrame(f), null);
});

test("valid FillCreated parses", () => {
  const f = frame("account.fills", {
    type: "fill_created",
    fill_id: "f-1",
    option_series_id: "s",
    order_id: "o",
    side: "buy",
    price_1e8: "10",
    size_1e8: "5",
    created_at_ms: 1782000000000,
  });
  const ev = parseLifecycleFrame(f);
  assert.equal(ev?.payload.type, "fill_created");
});

test("FillCreated with non-buy/sell side returns null", () => {
  const f = frame("account.fills", {
    type: "fill_created",
    fill_id: "f",
    option_series_id: "s",
    order_id: "o",
    side: "long",
    price_1e8: "1",
    size_1e8: "1",
    created_at_ms: 0,
  });
  assert.equal(parseLifecycleFrame(f), null);
});

test("ConditionalOrderUpdated with all optionals null parses", () => {
  const f = frame("account.conditional_orders", {
    type: "conditional_order_updated",
    conditional_order_id: "c-1",
    option_series_id: "s",
    status: "armed",
    child_order_id: null,
    oco_group_id: null,
    failure_code: null,
  });
  const ev = parseLifecycleFrame(f);
  assert.equal(ev?.payload.type, "conditional_order_updated");
  if (ev?.payload.type !== "conditional_order_updated") throw new Error("narrow");
  assert.equal(ev.payload.child_order_id, null);
});

test("ConditionalOrderUpdated with failure_code passes through", () => {
  const f = frame("account.conditional_orders", {
    type: "conditional_order_updated",
    conditional_order_id: "c-1",
    option_series_id: "s",
    status: "cancelled",
    child_order_id: null,
    oco_group_id: "g-1",
    failure_code: "oco_sibling_triggered",
  });
  const ev = parseLifecycleFrame(f);
  if (ev?.payload.type !== "conditional_order_updated") throw new Error("narrow");
  assert.equal(ev.payload.failure_code, "oco_sibling_triggered");
  assert.equal(ev.payload.oco_group_id, "g-1");
});

test("missing event_id / seq / address rejects the frame", () => {
  const f = JSON.stringify({
    jsonrpc: "2.0",
    method: "subscription",
    params: {
      subscription_id: "x",
      channel: "account.orders",
      // no event_id
      seq: 1,
      address: "0x",
      generated_at_ms: 0,
      data: {
        type: "lifecycle_delta",
        emitted_at_ms: 0,
        payload: {
          type: "order_updated",
          order_id: "o",
          option_series_id: "s",
          status: "open",
          remaining_size_1e8: "1",
          size_1e8: "1",
        },
      },
    },
  });
  assert.equal(parseLifecycleFrame(f), null);
});

test("non-lifecycle_delta data.type returns null", () => {
  const f = JSON.stringify({
    jsonrpc: "2.0",
    method: "subscription",
    params: {
      subscription_id: "x",
      channel: "account.orders",
      seq: 1,
      event_id: "e",
      address: "0x",
      generated_at_ms: 0,
      data: { type: "snapshot", emitted_at_ms: 0, payload: {} },
    },
  });
  assert.equal(parseLifecycleFrame(f), null);
});
