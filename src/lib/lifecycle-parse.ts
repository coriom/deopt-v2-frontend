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
  ConditionalOrderUpdated,
  FillCreated,
  LifecycleChannel,
  LifecycleEvent,
  LifecyclePayload,
  OrderUpdated,
} from "./lifecycle-types";

const LIFECYCLE_CHANNELS: ReadonlySet<LifecycleChannel> = new Set([
  "account.orders",
  "account.fills",
  "account.conditional_orders",
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

function nullableString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  return null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
