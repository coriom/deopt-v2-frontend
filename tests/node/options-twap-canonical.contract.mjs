// OPTIONS-TWAP-ORDERS-V1 — canonical payload contract test.
//
// Freezes the byte sequence for OPTION_TWAP_CREATE and
// OPTION_TWAP_CANCEL — both are on the write-auth EIP-712 signing
// path, so any drift between frontend + backend silently invalidates
// signed authorizations.

import { test } from "node:test";
import assert from "node:assert/strict";

function escapeCanonicalString(s) {
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else out += ch;
  }
  return out;
}
function encodeCanonical(value) {
  switch (value.kind) {
    case "string":
      return `"${escapeCanonicalString(value.value)}"`;
    case "u64":
    case "u128":
      return String(value.value);
    case "bool":
      return value.value ? "true" : "false";
    case "address":
      return `"${String(value.value).toLowerCase()}"`;
    case "null":
      return "null";
    default:
      throw new Error(`unknown canonical kind: ${value.kind}`);
  }
}
function canonicalPayload(action, fields) {
  let s = action;
  for (const [key, value] of fields) {
    s += `|${key}=${encodeCanonical(value)}`;
  }
  return s;
}

function optionTwapCreate({
  account,
  optionSeriesId,
  side,
  size1e8,
  limitPrice1e8,
  runningTimeMs,
  childCount,
  clientOrderId,
}) {
  return canonicalPayload("OPTION_TWAP_CREATE", [
    ["account", { kind: "address", value: account }],
    ["option_series_id", { kind: "string", value: optionSeriesId }],
    ["side", { kind: "string", value: side }],
    ["size_1e8", { kind: "string", value: size1e8 }],
    ["limit_price_1e8", { kind: "string", value: limitPrice1e8 }],
    ["running_time_ms", { kind: "u64", value: BigInt(runningTimeMs) }],
    ["child_count", { kind: "u64", value: BigInt(childCount) }],
    [
      "client_order_id",
      clientOrderId == null
        ? { kind: "null" }
        : { kind: "string", value: clientOrderId },
    ],
  ]);
}

function optionTwapCancel({ account, optionTwapId }) {
  return canonicalPayload("OPTION_TWAP_CANCEL", [
    ["account", { kind: "address", value: account }],
    ["option_twap_id", { kind: "string", value: optionTwapId }],
  ]);
}

test("OPTION_TWAP_CREATE canonical bytes are frozen (client_order_id null)", () => {
  const encoded = optionTwapCreate({
    account: "0xAaBbCcDdEeFf00112233445566778899AaBbCcDd",
    optionSeriesId: "opt-1",
    side: "buy",
    size1e8: "400000000",
    limitPrice1e8: "1000000000",
    runningTimeMs: 60000,
    childCount: 4,
    clientOrderId: null,
  });
  assert.equal(
    encoded,
    'OPTION_TWAP_CREATE|account="0xaabbccddeeff00112233445566778899aabbccdd"|option_series_id="opt-1"|side="buy"|size_1e8="400000000"|limit_price_1e8="1000000000"|running_time_ms=60000|child_count=4|client_order_id=null',
  );
});

test("OPTION_TWAP_CREATE canonical bytes are frozen (client_order_id populated)", () => {
  const encoded = optionTwapCreate({
    account: "0x0000000000000000000000000000000000000001",
    optionSeriesId: "opt-42",
    side: "sell",
    size1e8: "100000000",
    limitPrice1e8: "9500000000",
    runningTimeMs: 900000,
    childCount: 10,
    clientOrderId: "twap-1",
  });
  assert.equal(
    encoded,
    'OPTION_TWAP_CREATE|account="0x0000000000000000000000000000000000000001"|option_series_id="opt-42"|side="sell"|size_1e8="100000000"|limit_price_1e8="9500000000"|running_time_ms=900000|child_count=10|client_order_id="twap-1"',
  );
});

test("OPTION_TWAP_CANCEL canonical bytes are frozen", () => {
  const encoded = optionTwapCancel({
    account: "0xABCDEF0000000000000000000000000000000001",
    optionTwapId: "550e8400-e29b-41d4-a716-446655440000",
  });
  assert.equal(
    encoded,
    'OPTION_TWAP_CANCEL|account="0xabcdef0000000000000000000000000000000001"|option_twap_id="550e8400-e29b-41d4-a716-446655440000"',
  );
});

test("OPTION_TWAP_CREATE field order is enforced", () => {
  const encoded = optionTwapCreate({
    account: "0x0000000000000000000000000000000000000001",
    optionSeriesId: "opt-1",
    side: "buy",
    size1e8: "1",
    limitPrice1e8: "1",
    runningTimeMs: 60000,
    childCount: 1,
    clientOrderId: null,
  });
  const order = [
    "account=",
    "option_series_id=",
    "side=",
    "size_1e8=",
    "limit_price_1e8=",
    "running_time_ms=",
    "child_count=",
    "client_order_id=",
  ];
  let prev = -1;
  for (const key of order) {
    const idx = encoded.indexOf(key);
    assert.ok(idx > prev, `field order violated near ${key}`);
    prev = idx;
  }
});

test("addresses in OPTION_TWAP payloads are always lowercased", () => {
  const upper = optionTwapCancel({
    account: "0xABCDEF0000000000000000000000000000000001",
    optionTwapId: "id-1",
  });
  const lower = optionTwapCancel({
    account: "0xabcdef0000000000000000000000000000000001",
    optionTwapId: "id-1",
  });
  assert.equal(upper, lower);
});
