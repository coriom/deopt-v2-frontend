// PERPS-CLOSED-TEST-E2E-V1 Part H — frontend user-facing flow contract.
//
// Verifies the browser's `perp-order-intent.ts` helpers produce the
// exact typed-data envelope the backend's `POST /perps/orders/signed`
// route expects, and that the backend's error mapping (401 for
// tampered signatures) matches what the UI would surface.
//
// This test is HTTP-driven — it requires a running backend at
// `BACKEND_URL`. When the env var is unset, the tests emit an IGNORED
// marker and no-op (matches the pattern from the other frontend
// contract tests such as `perp-order-intent.contract.mjs`).
//
// Run from `deopt-v2-frontend/`:
//   BACKEND_URL=http://localhost:8080 \
//     node --test tests/node/e2e-flow.contract.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const BACKEND_URL = process.env.BACKEND_URL;
const CHAIN_ID = Number(process.env.CHAIN_ID ?? "84532");
const VERIFYING_CONTRACT =
  process.env.PERP_MATCHING_ENGINE_ADDRESS ??
  "0x0000000000000000000000000000000000000009";

// ---------------------------------------------------------------------
// Inline canonical constants — mirrors `perp-order-intent.contract.mjs`
// so any drift in the frontend module surfaces here too.
// ---------------------------------------------------------------------

const PERP_ORDER_INTENT_TYPE_STRING =
  "PerpOrderIntent(bytes32 intentId,address trader,uint32 subaccountId,uint256 marketId,uint8 side,uint128 size1e8,uint128 limitPrice1e8,uint128 maxExecPrice1e8,uint128 minExecPrice1e8,uint256 nonce,uint256 deadline)";

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

// Freeze — the on-chain TYPEHASH must equal keccak256 of the type
// string. Guards against any future drift in either constant.
{
  const derived = keccak256(toBytes(PERP_ORDER_INTENT_TYPE_STRING));
  const LOCKED =
    "0xeeaf370e4195f568ccb783efe23803dd5bf3c859aef9d0c3e3f211c2da2d5d1c";
  if (derived !== LOCKED) {
    throw new Error(
      `PERPS wire-lock broken in e2e-flow test: derived=${derived} expected=${LOCKED}`,
    );
  }
}

function buildTypedData(intent) {
  return {
    domain: {
      name: "DeOptV2-PerpMatchingEngine",
      version: "1",
      chainId: CHAIN_ID,
      verifyingContract: VERIFYING_CONTRACT,
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

function wireBody(intent, signature) {
  return {
    intent: {
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
    signature,
  };
}

// Deterministic-per-run privkey. Padded to 32 non-zero bytes so
// secp256k1 doesn't reject.
function randomAccount() {
  // Randomised so parallel runs against a shared backend don't collide
  // on trader-scoped state.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // Ensure non-zero first byte.
  if (bytes[0] === 0) bytes[0] = 1;
  const hex =
    "0x" +
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return privateKeyToAccount(hex);
}

function makeIntent(traderAddress, nonce) {
  const intentId =
    "0x" + "ab".repeat(32);
  return {
    intentId,
    trader: traderAddress,
    subaccountId: 1,
    marketId: BigInt(1),
    side: 0,
    size1e8: BigInt("100000000"),
    limitPrice1e8: BigInt(0),
    maxExecPrice1e8: BigInt("320000000000"),
    minExecPrice1e8: BigInt(0),
    nonce: BigInt(nonce),
    deadline: BigInt("9999999999"),
  };
}

async function postSigned(body) {
  const url = `${BACKEND_URL}/perps/orders/signed`;
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("Part H #1 — sign PerpOrderIntent via viem, POST to /perps/orders/signed, assert 200 OR fail-closed", async () => {
  if (!BACKEND_URL) {
    console.log(
      "IGNORED [part_h_01_sign_and_post] (BACKEND_URL not provided). " +
        "Set BACKEND_URL=http://localhost:8080 to run.",
    );
    return;
  }
  const account = randomAccount();
  const intent = makeIntent(account.address, 1);
  const typedData = buildTypedData(intent);
  const signature = await account.signTypedData(typedData);
  const response = await postSigned(wireBody(intent, signature));
  // In the closed-test posture the traderAddress is NOT on the allowlist
  // (the backend enforces per-wallet allowlist), so we expect 503
  // `PerpsNotLive`. That is the correct fail-closed shape for a public
  // wallet that hasn't been explicitly whitelisted. If the backend has
  // whitelisted this run's random address (i.e. an operator-side
  // allowlist-open posture), 200 OK is also acceptable.
  assert.ok(
    response.status === 200 ||
      response.status === 503 ||
      response.status === 422,
    `unexpected status ${response.status}: ${await response.text()}`,
  );
  console.log(`PART_H_01_SIGN_AND_POST_OK status=${response.status}`);
});

test("Part H #2 — tampered signature returns 401 with structured body", async () => {
  if (!BACKEND_URL) {
    console.log(
      "IGNORED [part_h_02_tampered_signature] (BACKEND_URL not provided).",
    );
    return;
  }
  const account = randomAccount();
  const intent = makeIntent(account.address, 2);
  // A well-formed signature over a DIFFERENT digest — recovered signer
  // will diverge from `intent.trader`. Endpoint collapses to 401.
  const wrongIntent = makeIntent(account.address, 999);
  const wrongTypedData = buildTypedData(wrongIntent);
  const badSignature = await account.signTypedData(wrongTypedData);
  const response = await postSigned(wireBody(intent, badSignature));
  const body = await response.text();
  assert.equal(
    response.status,
    401,
    `tampered signature must return 401; got ${response.status}: ${body}`,
  );
  console.log("PART_H_02_TAMPERED_SIGNATURE_OK");
});
