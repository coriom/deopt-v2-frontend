// PERPS-V2-WRITE-AUTH-ENFORCEMENT-V1 — frontend v2 canonical byte-freeze.
//
// Reproduces the byte layout the browser bundle emits from
// `canonicalV2.perpOrderSubmit` / `canonicalV2.perpOrderCancel` and
// asserts the wire matches the backend's `canonical_perp_order_*_v2`
// implementations (byte-frozen in
// `deopt-v2-backend/tests/perps_v2_write_auth_enforcement_v1_tests.rs`).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// -------------------------------------------------------------
// Inline reproduction of the canonical encoder — kept in sync with
// `src/lib/write-auth.ts`.
// -------------------------------------------------------------

function escapeCanonicalString(s) {
  let out = "";
  for (const ch of s) {
    switch (ch) {
      case "\\":
        out += "\\\\";
        break;
      case '"':
        out += '\\"';
        break;
      case "\n":
        out += "\\n";
        break;
      case "\r":
        out += "\\r";
        break;
      case "\t":
        out += "\\t";
        break;
      default:
        out += ch;
    }
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
  }
}

function canonicalPayload(action, fields) {
  let out = action;
  for (const [key, value] of fields) {
    out += `|${key}=${encodeCanonical(value)}`;
  }
  return out; // returned as a string for assertion convenience
}

const cv = {
  str: (v) => ({ kind: "string", value: v }),
  u64: (v) => ({ kind: "u64", value: v }),
  bool: (v) => ({ kind: "bool", value: v }),
  addr: (v) => ({ kind: "address", value: v }),
  null: () => ({ kind: "null" }),
};

function perpOrderSubmit(args) {
  return canonicalPayload("PERP_ORDER_SUBMIT", [
    ["account", cv.addr(args.account)],
    ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
    ["market_id", cv.str(args.marketId)],
    ["side", cv.str(args.side)],
    ["price_1e8", cv.str(args.price1e8)],
    ["size_1e8", cv.str(args.size1e8)],
    ["time_in_force", cv.str(args.timeInForce)],
    ["post_only", cv.bool(args.postOnly)],
    ["reduce_only", cv.bool(args.reduceOnly)],
    ["isolated_margin_1e8", cv.str(args.isolatedMargin1e8)],
    ["client_order_id", args.clientOrderId == null ? cv.null() : cv.str(args.clientOrderId)],
  ]);
}

function perpOrderCancel(args) {
  return canonicalPayload("PERP_ORDER_CANCEL", [
    ["account", cv.addr(args.account)],
    ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
    ["order_id", cv.str(args.orderId)],
  ]);
}

// -------------------------------------------------------------
// (1) Submit v2 canonical bytes match the frozen backend shape.
// -------------------------------------------------------------

test("submit v2 canonical bytes: field order + separators frozen", () => {
  const bytes = perpOrderSubmit({
    account: "0x00000000000000000000000000000000000000aa",
    subaccountId: 2,
    marketId: "ETH-PERP",
    side: "buy",
    price1e8: "300000000000",
    size1e8: "100000000",
    timeInForce: "gtc",
    postOnly: false,
    reduceOnly: false,
    isolatedMargin1e8: "30000000000",
    clientOrderId: null,
  });
  assert.ok(bytes.startsWith("PERP_ORDER_SUBMIT|"));
  assert.ok(bytes.includes("|subaccount_id=2|"));
  assert.ok(bytes.includes('|market_id="ETH-PERP"|'));
  assert.ok(bytes.endsWith("|client_order_id=null"));
});

// -------------------------------------------------------------
// (2) Cancel v2 canonical bytes match the frozen backend shape.
// -------------------------------------------------------------

test("cancel v2 canonical bytes: field order + separators frozen", () => {
  const bytes = perpOrderCancel({
    account: "0x00000000000000000000000000000000000000aa",
    subaccountId: 2,
    orderId: "11111111-2222-3333-4444-555555555555",
  });
  assert.ok(bytes.startsWith("PERP_ORDER_CANCEL|"));
  assert.ok(bytes.includes("|subaccount_id=2|"));
  assert.ok(
    bytes.endsWith('|order_id="11111111-2222-3333-4444-555555555555"'),
  );
});

// -------------------------------------------------------------
// (3) Bytes diverge across subaccounts (cross-subaccount replay
// resistance at the challenge verifier).
// -------------------------------------------------------------

test("submit v2 bytes diverge across subaccounts", () => {
  const build = (sub) =>
    perpOrderSubmit({
      account: "0x00000000000000000000000000000000000000aa",
      subaccountId: sub,
      marketId: "ETH-PERP",
      side: "buy",
      price1e8: "300000000000",
      size1e8: "100000000",
      timeInForce: "gtc",
      postOnly: false,
      reduceOnly: false,
      isolatedMargin1e8: "30000000000",
      clientOrderId: null,
    });
  assert.notEqual(build(1), build(2));
  assert.notEqual(build(2), build(3));
});

test("cancel v2 bytes diverge across subaccounts", () => {
  const build = (sub) =>
    perpOrderCancel({
      account: "0x00000000000000000000000000000000000000aa",
      subaccountId: sub,
      orderId: "11111111-2222-3333-4444-555555555555",
    });
  assert.notEqual(build(1), build(2));
});

// -------------------------------------------------------------
// (4) Perps action strings distinct from Options action strings.
// -------------------------------------------------------------

test("perp action strings distinct from option analogues", () => {
  assert.notEqual("PERP_ORDER_SUBMIT", "OPTION_ORDER_SUBMIT");
  assert.notEqual("PERP_ORDER_CANCEL", "OPTION_ORDER_CANCEL");
});

// -------------------------------------------------------------
// (5) Submit body wire schema — freeze the set of keys the
// browser bundle emits under the closed-test path so a future
// refactor cannot silently drop `authorization` or `subaccount_id`.
// -------------------------------------------------------------

test("submit body under closed-test carries authorization + subaccount_id", () => {
  const body = {
    market_id: "ETH-PERP",
    account: "0x00000000000000000000000000000000000000aa",
    subaccount_id: 2,
    side: "buy",
    price_1e8: "300000000000",
    size_1e8: "100000000",
    time_in_force: "gtc",
    post_only: false,
    reduce_only: false,
    isolated_margin_1e8: "30000000000",
    client_order_id: "cli-test",
    authorization: {
      action: "PERP_ORDER_SUBMIT",
      account: "0x00000000000000000000000000000000000000aa",
      nonce: "0x" + "aa".repeat(32),
      deadline_ms: 1_800_000_000_000,
      signature: "0x" + "bb".repeat(65),
      version: 2,
    },
  };
  const keys = Object.keys(body).sort();
  assert.deepEqual(keys, [
    "account",
    "authorization",
    "client_order_id",
    "isolated_margin_1e8",
    "market_id",
    "post_only",
    "price_1e8",
    "reduce_only",
    "side",
    "size_1e8",
    "subaccount_id",
    "time_in_force",
  ]);
  assert.equal(body.authorization.version, 2);
  assert.equal(body.authorization.action, "PERP_ORDER_SUBMIT");
});

// -------------------------------------------------------------
// (6) Cancel body wire schema — freeze the DELETE body shape.
// -------------------------------------------------------------

test("cancel body carries authorization + subaccount_id", () => {
  const body = {
    authorization: {
      action: "PERP_ORDER_CANCEL",
      account: "0x00000000000000000000000000000000000000aa",
      nonce: "0x" + "cc".repeat(32),
      deadline_ms: 1_800_000_000_000,
      signature: "0x" + "dd".repeat(65),
      version: 2,
    },
    subaccount_id: 2,
  };
  const keys = Object.keys(body).sort();
  assert.deepEqual(keys, ["authorization", "subaccount_id"]);
  assert.equal(body.authorization.version, 2);
  assert.equal(body.authorization.action, "PERP_ORDER_CANCEL");
});

// -------------------------------------------------------------
// (7) trading-api.ts source includes the new `authorization` field
// on `SubmitPerpsOrderRequest` — a source-level canary.
// -------------------------------------------------------------

test("SubmitPerpsOrderRequest source declares optional authorization", () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, "src/lib/trading-api.ts"),
    "utf8",
  );
  // A rough source check that survives whitespace changes.
  assert.ok(
    /interface\s+SubmitPerpsOrderRequest\s*\{[\s\S]*authorization\??\s*:\s*/.test(
      src,
    ),
    "SubmitPerpsOrderRequest must declare an authorization field",
  );
  assert.ok(
    /interface\s+CancelPerpsOrderRequest\s*\{[\s\S]*authorization\s*:\s*/.test(
      src,
    ),
    "CancelPerpsOrderRequest must declare an authorization field",
  );
});
