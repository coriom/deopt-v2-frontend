// PERPS-FULLSTACK-RUNTIME-INTEGRATION-V1 (Part D + H, frontend) —
// EIP-712 typed-data schema for the on-chain PerpMatchingEngine's
// `PerpOrderIntent` primary type.
//
// This module is the LOCKED contract-side canonical for what the
// browser signs. The backend re-verifies every signature against the
// same TYPEHASH + domain; any drift here is a P0 wire-contract break.
//
// Perps stays fail-closed at the backend. Nothing in this module
// enables public trading — signing happens only under the closed-test
// UI flag (`NEXT_PUBLIC_PERPS_CLOSED_TEST_ENABLED`), and the backend
// route (`POST /perps/orders/signed`) is still gated by the closed-
// test allowlist server-side.

import type { TypedData } from "./eip712";

// ---------------------------------------------------------------------
// LOCKED — DO NOT CHANGE.
// ---------------------------------------------------------------------
//
// The Solidity type string, verbatim, exactly as `PerpMatchingEngine`
// hashes with `keccak256(bytes(...))` to derive its TYPEHASH. Any
// whitespace / ordering change reproduces a different typehash and
// breaks signature verification.
export const PERP_ORDER_INTENT_TYPE_STRING =
  "PerpOrderIntent(bytes32 intentId,address trader,uint32 subaccountId,uint256 marketId,uint8 side,uint128 size1e8,uint128 limitPrice1e8,uint128 maxExecPrice1e8,uint128 minExecPrice1e8,uint256 nonce,uint256 deadline)";

// keccak256 of `PERP_ORDER_INTENT_TYPE_STRING`. Frozen — the backend's
// on-chain matching engine uses this exact 32-byte value as the EIP-712
// typehash.
export const PERP_ORDER_INTENT_TYPEHASH =
  "0xeeaf370e4195f568ccb783efe23803dd5bf3c859aef9d0c3e3f211c2da2d5d1c" as const;

// ---------------------------------------------------------------------
// TypeScript representation of the intent.
// ---------------------------------------------------------------------

/**
 * `PerpOrderIntent` — 11 fields, matching the locked Solidity struct.
 *
 * `bigint` is used for all numeric fields (uint128/uint256/etc.) so
 * callers cannot silently overflow a JS number. `intentId` is a 32-byte
 * hex string (`0x…`). `trader` is an EVM address (`0x…`).
 *
 * `side` semantics (frozen):
 *   * `0` → buy  → `maxExecPrice1e8` > 0, `minExecPrice1e8` = 0
 *   * `1` → sell → `minExecPrice1e8` > 0, `maxExecPrice1e8` = 0
 */
export interface PerpOrderIntent {
  intentId: `0x${string}`;
  trader: `0x${string}`;
  subaccountId: number;
  marketId: bigint;
  side: 0 | 1;
  size1e8: bigint;
  limitPrice1e8: bigint;
  maxExecPrice1e8: bigint;
  minExecPrice1e8: bigint;
  nonce: bigint;
  deadline: bigint;
}

// ---------------------------------------------------------------------
// EIP-712 typed data builder.
// ---------------------------------------------------------------------

/**
 * EIP-712 field ordering — MUST MATCH the Solidity struct field order
 * verbatim. Reordering here breaks signature verification.
 */
export const PERP_ORDER_INTENT_TYPES: Record<
  string,
  Array<{ name: string; type: string }>
> = {
  PerpOrderIntent: [
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
  ],
};

/**
 * Builds the object shape a wallet's `signTypedData` call expects,
 * mirroring the wagmi / viem `SignTypedDataArgs` contract.
 *
 * BigInts are serialised as base-10 decimal strings in `message` so the
 * whole envelope survives `JSON.stringify` (some wallet bridges pass
 * typed data through a JSON channel). viem's typed-data hasher
 * normalises strings → bigints internally; this is safe.
 *
 * The domain address is REQUIRED — pass the PerpMatchingEngine address
 * for the current chain (from `NEXT_PUBLIC_PERP_MATCHING_ENGINE_ADDRESS`).
 * There is NO silent fallback to the zero address; if the caller omits
 * this, signature verification fails on the backend and we prefer the
 * loud failure over the wrong-chain quiet-success footgun.
 */
export function buildPerpOrderIntentTypedData(
  intent: PerpOrderIntent,
  chainId: number,
  verifyingContract: `0x${string}`,
): TypedData {
  return {
    domain: {
      name: "DeOptV2-PerpMatchingEngine",
      version: "1",
      chainId,
      verifyingContract,
    },
    primaryType: "PerpOrderIntent",
    types: PERP_ORDER_INTENT_TYPES,
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

// ---------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------

/**
 * Returns a random `bytes32` intent id. Uses `crypto.getRandomValues`
 * (available in every modern browser + Node ≥ 19). NEVER falls back to
 * `Math.random` — a predictable intent id would let an observer replay
 * against an equivalent nonce.
 */
export function generateIntentId(): `0x${string}` {
  const bytes = new Uint8Array(32);
  const g: Crypto | undefined =
    typeof globalThis !== "undefined" && "crypto" in globalThis
      ? (globalThis as { crypto?: Crypto }).crypto
      : undefined;
  if (!g || typeof g.getRandomValues !== "function") {
    throw new Error(
      "PerpOrderIntent.generateIntentId: crypto.getRandomValues unavailable",
    );
  }
  g.getRandomValues(bytes);
  let hex = "0x";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex as `0x${string}`;
}

/**
 * Convenience wrapper that computes the two execution-price bounds for a
 * given side. Delegates to `computeSlippageBounds1e8` from the perps
 * trade form so the math stays in one place — this helper only enforces
 * the side-consistency invariant on the returned pair:
 *
 *   * buy  → returns `{ max > 0, min = 0 }`
 *   * sell → returns `{ max = 0, min > 0 }`
 *
 * For LIMIT orders where the caller wants strict (`price_1e8` IS the
 * limit), pass `limitPrice1e8String !== "0"` — the returned pair is
 * `{ max: 0n, min: 0n }` verbatim (backend semantics: `"0"` == strict).
 *
 * Returns `null` if the slippage percent is unusable (matches the
 * source helper's rejection contract).
 */
export function computeSideBounds(
  side: 0 | 1,
  slippagePctString: string,
  referencePrice1e8String: string,
  limitPrice1e8String: string,
): { maxExecPrice1e8: bigint; minExecPrice1e8: bigint } | null {
  // LIMIT orders → strict bounds (backend semantics).
  if (limitPrice1e8String !== "0") {
    return { maxExecPrice1e8: BigInt(0), minExecPrice1e8: BigInt(0) };
  }
  const sideStr: "buy" | "sell" = side === 0 ? "buy" : "sell";
  const bounds = computeSlippageBounds1e8Inline({
    referencePrice1e8: referencePrice1e8String,
    slippagePct: slippagePctString,
    side: sideStr,
  });
  if (bounds === null) return null;
  return {
    maxExecPrice1e8: BigInt(bounds.max),
    minExecPrice1e8: BigInt(bounds.min),
  };
}

/**
 * Byte-for-byte inline of `computeSlippageBounds1e8` from
 * `PerpsTradeForm.tsx`. Kept here to avoid a client-only import chain
 * (the form imports `wagmi`-adjacent code that would drag React into
 * this utility module). The two implementations MUST stay in lockstep;
 * the frontend contract test asserts bound consistency on both paths.
 */
function computeSlippageBounds1e8Inline(args: {
  referencePrice1e8: string;
  slippagePct: string;
  side: "buy" | "sell";
}): { max: string; min: string } | null {
  const ZERO = BigInt(0);
  const ONE = BigInt(1);
  const DENOM = BigInt(10_000);
  const pct = Number.parseFloat(args.slippagePct);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  const bps = BigInt(Math.round(pct * 100));
  if (bps <= ZERO) return null;
  let ref: bigint;
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

/**
 * Frontend-side sanity check on a `PerpOrderIntent` before signing.
 * The backend re-validates all of this; we replicate the checks here
 * so the wallet prompt never opens for a nonsense payload (e.g.
 * side=1 with maxExecPrice > 0 — the on-chain matcher would revert).
 *
 * Returns null if valid, or a short reason string.
 */
export function validatePerpOrderIntent(intent: PerpOrderIntent): string | null {
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
  // intentId must be 0x + 64 hex chars.
  if (!/^0x[0-9a-fA-F]{64}$/.test(intent.intentId)) {
    return "intentId must be a 32-byte hex string";
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(intent.trader)) {
    return "trader must be a 20-byte address hex string";
  }
  return null;
}
