// SUBACCOUNTS-FRONTEND-SWITCHER-V1 — v2 canonical wire contract.
//
// Freezes the shape of the v2 canonical payloads shared between
//   - frontend: `src/lib/write-auth.ts::canonicalV2.*`
//   - backend:  `src/api/routes.rs::canonical_*_v2` (all six Options
//     mutations + SUBACCOUNT_CREATE / SUBACCOUNT_RENAME)
//
// The rule the backend enforces: `subaccount_id` is emitted
// immediately after `account`, and every other field is byte-
// identical to the v1 canonical. If either side moves the field or
// changes the ordering, EVERY v2 authorisation immediately breaks
// with `PayloadMismatch`.
//
// This test re-implements the canonical encoding in pure Node.js
// (no viem, no imports from the app) so it survives a repo build
// break.
//
// Run from `deopt-v2-frontend/`:
//   node --test tests/node/subaccounts-canonical.contract.mjs

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

const ACCOUNT = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

test("OPTION_ORDER_SUBMIT v2 emits subaccount_id immediately after account", () => {
  const encoded = canonicalPayload("OPTION_ORDER_SUBMIT", [
    ["account", { kind: "address", value: ACCOUNT }],
    ["subaccount_id", { kind: "u64", value: 2n }],
    ["option_series_id", { kind: "string", value: "BTC-30JAN2026-50000-C" }],
    ["side", { kind: "string", value: "buy" }],
    ["price_1e8", { kind: "string", value: "50000000000" }],
    ["size_1e8", { kind: "string", value: "100000000" }],
    ["time_in_force", { kind: "string", value: "gtc" }],
    ["post_only", { kind: "bool", value: false }],
    ["client_order_id", { kind: "null" }],
  ]);
  assert.equal(
    encoded,
    'OPTION_ORDER_SUBMIT|account="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|subaccount_id=2|option_series_id="BTC-30JAN2026-50000-C"|side="buy"|price_1e8="50000000000"|size_1e8="100000000"|time_in_force="gtc"|post_only=false|client_order_id=null',
  );
});

test("OPTION_ORDER_CANCEL v2 emits subaccount_id immediately after account", () => {
  const encoded = canonicalPayload("OPTION_ORDER_CANCEL", [
    ["account", { kind: "address", value: ACCOUNT }],
    ["subaccount_id", { kind: "u64", value: 7n }],
    ["order_id", { kind: "string", value: "11111111-1111-1111-1111-111111111111" }],
  ]);
  assert.equal(
    encoded,
    'OPTION_ORDER_CANCEL|account="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|subaccount_id=7|order_id="11111111-1111-1111-1111-111111111111"',
  );
});

test("CONDITIONAL_ORDER_CREATE v2 embeds subaccount_id + preserves per-leg fan-out", () => {
  const encoded = canonicalPayload("CONDITIONAL_ORDER_CREATE", [
    ["account", { kind: "address", value: ACCOUNT }],
    ["subaccount_id", { kind: "u64", value: 2n }],
    ["option_series_id", { kind: "string", value: "BTC-30JAN2026-50000-C" }],
    ["quantity_1e8", { kind: "string", value: "100000000" }],
    ["link_as_oco", { kind: "bool", value: true }],
    ["expires_at_ms", { kind: "null" }],
    ["leg_count", { kind: "u64", value: 2n }],
    ["leg0_conditional_type", { kind: "string", value: "take_profit" }],
    ["leg0_trigger_price_1e8", { kind: "string", value: "60000000000" }],
    ["leg0_limit_price_1e8", { kind: "string", value: "59000000000" }],
    ["leg0_trigger_condition", { kind: "null" }],
    ["leg1_conditional_type", { kind: "string", value: "stop_loss" }],
    ["leg1_trigger_price_1e8", { kind: "string", value: "40000000000" }],
    ["leg1_limit_price_1e8", { kind: "string", value: "41000000000" }],
    ["leg1_trigger_condition", { kind: "null" }],
  ]);
  assert.equal(
    encoded,
    'CONDITIONAL_ORDER_CREATE|account="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|subaccount_id=2|option_series_id="BTC-30JAN2026-50000-C"|quantity_1e8="100000000"|link_as_oco=true|expires_at_ms=null|leg_count=2|leg0_conditional_type="take_profit"|leg0_trigger_price_1e8="60000000000"|leg0_limit_price_1e8="59000000000"|leg0_trigger_condition=null|leg1_conditional_type="stop_loss"|leg1_trigger_price_1e8="40000000000"|leg1_limit_price_1e8="41000000000"|leg1_trigger_condition=null',
  );
});

test("CONDITIONAL_ORDER_CANCEL v2 embeds subaccount_id", () => {
  const encoded = canonicalPayload("CONDITIONAL_ORDER_CANCEL", [
    ["account", { kind: "address", value: ACCOUNT }],
    ["subaccount_id", { kind: "u64", value: 3n }],
    ["conditional_order_id", { kind: "string", value: "22222222-2222-2222-2222-222222222222" }],
  ]);
  assert.equal(
    encoded,
    'CONDITIONAL_ORDER_CANCEL|account="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|subaccount_id=3|conditional_order_id="22222222-2222-2222-2222-222222222222"',
  );
});

test("OPTION_TWAP_CREATE v2 embeds subaccount_id", () => {
  const encoded = canonicalPayload("OPTION_TWAP_CREATE", [
    ["account", { kind: "address", value: ACCOUNT }],
    ["subaccount_id", { kind: "u64", value: 5n }],
    ["option_series_id", { kind: "string", value: "BTC-30JAN2026-50000-C" }],
    ["side", { kind: "string", value: "sell" }],
    ["size_1e8", { kind: "string", value: "500000000" }],
    ["limit_price_1e8", { kind: "string", value: "50000000000" }],
    ["running_time_ms", { kind: "u64", value: 3600000n }],
    ["child_count", { kind: "u64", value: 10n }],
    ["client_order_id", { kind: "null" }],
  ]);
  assert.equal(
    encoded,
    'OPTION_TWAP_CREATE|account="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|subaccount_id=5|option_series_id="BTC-30JAN2026-50000-C"|side="sell"|size_1e8="500000000"|limit_price_1e8="50000000000"|running_time_ms=3600000|child_count=10|client_order_id=null',
  );
});

test("OPTION_TWAP_CANCEL v2 embeds subaccount_id", () => {
  const encoded = canonicalPayload("OPTION_TWAP_CANCEL", [
    ["account", { kind: "address", value: ACCOUNT }],
    ["subaccount_id", { kind: "u64", value: 9n }],
    ["option_twap_id", { kind: "string", value: "33333333-3333-3333-3333-333333333333" }],
  ]);
  assert.equal(
    encoded,
    'OPTION_TWAP_CANCEL|account="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|subaccount_id=9|option_twap_id="33333333-3333-3333-3333-333333333333"',
  );
});

test("SUBACCOUNT_CREATE canonical is action + account + name (nullable)", () => {
  const withName = canonicalPayload("SUBACCOUNT_CREATE", [
    ["account", { kind: "address", value: ACCOUNT }],
    ["name", { kind: "string", value: "Alpha book" }],
  ]);
  assert.equal(
    withName,
    'SUBACCOUNT_CREATE|account="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|name="Alpha book"',
  );

  const withoutName = canonicalPayload("SUBACCOUNT_CREATE", [
    ["account", { kind: "address", value: ACCOUNT }],
    ["name", { kind: "null" }],
  ]);
  assert.equal(
    withoutName,
    'SUBACCOUNT_CREATE|account="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|name=null',
  );
});

test("SUBACCOUNT_RENAME canonical is action + account + subaccount_id + name", () => {
  const encoded = canonicalPayload("SUBACCOUNT_RENAME", [
    ["account", { kind: "address", value: ACCOUNT }],
    ["subaccount_id", { kind: "u64", value: 4n }],
    ["name", { kind: "string", value: "Renamed" }],
  ]);
  assert.equal(
    encoded,
    'SUBACCOUNT_RENAME|account="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|subaccount_id=4|name="Renamed"',
  );
});

test("v1 canonical stays byte-identical (no subaccount_id) for OPTION_ORDER_SUBMIT", () => {
  // Regression guard: sending v1 bytes when the envelope version is
  // absent MUST match the pre-migration wire format so Account-1
  // flows keep verifying.
  const encoded = canonicalPayload("OPTION_ORDER_SUBMIT", [
    ["account", { kind: "address", value: ACCOUNT }],
    ["option_series_id", { kind: "string", value: "BTC-30JAN2026-50000-C" }],
    ["side", { kind: "string", value: "buy" }],
    ["price_1e8", { kind: "string", value: "50000000000" }],
    ["size_1e8", { kind: "string", value: "100000000" }],
    ["time_in_force", { kind: "string", value: "gtc" }],
    ["post_only", { kind: "bool", value: false }],
    ["client_order_id", { kind: "null" }],
  ]);
  assert.equal(
    encoded,
    'OPTION_ORDER_SUBMIT|account="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|option_series_id="BTC-30JAN2026-50000-C"|side="buy"|price_1e8="50000000000"|size_1e8="100000000"|time_in_force="gtc"|post_only=false|client_order_id=null',
  );
  // The v1 bytes MUST NOT match the v2 bytes for the same input —
  // that mismatch is what enforces cross-subaccount replay resistance
  // via digest divergence at the challenge verifier.
  const v2 = canonicalPayload("OPTION_ORDER_SUBMIT", [
    ["account", { kind: "address", value: ACCOUNT }],
    ["subaccount_id", { kind: "u64", value: 1n }],
    ["option_series_id", { kind: "string", value: "BTC-30JAN2026-50000-C" }],
    ["side", { kind: "string", value: "buy" }],
    ["price_1e8", { kind: "string", value: "50000000000" }],
    ["size_1e8", { kind: "string", value: "100000000" }],
    ["time_in_force", { kind: "string", value: "gtc" }],
    ["post_only", { kind: "bool", value: false }],
    ["client_order_id", { kind: "null" }],
  ]);
  assert.notEqual(encoded, v2);
});
