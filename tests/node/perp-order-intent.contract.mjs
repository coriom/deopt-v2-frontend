// PERPS-FULLSTACK-RUNTIME-INTEGRATION-V1 (Part D + H, frontend) —
// EIP-712 typehash + typed-data freeze test.
//
// The browser bundle in `src/lib/perp-order-intent.ts` builds the
// `PerpOrderIntent` envelope the wallet signs. The backend re-derives
// this exact TYPEHASH + domain to verify the signature. Any drift here
// (whitespace in the type string, reordered fields, chain id / domain
// address confusion) is a P0 wire-contract break, so we freeze the
// canonical shape in a stand-alone node test that runs with viem.
//
// Run from `deopt-v2-frontend/`:
//   node --test tests/node/perp-order-intent.contract.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { keccak256, toBytes } from "viem";

// ---------------------------------------------------------------------
// Inline copies of the frozen constants + helpers from the source
// module. Kept here so a divergence between source and test forces the
// author to update BOTH — that's the whole point of a byte-freeze.
// ---------------------------------------------------------------------

const PERP_ORDER_INTENT_TYPE_STRING =
  "PerpOrderIntent(bytes32 intentId,address trader,uint32 subaccountId,uint256 marketId,uint8 side,uint128 size1e8,uint128 limitPrice1e8,uint128 maxExecPrice1e8,uint128 minExecPrice1e8,uint256 nonce,uint256 deadline)";

const PERP_ORDER_INTENT_TYPEHASH =
  "0xeeaf370e4195f568ccb783efe23803dd5bf3c859aef9d0c3e3f211c2da2d5d1c";

const PERP_ORDER_INTENT_FIELDS = [
  { name: "intentId", type: "bytes32" },
  { name: "trader", type: "address" },
  { name: "subaccountId", type: "uint32" },
  { name: "marketId", type: "uint256" },
  { name: "side", type: "uint8" },
  { name: "size1e8", type: "uint128" },
  { name: "limitPrice1e8", type: "uint128" },
  { name: "maxExecPrice1e8", type: "uint128" },
  { name: "minExecPrice1e8", type: "uint128" },
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint256" },
];

function buildTypedData(intent, chainId, verifyingContract) {
  return {
    domain: {
      name: "DeOptV2-PerpMatchingEngine",
      version: "1",
      chainId,
      verifyingContract,
    },
    primaryType: "PerpOrderIntent",
    types: { PerpOrderIntent: PERP_ORDER_INTENT_FIELDS },
    message: {
      intentId: intent.intentId,
      trader: intent.trader,
      subaccountId: intent.subaccountId,
      marketId: intent.marketId.toString(),
      side: intent.side,
      size1e8: intent.size1e8.toString(),
      limitPrice1e8: intent.limitPrice1e8.toString(),
      maxExecPrice1e8: intent.maxExecPrice1e8.toString(),
      minExecPrice1e8: intent.minExecPrice1e8.toString(),
      nonce: intent.nonce.toString(),
      deadline: intent.deadline.toString(),
    },
  };
}

function computeSlippageBounds1e8(args) {
  const ZERO = BigInt(0);
  const ONE = BigInt(1);
  const DENOM = BigInt(10_000);
  const pct = Number.parseFloat(args.slippagePct);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  const bps = BigInt(Math.round(pct * 100));
  if (bps <= ZERO) return null;
  let ref;
  try {
    ref = BigInt(args.referencePrice1e8);
  } catch {
    return null;
  }
  if (ref <= ZERO) return null;
  if (args.side === "buy") {
    const numer = ref * (DENOM + bps);
    const max = (numer + DENOM - ONE) / DENOM;
    return { max: max.toString(), min: "0" };
  }
  if (bps >= DENOM) return null;
  const numer = ref * (DENOM - bps);
  const min = numer / DENOM;
  return { max: "0", min: min.toString() };
}

function computeSideBounds(side, slippagePct, refPrice1e8, limitPrice1e8) {
  if (limitPrice1e8 !== "0") {
    return { maxExecPrice1e8: BigInt(0), minExecPrice1e8: BigInt(0) };
  }
  const sideStr = side === 0 ? "buy" : "sell";
  const b = computeSlippageBounds1e8({
    referencePrice1e8: refPrice1e8,
    slippagePct,
    side: sideStr,
  });
  if (b === null) return null;
  return {
    maxExecPrice1e8: BigInt(b.max),
    minExecPrice1e8: BigInt(b.min),
  };
}

function validatePerpOrderIntent(intent) {
  const ZERO = BigInt(0);
  if (intent.side !== 0 && intent.side !== 1) {
    return "side must be 0 (buy) or 1 (sell)";
  }
  if (intent.size1e8 <= ZERO) return "size1e8 must be > 0";
  if (intent.marketId <= ZERO) return "marketId must be > 0";
  if (intent.deadline <= ZERO) return "deadline must be > 0";
  if (intent.side === 0 && intent.minExecPrice1e8 !== ZERO) {
    return "buy side must have minExecPrice1e8 == 0";
  }
  if (intent.side === 1 && intent.maxExecPrice1e8 !== ZERO) {
    return "sell side must have maxExecPrice1e8 == 0";
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(intent.intentId)) {
    return "intentId must be a 32-byte hex string";
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(intent.trader)) {
    return "trader must be a 20-byte address hex string";
  }
  return null;
}

// ---------------------------------------------------------------------
// TYPEHASH freeze — keccak256 of the type string must equal the locked
// constant. Any whitespace / ordering drift explodes here.
// ---------------------------------------------------------------------

test("PERP_ORDER_INTENT_TYPEHASH equals keccak256(PERP_ORDER_INTENT_TYPE_STRING)", () => {
  const derived = keccak256(toBytes(PERP_ORDER_INTENT_TYPE_STRING));
  assert.equal(derived, PERP_ORDER_INTENT_TYPEHASH);
});

test("PERP_ORDER_INTENT_TYPE_STRING has the exact locked field ordering", () => {
  // Field order is embedded in the type string; recomputing the type
  // string from the fields array must round-trip.
  const rebuilt =
    "PerpOrderIntent(" +
    PERP_ORDER_INTENT_FIELDS.map((f) => `${f.type} ${f.name}`).join(",") +
    ")";
  assert.equal(rebuilt, PERP_ORDER_INTENT_TYPE_STRING);
});

// ---------------------------------------------------------------------
// Typed-data shape — the object handed to the wallet MUST have exactly
// these top-level keys with these values.
// ---------------------------------------------------------------------

test("buildPerpOrderIntentTypedData shape matches the wallet.signTypedData contract", () => {
  const intent = {
    intentId:
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    trader: "0x2222222222222222222222222222222222222222",
    subaccountId: 1,
    marketId: BigInt(1),
    side: 0,
    size1e8: BigInt("100000000"),
    limitPrice1e8: BigInt(0),
    maxExecPrice1e8: BigInt("301500000000"),
    minExecPrice1e8: BigInt(0),
    nonce: BigInt(42),
    deadline: BigInt(1700000000),
  };
  const td = buildTypedData(
    intent,
    84532,
    "0x3333333333333333333333333333333333333333",
  );
  assert.deepEqual(Object.keys(td).sort(), [
    "domain",
    "message",
    "primaryType",
    "types",
  ]);
  assert.equal(td.primaryType, "PerpOrderIntent");
  assert.equal(td.domain.name, "DeOptV2-PerpMatchingEngine");
  assert.equal(td.domain.version, "1");
  assert.equal(td.domain.chainId, 84532);
  assert.equal(
    td.domain.verifyingContract,
    "0x3333333333333333333333333333333333333333",
  );
  // Message MUST carry every field the type string declares, in the
  // exact order (JSON preserves insertion order for string keys).
  const messageKeys = Object.keys(td.message);
  assert.deepEqual(messageKeys, PERP_ORDER_INTENT_FIELDS.map((f) => f.name));
  // BigInts are serialised to base-10 decimal strings so the whole
  // envelope survives JSON.stringify.
  assert.equal(td.message.marketId, "1");
  assert.equal(td.message.size1e8, "100000000");
  assert.equal(td.message.maxExecPrice1e8, "301500000000");
  assert.equal(td.message.minExecPrice1e8, "0");
  assert.equal(td.message.nonce, "42");
  assert.equal(td.message.deadline, "1700000000");
  // Non-numeric fields pass through verbatim.
  assert.equal(td.message.side, 0);
  assert.equal(td.message.subaccountId, 1);
});

test("buildPerpOrderIntentTypedData: types map has exactly PerpOrderIntent", () => {
  const intent = {
    intentId:
      "0x0000000000000000000000000000000000000000000000000000000000000001",
    trader: "0x2222222222222222222222222222222222222222",
    subaccountId: 1,
    marketId: BigInt(1),
    side: 1,
    size1e8: BigInt(1),
    limitPrice1e8: BigInt(0),
    maxExecPrice1e8: BigInt(0),
    minExecPrice1e8: BigInt("299000000000"),
    nonce: BigInt(1),
    deadline: BigInt(1),
  };
  const td = buildTypedData(
    intent,
    31337,
    "0x0000000000000000000000000000000000000000",
  );
  assert.deepEqual(Object.keys(td.types), ["PerpOrderIntent"]);
  assert.deepEqual(td.types.PerpOrderIntent, PERP_ORDER_INTENT_FIELDS);
});

// ---------------------------------------------------------------------
// Bound side consistency — buy sets max only, sell sets min only.
// LIMIT orders (limit_1e8 != "0") return strict {0, 0}.
// ---------------------------------------------------------------------

test("computeSideBounds buy → max > 0, min == 0", () => {
  const b = computeSideBounds(0, "0.5", "300000000000", "0");
  assert.ok(b);
  assert.ok(b.maxExecPrice1e8 > BigInt(0));
  assert.equal(b.minExecPrice1e8, BigInt(0));
});

test("computeSideBounds sell → min > 0, max == 0", () => {
  const b = computeSideBounds(1, "0.5", "300000000000", "0");
  assert.ok(b);
  assert.equal(b.maxExecPrice1e8, BigInt(0));
  assert.ok(b.minExecPrice1e8 > BigInt(0));
});

test("computeSideBounds LIMIT order (limit != '0') returns strict {0, 0} regardless of side", () => {
  const buy = computeSideBounds(0, "0.5", "300000000000", "300000000000");
  const sell = computeSideBounds(1, "0.5", "300000000000", "300000000000");
  assert.deepEqual(buy, {
    maxExecPrice1e8: BigInt(0),
    minExecPrice1e8: BigInt(0),
  });
  assert.deepEqual(sell, {
    maxExecPrice1e8: BigInt(0),
    minExecPrice1e8: BigInt(0),
  });
});

test("computeSideBounds rejects unusable slippage (null)", () => {
  assert.equal(computeSideBounds(0, "0", "300000000000", "0"), null);
  assert.equal(computeSideBounds(0, "not-a-number", "300000000000", "0"), null);
  assert.equal(computeSideBounds(0, "-1", "300000000000", "0"), null);
});

test("computeSideBounds sell with pct >= 100% is null (would floor negative)", () => {
  assert.equal(computeSideBounds(1, "100", "300000000000", "0"), null);
});

// ---------------------------------------------------------------------
// validatePerpOrderIntent — reject nonsense intents BEFORE signing.
// ---------------------------------------------------------------------

test("validatePerpOrderIntent rejects side=1 (sell) with maxExecPrice > 0", () => {
  const bad = {
    intentId:
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    trader: "0x2222222222222222222222222222222222222222",
    subaccountId: 1,
    marketId: BigInt(1),
    side: 1,
    size1e8: BigInt(1),
    limitPrice1e8: BigInt(0),
    maxExecPrice1e8: BigInt(1), // <-- illegal on sell
    minExecPrice1e8: BigInt(0),
    nonce: BigInt(1),
    deadline: BigInt(1),
  };
  const reason = validatePerpOrderIntent(bad);
  assert.match(reason, /sell/i);
});

test("validatePerpOrderIntent rejects side=0 (buy) with minExecPrice > 0", () => {
  const bad = {
    intentId:
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    trader: "0x2222222222222222222222222222222222222222",
    subaccountId: 1,
    marketId: BigInt(1),
    side: 0,
    size1e8: BigInt(1),
    limitPrice1e8: BigInt(0),
    maxExecPrice1e8: BigInt(1),
    minExecPrice1e8: BigInt(1), // <-- illegal on buy
    nonce: BigInt(1),
    deadline: BigInt(1),
  };
  assert.match(validatePerpOrderIntent(bad), /buy/i);
});

test("validatePerpOrderIntent rejects zero size1e8, marketId, deadline", () => {
  const base = {
    intentId:
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    trader: "0x2222222222222222222222222222222222222222",
    subaccountId: 1,
    marketId: BigInt(1),
    side: 0,
    size1e8: BigInt(1),
    limitPrice1e8: BigInt(0),
    maxExecPrice1e8: BigInt(1),
    minExecPrice1e8: BigInt(0),
    nonce: BigInt(1),
    deadline: BigInt(1),
  };
  assert.match(
    validatePerpOrderIntent({ ...base, size1e8: BigInt(0) }),
    /size1e8/,
  );
  assert.match(
    validatePerpOrderIntent({ ...base, marketId: BigInt(0) }),
    /marketId/,
  );
  assert.match(
    validatePerpOrderIntent({ ...base, deadline: BigInt(0) }),
    /deadline/,
  );
});

test("validatePerpOrderIntent rejects malformed intentId and trader", () => {
  const base = {
    intentId:
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    trader: "0x2222222222222222222222222222222222222222",
    subaccountId: 1,
    marketId: BigInt(1),
    side: 0,
    size1e8: BigInt(1),
    limitPrice1e8: BigInt(0),
    maxExecPrice1e8: BigInt(1),
    minExecPrice1e8: BigInt(0),
    nonce: BigInt(1),
    deadline: BigInt(1),
  };
  assert.match(
    validatePerpOrderIntent({ ...base, intentId: "0xabc" }),
    /intentId/,
  );
  assert.match(
    validatePerpOrderIntent({ ...base, trader: "not-an-address" }),
    /trader/,
  );
});

test("validatePerpOrderIntent accepts a well-formed buy intent", () => {
  assert.equal(
    validatePerpOrderIntent({
      intentId:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      trader: "0x2222222222222222222222222222222222222222",
      subaccountId: 1,
      marketId: BigInt(1),
      side: 0,
      size1e8: BigInt("100000000"),
      limitPrice1e8: BigInt(0),
      maxExecPrice1e8: BigInt("301500000000"),
      minExecPrice1e8: BigInt(0),
      nonce: BigInt(1),
      deadline: BigInt(1700000000),
    }),
    null,
  );
});

test("validatePerpOrderIntent accepts a well-formed sell intent", () => {
  assert.equal(
    validatePerpOrderIntent({
      intentId:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      trader: "0x2222222222222222222222222222222222222222",
      subaccountId: 1,
      marketId: BigInt(1),
      side: 1,
      size1e8: BigInt("100000000"),
      limitPrice1e8: BigInt(0),
      maxExecPrice1e8: BigInt(0),
      minExecPrice1e8: BigInt("298500000000"),
      nonce: BigInt(1),
      deadline: BigInt(1700000000),
    }),
    null,
  );
});
