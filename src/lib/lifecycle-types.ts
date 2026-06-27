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
  | "account.conditional_orders";

export interface OrderUpdated {
  type: "order_updated";
  order_id: string;
  option_series_id: string;
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
}

export interface ConditionalOrderUpdated {
  type: "conditional_order_updated";
  conditional_order_id: string;
  option_series_id: string;
  status: string;
  child_order_id: string | null;
  oco_group_id: string | null;
  failure_code: string | null;
}

export type LifecyclePayload =
  | OrderUpdated
  | FillCreated
  | ConditionalOrderUpdated;

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
