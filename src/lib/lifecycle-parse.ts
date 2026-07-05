// FRONTEND-LIFECYCLE-OBSERVABILITY-V1 — defensive JSON-RPC frame parser.
//
// Accepts ONE WebSocket text frame at a time. Returns a typed
// `LifecycleEvent` if the frame is a recognised subscription push for
// one of the three lifecycle channels with a recognised payload
// variant; returns `null` for everything else.
//
// Properties:
//
//  * Never throws. Malformed JSON → `null`.
//  * Never logs the message bytes. Higher layers decide what to log.
//  * Ignores any payload `type` we don't yet model so the UI can keep
//    running when the backend introduces new variants.
//  * Validates EVERY field referenced by the typed shape — a missing
//    or wrong-type field makes the whole frame return `null` (no
//    silent partial mutations into UI state).

import type {
  AttachmentPlanUpdated,
  ConditionalOrderUpdated,
  FillCreated,
  LifecycleChannel,
  LifecycleEvent,
  LifecyclePayload,
  OptionRfqAccepted,
  OptionRfqCancelled,
  OptionRfqCreated,
  OptionRfqFillCreated,
  OptionRfqQuoteSubmitted,
  OrderRejected,
  OrderUpdated,
  PerpFillCreated,
  PerpFundingPaymentCreated,
  PerpOrderRejected,
  PerpOrderUpdated,
  PerpPositionLiquidated,
  PerpPositionUpdated,
} from "./lifecycle-types";

const LIFECYCLE_CHANNELS: ReadonlySet<LifecycleChannel> = new Set([
  "account.orders",
  "account.fills",
  "account.conditional_orders",
  "account.perp_orders",
  "account.perp_fills",
  "account.perp_positions",
  "account.perp_funding",
  "account.rfqs",
]);

export function parseLifecycleFrame(raw: string): LifecycleEvent | null {
  let frame: unknown;
  try {
    frame = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(frame)) return null;
  if (frame.method !== "subscription") return null;
  const params = frame.params;
  if (!isObject(params)) return null;
  const channel = params.channel;
  if (typeof channel !== "string") return null;
  if (!LIFECYCLE_CHANNELS.has(channel as LifecycleChannel)) return null;
  const event_id = params.event_id;
  const seq = params.seq;
  const address = params.address;
  const generated_at_ms = params.generated_at_ms;
  if (typeof event_id !== "string") return null;
  if (typeof seq !== "number") return null;
  if (typeof address !== "string") return null;
  if (typeof generated_at_ms !== "number") return null;
  const data = params.data;
  if (!isObject(data)) return null;
  if (data.type !== "lifecycle_delta") return null;
  const emitted_at_ms = data.emitted_at_ms;
  if (typeof emitted_at_ms !== "number") return null;
  const payload = parsePayload(data.payload);
  if (!payload) return null;
  return {
    channel: channel as LifecycleChannel,
    event_id,
    seq,
    address,
    emitted_at_ms,
    generated_at_ms,
    payload,
  };
}

function parsePayload(raw: unknown): LifecyclePayload | null {
  if (!isObject(raw)) return null;
  // Backend serializes the tagged union with `#[serde(tag = "type", rename_all = "snake_case")]`.
  // The Rust variants `OrderUpdated`, `FillCreated`, `ConditionalOrderUpdated`
  // become `order_updated`, `fill_created`, `conditional_order_updated`.
  const tag = raw.type;
  if (typeof tag !== "string") return null;
  switch (tag) {
    case "order_updated":
      return parseOrderUpdated(raw);
    case "fill_created":
      return parseFillCreated(raw);
    case "conditional_order_updated":
      return parseConditionalOrderUpdated(raw);
    case "order_rejected":
      return parseOrderRejected(raw);
    case "attachment_plan_updated":
      return parseAttachmentPlanUpdated(raw);
    case "perp_order_updated":
      return parsePerpOrderUpdated(raw);
    case "perp_fill_created":
      return parsePerpFillCreated(raw);
    case "perp_position_updated":
      return parsePerpPositionUpdated(raw);
    case "perp_order_rejected":
      return parsePerpOrderRejected(raw);
    case "perp_position_liquidated":
      return parsePerpPositionLiquidated(raw);
    case "perp_funding_payment_created":
      return parsePerpFundingPaymentCreated(raw);
    // OPTIONS-RFQ-LIFECYCLE-WS-V1 — Options RFQ payload variants.
    case "option_rfq_created":
      return parseOptionRfqCreated(raw);
    case "option_rfq_quote_submitted":
      return parseOptionRfqQuoteSubmitted(raw);
    case "option_rfq_accepted":
      return parseOptionRfqAccepted(raw);
    case "option_rfq_fill_created":
      return parseOptionRfqFillCreated(raw);
    case "option_rfq_cancelled":
      return parseOptionRfqCancelled(raw);
    default:
      // Unknown variant — return null so callers skip the frame
      // gracefully. Forward-compat: backend can add variants without
      // breaking older clients.
      return null;
  }
}

function parseOrderUpdated(raw: Record<string, unknown>): OrderUpdated | null {
  const order_id = raw.order_id;
  const option_series_id = raw.option_series_id;
  const status = raw.status;
  const remaining_size_1e8 = raw.remaining_size_1e8;
  const size_1e8 = raw.size_1e8;
  if (
    typeof order_id !== "string" ||
    typeof option_series_id !== "string" ||
    typeof status !== "string" ||
    typeof remaining_size_1e8 !== "string" ||
    typeof size_1e8 !== "string"
  ) {
    return null;
  }
  return {
    type: "order_updated",
    order_id,
    option_series_id,
    status,
    remaining_size_1e8,
    size_1e8,
  };
}

function parseFillCreated(raw: Record<string, unknown>): FillCreated | null {
  const fill_id = raw.fill_id;
  const option_series_id = raw.option_series_id;
  const order_id = raw.order_id;
  const side = raw.side;
  const price_1e8 = raw.price_1e8;
  const size_1e8 = raw.size_1e8;
  const created_at_ms = raw.created_at_ms;
  if (
    typeof fill_id !== "string" ||
    typeof option_series_id !== "string" ||
    typeof order_id !== "string" ||
    !(side === "buy" || side === "sell") ||
    typeof price_1e8 !== "string" ||
    typeof size_1e8 !== "string" ||
    typeof created_at_ms !== "number"
  ) {
    return null;
  }
  return {
    type: "fill_created",
    fill_id,
    option_series_id,
    order_id,
    side,
    price_1e8,
    size_1e8,
    created_at_ms,
  };
}

function parseConditionalOrderUpdated(
  raw: Record<string, unknown>,
): ConditionalOrderUpdated | null {
  const conditional_order_id = raw.conditional_order_id;
  const option_series_id = raw.option_series_id;
  const status = raw.status;
  if (
    typeof conditional_order_id !== "string" ||
    typeof option_series_id !== "string" ||
    typeof status !== "string"
  ) {
    return null;
  }
  const child_order_id = nullableString(raw.child_order_id);
  const oco_group_id = nullableString(raw.oco_group_id);
  const failure_code = nullableString(raw.failure_code);
  return {
    type: "conditional_order_updated",
    conditional_order_id,
    option_series_id,
    status,
    child_order_id,
    oco_group_id,
    failure_code,
  };
}

function parseOrderRejected(raw: Record<string, unknown>): OrderRejected | null {
  const rejection_id = raw.rejection_id;
  const reason_code = raw.reason_code;
  const reason_source = raw.reason_source;
  const created_at_ms = raw.created_at_ms;
  if (
    typeof rejection_id !== "string" ||
    typeof reason_code !== "string" ||
    typeof reason_source !== "string" ||
    typeof created_at_ms !== "number"
  ) {
    return null;
  }
  const option_series_id = nullableString(raw.option_series_id);
  const sideRaw = raw.side;
  let side: "buy" | "sell" | null = null;
  if (sideRaw === "buy" || sideRaw === "sell") side = sideRaw;
  else if (sideRaw !== null && sideRaw !== undefined) return null;
  const price_1e8 = nullableString(raw.price_1e8);
  const size_1e8 = nullableString(raw.size_1e8);
  const time_in_force = nullableString(raw.time_in_force);
  const post_only = nullableBool(raw.post_only);
  const client_order_id = nullableString(raw.client_order_id);
  const reason_message = nullableString(raw.reason_message);
  return {
    type: "order_rejected",
    rejection_id,
    option_series_id,
    side,
    price_1e8,
    size_1e8,
    time_in_force,
    post_only,
    client_order_id,
    reason_code,
    reason_message,
    reason_source,
    created_at_ms,
  };
}

function parseAttachmentPlanUpdated(
  raw: Record<string, unknown>,
): AttachmentPlanUpdated | null {
  const plan_id = raw.plan_id;
  const parent_order_id = raw.parent_order_id;
  const option_series_id = raw.option_series_id;
  const status = raw.status;
  const updated_at_ms = raw.updated_at_ms;
  if (
    typeof plan_id !== "string" ||
    typeof parent_order_id !== "string" ||
    typeof option_series_id !== "string" ||
    typeof status !== "string" ||
    typeof updated_at_ms !== "number"
  ) {
    return null;
  }
  const materialized_size_1e8 = nullableString(raw.materialized_size_1e8);
  const tp_conditional_order_id = nullableString(raw.tp_conditional_order_id);
  const sl_conditional_order_id = nullableString(raw.sl_conditional_order_id);
  const oco_group_id = nullableString(raw.oco_group_id);
  const failure_code = nullableString(raw.failure_code);
  const failure_message = nullableString(raw.failure_message);
  return {
    type: "attachment_plan_updated",
    plan_id,
    parent_order_id,
    option_series_id,
    status,
    materialized_size_1e8,
    tp_conditional_order_id,
    sl_conditional_order_id,
    oco_group_id,
    failure_code,
    failure_message,
    updated_at_ms,
  };
}

// PERPS-PERSISTENCE-HISTORY-LIFECYCLE-V1 — Perps payload parsers.

function parsePerpOrderUpdated(raw: Record<string, unknown>): PerpOrderUpdated | null {
  const order_id = raw.order_id;
  const market_id = raw.market_id;
  const side = raw.side;
  const status = raw.status;
  const price_1e8 = raw.price_1e8;
  const size_1e8 = raw.size_1e8;
  const remaining_size_1e8 = raw.remaining_size_1e8;
  const filled_size_1e8 = raw.filled_size_1e8;
  const time_in_force = raw.time_in_force;
  const post_only = raw.post_only;
  const reduce_only = raw.reduce_only;
  const updated_at_ms = raw.updated_at_ms;
  if (
    typeof order_id !== "string" ||
    typeof market_id !== "string" ||
    !(side === "buy" || side === "sell") ||
    typeof status !== "string" ||
    typeof price_1e8 !== "string" ||
    typeof size_1e8 !== "string" ||
    typeof remaining_size_1e8 !== "string" ||
    typeof filled_size_1e8 !== "string" ||
    typeof time_in_force !== "string" ||
    typeof post_only !== "boolean" ||
    typeof reduce_only !== "boolean" ||
    typeof updated_at_ms !== "number"
  ) {
    return null;
  }
  return {
    type: "perp_order_updated",
    order_id,
    market_id,
    side,
    status,
    price_1e8,
    size_1e8,
    remaining_size_1e8,
    filled_size_1e8,
    time_in_force,
    post_only,
    reduce_only,
    client_order_id: nullableString(raw.client_order_id),
    terminal_reason_code: nullableString(raw.terminal_reason_code),
    updated_at_ms,
  };
}

function parsePerpFillCreated(raw: Record<string, unknown>): PerpFillCreated | null {
  const fill_id = raw.fill_id;
  const market_id = raw.market_id;
  const order_id = raw.order_id;
  const counterparty_order_id = raw.counterparty_order_id;
  const liquidity_role = raw.liquidity_role;
  const side = raw.side;
  const price_1e8 = raw.price_1e8;
  const size_1e8 = raw.size_1e8;
  const created_at_ms = raw.created_at_ms;
  if (
    typeof fill_id !== "string" ||
    typeof market_id !== "string" ||
    typeof order_id !== "string" ||
    typeof counterparty_order_id !== "string" ||
    !(liquidity_role === "taker" || liquidity_role === "maker") ||
    !(side === "buy" || side === "sell") ||
    typeof price_1e8 !== "string" ||
    typeof size_1e8 !== "string" ||
    typeof created_at_ms !== "number"
  ) {
    return null;
  }
  return {
    type: "perp_fill_created",
    fill_id,
    market_id,
    order_id,
    counterparty_order_id,
    liquidity_role,
    side,
    price_1e8,
    size_1e8,
    created_at_ms,
  };
}

function parsePerpPositionUpdated(
  raw: Record<string, unknown>,
): PerpPositionUpdated | null {
  const position_id = raw.position_id;
  const market_id = raw.market_id;
  const side = raw.side;
  const size_1e8 = raw.size_1e8;
  const entry_price_1e8 = raw.entry_price_1e8;
  const margin_1e8 = raw.margin_1e8;
  const realized_pnl_1e8 = raw.realized_pnl_1e8;
  const status = raw.status;
  const updated_at_ms = raw.updated_at_ms;
  if (
    typeof position_id !== "string" ||
    typeof market_id !== "string" ||
    !(side === "long" || side === "short") ||
    typeof size_1e8 !== "string" ||
    typeof entry_price_1e8 !== "string" ||
    typeof margin_1e8 !== "string" ||
    typeof realized_pnl_1e8 !== "string" ||
    typeof status !== "string" ||
    typeof updated_at_ms !== "number"
  ) {
    return null;
  }
  return {
    type: "perp_position_updated",
    position_id,
    market_id,
    side,
    size_1e8,
    entry_price_1e8,
    margin_1e8,
    realized_pnl_1e8,
    status,
    updated_at_ms,
  };
}

function parsePerpPositionLiquidated(
  raw: Record<string, unknown>,
): PerpPositionLiquidated | null {
  const liquidation_id = raw.liquidation_id;
  const market_id = raw.market_id;
  const position_id = raw.position_id;
  const side = raw.side;
  const size_1e8 = raw.size_1e8;
  const mark_price_1e8 = raw.mark_price_1e8;
  const realized_pnl_1e8 = raw.realized_pnl_1e8;
  const bad_debt_1e8 = raw.bad_debt_1e8;
  const liquidation_fee_1e8 = raw.liquidation_fee_1e8;
  const reason_code = raw.reason_code;
  const created_at_ms = raw.created_at_ms;
  if (
    typeof liquidation_id !== "string" ||
    typeof market_id !== "string" ||
    typeof position_id !== "string" ||
    !(side === "long" || side === "short") ||
    typeof size_1e8 !== "string" ||
    typeof mark_price_1e8 !== "string" ||
    typeof realized_pnl_1e8 !== "string" ||
    typeof bad_debt_1e8 !== "string" ||
    typeof liquidation_fee_1e8 !== "string" ||
    typeof reason_code !== "string" ||
    typeof created_at_ms !== "number"
  ) {
    return null;
  }
  return {
    type: "perp_position_liquidated",
    liquidation_id,
    market_id,
    position_id,
    side,
    size_1e8,
    mark_price_1e8,
    realized_pnl_1e8,
    bad_debt_1e8,
    liquidation_fee_1e8,
    reason_code,
    created_at_ms,
  };
}

function parsePerpFundingPaymentCreated(
  raw: Record<string, unknown>,
): PerpFundingPaymentCreated | null {
  const funding_event_id = raw.funding_event_id;
  const market_id = raw.market_id;
  const position_id = raw.position_id;
  const side = raw.side;
  const position_size_1e8 = raw.position_size_1e8;
  const funding_index_before_1e18 = raw.funding_index_before_1e18;
  const funding_index_after_1e18 = raw.funding_index_after_1e18;
  const funding_delta_1e18 = raw.funding_delta_1e18;
  const payment_1e8 = raw.payment_1e8;
  const margin_before_1e8 = raw.margin_before_1e8;
  const margin_after_1e8 = raw.margin_after_1e8;
  const bad_debt_1e8 = raw.bad_debt_1e8;
  const reason_code = raw.reason_code;
  const created_at_ms = raw.created_at_ms;
  if (
    typeof funding_event_id !== "string" ||
    typeof market_id !== "string" ||
    typeof position_id !== "string" ||
    !(side === "long" || side === "short") ||
    typeof position_size_1e8 !== "string" ||
    typeof funding_index_before_1e18 !== "string" ||
    typeof funding_index_after_1e18 !== "string" ||
    typeof funding_delta_1e18 !== "string" ||
    typeof payment_1e8 !== "string" ||
    typeof margin_before_1e8 !== "string" ||
    typeof margin_after_1e8 !== "string" ||
    typeof bad_debt_1e8 !== "string" ||
    typeof reason_code !== "string" ||
    typeof created_at_ms !== "number"
  ) {
    return null;
  }
  return {
    type: "perp_funding_payment_created",
    funding_event_id,
    market_id,
    position_id,
    side,
    position_size_1e8,
    funding_index_before_1e18,
    funding_index_after_1e18,
    funding_delta_1e18,
    payment_1e8,
    margin_before_1e8,
    margin_after_1e8,
    bad_debt_1e8,
    reason_code,
    created_at_ms,
  };
}

function parsePerpOrderRejected(raw: Record<string, unknown>): PerpOrderRejected | null {
  const reason_code = raw.reason_code;
  const reason_source = raw.reason_source;
  const created_at_ms = raw.created_at_ms;
  if (
    typeof reason_code !== "string" ||
    typeof reason_source !== "string" ||
    typeof created_at_ms !== "number"
  ) {
    return null;
  }
  const sideRaw = raw.side;
  let side: "buy" | "sell" | null = null;
  if (sideRaw === "buy" || sideRaw === "sell") side = sideRaw;
  else if (sideRaw !== null && sideRaw !== undefined) return null;
  return {
    type: "perp_order_rejected",
    market_id: nullableString(raw.market_id),
    side,
    price_1e8: nullableString(raw.price_1e8),
    size_1e8: nullableString(raw.size_1e8),
    time_in_force: nullableString(raw.time_in_force),
    post_only: nullableBool(raw.post_only),
    reduce_only: nullableBool(raw.reduce_only),
    client_order_id: nullableString(raw.client_order_id),
    reason_code,
    reason_message: nullableString(raw.reason_message),
    reason_source,
    created_at_ms,
  };
}

// OPTIONS-RFQ-LIFECYCLE-WS-V1 — RFQ payload parsers.

function parseOptionRfqCreated(raw: Record<string, unknown>): OptionRfqCreated | null {
  const option_rfq_id = raw.option_rfq_id;
  const option_series_id = raw.option_series_id;
  const taker = raw.taker;
  const side = raw.side;
  const size_1e8 = raw.size_1e8;
  const status = raw.status;
  const created_at_ms = raw.created_at_ms;
  const expires_at_ms = raw.expires_at_ms;
  if (
    typeof option_rfq_id !== "string" ||
    typeof option_series_id !== "string" ||
    typeof taker !== "string" ||
    !(side === "buy" || side === "sell") ||
    typeof size_1e8 !== "string" ||
    typeof status !== "string" ||
    typeof created_at_ms !== "number" ||
    typeof expires_at_ms !== "number"
  ) {
    return null;
  }
  return {
    type: "option_rfq_created",
    option_rfq_id,
    option_series_id,
    taker,
    side,
    size_1e8,
    limit_price_1e8: nullableString(raw.limit_price_1e8),
    status,
    created_at_ms,
    expires_at_ms,
  };
}

function parseOptionRfqQuoteSubmitted(
  raw: Record<string, unknown>,
): OptionRfqQuoteSubmitted | null {
  const option_rfq_id = raw.option_rfq_id;
  const quote_id = raw.quote_id;
  const option_series_id = raw.option_series_id;
  const taker = raw.taker;
  const mm_account = raw.mm_account;
  const price_1e8 = raw.price_1e8;
  const size_1e8 = raw.size_1e8;
  const status = raw.status;
  const created_at_ms = raw.created_at_ms;
  const expires_at_ms = raw.expires_at_ms;
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
  ) {
    return null;
  }
  return {
    type: "option_rfq_quote_submitted",
    option_rfq_id,
    quote_id,
    option_series_id,
    taker,
    mm_account,
    price_1e8,
    size_1e8,
    status,
    created_at_ms,
    expires_at_ms,
  };
}

function parseOptionRfqAccepted(raw: Record<string, unknown>): OptionRfqAccepted | null {
  const option_rfq_id = raw.option_rfq_id;
  const quote_id = raw.quote_id;
  const option_series_id = raw.option_series_id;
  const taker = raw.taker;
  const mm_account = raw.mm_account;
  const rfq_status = raw.rfq_status;
  const quote_status = raw.quote_status;
  const option_fill_id = raw.option_fill_id;
  const accepted_at_ms = raw.accepted_at_ms;
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
  ) {
    return null;
  }
  return {
    type: "option_rfq_accepted",
    option_rfq_id,
    quote_id,
    option_series_id,
    taker,
    mm_account,
    rfq_status,
    quote_status,
    option_fill_id,
    accepted_at_ms,
  };
}

function parseOptionRfqFillCreated(
  raw: Record<string, unknown>,
): OptionRfqFillCreated | null {
  const option_rfq_id = raw.option_rfq_id;
  const quote_id = raw.quote_id;
  const fill_id = raw.fill_id;
  const option_series_id = raw.option_series_id;
  const taker = raw.taker;
  const mm_account = raw.mm_account;
  const taker_side = raw.taker_side;
  const price_1e8 = raw.price_1e8;
  const size_1e8 = raw.size_1e8;
  const created_at_ms = raw.created_at_ms;
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
  ) {
    return null;
  }
  return {
    type: "option_rfq_fill_created",
    option_rfq_id,
    quote_id,
    fill_id,
    option_series_id,
    taker,
    mm_account,
    taker_side,
    price_1e8,
    size_1e8,
    created_at_ms,
  };
}

function parseOptionRfqCancelled(raw: Record<string, unknown>): OptionRfqCancelled | null {
  const option_rfq_id = raw.option_rfq_id;
  const option_series_id = raw.option_series_id;
  const taker = raw.taker;
  const status = raw.status;
  const cancelled_at_ms = raw.cancelled_at_ms;
  if (
    typeof option_rfq_id !== "string" ||
    typeof option_series_id !== "string" ||
    typeof taker !== "string" ||
    typeof status !== "string" ||
    typeof cancelled_at_ms !== "number"
  ) {
    return null;
  }
  return {
    type: "option_rfq_cancelled",
    option_rfq_id,
    option_series_id,
    taker,
    status,
    cancelled_at_ms,
  };
}

function nullableString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  return null;
}

function nullableBool(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  return null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
