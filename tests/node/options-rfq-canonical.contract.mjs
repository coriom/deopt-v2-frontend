// OPTIONS-RFQ-CREATE-AND-LIFECYCLE-V1 — canonical payload contract
// test.
//
// Freezes the byte sequence for the OPTION_RFQ_CREATE and
// OPTION_RFQ_CANCEL canonical payloads shared between:
//   - frontend: `src/lib/write-auth.ts::canonical.optionRfqCreate` +
//     `canonical.optionRfqCancel`
//   - backend:  `src/api/routes.rs::canonical_option_rfq_create` +
//     `canonical_option_rfq_cancel`
//
// Any change here MUST be coordinated with the backend fixture —
// the encoded bytes flow into the EIP-712 typed data as the `payload`
// field, so any drift silently invalidates all outstanding signed
// authorizations.
//
// Run from `deopt-v2-frontend/`:
//   node --test tests/node/options-rfq-canonical.contract.mjs

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

// Reproduction of `canonical.optionRfqCreate` from write-auth.ts.
// Field order must match backend `canonical_option_rfq_create`.
function optionRfqCreate({ taker, optionSeriesId, side, size1e8, limitPrice1e8, ttlMs }) {
  return canonicalPayload("OPTION_RFQ_CREATE", [
    ["taker", { kind: "address", value: taker }],
    ["option_series_id", { kind: "string", value: optionSeriesId }],
    ["side", { kind: "string", value: side }],
    ["size_1e8", { kind: "string", value: size1e8 }],
    [
      "limit_price_1e8",
      limitPrice1e8 == null
        ? { kind: "null" }
        : { kind: "string", value: limitPrice1e8 },
    ],
    [
      "ttl_ms",
      ttlMs == null ? { kind: "null" } : { kind: "u64", value: BigInt(ttlMs) },
    ],
  ]);
}

function optionRfqCancel({ taker, optionRfqId }) {
  return canonicalPayload("OPTION_RFQ_CANCEL", [
    ["taker", { kind: "address", value: taker }],
    ["option_rfq_id", { kind: "string", value: optionRfqId }],
  ]);
}

// Reproduction of `canonical.optionRfqAccept` from write-auth.ts.
// Field order must match backend `canonical_option_rfq_accept`:
// taker | option_rfq_id | quote_id.
function optionRfqAccept({ taker, optionRfqId, quoteId }) {
  return canonicalPayload("OPTION_RFQ_ACCEPT", [
    ["taker", { kind: "address", value: taker }],
    ["option_rfq_id", { kind: "string", value: optionRfqId }],
    ["quote_id", { kind: "string", value: quoteId }],
  ]);
}

// Reproduction of `canonical.optionRfqQuoteSubmit` from write-auth.ts.
// Field order must match backend `canonical_option_rfq_quote_submit`:
// option_rfq_id | mm_account | price_1e8 | size_1e8 |
// client_quote_id | quote_nonce | quote_ttl_ms.
function optionRfqQuoteSubmit({
  optionRfqId,
  mmAccount,
  price1e8,
  size1e8,
  clientQuoteId,
  quoteNonce,
  quoteTtlMs,
}) {
  return canonicalPayload("OPTION_RFQ_QUOTE_SUBMIT", [
    ["option_rfq_id", { kind: "string", value: optionRfqId }],
    ["mm_account", { kind: "address", value: mmAccount }],
    ["price_1e8", { kind: "string", value: price1e8 }],
    ["size_1e8", { kind: "string", value: size1e8 }],
    [
      "client_quote_id",
      clientQuoteId == null
        ? { kind: "null" }
        : { kind: "string", value: clientQuoteId },
    ],
    [
      "quote_nonce",
      quoteNonce == null
        ? { kind: "null" }
        : { kind: "u64", value: BigInt(quoteNonce) },
    ],
    [
      "quote_ttl_ms",
      quoteTtlMs == null
        ? { kind: "null" }
        : { kind: "u64", value: BigInt(quoteTtlMs) },
    ],
  ]);
}

test("OPTION_RFQ_CREATE canonical bytes are frozen (nullable fields null)", () => {
  const encoded = optionRfqCreate({
    taker: "0xAaBbCcDdEeFf00112233445566778899AaBbCcDd",
    optionSeriesId: "opt-1",
    side: "buy",
    size1e8: "100000000",
    limitPrice1e8: null,
    ttlMs: null,
  });
  assert.equal(
    encoded,
    'OPTION_RFQ_CREATE|taker="0xaabbccddeeff00112233445566778899aabbccdd"|option_series_id="opt-1"|side="buy"|size_1e8="100000000"|limit_price_1e8=null|ttl_ms=null',
  );
});

test("OPTION_RFQ_CREATE canonical bytes are frozen (nullable fields set)", () => {
  const encoded = optionRfqCreate({
    taker: "0x0000000000000000000000000000000000000001",
    optionSeriesId: "opt-42",
    side: "sell",
    size1e8: "250000000",
    limitPrice1e8: "3000000000000",
    ttlMs: 5000,
  });
  assert.equal(
    encoded,
    'OPTION_RFQ_CREATE|taker="0x0000000000000000000000000000000000000001"|option_series_id="opt-42"|side="sell"|size_1e8="250000000"|limit_price_1e8="3000000000000"|ttl_ms=5000',
  );
});

test("OPTION_RFQ_CANCEL canonical bytes are frozen", () => {
  const encoded = optionRfqCancel({
    taker: "0xABCDEF0000000000000000000000000000000001",
    optionRfqId: "550e8400-e29b-41d4-a716-446655440000",
  });
  assert.equal(
    encoded,
    'OPTION_RFQ_CANCEL|taker="0xabcdef0000000000000000000000000000000001"|option_rfq_id="550e8400-e29b-41d4-a716-446655440000"',
  );
});

test("side value must be lowercase buy/sell (backend match)", () => {
  const buy = optionRfqCreate({
    taker: "0x0000000000000000000000000000000000000001",
    optionSeriesId: "opt-1",
    side: "buy",
    size1e8: "1",
    limitPrice1e8: null,
    ttlMs: null,
  });
  const sell = optionRfqCreate({
    taker: "0x0000000000000000000000000000000000000001",
    optionSeriesId: "opt-1",
    side: "sell",
    size1e8: "1",
    limitPrice1e8: null,
    ttlMs: null,
  });
  assert.ok(buy.includes('side="buy"'));
  assert.ok(sell.includes('side="sell"'));
});

test("address casing is normalised to lowercase in canonical bytes", () => {
  const upper = optionRfqCancel({
    taker: "0xABCDEF0000000000000000000000000000000001",
    optionRfqId: "id-1",
  });
  const lower = optionRfqCancel({
    taker: "0xabcdef0000000000000000000000000000000001",
    optionRfqId: "id-1",
  });
  assert.equal(upper, lower);
});

// -------------------------------------------------------------------
// OPTIONS-RFQ-QUOTE-SIGNING-ACCEPT-V1 — accept canonical byte freeze.
// -------------------------------------------------------------------

test("OPTION_RFQ_ACCEPT canonical bytes are frozen", () => {
  const encoded = optionRfqAccept({
    taker: "0xAaBbCcDdEeFf00112233445566778899AaBbCcDd",
    optionRfqId: "550e8400-e29b-41d4-a716-446655440000",
    quoteId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  });
  assert.equal(
    encoded,
    'OPTION_RFQ_ACCEPT|taker="0xaabbccddeeff00112233445566778899aabbccdd"|option_rfq_id="550e8400-e29b-41d4-a716-446655440000"|quote_id="6ba7b810-9dad-11d1-80b4-00c04fd430c8"',
  );
});

test("OPTION_RFQ_ACCEPT field order is taker → option_rfq_id → quote_id", () => {
  const encoded = optionRfqAccept({
    taker: "0x0000000000000000000000000000000000000001",
    optionRfqId: "rfq-1",
    quoteId: "q-1",
  });
  const idxTaker = encoded.indexOf("taker=");
  const idxRfq = encoded.indexOf("option_rfq_id=");
  const idxQuote = encoded.indexOf("quote_id=");
  assert.ok(idxTaker > 0);
  assert.ok(idxRfq > idxTaker);
  assert.ok(idxQuote > idxRfq);
});

test("OPTION_RFQ_ACCEPT address casing is normalised to lowercase", () => {
  const upper = optionRfqAccept({
    taker: "0xABCDEF0000000000000000000000000000000001",
    optionRfqId: "rfq-1",
    quoteId: "q-1",
  });
  const lower = optionRfqAccept({
    taker: "0xabcdef0000000000000000000000000000000001",
    optionRfqId: "rfq-1",
    quoteId: "q-1",
  });
  assert.equal(upper, lower);
});

// -------------------------------------------------------------------
// OPTIONS-RFQ-MAKER-QUOTE-SUBMIT-V1 — quote submit canonical freeze.
// -------------------------------------------------------------------

test("OPTION_RFQ_QUOTE_SUBMIT canonical bytes are frozen (all optional fields null)", () => {
  const encoded = optionRfqQuoteSubmit({
    optionRfqId: "550e8400-e29b-41d4-a716-446655440000",
    mmAccount: "0xAaBbCcDdEeFf00112233445566778899AaBbCcDd",
    price1e8: "300000000000",
    size1e8: "100000000",
    clientQuoteId: null,
    quoteNonce: null,
    quoteTtlMs: null,
  });
  assert.equal(
    encoded,
    'OPTION_RFQ_QUOTE_SUBMIT|option_rfq_id="550e8400-e29b-41d4-a716-446655440000"|mm_account="0xaabbccddeeff00112233445566778899aabbccdd"|price_1e8="300000000000"|size_1e8="100000000"|client_quote_id=null|quote_nonce=null|quote_ttl_ms=null',
  );
});

test("OPTION_RFQ_QUOTE_SUBMIT canonical bytes are frozen (all optional fields populated)", () => {
  const encoded = optionRfqQuoteSubmit({
    optionRfqId: "rfq-42",
    mmAccount: "0x0000000000000000000000000000000000000042",
    price1e8: "50000000000",
    size1e8: "200000000",
    clientQuoteId: "cq-1",
    quoteNonce: 12345,
    quoteTtlMs: 10000,
  });
  assert.equal(
    encoded,
    'OPTION_RFQ_QUOTE_SUBMIT|option_rfq_id="rfq-42"|mm_account="0x0000000000000000000000000000000000000042"|price_1e8="50000000000"|size_1e8="200000000"|client_quote_id="cq-1"|quote_nonce=12345|quote_ttl_ms=10000',
  );
});

test("OPTION_RFQ_QUOTE_SUBMIT field order: option_rfq_id → mm_account → price_1e8 → size_1e8 → client_quote_id → quote_nonce → quote_ttl_ms", () => {
  const encoded = optionRfqQuoteSubmit({
    optionRfqId: "rfq-1",
    mmAccount: "0x0000000000000000000000000000000000000001",
    price1e8: "1",
    size1e8: "1",
    clientQuoteId: null,
    quoteNonce: null,
    quoteTtlMs: null,
  });
  const order = [
    "option_rfq_id=",
    "mm_account=",
    "price_1e8=",
    "size_1e8=",
    "client_quote_id=",
    "quote_nonce=",
    "quote_ttl_ms=",
  ];
  let prev = -1;
  for (const key of order) {
    const idx = encoded.indexOf(key);
    assert.ok(idx > prev, `field order violated near ${key}`);
    prev = idx;
  }
});

test("OPTION_RFQ_QUOTE_SUBMIT mm_account casing is normalised to lowercase", () => {
  const upper = optionRfqQuoteSubmit({
    optionRfqId: "rfq-1",
    mmAccount: "0xABCDEF0000000000000000000000000000000001",
    price1e8: "1",
    size1e8: "1",
    clientQuoteId: null,
    quoteNonce: null,
    quoteTtlMs: null,
  });
  const lower = optionRfqQuoteSubmit({
    optionRfqId: "rfq-1",
    mmAccount: "0xabcdef0000000000000000000000000000000001",
    price1e8: "1",
    size1e8: "1",
    clientQuoteId: null,
    quoteNonce: null,
    quoteTtlMs: null,
  });
  assert.equal(upper, lower);
});
