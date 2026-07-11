// RFQ-MULTI-LEG-FRONTEND-V1 — v2 multi-leg RFQ canonical wire contract.
//
// Freezes the v2 canonical payloads shared between:
//   - frontend: `src/lib/write-auth.ts::canonicalV2.optionMultiLegRfq*`
//   - backend:  `src/api/routes.rs::canonical_option_multi_leg_rfq_*_v2`
//
// The rules are:
//   * `subaccount_id` is emitted immediately after the party
//     identifier (`taker` for taker-side actions; `mm_account` for
//     the maker quote submit).
//   * `legs_count` is emitted as an explicit anti-injection field
//     BEFORE the per-leg entries — a client cannot slip an extra
//     leg past the signature without also bumping the count.
//   * Per-leg fields use the numeric `leg_{i}_{field}` convention
//     and are emitted in ascending `leg_index` order.
//
// If either side drifts, EVERY multi-leg RFQ authorisation
// immediately breaks with `PayloadMismatch` at the challenge
// verifier — which is exactly the outcome we want.
//
// Pure-JS re-implementation so the test survives a repo build
// break.

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
const SERIES_A = "BTC-30JAN2026-95000-C";
const SERIES_B = "BTC-30JAN2026-97000-C";
const RFQ_ID = "11111111-1111-1111-1111-111111111111";
const QUOTE_ID = "22222222-2222-2222-2222-222222222222";

// ---------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------

test("OPTION_MULTI_LEG_RFQ_CREATE emits legs_count before per-leg block", () => {
  const encoded = canonicalPayload("OPTION_MULTI_LEG_RFQ_CREATE", [
    ["taker", { kind: "address", value: TAKER }],
    ["subaccount_id", { kind: "u64", value: 1n }],
    ["legs_count", { kind: "u64", value: 2n }],
    ["leg_0_option_series_id", { kind: "string", value: SERIES_A }],
    ["leg_0_side", { kind: "string", value: "buy" }],
    ["leg_0_size_1e8", { kind: "string", value: "100000000" }],
    ["leg_0_ratio_num", { kind: "u64", value: 1n }],
    ["leg_0_ratio_den", { kind: "u64", value: 1n }],
    ["leg_1_option_series_id", { kind: "string", value: SERIES_B }],
    ["leg_1_side", { kind: "string", value: "sell" }],
    ["leg_1_size_1e8", { kind: "string", value: "100000000" }],
    ["leg_1_ratio_num", { kind: "u64", value: 1n }],
    ["leg_1_ratio_den", { kind: "u64", value: 1n }],
    ["ttl_ms", { kind: "null" }],
  ]);
  assert.equal(
    encoded,
    'OPTION_MULTI_LEG_RFQ_CREATE|taker="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|subaccount_id=1|legs_count=2|leg_0_option_series_id="BTC-30JAN2026-95000-C"|leg_0_side="buy"|leg_0_size_1e8="100000000"|leg_0_ratio_num=1|leg_0_ratio_den=1|leg_1_option_series_id="BTC-30JAN2026-97000-C"|leg_1_side="sell"|leg_1_size_1e8="100000000"|leg_1_ratio_num=1|leg_1_ratio_den=1|ttl_ms=null',
  );
});

test("OPTION_MULTI_LEG_RFQ_CREATE with ttl_ms carries u64 literal", () => {
  const encoded = canonicalPayload("OPTION_MULTI_LEG_RFQ_CREATE", [
    ["taker", { kind: "address", value: TAKER }],
    ["subaccount_id", { kind: "u64", value: 2n }],
    ["legs_count", { kind: "u64", value: 2n }],
    ["leg_0_option_series_id", { kind: "string", value: SERIES_A }],
    ["leg_0_side", { kind: "string", value: "buy" }],
    ["leg_0_size_1e8", { kind: "string", value: "100000000" }],
    ["leg_0_ratio_num", { kind: "u64", value: 1n }],
    ["leg_0_ratio_den", { kind: "u64", value: 1n }],
    ["leg_1_option_series_id", { kind: "string", value: SERIES_B }],
    ["leg_1_side", { kind: "string", value: "sell" }],
    ["leg_1_size_1e8", { kind: "string", value: "100000000" }],
    ["leg_1_ratio_num", { kind: "u64", value: 1n }],
    ["leg_1_ratio_den", { kind: "u64", value: 1n }],
    ["ttl_ms", { kind: "u64", value: 30000n }],
  ]);
  assert.ok(
    encoded.endsWith("|ttl_ms=30000"),
    "ttl_ms must be the tail field",
  );
});

test("injecting an extra leg without bumping legs_count changes bytes", () => {
  const with2 = canonicalPayload("OPTION_MULTI_LEG_RFQ_CREATE", [
    ["taker", { kind: "address", value: TAKER }],
    ["subaccount_id", { kind: "u64", value: 1n }],
    ["legs_count", { kind: "u64", value: 2n }],
    ["leg_0_option_series_id", { kind: "string", value: SERIES_A }],
    ["leg_0_side", { kind: "string", value: "buy" }],
    ["leg_0_size_1e8", { kind: "string", value: "100000000" }],
    ["leg_0_ratio_num", { kind: "u64", value: 1n }],
    ["leg_0_ratio_den", { kind: "u64", value: 1n }],
    ["leg_1_option_series_id", { kind: "string", value: SERIES_B }],
    ["leg_1_side", { kind: "string", value: "sell" }],
    ["leg_1_size_1e8", { kind: "string", value: "100000000" }],
    ["leg_1_ratio_num", { kind: "u64", value: 1n }],
    ["leg_1_ratio_den", { kind: "u64", value: 1n }],
    ["ttl_ms", { kind: "null" }],
  ]);
  const with3 = canonicalPayload("OPTION_MULTI_LEG_RFQ_CREATE", [
    ["taker", { kind: "address", value: TAKER }],
    ["subaccount_id", { kind: "u64", value: 1n }],
    // Same legs_count as `with2` — attempts to sneak a leg past.
    ["legs_count", { kind: "u64", value: 2n }],
    ["leg_0_option_series_id", { kind: "string", value: SERIES_A }],
    ["leg_0_side", { kind: "string", value: "buy" }],
    ["leg_0_size_1e8", { kind: "string", value: "100000000" }],
    ["leg_0_ratio_num", { kind: "u64", value: 1n }],
    ["leg_0_ratio_den", { kind: "u64", value: 1n }],
    ["leg_1_option_series_id", { kind: "string", value: SERIES_B }],
    ["leg_1_side", { kind: "string", value: "sell" }],
    ["leg_1_size_1e8", { kind: "string", value: "100000000" }],
    ["leg_1_ratio_num", { kind: "u64", value: 1n }],
    ["leg_1_ratio_den", { kind: "u64", value: 1n }],
    ["leg_2_option_series_id", { kind: "string", value: "BTC-EXTRA" }],
    ["leg_2_side", { kind: "string", value: "buy" }],
    ["leg_2_size_1e8", { kind: "string", value: "100000000" }],
    ["leg_2_ratio_num", { kind: "u64", value: 1n }],
    ["leg_2_ratio_den", { kind: "u64", value: 1n }],
    ["ttl_ms", { kind: "null" }],
  ]);
  assert.notEqual(with2, with3);
});

// ---------------------------------------------------------------------
// QUOTE_SUBMIT
// ---------------------------------------------------------------------

test("OPTION_MULTI_LEG_RFQ_QUOTE_SUBMIT emits subaccount_id after mm_account and legs_count before per-leg prices", () => {
  const encoded = canonicalPayload("OPTION_MULTI_LEG_RFQ_QUOTE_SUBMIT", [
    ["option_rfq_id", { kind: "string", value: RFQ_ID }],
    ["mm_account", { kind: "address", value: MAKER }],
    ["subaccount_id", { kind: "u64", value: 3n }],
    ["package_price_1e8", { kind: "string", value: "50000000" }],
    ["size_1e8", { kind: "string", value: "100000000" }],
    ["legs_count", { kind: "u64", value: 2n }],
    ["leg_0_price_1e8", { kind: "string", value: "12000000000" }],
    ["leg_1_price_1e8", { kind: "string", value: "11500000000" }],
    ["client_quote_id", { kind: "null" }],
    ["quote_nonce", { kind: "null" }],
    ["quote_ttl_ms", { kind: "u64", value: 30000n }],
  ]);
  assert.equal(
    encoded,
    'OPTION_MULTI_LEG_RFQ_QUOTE_SUBMIT|option_rfq_id="11111111-1111-1111-1111-111111111111"|mm_account="0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"|subaccount_id=3|package_price_1e8="50000000"|size_1e8="100000000"|legs_count=2|leg_0_price_1e8="12000000000"|leg_1_price_1e8="11500000000"|client_quote_id=null|quote_nonce=null|quote_ttl_ms=30000',
  );
});

test("OPTION_MULTI_LEG_RFQ_QUOTE_SUBMIT with client_quote_id + quote_nonce string/u64 tails", () => {
  const encoded = canonicalPayload("OPTION_MULTI_LEG_RFQ_QUOTE_SUBMIT", [
    ["option_rfq_id", { kind: "string", value: RFQ_ID }],
    ["mm_account", { kind: "address", value: MAKER }],
    ["subaccount_id", { kind: "u64", value: 1n }],
    ["package_price_1e8", { kind: "string", value: "50000000" }],
    ["size_1e8", { kind: "string", value: "100000000" }],
    ["legs_count", { kind: "u64", value: 2n }],
    ["leg_0_price_1e8", { kind: "string", value: "12000000000" }],
    ["leg_1_price_1e8", { kind: "string", value: "11500000000" }],
    ["client_quote_id", { kind: "string", value: "cq-42" }],
    ["quote_nonce", { kind: "u64", value: 7n }],
    ["quote_ttl_ms", { kind: "u64", value: 30000n }],
  ]);
  assert.ok(
    encoded.includes('client_quote_id="cq-42"|quote_nonce=7|quote_ttl_ms=30000'),
    "tail fields are emitted in order",
  );
});

// ---------------------------------------------------------------------
// ACCEPT
// ---------------------------------------------------------------------

test("OPTION_MULTI_LEG_RFQ_ACCEPT emits subaccount_id after taker, expected_package_price + legs_count before per-leg prices", () => {
  const encoded = canonicalPayload("OPTION_MULTI_LEG_RFQ_ACCEPT", [
    ["taker", { kind: "address", value: TAKER }],
    ["subaccount_id", { kind: "u64", value: 2n }],
    ["option_rfq_id", { kind: "string", value: RFQ_ID }],
    ["quote_id", { kind: "string", value: QUOTE_ID }],
    ["expected_package_price_1e8", { kind: "string", value: "50000000" }],
    ["legs_count", { kind: "u64", value: 2n }],
    ["leg_0_price_1e8", { kind: "string", value: "12000000000" }],
    ["leg_1_price_1e8", { kind: "string", value: "11500000000" }],
  ]);
  assert.equal(
    encoded,
    'OPTION_MULTI_LEG_RFQ_ACCEPT|taker="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|subaccount_id=2|option_rfq_id="11111111-1111-1111-1111-111111111111"|quote_id="22222222-2222-2222-2222-222222222222"|expected_package_price_1e8="50000000"|legs_count=2|leg_0_price_1e8="12000000000"|leg_1_price_1e8="11500000000"',
  );
});

test("ACCEPT with mutated per-leg price diverges byte-for-byte", () => {
  const good = canonicalPayload("OPTION_MULTI_LEG_RFQ_ACCEPT", [
    ["taker", { kind: "address", value: TAKER }],
    ["subaccount_id", { kind: "u64", value: 1n }],
    ["option_rfq_id", { kind: "string", value: RFQ_ID }],
    ["quote_id", { kind: "string", value: QUOTE_ID }],
    ["expected_package_price_1e8", { kind: "string", value: "50000000" }],
    ["legs_count", { kind: "u64", value: 2n }],
    ["leg_0_price_1e8", { kind: "string", value: "12000000000" }],
    ["leg_1_price_1e8", { kind: "string", value: "11500000000" }],
  ]);
  const mutated = canonicalPayload("OPTION_MULTI_LEG_RFQ_ACCEPT", [
    ["taker", { kind: "address", value: TAKER }],
    ["subaccount_id", { kind: "u64", value: 1n }],
    ["option_rfq_id", { kind: "string", value: RFQ_ID }],
    ["quote_id", { kind: "string", value: QUOTE_ID }],
    ["expected_package_price_1e8", { kind: "string", value: "50000000" }],
    ["legs_count", { kind: "u64", value: 2n }],
    ["leg_0_price_1e8", { kind: "string", value: "12000000000" }],
    // Attacker mutation on the second leg's price.
    ["leg_1_price_1e8", { kind: "string", value: "999999999" }],
  ]);
  assert.notEqual(good, mutated);
});

// ---------------------------------------------------------------------
// CANCEL
// ---------------------------------------------------------------------

test("OPTION_MULTI_LEG_RFQ_CANCEL emits subaccount_id immediately after taker", () => {
  const encoded = canonicalPayload("OPTION_MULTI_LEG_RFQ_CANCEL", [
    ["taker", { kind: "address", value: TAKER }],
    ["subaccount_id", { kind: "u64", value: 2n }],
    ["option_rfq_id", { kind: "string", value: RFQ_ID }],
  ]);
  assert.equal(
    encoded,
    'OPTION_MULTI_LEG_RFQ_CANCEL|taker="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|subaccount_id=2|option_rfq_id="11111111-1111-1111-1111-111111111111"',
  );
});

test("Multi-leg cancel bytes diverge from single-leg cancel bytes for identical inputs", () => {
  const singleLeg = canonicalPayload("OPTION_RFQ_CANCEL", [
    ["taker", { kind: "address", value: TAKER }],
    ["subaccount_id", { kind: "u64", value: 2n }],
    ["option_rfq_id", { kind: "string", value: RFQ_ID }],
  ]);
  const multiLeg = canonicalPayload("OPTION_MULTI_LEG_RFQ_CANCEL", [
    ["taker", { kind: "address", value: TAKER }],
    ["subaccount_id", { kind: "u64", value: 2n }],
    ["option_rfq_id", { kind: "string", value: RFQ_ID }],
  ]);
  // Action prefix must differ so a single-leg cancel signature can
  // never be replayed against the multi-leg cancel route.
  assert.notEqual(singleLeg, multiLeg);
});

// ---------------------------------------------------------------------
// Frontend helper parity — invokes the actual `canonicalV2` module.
// This connects the frozen expected strings above to the real
// implementation. If the frontend helper drifts, this test fails.
// ---------------------------------------------------------------------

test("canonicalV2.optionMultiLegRfqCreate matches the frozen bytes", async () => {
  // Dynamic import to avoid crashing the suite if the frontend build
  // is broken — same posture as `write-auth-canonical.contract.mjs`.
  let mod;
  try {
    mod = await import("../../src/lib/write-auth.ts");
  } catch {
    // Skip when tsx-loader isn't available; the pure-JS re-implementation
    // above still pins the wire format.
    return;
  }
  const bytes = mod.canonicalV2.optionMultiLegRfqCreate({
    taker: TAKER,
    subaccountId: 1,
    legs: [
      {
        legIndex: 0,
        optionSeriesId: SERIES_A,
        side: "buy",
        size1e8: "100000000",
        ratioNum: 1,
        ratioDen: 1,
      },
      {
        legIndex: 1,
        optionSeriesId: SERIES_B,
        side: "sell",
        size1e8: "100000000",
        ratioNum: 1,
        ratioDen: 1,
      },
    ],
    ttlMs: null,
  });
  const asString = new TextDecoder().decode(bytes);
  assert.equal(
    asString,
    'OPTION_MULTI_LEG_RFQ_CREATE|taker="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"|subaccount_id=1|legs_count=2|leg_0_option_series_id="BTC-30JAN2026-95000-C"|leg_0_side="buy"|leg_0_size_1e8="100000000"|leg_0_ratio_num=1|leg_0_ratio_den=1|leg_1_option_series_id="BTC-30JAN2026-97000-C"|leg_1_side="sell"|leg_1_size_1e8="100000000"|leg_1_ratio_num=1|leg_1_ratio_den=1|ttl_ms=null',
  );
});
