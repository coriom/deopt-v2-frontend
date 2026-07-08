// FRONTEND-LIFECYCLE-OBSERVABILITY-V1 — typed lifecycle payloads.
//
// Mirrors the backend `LifecyclePayload` tagged union from
// `~/DEOPT/deopt-v2-backend/src/api/public_ws/lifecycle.rs`.
// Wire shape (server → client):
//
//   {
//     "jsonrpc": "2.0",
//     "method": "subscription",
//     "params": {
//       "subscription_id": "sub_…",
//       "channel": "account.orders" | "account.fills" | "account.conditional_orders",
//       "seq": <u64>,
//       "event_id": "evt_<uuid>",
//       "source": "backend",
//       "chain_id": 84532,
//       "generated_at_ms": <i64>,
//       "address": "<authenticated session address>",
//       "data": {
//         "type": "lifecycle_delta",
//         "emitted_at_ms": <i64>,
//         "payload": <LifecyclePayload>
//       }
//     }
//   }
//
// The `payload` is one of three tagged variants. Unknown variants are
// returned as `null` from the parser so the UI can ignore them safely.

export type LifecycleChannel =
  | "account.orders"
  | "account.fills"
  | "account.conditional_orders"
  | "account.perp_orders"
  | "account.perp_fills"
  | "account.perp_positions"
  | "account.perp_funding"
  | "account.rfqs";

export interface OrderUpdated {
  type: "order_updated";
  order_id: string;
  option_series_id: string;
  /**
   * SUBACCOUNTS-OPTIONS-WS-PAYLOAD-V1 — subaccount that owns the
   * order. Backend emits `1` for pre-migration rows via
   * `#[serde(default = "one_subaccount_id")]`. Optional so an older
   * enveloped payload without the field still parses; consumers
   * treat `undefined` as "unknown → refetch to be safe".
   */
  subaccount_id?: number;
  status: string;
  remaining_size_1e8: string;
  size_1e8: string;
}

export interface FillCreated {
  type: "fill_created";
  fill_id: string;
  option_series_id: string;
  order_id: string;
  side: "buy" | "sell";
  price_1e8: string;
  size_1e8: string;
  created_at_ms: number;
  /**
   * SUBACCOUNTS-OPTIONS-WS-PAYLOAD-V1 — per-side subaccounts so a
   * wallet that owned both legs can filter side-aware. The receiver
   * reads `buyer_subaccount_id` when they were the buyer and
   * `seller_subaccount_id` when they were the seller.
   */
  buyer_subaccount_id?: number;
  seller_subaccount_id?: number;
}

export interface ConditionalOrderUpdated {
  type: "conditional_order_updated";
  conditional_order_id: string;
  option_series_id: string;
  /**
   * SUBACCOUNTS-OPTIONS-WS-PAYLOAD-V1 — subaccount the conditional
   * order belongs to. Attached TP/SL legs inherit their parent
   * order's value at materialisation time.
   */
  subaccount_id?: number;
  status: string;
  child_order_id: string | null;
  oco_group_id: string | null;
  failure_code: string | null;
}

/**
 * ACCOUNT-LIFECYCLE-REALTIME-GAPS-V2 — a submit attempt that was
 * durably persisted in the rejected-attempts feed. Routed on
 * `account.orders`. Carries only scalar fields already surfaced by
 * the rejected-attempts REST endpoint — never a signature, nonce,
 * envelope, header, or bearer token.
 */
export interface OrderRejected {
  type: "order_rejected";
  rejection_id: string;
  option_series_id: string | null;
  side: "buy" | "sell" | null;
  price_1e8: string | null;
  size_1e8: string | null;
  time_in_force: string | null;
  post_only: boolean | null;
  client_order_id: string | null;
  reason_code: string;
  reason_message: string | null;
  reason_source: string;
  created_at_ms: number;
}

/**
 * ACCOUNT-LIFECYCLE-REALTIME-GAPS-V2 — an attached TP/SL plan
 * transitioned (pending create, active materialisation, cancelled,
 * failed, or materialized_size resize). Routed on
 * `account.conditional_orders` so consumers already tracking the
 * conditional-orders channel receive both conditional leg deltas
 * and their parent-plan transitions on one subscription.
 */
export interface AttachmentPlanUpdated {
  type: "attachment_plan_updated";
  plan_id: string;
  parent_order_id: string;
  option_series_id: string;
  /**
   * SUBACCOUNTS-OPTIONS-WS-PAYLOAD-V1 — inherited from the parent
   * Options order at emit time. See the backend note in
   * `emit_attachment_plan_lifecycle`.
   */
  subaccount_id?: number;
  status: string;
  materialized_size_1e8: string | null;
  tp_conditional_order_id: string | null;
  sl_conditional_order_id: string | null;
  oco_group_id: string | null;
  failure_code: string | null;
  failure_message: string | null;
  updated_at_ms: number;
}

/**
 * PERPS-PERSISTENCE-HISTORY-LIFECYCLE-V1 — Perps order lifecycle.
 * Routed on `account.perp_orders`. Never carries auth material.
 */
export interface PerpOrderUpdated {
  type: "perp_order_updated";
  order_id: string;
  market_id: string;
  side: "buy" | "sell";
  status: string;
  price_1e8: string;
  size_1e8: string;
  remaining_size_1e8: string;
  filled_size_1e8: string;
  time_in_force: string;
  post_only: boolean;
  reduce_only: boolean;
  client_order_id: string | null;
  terminal_reason_code: string | null;
  updated_at_ms: number;
}

/** Routed on `account.perp_fills`. One frame per account (taker + maker). */
export interface PerpFillCreated {
  type: "perp_fill_created";
  fill_id: string;
  market_id: string;
  order_id: string;
  counterparty_order_id: string;
  liquidity_role: "taker" | "maker";
  side: "buy" | "sell";
  price_1e8: string;
  size_1e8: string;
  created_at_ms: number;
}

/** Routed on `account.perp_positions`. */
export interface PerpPositionUpdated {
  type: "perp_position_updated";
  position_id: string;
  market_id: string;
  side: "long" | "short";
  size_1e8: string;
  entry_price_1e8: string;
  margin_1e8: string;
  realized_pnl_1e8: string;
  status: string;
  updated_at_ms: number;
}

/** Routed on `account.perp_orders`. V1 emitted from internal exec only. */
export interface PerpOrderRejected {
  type: "perp_order_rejected";
  market_id: string | null;
  side: "buy" | "sell" | null;
  price_1e8: string | null;
  size_1e8: string | null;
  time_in_force: string | null;
  post_only: boolean | null;
  reduce_only: boolean | null;
  client_order_id: string | null;
  reason_code: string;
  reason_message: string | null;
  reason_source: string;
  created_at_ms: number;
}

/**
 * PERPS-LIQUIDATION-AND-RISK-V1 — a Perps position was liquidated (or a
 * candidate was skipped because the mark was unavailable). Routed on
 * `account.perp_positions`. Never carries auth material.
 */
export interface PerpPositionLiquidated {
  type: "perp_position_liquidated";
  liquidation_id: string;
  market_id: string;
  position_id: string;
  side: "long" | "short";
  size_1e8: string;
  mark_price_1e8: string;
  realized_pnl_1e8: string;
  bad_debt_1e8: string;
  liquidation_fee_1e8: string;
  reason_code: string;
  created_at_ms: number;
}

/**
 * PERPS-FUNDING-V1 — a Perps funding settlement recorded a payment.
 * Positive `payment_1e8` means the trader OWED funding (their margin
 * was reduced); negative means the trader RECEIVED funding (their
 * margin was increased). Routed on `account.perp_funding`. Consumers
 * already subscribed to `account.perp_positions` will additionally
 * see a `PerpPositionUpdated` frame reflecting the new margin. Never
 * carries signatures, nonces, envelopes, headers, or bearer tokens.
 */
export interface PerpFundingPaymentCreated {
  type: "perp_funding_payment_created";
  funding_event_id: string;
  market_id: string;
  position_id: string;
  side: "long" | "short";
  position_size_1e8: string;
  funding_index_before_1e18: string;
  funding_index_after_1e18: string;
  funding_delta_1e18: string;
  payment_1e8: string;
  margin_before_1e8: string;
  margin_after_1e8: string;
  bad_debt_1e8: string;
  reason_code: string;
  created_at_ms: number;
}

/**
 * OPTIONS-RFQ-LIFECYCLE-WS-V1 — Options RFQ lifecycle deltas
 * routed on `account.rfqs`. Every field is a scalar already
 * exposed by the public REST surface. NEVER a signature,
 * write-auth nonce, envelope, header, or bearer token.
 */
export interface OptionRfqCreated {
  type: "option_rfq_created";
  option_rfq_id: string;
  option_series_id: string;
  taker: string;
  side: "buy" | "sell";
  size_1e8: string;
  limit_price_1e8: string | null;
  status: string;
  created_at_ms: number;
  expires_at_ms: number;
}

export interface OptionRfqQuoteSubmitted {
  type: "option_rfq_quote_submitted";
  option_rfq_id: string;
  quote_id: string;
  option_series_id: string;
  taker: string;
  mm_account: string;
  price_1e8: string;
  size_1e8: string;
  status: string;
  created_at_ms: number;
  expires_at_ms: number;
}

export interface OptionRfqAccepted {
  type: "option_rfq_accepted";
  option_rfq_id: string;
  quote_id: string;
  option_series_id: string;
  taker: string;
  mm_account: string;
  rfq_status: string;
  quote_status: string;
  option_fill_id: string;
  accepted_at_ms: number;
}

export interface OptionRfqFillCreated {
  type: "option_rfq_fill_created";
  option_rfq_id: string;
  quote_id: string;
  fill_id: string;
  option_series_id: string;
  taker: string;
  mm_account: string;
  taker_side: "buy" | "sell";
  price_1e8: string;
  size_1e8: string;
  created_at_ms: number;
}

export interface OptionRfqCancelled {
  type: "option_rfq_cancelled";
  option_rfq_id: string;
  option_series_id: string;
  taker: string;
  status: string;
  cancelled_at_ms: number;
}

export type LifecyclePayload =
  | OrderUpdated
  | FillCreated
  | ConditionalOrderUpdated
  | OrderRejected
  | AttachmentPlanUpdated
  | PerpOrderUpdated
  | PerpFillCreated
  | PerpPositionUpdated
  | PerpOrderRejected
  | PerpPositionLiquidated
  | PerpFundingPaymentCreated
  | OptionRfqCreated
  | OptionRfqQuoteSubmitted
  | OptionRfqAccepted
  | OptionRfqFillCreated
  | OptionRfqCancelled;

/** Parsed lifecycle frame ready for UI consumption. */
export interface LifecycleEvent {
  channel: LifecycleChannel;
  event_id: string;
  seq: number;
  address: string;
  emitted_at_ms: number;
  generated_at_ms: number;
  payload: LifecyclePayload;
}

export type LifecycleConnectionStatus =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "subscribed"
  | "reconnecting"
  | "polling_fallback"
  | "error";
