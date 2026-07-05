// ACCOUNT-WRITE-AUTH-HARDENING-V1 — frontend write-authorization client.
//
// Centralized wrapper that turns any state-changing API request into a
// (typed-data, signature, envelope) tuple ready to attach to the
// request body.
//
// Pipeline:
//   1. requestChallenge(account, action)  → server-issued nonce + domain
//   2. canonicalPayload(action, fields)   → byte-identical to backend
//   3. typedData(action, account, ...)    → EIP-712 payload for viem
//   4. signTypedData(wallet, typed)       → 65-byte signature
//   5. buildEnvelope(...)                  → { action, account, nonce,
//                                              deadline_ms, signature,
//                                              idempotency_key? }
//
// The canonical encoding here MUST stay byte-identical to
// `src/auth/write_authorization.rs::canonical_payload_bytes` on the
// backend. The test in `tests/write-auth.test.ts` freezes the
// expected output and breaks if either side drifts.

import type { Address, Hex } from "viem";
import { keccak256, toBytes, toHex } from "viem";
import { tradingApiBaseUrl, TradingApiError } from "./trading-api";

// ---------------------------------------------------------------------
// Frozen domain constants (must mirror backend `auth::write_authorization`).
// ---------------------------------------------------------------------

export const WRITE_AUTH_DOMAIN_NAME = "DeOpt API Write" as const;
export const WRITE_AUTH_DOMAIN_VERSION = "1" as const;
export const WRITE_AUTH_DOMAIN_CHAIN_ID = 84532 as const;
export const WRITE_AUTH_DOMAIN_SALT_PREIMAGE =
  "deopt-api-write:base-sepolia:v1" as const;
export const WRITE_AUTH_DOMAIN_SALT: Hex = keccak256(
  toBytes(WRITE_AUTH_DOMAIN_SALT_PREIMAGE),
);

export const ENVIRONMENT = "base-sepolia" as const;

export const WRITE_AUTH_TYPES: Record<
  string,
  Array<{ name: string; type: string }>
> = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "salt", type: "bytes32" },
  ],
  WriteAuthorization: [
    { name: "action", type: "string" },
    { name: "account", type: "address" },
    { name: "payload", type: "bytes" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "environment", type: "string" },
    { name: "idempotencyKey", type: "string" },
  ],
};

// ---------------------------------------------------------------------
// Action enum (must match backend `WriteAuthAction`)
// ---------------------------------------------------------------------

export type WriteAuthAction =
  | "OPTION_ORDER_SUBMIT"
  | "OPTION_ORDER_CANCEL"
  | "CONDITIONAL_ORDER_CREATE"
  | "CONDITIONAL_ORDER_CANCEL"
  | "OPTION_RFQ_CREATE"
  | "OPTION_RFQ_QUOTE_SUBMIT"
  | "OPTION_RFQ_ACCEPT"
  | "OPTION_RFQ_CANCEL"
  | "OPTION_EXECUTION_INTENT_SIGNATURE_SUBMIT";

// ---------------------------------------------------------------------
// Canonical payload encoding
// ---------------------------------------------------------------------

export type CanonicalValue =
  | { kind: "string"; value: string }
  | { kind: "u64"; value: bigint }
  | { kind: "u128"; value: bigint }
  | { kind: "bool"; value: boolean }
  | { kind: "address"; value: Address | string }
  | { kind: "null" };

export const cv = {
  str: (value: string): CanonicalValue => ({ kind: "string", value }),
  u64: (value: bigint | number): CanonicalValue => ({
    kind: "u64",
    value: BigInt(value),
  }),
  u128: (value: bigint | number): CanonicalValue => ({
    kind: "u128",
    value: BigInt(value),
  }),
  bool: (value: boolean): CanonicalValue => ({ kind: "bool", value }),
  addr: (value: string): CanonicalValue => ({ kind: "address", value }),
  null: (): CanonicalValue => ({ kind: "null" }),
  opt: <T extends CanonicalValue>(
    inner: T | null | undefined,
    nullValue: CanonicalValue = { kind: "null" },
  ): CanonicalValue => (inner == null ? nullValue : inner),
};

function escapeCanonicalString(s: string): string {
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

function encodeCanonical(value: CanonicalValue): string {
  switch (value.kind) {
    case "string":
      return `"${escapeCanonicalString(value.value)}"`;
    case "u64":
    case "u128":
      return value.value.toString();
    case "bool":
      return value.value ? "true" : "false";
    case "address":
      return `"${value.value.toLowerCase()}"`;
    case "null":
      return "null";
  }
}

/**
 * Build canonical payload bytes for a given action. The output is the
 * UTF-8 encoded byte sequence:
 *   `action|key1=encoded(value1)|key2=encoded(value2)|...`
 *
 * Field order is significant — backend reconstructs the same sequence
 * in the same order, so the caller MUST emit fields in the order the
 * backend's `canonical_*` helper does (see `src/api/routes.rs`).
 */
export function canonicalPayload(
  action: WriteAuthAction,
  fields: ReadonlyArray<readonly [string, CanonicalValue]>,
): Uint8Array {
  let s = action;
  for (const [key, value] of fields) {
    s += `|${key}=${encodeCanonical(value)}`;
  }
  return new TextEncoder().encode(s);
}

export function canonicalPayloadHex(
  action: WriteAuthAction,
  fields: ReadonlyArray<readonly [string, CanonicalValue]>,
): Hex {
  return toHex(canonicalPayload(action, fields));
}

// ---------------------------------------------------------------------
// Typed-data construction
// ---------------------------------------------------------------------

export interface WriteAuthTypedData {
  domain: {
    name: typeof WRITE_AUTH_DOMAIN_NAME;
    version: typeof WRITE_AUTH_DOMAIN_VERSION;
    chainId: typeof WRITE_AUTH_DOMAIN_CHAIN_ID;
    salt: Hex;
  };
  types: typeof WRITE_AUTH_TYPES;
  primaryType: "WriteAuthorization";
  message: {
    action: WriteAuthAction;
    account: Address;
    payload: Hex;
    nonce: bigint;
    deadline: bigint;
    environment: typeof ENVIRONMENT;
    idempotencyKey: string;
  };
}

export function typedData(args: {
  action: WriteAuthAction;
  account: Address;
  canonical: Uint8Array | Hex;
  nonce: Hex; // 0x-prefixed 64-char hex
  deadlineMs: number | bigint;
  idempotencyKey?: string | null;
}): WriteAuthTypedData {
  const payload: Hex =
    typeof args.canonical === "string"
      ? (args.canonical as Hex)
      : toHex(args.canonical);
  return {
    domain: {
      name: WRITE_AUTH_DOMAIN_NAME,
      version: WRITE_AUTH_DOMAIN_VERSION,
      chainId: WRITE_AUTH_DOMAIN_CHAIN_ID,
      salt: WRITE_AUTH_DOMAIN_SALT,
    },
    types: WRITE_AUTH_TYPES,
    primaryType: "WriteAuthorization",
    message: {
      action: args.action,
      account: args.account,
      payload,
      nonce: BigInt(args.nonce),
      deadline: BigInt(args.deadlineMs),
      environment: ENVIRONMENT,
      idempotencyKey: args.idempotencyKey ?? "",
    },
  };
}

// ---------------------------------------------------------------------
// Envelope shape
// ---------------------------------------------------------------------

export interface AuthorizationEnvelope {
  action: WriteAuthAction;
  account: Address;
  nonce: Hex;
  deadline_ms: number;
  signature: Hex;
  idempotency_key?: string;
}

// ---------------------------------------------------------------------
// Challenge issuance
// ---------------------------------------------------------------------

export interface WriteAuthChallenge {
  nonce: Hex;
  deadline_ms: number;
  chain_id: number;
  action: WriteAuthAction;
  domain: {
    name: string;
    version: string;
    chainId: number;
    salt: Hex;
  };
  primary_type: "WriteAuthorization";
}

export async function requestChallenge(args: {
  account: Address;
  action: WriteAuthAction;
  idempotencyKey?: string;
  signal?: AbortSignal;
}): Promise<WriteAuthChallenge> {
  const url = `${tradingApiBaseUrl()}/auth/write-challenges`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        account: args.account,
        action: args.action,
        ...(args.idempotencyKey ? { idempotency_key: args.idempotencyKey } : {}),
      }),
      signal: args.signal,
      cache: "no-store",
    });
  } catch (e) {
    throw new TradingApiError({
      code: "NETWORK",
      message: `Failed to request write challenge: ${(e as Error).message}`,
      status: 0,
    });
  }
  if (!res.ok) {
    throw new TradingApiError({
      code: "INTERNAL_ERROR",
      message: `Challenge endpoint returned HTTP ${res.status}`,
      status: res.status,
    });
  }
  return (await res.json()) as WriteAuthChallenge;
}

// ---------------------------------------------------------------------
// Build an authorized envelope from a wallet signer.
// ---------------------------------------------------------------------

export type SignTypedDataFn = (args: {
  domain: WriteAuthTypedData["domain"];
  types: typeof WRITE_AUTH_TYPES;
  primaryType: "WriteAuthorization";
  message: WriteAuthTypedData["message"];
}) => Promise<
  | { ok: true; signature: Hex }
  | { ok: false; reason: string; message?: string }
>;

export async function buildAuthorization(args: {
  account: Address;
  action: WriteAuthAction;
  canonical: Uint8Array;
  signTypedData: SignTypedDataFn;
  idempotencyKey?: string;
  signal?: AbortSignal;
}): Promise<AuthorizationEnvelope> {
  const challenge = await requestChallenge({
    account: args.account,
    action: args.action,
    idempotencyKey: args.idempotencyKey,
    signal: args.signal,
  });
  if (challenge.chain_id !== WRITE_AUTH_DOMAIN_CHAIN_ID) {
    throw new TradingApiError({
      code: "INTERNAL_ERROR",
      message: `Unexpected chain id from challenge endpoint: ${challenge.chain_id}`,
      status: 0,
    });
  }
  const typed = typedData({
    action: args.action,
    account: args.account,
    canonical: args.canonical,
    nonce: challenge.nonce,
    deadlineMs: challenge.deadline_ms,
    idempotencyKey: args.idempotencyKey ?? null,
  });
  const sig = await args.signTypedData(typed);
  if (!sig.ok) {
    throw new TradingApiError({
      code: "INTERNAL_ERROR",
      message: `Wallet refused to sign write authorization: ${sig.reason}${sig.message ? ` — ${sig.message}` : ""}`,
      status: 0,
    });
  }
  const envelope: AuthorizationEnvelope = {
    action: args.action,
    account: args.account,
    nonce: challenge.nonce,
    deadline_ms: challenge.deadline_ms,
    signature: sig.signature,
  };
  if (args.idempotencyKey) {
    envelope.idempotency_key = args.idempotencyKey;
  }
  return envelope;
}

// ---------------------------------------------------------------------
// Convenience: canonical builders per action — keep field order in
// sync with `src/api/routes.rs::canonical_*` on the backend.
// ---------------------------------------------------------------------

export const canonical = {
  optionOrderSubmit(args: {
    account: Address;
    optionSeriesId: string;
    side: "buy" | "sell";
    price1e8: string;
    size1e8: string;
    timeInForce: "gtc" | "ioc" | "fok";
    postOnly: boolean;
    clientOrderId?: string | null;
  }): Uint8Array {
    return canonicalPayload("OPTION_ORDER_SUBMIT", [
      ["account", cv.addr(args.account)],
      ["option_series_id", cv.str(args.optionSeriesId)],
      ["side", cv.str(args.side)],
      ["price_1e8", cv.str(args.price1e8)],
      ["size_1e8", cv.str(args.size1e8)],
      ["time_in_force", cv.str(args.timeInForce)],
      ["post_only", cv.bool(args.postOnly)],
      [
        "client_order_id",
        args.clientOrderId ? cv.str(args.clientOrderId) : cv.null(),
      ],
    ]);
  },

  optionOrderCancel(args: {
    account: Address;
    orderId: string;
  }): Uint8Array {
    return canonicalPayload("OPTION_ORDER_CANCEL", [
      ["account", cv.addr(args.account)],
      ["order_id", cv.str(args.orderId)],
    ]);
  },

  conditionalOrderCancel(args: {
    account: Address;
    conditionalOrderId: string;
  }): Uint8Array {
    return canonicalPayload("CONDITIONAL_ORDER_CANCEL", [
      ["account", cv.addr(args.account)],
      ["conditional_order_id", cv.str(args.conditionalOrderId)],
    ]);
  },

  /**
   * OPTIONS-RFQ-CREATE-AND-LIFECYCLE-V1 — field order must stay
   * byte-identical to backend `canonical_option_rfq_create` in
   * `src/api/routes.rs`. Nullable fields serialise as literal `null`.
   */
  optionRfqCreate(args: {
    taker: Address;
    optionSeriesId: string;
    side: "buy" | "sell";
    size1e8: string;
    limitPrice1e8?: string | null;
    ttlMs?: number | bigint | null;
  }): Uint8Array {
    return canonicalPayload("OPTION_RFQ_CREATE", [
      ["taker", cv.addr(args.taker)],
      ["option_series_id", cv.str(args.optionSeriesId)],
      ["side", cv.str(args.side)],
      ["size_1e8", cv.str(args.size1e8)],
      [
        "limit_price_1e8",
        args.limitPrice1e8 == null ? cv.null() : cv.str(args.limitPrice1e8),
      ],
      [
        "ttl_ms",
        args.ttlMs == null ? cv.null() : cv.u64(BigInt(args.ttlMs)),
      ],
    ]);
  },

  optionRfqCancel(args: { taker: Address; optionRfqId: string }): Uint8Array {
    return canonicalPayload("OPTION_RFQ_CANCEL", [
      ["taker", cv.addr(args.taker)],
      ["option_rfq_id", cv.str(args.optionRfqId)],
    ]);
  },

  /**
   * OPTIONS-RFQ-MAKER-QUOTE-SUBMIT-V1 — field order must stay
   * byte-identical to backend `canonical_option_rfq_quote_submit`:
   * option_rfq_id | mm_account | price_1e8 | size_1e8 |
   * client_quote_id | quote_nonce | quote_ttl_ms.
   */
  optionRfqQuoteSubmit(args: {
    optionRfqId: string;
    mmAccount: Address;
    price1e8: string;
    size1e8: string;
    clientQuoteId?: string | null;
    quoteNonce?: number | bigint | null;
    quoteTtlMs?: number | bigint | null;
  }): Uint8Array {
    return canonicalPayload("OPTION_RFQ_QUOTE_SUBMIT", [
      ["option_rfq_id", cv.str(args.optionRfqId)],
      ["mm_account", cv.addr(args.mmAccount)],
      ["price_1e8", cv.str(args.price1e8)],
      ["size_1e8", cv.str(args.size1e8)],
      [
        "client_quote_id",
        args.clientQuoteId == null ? cv.null() : cv.str(args.clientQuoteId),
      ],
      [
        "quote_nonce",
        args.quoteNonce == null ? cv.null() : cv.u64(BigInt(args.quoteNonce)),
      ],
      [
        "quote_ttl_ms",
        args.quoteTtlMs == null ? cv.null() : cv.u64(BigInt(args.quoteTtlMs)),
      ],
    ]);
  },

  optionRfqAccept(args: {
    taker: Address;
    optionRfqId: string;
    quoteId: string;
  }): Uint8Array {
    return canonicalPayload("OPTION_RFQ_ACCEPT", [
      ["taker", cv.addr(args.taker)],
      ["option_rfq_id", cv.str(args.optionRfqId)],
      ["quote_id", cv.str(args.quoteId)],
    ]);
  },
};
