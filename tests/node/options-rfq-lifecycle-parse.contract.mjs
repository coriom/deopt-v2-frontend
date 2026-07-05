// OPTIONS-RFQ-LIFECYCLE-WS-V1 — node contract test for the new
// Options RFQ lifecycle payload parsers.
//
// Freezes:
//   - the 5 accepted RFQ payload `type` tags,
//   - the field shape of each variant (all scalars),
//   - the "no signature / no auth / no secret" wire invariant
//     (via a grep-style deny-list on serialized frames).
//
// Reproduces the parser inline so this test runs without importing
// the TypeScript source. If you change
// `src/lib/lifecycle-parse.ts` you must change the inline parser
// below too. They are a wire-contract pair.

import { test } from "node:test";
import assert from "node:assert/strict";

function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function nullableString(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  return null;
}

function parseOptionRfqCreated(raw) {
  const {
    option_rfq_id, option_series_id, taker, side, size_1e8, status,
    created_at_ms, expires_at_ms,
  } = raw;
  if (
    typeof option_rfq_id !== "string" ||
    typeof option_series_id !== "string" ||
    typeof taker !== "string" ||
    !(side === "buy" || side === "sell") ||
    typeof size_1e8 !== "string" ||
    typeof status !== "string" ||
    typeof created_at_ms !== "number" ||
    typeof expires_at_ms !== "number"
  ) return null;
  return {
    type: "option_rfq_created",
    option_rfq_id, option_series_id, taker, side, size_1e8,
    limit_price_1e8: nullableString(raw.limit_price_1e8),
    status, created_at_ms, expires_at_ms,
  };
}

function parseOptionRfqQuoteSubmitted(raw) {
  const {
    option_rfq_id, quote_id, option_series_id, taker, mm_account,
    price_1e8, size_1e8, status, created_at_ms, expires_at_ms,
  } = raw;
  if (
    typeof option_rfq_id !== "string" ||
    typeof quote_id !== "string" ||
    typeof option_series_id !== "string" ||
    typeof taker !== "string" ||
    typeof mm_account !== "string" ||
    typeof price_1e8 !== "string" ||
    typeof size_1e8 !== "string" ||
    typeof status !== "string" ||
    typeof created_at_ms !== "number" ||
    typeof expires_at_ms !== "number"
  ) return null;
  return {
    type: "option_rfq_quote_submitted",
    option_rfq_id, quote_id, option_series_id, taker, mm_account,
    price_1e8, size_1e8, status, created_at_ms, expires_at_ms,
  };
}

function parseOptionRfqAccepted(raw) {
  const {
    option_rfq_id, quote_id, option_series_id, taker, mm_account,
    rfq_status, quote_status, option_fill_id, accepted_at_ms,
  } = raw;
  if (
    typeof option_rfq_id !== "string" ||
    typeof quote_id !== "string" ||
    typeof option_series_id !== "string" ||
    typeof taker !== "string" ||
    typeof mm_account !== "string" ||
    typeof rfq_status !== "string" ||
    typeof quote_status !== "string" ||
    typeof option_fill_id !== "string" ||
    typeof accepted_at_ms !== "number"
  ) return null;
  return {
    type: "option_rfq_accepted",
    option_rfq_id, quote_id, option_series_id, taker, mm_account,
    rfq_status, quote_status, option_fill_id, accepted_at_ms,
  };
}

function parseOptionRfqFillCreated(raw) {
  const {
    option_rfq_id, quote_id, fill_id, option_series_id, taker,
    mm_account, taker_side, price_1e8, size_1e8, created_at_ms,
  } = raw;
  if (
    typeof option_rfq_id !== "string" ||
    typeof quote_id !== "string" ||
    typeof fill_id !== "string" ||
    typeof option_series_id !== "string" ||
    typeof taker !== "string" ||
    typeof mm_account !== "string" ||
    !(taker_side === "buy" || taker_side === "sell") ||
    typeof price_1e8 !== "string" ||
    typeof size_1e8 !== "string" ||
    typeof created_at_ms !== "number"
  ) return null;
  return {
    type: "option_rfq_fill_created",
    option_rfq_id, quote_id, fill_id, option_series_id, taker,
    mm_account, taker_side, price_1e8, size_1e8, created_at_ms,
  };
}

function parseOptionRfqCancelled(raw) {
  const {
    option_rfq_id, option_series_id, taker, status, cancelled_at_ms,
  } = raw;
  if (
    typeof option_rfq_id !== "string" ||
    typeof option_series_id !== "string" ||
    typeof taker !== "string" ||
    typeof status !== "string" ||
    typeof cancelled_at_ms !== "number"
  ) return null;
  return {
    type: "option_rfq_cancelled",
    option_rfq_id, option_series_id, taker, status, cancelled_at_ms,
  };
}

function parsePayload(raw) {
  if (!isObject(raw)) return null;
  switch (raw.type) {
    case "option_rfq_created": return parseOptionRfqCreated(raw);
    case "option_rfq_quote_submitted": return parseOptionRfqQuoteSubmitted(raw);
    case "option_rfq_accepted": return parseOptionRfqAccepted(raw);
    case "option_rfq_fill_created": return parseOptionRfqFillCreated(raw);
    case "option_rfq_cancelled": return parseOptionRfqCancelled(raw);
    default: return null;
  }
}

const OK_CREATED = {
  type: "option_rfq_created",
  option_rfq_id: "550e8400-e29b-41d4-a716-446655440000",
  option_series_id: "opt-1",
  taker: "0x0000000000000000000000000000000000000001",
  side: "buy",
  size_1e8: "100000000",
  limit_price_1e8: null,
  status: "open",
  created_at_ms: 1700000000000,
  expires_at_ms: 1700000005000,
};

const OK_QUOTE_SUBMITTED = {
  type: "option_rfq_quote_submitted",
  option_rfq_id: "rfq-1",
  quote_id: "q-1",
  option_series_id: "opt-1",
  taker: "0x0000000000000000000000000000000000000001",
  mm_account: "0x0000000000000000000000000000000000000002",
  price_1e8: "300000000000",
  size_1e8: "100000000",
  status: "active",
  created_at_ms: 1700000000000,
  expires_at_ms: 1700000010000,
};

const OK_ACCEPTED = {
  type: "option_rfq_accepted",
  option_rfq_id: "rfq-1",
  quote_id: "q-1",
  option_series_id: "opt-1",
  taker: "0x0000000000000000000000000000000000000001",
  mm_account: "0x0000000000000000000000000000000000000002",
  rfq_status: "accepted",
  quote_status: "accepted",
  option_fill_id: "fill-1",
  accepted_at_ms: 1700000001000,
};

const OK_FILL_CREATED = {
  type: "option_rfq_fill_created",
  option_rfq_id: "rfq-1",
  quote_id: "q-1",
  fill_id: "fill-1",
  option_series_id: "opt-1",
  taker: "0x0000000000000000000000000000000000000001",
  mm_account: "0x0000000000000000000000000000000000000002",
  taker_side: "buy",
  price_1e8: "300000000000",
  size_1e8: "100000000",
  created_at_ms: 1700000001000,
};

const OK_CANCELLED = {
  type: "option_rfq_cancelled",
  option_rfq_id: "rfq-1",
  option_series_id: "opt-1",
  taker: "0x0000000000000000000000000000000000000001",
  status: "cancelled",
  cancelled_at_ms: 1700000002000,
};

test("parser accepts OptionRfqCreated with all required fields", () => {
  assert.deepEqual(parsePayload(OK_CREATED), OK_CREATED);
});

test("parser accepts OptionRfqQuoteSubmitted", () => {
  assert.deepEqual(parsePayload(OK_QUOTE_SUBMITTED), OK_QUOTE_SUBMITTED);
});

test("parser accepts OptionRfqAccepted", () => {
  assert.deepEqual(parsePayload(OK_ACCEPTED), OK_ACCEPTED);
});

test("parser accepts OptionRfqFillCreated", () => {
  assert.deepEqual(parsePayload(OK_FILL_CREATED), OK_FILL_CREATED);
});

test("parser accepts OptionRfqCancelled", () => {
  assert.deepEqual(parsePayload(OK_CANCELLED), OK_CANCELLED);
});

test("parser rejects wrong `side` value", () => {
  assert.equal(parsePayload({ ...OK_CREATED, side: "long" }), null);
});

test("parser rejects missing required string field", () => {
  const bad = { ...OK_CREATED };
  delete bad.option_series_id;
  assert.equal(parsePayload(bad), null);
});

test("parser rejects when created_at_ms is a string", () => {
  assert.equal(parsePayload({ ...OK_CREATED, created_at_ms: "1700000000000" }), null);
});

test("parser accepts null limit_price_1e8 but rejects non-string values", () => {
  assert.equal(parsePayload({ ...OK_CREATED, limit_price_1e8: null }).limit_price_1e8, null);
  assert.equal(parsePayload({ ...OK_CREATED, limit_price_1e8: 123 }).limit_price_1e8, null);
});

test("parser ignores unknown payload types safely", () => {
  assert.equal(parsePayload({ type: "some_future_type", foo: 1 }), null);
});

test("no RFQ payload variant leaks signature/auth/secret fields", () => {
  const fixtures = [
    OK_CREATED, OK_QUOTE_SUBMITTED, OK_ACCEPTED, OK_FILL_CREATED, OK_CANCELLED,
  ];
  for (const p of fixtures) {
    const parsed = parsePayload(p);
    assert.ok(parsed, `expected ${p.type} to parse`);
    const json = JSON.stringify(parsed).toLowerCase();
    for (const forbidden of [
      "signature",
      "authorization",
      "auth_envelope",
      "nonce",
      "quote_digest",
      "recovered_signer",
      "private_key",
      "bearer",
      "db_url",
      "rpc_url",
    ]) {
      assert.ok(
        !json.includes(forbidden),
        `parsed ${p.type} contains forbidden field \`${forbidden}\``,
      );
    }
  }
});
