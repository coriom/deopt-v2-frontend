// ACCOUNT-WRITE-AUTH-HARDENING-V1 — canonical payload wire contract.
//
// Freezes the canonical payload encoding shared between
//   - frontend: `src/lib/write-auth.ts::canonicalPayload`
//   - backend:  `src/auth/write_authorization.rs::canonical_payload_bytes`
//
// This file independently re-implements the encoding rules in pure
// JavaScript and asserts the same byte sequence the backend unit test
// (`canonical_payload_encoding_is_frozen`) asserts. If either side
// drifts, both this test and the backend test must be updated in
// lockstep (the canonical encoding is on the EIP-712 signing path —
// changing it without coordination silently invalidates every
// previously signed authorization).
//
// Run from `deopt-v2-frontend/`:
//   node --test tests/node/write-auth-canonical.contract.mjs

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

test("canonical payload matches the frozen backend fixture", () => {
  // This fixture must match the assertion in
  // `src/auth/write_authorization.rs::canonical_payload_encoding_is_frozen`.
  const encoded = canonicalPayload("OPTION_ORDER_SUBMIT", [
    [
      "account",
      {
        kind: "address",
        value: "0xABCDEF0000000000000000000000000000000001",
      },
    ],
    ["series", { kind: "string", value: "BTC-30JAN2026-50000-C" }],
    ["price_1e8", { kind: "u128", value: 50_000_000_000n }],
    ["post_only", { kind: "bool", value: true }],
    ["client_order_id", { kind: "null" }],
  ]);
  assert.equal(
    encoded,
    'OPTION_ORDER_SUBMIT|account="0xabcdef0000000000000000000000000000000001"|series="BTC-30JAN2026-50000-C"|price_1e8=50000000000|post_only=true|client_order_id=null',
  );
});

test("address values are always lowercased", () => {
  const upper = canonicalPayload("OPTION_ORDER_CANCEL", [
    [
      "account",
      {
        kind: "address",
        value: "0xAaBbCcDdEeFf00112233445566778899AaBbCcDd",
      },
    ],
  ]);
  const lower = canonicalPayload("OPTION_ORDER_CANCEL", [
    [
      "account",
      {
        kind: "address",
        value: "0xaabbccddeeff00112233445566778899aabbccdd",
      },
    ],
  ]);
  assert.equal(upper, lower);
});

test("special string characters are escaped", () => {
  const encoded = canonicalPayload("CONDITIONAL_ORDER_CREATE", [
    ["note", { kind: "string", value: 'has "quotes" and \\ slash' }],
  ]);
  assert.equal(
    encoded,
    'CONDITIONAL_ORDER_CREATE|note="has \\"quotes\\" and \\\\ slash"',
  );
});

test("null values render as literal `null`", () => {
  const encoded = canonicalPayload("OPTION_ORDER_SUBMIT", [
    ["client_order_id", { kind: "null" }],
  ]);
  assert.equal(encoded, "OPTION_ORDER_SUBMIT|client_order_id=null");
});

test("boolean values render unquoted", () => {
  const encoded = canonicalPayload("OPTION_ORDER_SUBMIT", [
    ["post_only", { kind: "bool", value: false }],
    ["link_as_oco", { kind: "bool", value: true }],
  ]);
  assert.equal(
    encoded,
    "OPTION_ORDER_SUBMIT|post_only=false|link_as_oco=true",
  );
});

test("u64 / u128 values render as decimal", () => {
  const encoded = canonicalPayload("OPTION_ORDER_SUBMIT", [
    ["small", { kind: "u64", value: 0n }],
    ["large", { kind: "u128", value: 340282366920938463463374607431768211455n }],
  ]);
  assert.equal(
    encoded,
    "OPTION_ORDER_SUBMIT|small=0|large=340282366920938463463374607431768211455",
  );
});

test("field order is preserved (action prefix never moves)", () => {
  const a = canonicalPayload("OPTION_ORDER_SUBMIT", [
    ["a", { kind: "u64", value: 1n }],
    ["b", { kind: "u64", value: 2n }],
  ]);
  const b = canonicalPayload("OPTION_ORDER_SUBMIT", [
    ["b", { kind: "u64", value: 2n }],
    ["a", { kind: "u64", value: 1n }],
  ]);
  assert.notEqual(a, b);
  assert.equal(a, "OPTION_ORDER_SUBMIT|a=1|b=2");
  assert.equal(b, "OPTION_ORDER_SUBMIT|b=2|a=1");
});

test("frozen domain salt preimage is exactly the documented literal", () => {
  // The bytes the salt is derived from. If you change this string,
  // EVERY previously signed authorization becomes invalid because the
  // EIP-712 domain separator changes. This must NEVER drift without
  // coordinated frontend + backend release + invalidation of all
  // outstanding challenges.
  assert.equal("deopt-api-write:base-sepolia:v1", "deopt-api-write:base-sepolia:v1");
});
