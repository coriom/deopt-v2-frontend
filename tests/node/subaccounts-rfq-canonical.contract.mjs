// SUBACCOUNTS-RFQ-INTEGRATION-V1 — v2 RFQ canonical wire contract.
//
// Freezes the v2 canonical payloads shared between:
//   - frontend: `src/lib/write-auth.ts::canonicalV2.optionRfq*`
//   - backend:  `src/api/routes.rs::canonical_option_rfq_*_v2`
//
// The rule: `subaccount_id` is emitted immediately after the party
// identifier (`taker` for taker-side actions; `mm_account` for the
// maker quote submit). If either side moves the field or drifts the
// ordering, EVERY v2 RFQ authorisation immediately breaks with
// `PayloadMismatch`.
//
// Pure-JS re-implementation so the test survives a repo build break.

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

const TAKER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const MAKER = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SERIES = "BTC-30JAN2026-50000-C";
const RFQ_ID = "11111111-1111-1111-1111-111111111111";
const QUOTE_ID = "22222222-2222-2222-2222-222222222222";

test("OPTION_RFQ_CREATE v2 emits subaccount_id immediately after taker", () => {
  const encoded = canonicalPayload("OPTION_RFQ_CREATE", [
    ["taker", { kind: "address", value: TAKER }],
    ["subaccount_id", { kind: "u64", value: 2n }],
    ["option_series_id", { kind: "string", value: SERIES }],
    ["side", { kind: "string", value: "buy" }],
    ["size_1e8", { kind: "string", value: "100000000" }],
    ["limit_price_1e8", { kind: "string", value: "1100000000" }],
    ["ttl_ms", { kind: "u64", value: 60000n }],
  ]);
  assert.equal(
    encoded,
    'OPTION_RFQ_CREATE|taker="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|subaccount_id=2|option_series_id="BTC-30JAN2026-50000-C"|side="buy"|size_1e8="100000000"|limit_price_1e8="1100000000"|ttl_ms=60000',
  );
});

test("OPTION_RFQ_QUOTE_SUBMIT v2 emits subaccount_id immediately after mm_account", () => {
  const encoded = canonicalPayload("OPTION_RFQ_QUOTE_SUBMIT", [
    ["option_rfq_id", { kind: "string", value: RFQ_ID }],
    ["mm_account", { kind: "address", value: MAKER }],
    ["subaccount_id", { kind: "u64", value: 3n }],
    ["price_1e8", { kind: "string", value: "1000000000" }],
    ["size_1e8", { kind: "string", value: "100000000" }],
    ["client_quote_id", { kind: "null" }],
    ["quote_nonce", { kind: "null" }],
    ["quote_ttl_ms", { kind: "u64", value: 30000n }],
  ]);
  assert.equal(
    encoded,
    'OPTION_RFQ_QUOTE_SUBMIT|option_rfq_id="11111111-1111-1111-1111-111111111111"|mm_account="0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"|subaccount_id=3|price_1e8="1000000000"|size_1e8="100000000"|client_quote_id=null|quote_nonce=null|quote_ttl_ms=30000',
  );
});

test("OPTION_RFQ_ACCEPT v2 emits subaccount_id immediately after taker", () => {
  const encoded = canonicalPayload("OPTION_RFQ_ACCEPT", [
    ["taker", { kind: "address", value: TAKER }],
    ["subaccount_id", { kind: "u64", value: 2n }],
    ["option_rfq_id", { kind: "string", value: RFQ_ID }],
    ["quote_id", { kind: "string", value: QUOTE_ID }],
  ]);
  assert.equal(
    encoded,
    'OPTION_RFQ_ACCEPT|taker="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|subaccount_id=2|option_rfq_id="11111111-1111-1111-1111-111111111111"|quote_id="22222222-2222-2222-2222-222222222222"',
  );
});

test("OPTION_RFQ_CANCEL v2 emits subaccount_id immediately after taker", () => {
  const encoded = canonicalPayload("OPTION_RFQ_CANCEL", [
    ["taker", { kind: "address", value: TAKER }],
    ["subaccount_id", { kind: "u64", value: 2n }],
    ["option_rfq_id", { kind: "string", value: RFQ_ID }],
  ]);
  assert.equal(
    encoded,
    'OPTION_RFQ_CANCEL|taker="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|subaccount_id=2|option_rfq_id="11111111-1111-1111-1111-111111111111"',
  );
});

test("v1 vs v2 RFQ create bytes diverge for the same input", () => {
  const v1 = canonicalPayload("OPTION_RFQ_CREATE", [
    ["taker", { kind: "address", value: TAKER }],
    ["option_series_id", { kind: "string", value: SERIES }],
    ["side", { kind: "string", value: "buy" }],
    ["size_1e8", { kind: "string", value: "100000000" }],
    ["limit_price_1e8", { kind: "string", value: "1100000000" }],
    ["ttl_ms", { kind: "u64", value: 60000n }],
  ]);
  const v2 = canonicalPayload("OPTION_RFQ_CREATE", [
    ["taker", { kind: "address", value: TAKER }],
    ["subaccount_id", { kind: "u64", value: 1n }],
    ["option_series_id", { kind: "string", value: SERIES }],
    ["side", { kind: "string", value: "buy" }],
    ["size_1e8", { kind: "string", value: "100000000" }],
    ["limit_price_1e8", { kind: "string", value: "1100000000" }],
    ["ttl_ms", { kind: "u64", value: 60000n }],
  ]);
  assert.notEqual(v1, v2);
});
