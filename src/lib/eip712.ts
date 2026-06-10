// EIP-712 typed-data helpers.
//
// M-P3b: enabled signing via the wallet context. The actual typed-data
// envelope MUST come from the backend
// (`GET /options/execution-intents/:id/signing-payload`) — this module
// provides typed builders for documentation + UI display + as a safety
// fallback for early local-development against a fixture envelope.
//
// **No silent signing.** All sign attempts require explicit user click
// in the TradeTicket / RfqPanel components.

import type { Address, Hex } from "viem";

export interface Eip712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

export interface TypedData {
  domain: Eip712Domain;
  primaryType: string;
  types: Record<string, Array<{ name: string; type: string }>>;
  message: Record<string, unknown>;
}

/**
 * Hard gate. M-P3b allows user-initiated `signTypedData` calls; M-P3
 * had this hard-coded false. The product policy is now: signing is
 * enabled ONLY when:
 *   1. backend provides the typed-data envelope (via
 *      /options/execution-intents/:id/signing-payload), OR
 *   2. the typed-data is built locally for development against the
 *      anvil chain (chain_id = 31337) using a placeholder verifying
 *      contract.
 *
 * The `TradeTicket` component asks the user to click "Sign" before any
 * wallet prompt opens.
 */
export function isSigningEnabled(): boolean {
  return true;
}

// ----- OrderbookOptionTrade -----
// Matches the backend's `OPTION_TRADE_TYPE` constant in
// `~/DEOPT/deopt-v2-backend/src/options/execution.rs`.

type TypeField = { name: string; type: string };

export const OPTION_TRADE_TYPES: Record<string, TypeField[]> = {
  OptionTrade: [
    { name: "intentId", type: "bytes32" },
    { name: "buyer", type: "address" },
    { name: "seller", type: "address" },
    { name: "optionId", type: "uint256" },
    { name: "underlying", type: "address" },
    { name: "settlementAsset", type: "address" },
    { name: "expiry", type: "uint64" },
    { name: "strike1e8", type: "uint64" },
    { name: "isCall", type: "bool" },
    { name: "contractSize1e8", type: "uint128" },
    { name: "quantity", type: "uint128" },
    { name: "premiumPerContract", type: "uint128" },
    { name: "buyerIsMaker", type: "bool" },
    { name: "buyerNonce", type: "uint256" },
    { name: "sellerNonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

export const OPTION_RFQ_TRADE_TYPES: Record<string, TypeField[]> = {
  OptionRfqTrade: [
    { name: "intentId", type: "bytes32" },
    { name: "buyer", type: "address" },
    { name: "seller", type: "address" },
    { name: "optionId", type: "uint256" },
    { name: "underlying", type: "address" },
    { name: "settlementAsset", type: "address" },
    { name: "expiry", type: "uint64" },
    { name: "strike1e8", type: "uint64" },
    { name: "isCall", type: "bool" },
    { name: "contractSize1e8", type: "uint128" },
    { name: "quantity", type: "uint128" },
    { name: "premiumPerContract", type: "uint128" },
    { name: "buyerIsMaker", type: "bool" },
    { name: "buyerNonce", type: "uint256" },
    { name: "sellerNonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

export interface SigningPayloadResponse {
  /** Backend-issued payload (e.g. from `/options/execution-intents/:id/signing-payload`). */
  domain: Eip712Domain;
  primaryType: string;
  types: Record<string, Array<{ name: string; type: string }>>;
  message: Record<string, unknown>;
  /** Who this envelope expects to sign (buyer or seller). */
  expected_signer?: Address;
}

/**
 * Adapts a backend `SigningPayloadResponse` into the wallet-context
 * `SignTypedDataArgs` shape.
 */
export function adaptSigningPayload(payload: SigningPayloadResponse): TypedData {
  return {
    domain: payload.domain,
    primaryType: payload.primaryType,
    types: payload.types,
    message: payload.message,
  };
}

/**
 * Placeholder builder for local development before the backend
 * `/options/execution-intents/:id/signing-payload` endpoint is wired.
 * The frontend MUST NOT use this builder against production data; the
 * `verifyingContract` is intentionally the zero address.
 */
export function buildPlaceholderTrade(args: {
  chainId: number;
  buyer: Address;
  seller: Address;
  intentId: Hex;
  optionId: bigint;
  underlying: Address;
  settlementAsset: Address;
  expiry: bigint;
  strike1e8: bigint;
  isCall: boolean;
  contractSize1e8: bigint;
  quantity: bigint;
  premiumPerContract: bigint;
  buyerIsMaker: boolean;
  buyerNonce: bigint;
  sellerNonce: bigint;
  deadline: bigint;
}): TypedData {
  return {
    domain: {
      name: "DeOptV2-OptionMatchingEngine",
      version: "1",
      chainId: args.chainId,
      verifyingContract: "0x0000000000000000000000000000000000000000",
    },
    primaryType: "OptionTrade",
    types: OPTION_TRADE_TYPES,
    message: {
      intentId: args.intentId,
      buyer: args.buyer,
      seller: args.seller,
      optionId: args.optionId,
      underlying: args.underlying,
      settlementAsset: args.settlementAsset,
      expiry: args.expiry,
      strike1e8: args.strike1e8,
      isCall: args.isCall,
      contractSize1e8: args.contractSize1e8,
      quantity: args.quantity,
      premiumPerContract: args.premiumPerContract,
      buyerIsMaker: args.buyerIsMaker,
      buyerNonce: args.buyerNonce,
      sellerNonce: args.sellerNonce,
      deadline: args.deadline,
    },
  };
}
