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
  // RFQ-MULTI-LEG-FRONTEND-V1 — multi-leg atomic RFQ actions. All
  // v2-only (backend refuses envelopes with version != 2).
  | "OPTION_MULTI_LEG_RFQ_CREATE"
  | "OPTION_MULTI_LEG_RFQ_QUOTE_SUBMIT"
  | "OPTION_MULTI_LEG_RFQ_ACCEPT"
  | "OPTION_MULTI_LEG_RFQ_CANCEL"
  | "OPTION_EXECUTION_INTENT_SIGNATURE_SUBMIT"
  | "OPTION_TWAP_CREATE"
  | "OPTION_TWAP_CANCEL"
  | "SUBACCOUNT_CREATE"
  | "SUBACCOUNT_RENAME"
  // PERPS-V2-WRITE-AUTH-ENFORCEMENT-V1 — Perps mutations under closed-
  // test conditions require a v2 envelope with these action strings.
  | "PERP_ORDER_SUBMIT"
  | "PERP_ORDER_CANCEL";

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
  /**
   * SUBACCOUNTS-FRONTEND-SWITCHER-V1 — envelope version. Absent or
   * `1` selects legacy Options canonical bytes (Account 1). Set to
   * `2` when the request targets a non-default subaccount; the
   * backend then reconstructs the v2 canonical which embeds
   * `subaccount_id` immediately after `account`. RFQ and Perps
   * actions do not use this field yet.
   */
  version?: number;
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
  /**
   * Envelope version to include on the returned envelope. Pass `2`
   * for Options mutations targeting a non-default subaccount so the
   * backend selects the v2 canonical reconstruction. Absent / `1`
   * preserves legacy v1 wire behaviour.
   */
  version?: number;
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
  if (args.version !== undefined && args.version !== 1) {
    envelope.version = args.version;
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

  /**
   * OPTIONS-TWAP-ORDERS-V1 — byte-identical to backend
   * `canonical_option_twap_create`. Field order:
   * account | option_series_id | side | size_1e8 | limit_price_1e8 |
   * running_time_ms | child_count | client_order_id.
   */
  optionTwapCreate(args: {
    account: Address;
    optionSeriesId: string;
    side: "buy" | "sell";
    size1e8: string;
    limitPrice1e8: string;
    runningTimeMs: number | bigint;
    childCount: number;
    clientOrderId?: string | null;
  }): Uint8Array {
    return canonicalPayload("OPTION_TWAP_CREATE", [
      ["account", cv.addr(args.account)],
      ["option_series_id", cv.str(args.optionSeriesId)],
      ["side", cv.str(args.side)],
      ["size_1e8", cv.str(args.size1e8)],
      ["limit_price_1e8", cv.str(args.limitPrice1e8)],
      ["running_time_ms", cv.u64(BigInt(args.runningTimeMs))],
      ["child_count", cv.u64(BigInt(args.childCount))],
      [
        "client_order_id",
        args.clientOrderId == null ? cv.null() : cv.str(args.clientOrderId),
      ],
    ]);
  },

  /**
   * OPTIONS-TWAP-ORDERS-V1 — byte-identical to backend
   * `canonical_option_twap_cancel`. Field order: account | option_twap_id.
   */
  optionTwapCancel(args: { account: Address; optionTwapId: string }): Uint8Array {
    return canonicalPayload("OPTION_TWAP_CANCEL", [
      ["account", cv.addr(args.account)],
      ["option_twap_id", cv.str(args.optionTwapId)],
    ]);
  },

  // -------------------------------------------------------------------
  // SUBACCOUNTS-FRONTEND-SWITCHER-V1 — v1 conditional order create
  // (previously constructed inline in `TpSlManager`). Extracted to
  // give v1 and v2 a shared field-list helper.
  // -------------------------------------------------------------------

  conditionalOrderCreate(args: {
    account: Address;
    optionSeriesId: string;
    quantity1e8: string;
    linkAsOco: boolean;
    expiresAtMs?: number | bigint | null;
    legs: ReadonlyArray<{
      conditionalType: "take_profit" | "stop_loss";
      triggerPrice1e8: string;
      limitPrice1e8: string;
      triggerCondition?: "gte" | "lte" | null;
    }>;
  }): Uint8Array {
    return canonicalPayload(
      "CONDITIONAL_ORDER_CREATE",
      conditionalOrderCreateFields({ ...args, subaccountId: null }),
    );
  },

  /**
   * SUBACCOUNTS-FRONTEND-SWITCHER-V1 — byte-identical to backend
   * `canonical_subaccount_create`. Field order: account | name.
   * Never authorised against a specific subaccount — the create
   * action is always wallet-level.
   */
  subaccountCreate(args: {
    account: Address;
    name?: string | null;
  }): Uint8Array {
    return canonicalPayload("SUBACCOUNT_CREATE", [
      ["account", cv.addr(args.account)],
      ["name", args.name == null ? cv.null() : cv.str(args.name)],
    ]);
  },

  /**
   * SUBACCOUNTS-FRONTEND-SWITCHER-V1 — byte-identical to backend
   * `canonical_subaccount_rename`. Field order:
   * account | subaccount_id | name.
   */
  subaccountRename(args: {
    account: Address;
    subaccountId: number;
    name: string;
  }): Uint8Array {
    return canonicalPayload("SUBACCOUNT_RENAME", [
      ["account", cv.addr(args.account)],
      ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
      ["name", cv.str(args.name)],
    ]);
  },
};

// ---------------------------------------------------------------------
// SUBACCOUNTS-FRONTEND-SWITCHER-V1 — v2 canonical builders.
//
// Each helper is byte-identical to its backend `canonical_*_v2`
// counterpart in `src/api/routes.rs`. The `subaccount_id` key is
// emitted immediately after `account` for every action.
//
// Use these builders when the active subaccount is not the default
// (subaccount 1). Pair with `buildAuthorization({ ..., version: 2 })`
// so the backend selects the v2 reconstruction. Sending v2 canonical
// bytes with a v1 envelope will fail as `PayloadMismatch` at the
// challenge verifier.
// ---------------------------------------------------------------------

/**
 * Shared field-list builder for `CONDITIONAL_ORDER_CREATE`. When
 * `subaccountId` is provided, emits `subaccount_id` immediately after
 * `account` and leaves every other field byte-identical to v1.
 */
function conditionalOrderCreateFields(args: {
  account: Address;
  subaccountId: number | null;
  optionSeriesId: string;
  quantity1e8: string;
  linkAsOco: boolean;
  expiresAtMs?: number | bigint | null;
  legs: ReadonlyArray<{
    conditionalType: "take_profit" | "stop_loss";
    triggerPrice1e8: string;
    limitPrice1e8: string;
    triggerCondition?: "gte" | "lte" | null;
  }>;
}): Array<readonly [string, CanonicalValue]> {
  const fields: Array<readonly [string, CanonicalValue]> = [
    ["account", cv.addr(args.account)],
  ];
  if (args.subaccountId !== null) {
    fields.push(["subaccount_id", cv.u64(BigInt(args.subaccountId))]);
  }
  fields.push(
    ["option_series_id", cv.str(args.optionSeriesId)],
    ["quantity_1e8", cv.str(args.quantity1e8)],
    ["link_as_oco", cv.bool(args.linkAsOco)],
    [
      "expires_at_ms",
      args.expiresAtMs == null ? cv.null() : cv.u64(BigInt(args.expiresAtMs)),
    ],
    ["leg_count", cv.u64(BigInt(args.legs.length))],
  );
  args.legs.forEach((leg, idx) => {
    const prefix = `leg${idx}_`;
    fields.push([`${prefix}conditional_type`, cv.str(leg.conditionalType)]);
    fields.push([`${prefix}trigger_price_1e8`, cv.str(leg.triggerPrice1e8)]);
    fields.push([`${prefix}limit_price_1e8`, cv.str(leg.limitPrice1e8)]);
    fields.push([
      `${prefix}trigger_condition`,
      leg.triggerCondition ? cv.str(leg.triggerCondition) : cv.null(),
    ]);
  });
  return fields;
}

export const canonicalV2 = {
  optionOrderSubmit(args: {
    account: Address;
    subaccountId: number;
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
      ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
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
    subaccountId: number;
    orderId: string;
  }): Uint8Array {
    return canonicalPayload("OPTION_ORDER_CANCEL", [
      ["account", cv.addr(args.account)],
      ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
      ["order_id", cv.str(args.orderId)],
    ]);
  },

  conditionalOrderCreate(args: {
    account: Address;
    subaccountId: number;
    optionSeriesId: string;
    quantity1e8: string;
    linkAsOco: boolean;
    expiresAtMs?: number | bigint | null;
    legs: ReadonlyArray<{
      conditionalType: "take_profit" | "stop_loss";
      triggerPrice1e8: string;
      limitPrice1e8: string;
      triggerCondition?: "gte" | "lte" | null;
    }>;
  }): Uint8Array {
    return canonicalPayload(
      "CONDITIONAL_ORDER_CREATE",
      conditionalOrderCreateFields({ ...args, subaccountId: args.subaccountId }),
    );
  },

  conditionalOrderCancel(args: {
    account: Address;
    subaccountId: number;
    conditionalOrderId: string;
  }): Uint8Array {
    return canonicalPayload("CONDITIONAL_ORDER_CANCEL", [
      ["account", cv.addr(args.account)],
      ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
      ["conditional_order_id", cv.str(args.conditionalOrderId)],
    ]);
  },

  optionTwapCreate(args: {
    account: Address;
    subaccountId: number;
    optionSeriesId: string;
    side: "buy" | "sell";
    size1e8: string;
    limitPrice1e8: string;
    runningTimeMs: number | bigint;
    childCount: number;
    clientOrderId?: string | null;
  }): Uint8Array {
    return canonicalPayload("OPTION_TWAP_CREATE", [
      ["account", cv.addr(args.account)],
      ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
      ["option_series_id", cv.str(args.optionSeriesId)],
      ["side", cv.str(args.side)],
      ["size_1e8", cv.str(args.size1e8)],
      ["limit_price_1e8", cv.str(args.limitPrice1e8)],
      ["running_time_ms", cv.u64(BigInt(args.runningTimeMs))],
      ["child_count", cv.u64(BigInt(args.childCount))],
      [
        "client_order_id",
        args.clientOrderId == null ? cv.null() : cv.str(args.clientOrderId),
      ],
    ]);
  },

  optionTwapCancel(args: {
    account: Address;
    subaccountId: number;
    optionTwapId: string;
  }): Uint8Array {
    return canonicalPayload("OPTION_TWAP_CANCEL", [
      ["account", cv.addr(args.account)],
      ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
      ["option_twap_id", cv.str(args.optionTwapId)],
    ]);
  },

  // -------------------------------------------------------------------
  // SUBACCOUNTS-RFQ-INTEGRATION-V1 — v2 canonical builders for RFQ.
  //
  // Each mirrors its v1 counterpart with `subaccount_id` emitted
  // immediately after the party identifier (`taker` for taker-side
  // actions; `mm_account` for the maker quote submit). Every other
  // field stays in v1 order so only the digest for a non-default
  // subaccount diverges — that divergence is what enforces cross-
  // subaccount replay resistance at the challenge verifier.
  //
  // Byte-frozen against the backend by
  // `tests/subaccounts_rfq_integration_tests.rs::v2_option_rfq_*`.
  // -------------------------------------------------------------------

  optionRfqCreate(args: {
    taker: Address;
    subaccountId: number;
    optionSeriesId: string;
    side: "buy" | "sell";
    size1e8: string;
    limitPrice1e8?: string | null;
    ttlMs?: number | bigint | null;
  }): Uint8Array {
    return canonicalPayload("OPTION_RFQ_CREATE", [
      ["taker", cv.addr(args.taker)],
      ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
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

  optionRfqQuoteSubmit(args: {
    optionRfqId: string;
    mmAccount: Address;
    subaccountId: number;
    price1e8: string;
    size1e8: string;
    clientQuoteId?: string | null;
    quoteNonce?: number | bigint | null;
    quoteTtlMs?: number | bigint | null;
  }): Uint8Array {
    return canonicalPayload("OPTION_RFQ_QUOTE_SUBMIT", [
      ["option_rfq_id", cv.str(args.optionRfqId)],
      ["mm_account", cv.addr(args.mmAccount)],
      ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
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
    subaccountId: number;
    optionRfqId: string;
    quoteId: string;
  }): Uint8Array {
    return canonicalPayload("OPTION_RFQ_ACCEPT", [
      ["taker", cv.addr(args.taker)],
      ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
      ["option_rfq_id", cv.str(args.optionRfqId)],
      ["quote_id", cv.str(args.quoteId)],
    ]);
  },

  optionRfqCancel(args: {
    taker: Address;
    subaccountId: number;
    optionRfqId: string;
  }): Uint8Array {
    return canonicalPayload("OPTION_RFQ_CANCEL", [
      ["taker", cv.addr(args.taker)],
      ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
      ["option_rfq_id", cv.str(args.optionRfqId)],
    ]);
  },

  // -------------------------------------------------------------------
  // RFQ-MULTI-LEG-FRONTEND-V1 — v2 canonical builders for the multi-
  // leg atomic RFQ subsystem. Backend refuses envelopes with version
  // != 2 for every one of these actions, so there is no v1 helper.
  //
  // Field ordering is byte-frozen against backend
  // `src/api/routes.rs::canonical_option_multi_leg_rfq_*_v2`. The
  // guiding rules:
  //
  //   * `subaccount_id` is emitted immediately after the party
  //     identifier (`taker` or `mm_account`).
  //   * `legs_count` is emitted as an explicit anti-injection guard
  //     before any per-leg fields — a client cannot slip an extra leg
  //     past the signature without also bumping the count.
  //   * Per-leg fields use the numeric `leg_{i}_{field}` convention
  //     and are emitted in ascending `leg_index` order.
  // -------------------------------------------------------------------

  /**
   * Byte-identical to backend `canonical_option_multi_leg_rfq_create_v2`.
   * Field order:
   * taker | subaccount_id | legs_count |
   * (leg_{i}_option_series_id | leg_{i}_side | leg_{i}_size_1e8 |
   *  leg_{i}_ratio_num | leg_{i}_ratio_den)... |
   * ttl_ms.
   */
  optionMultiLegRfqCreate(args: {
    taker: Address;
    subaccountId: number;
    legs: ReadonlyArray<{
      legIndex: number;
      optionSeriesId: string;
      side: "buy" | "sell";
      size1e8: string;
      ratioNum: number;
      ratioDen: number;
    }>;
    ttlMs?: number | bigint | null;
  }): Uint8Array {
    const fields: Array<readonly [string, CanonicalValue]> = [
      ["taker", cv.addr(args.taker)],
      ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
      ["legs_count", cv.u64(BigInt(args.legs.length))],
    ];
    for (const leg of args.legs) {
      const prefix = `leg_${leg.legIndex}_`;
      fields.push([`${prefix}option_series_id`, cv.str(leg.optionSeriesId)]);
      fields.push([`${prefix}side`, cv.str(leg.side)]);
      fields.push([`${prefix}size_1e8`, cv.str(leg.size1e8)]);
      fields.push([`${prefix}ratio_num`, cv.u64(BigInt(leg.ratioNum))]);
      fields.push([`${prefix}ratio_den`, cv.u64(BigInt(leg.ratioDen))]);
    }
    fields.push([
      "ttl_ms",
      args.ttlMs == null ? cv.null() : cv.u64(BigInt(args.ttlMs)),
    ]);
    return canonicalPayload("OPTION_MULTI_LEG_RFQ_CREATE", fields);
  },

  /**
   * Byte-identical to backend
   * `canonical_option_multi_leg_rfq_quote_submit_v2`. Field order:
   * option_rfq_id | mm_account | subaccount_id | package_price_1e8 |
   * size_1e8 | legs_count | (leg_{i}_price_1e8)... |
   * client_quote_id | quote_nonce | quote_ttl_ms.
   */
  optionMultiLegRfqQuoteSubmit(args: {
    optionRfqId: string;
    mmAccount: Address;
    subaccountId: number;
    packagePrice1e8: string;
    size1e8: string;
    legs: ReadonlyArray<{ legIndex: number; price1e8: string }>;
    clientQuoteId?: string | null;
    quoteNonce?: number | bigint | null;
    quoteTtlMs?: number | bigint | null;
  }): Uint8Array {
    const fields: Array<readonly [string, CanonicalValue]> = [
      ["option_rfq_id", cv.str(args.optionRfqId)],
      ["mm_account", cv.addr(args.mmAccount)],
      ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
      ["package_price_1e8", cv.str(args.packagePrice1e8)],
      ["size_1e8", cv.str(args.size1e8)],
      ["legs_count", cv.u64(BigInt(args.legs.length))],
    ];
    for (const leg of args.legs) {
      fields.push([`leg_${leg.legIndex}_price_1e8`, cv.str(leg.price1e8)]);
    }
    fields.push([
      "client_quote_id",
      args.clientQuoteId == null ? cv.null() : cv.str(args.clientQuoteId),
    ]);
    fields.push([
      "quote_nonce",
      args.quoteNonce == null ? cv.null() : cv.u64(BigInt(args.quoteNonce)),
    ]);
    fields.push([
      "quote_ttl_ms",
      args.quoteTtlMs == null ? cv.null() : cv.u64(BigInt(args.quoteTtlMs)),
    ]);
    return canonicalPayload("OPTION_MULTI_LEG_RFQ_QUOTE_SUBMIT", fields);
  },

  /**
   * Byte-identical to backend
   * `canonical_option_multi_leg_rfq_accept_v2`. Field order:
   * taker | subaccount_id | option_rfq_id | quote_id |
   * expected_package_price_1e8 | legs_count |
   * (leg_{i}_price_1e8)... — where the per-leg keys use the
   * bare index literal (`leg_0_price_1e8`) rather than the leg's
   * `leg_index`, matching the backend loop `for (i, price) in
   * expected_leg_prices_1e8.iter().enumerate()`.
   */
  optionMultiLegRfqAccept(args: {
    taker: Address;
    subaccountId: number;
    optionRfqId: string;
    quoteId: string;
    expectedPackagePrice1e8: string;
    expectedLegsCount: number;
    expectedLegPrices1e8: ReadonlyArray<string>;
  }): Uint8Array {
    const fields: Array<readonly [string, CanonicalValue]> = [
      ["taker", cv.addr(args.taker)],
      ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
      ["option_rfq_id", cv.str(args.optionRfqId)],
      ["quote_id", cv.str(args.quoteId)],
      [
        "expected_package_price_1e8",
        cv.str(args.expectedPackagePrice1e8),
      ],
      ["legs_count", cv.u64(BigInt(args.expectedLegsCount))],
    ];
    args.expectedLegPrices1e8.forEach((price, i) => {
      fields.push([`leg_${i}_price_1e8`, cv.str(price)]);
    });
    return canonicalPayload("OPTION_MULTI_LEG_RFQ_ACCEPT", fields);
  },

  /**
   * Byte-identical to backend
   * `canonical_option_multi_leg_rfq_cancel_v2`. Field order:
   * taker | subaccount_id | option_rfq_id.
   */
  optionMultiLegRfqCancel(args: {
    taker: Address;
    subaccountId: number;
    optionRfqId: string;
  }): Uint8Array {
    return canonicalPayload("OPTION_MULTI_LEG_RFQ_CANCEL", [
      ["taker", cv.addr(args.taker)],
      ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
      ["option_rfq_id", cv.str(args.optionRfqId)],
    ]);
  },

  // -------------------------------------------------------------------
  // PERPS-V2-WRITE-AUTH-ENFORCEMENT-V1 — v2 canonical builders for
  // Perps submit + cancel.
  //
  // Byte-frozen against the backend at
  // `src/api/routes.rs::canonical_perp_order_submit_v2` +
  // `canonical_perp_order_cancel_v2`. Perps never shipped a v1 wire,
  // so there is no v1 counterpart — every Perps closed-test / public-
  // trading call MUST use these.
  // -------------------------------------------------------------------

  perpOrderSubmit(args: {
    account: Address;
    subaccountId: number;
    marketId: string;
    side: "buy" | "sell";
    price1e8: string;
    size1e8: string;
    timeInForce: "gtc" | "ioc" | "fok";
    postOnly: boolean;
    reduceOnly: boolean;
    isolatedMargin1e8: string;
    clientOrderId?: string | null;
  }): Uint8Array {
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
      [
        "client_order_id",
        args.clientOrderId == null ? cv.null() : cv.str(args.clientOrderId),
      ],
    ]);
  },

  perpOrderCancel(args: {
    account: Address;
    subaccountId: number;
    orderId: string;
  }): Uint8Array {
    return canonicalPayload("PERP_ORDER_CANCEL", [
      ["account", cv.addr(args.account)],
      ["subaccount_id", cv.u64(BigInt(args.subaccountId))],
      ["order_id", cv.str(args.orderId)],
    ]);
  },
};
