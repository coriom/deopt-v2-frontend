// OPTIONS-TRADE-WIDGET-TP-SL-UX-V1
//
// Pure helpers shared between the order ticket and node tests for
// building the `attached_tp_sl` payload from the ticket's user
// input. The V1 UX exposes a single price per side (Take Profit
// Price / Stop Loss Price); the wire body still carries the two
// backend-required fields (`trigger_price_1e8` and `limit_price_1e8`)
// with equal values — the backend has no constraint that trigger
// and limit must differ (see `validate_attached_tp_sl` in
// `deopt-v2-backend/src/options/service.rs`).
//
// Validation rules:
//
//   * Each enabled leg's price must be a non-empty digit-only string
//     parseable to a positive BigInt (the project's 1e8 fixed-point
//     convention).
//   * When both legs are enabled, `link_as_oco` is forced to `true`
//     by the ticket UI; standalone TP/SL remains available for the
//     non-OCO case via the existing TpSlManager panel.
//   * When neither leg is enabled, the payload is `undefined` — the
//     ticket MUST omit the `attached_tp_sl` field entirely (the
//     backend rejects `{}` with `at least one of …`).
//
// The helpers never throw — invalid inputs produce an error string
// and `buildAttachedTpSlPayload` returns `undefined`; the UI
// surfaces the per-side error.

import type {
  AttachedLegRequest,
  AttachedTpSlRequest,
} from "./trading-types";

export interface AttachedTpSlInputState {
  tpEnabled: boolean;
  slEnabled: boolean;
  tpPrice1e8: string;
  slPrice1e8: string;
}

export interface AttachedTpSlValidation {
  tpError: string | null;
  slError: string | null;
  /** `true` iff every enabled leg has a valid price. When neither
   * leg is enabled, returns `true` (the payload is simply omitted). */
  ok: boolean;
}

function parsePositive1e8(
  raw: string,
  label: string,
): { value: string | null; error: string | null } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { value: null, error: `${label} price is required` };
  }
  if (!/^\d+$/.test(trimmed)) {
    return {
      value: null,
      error: `${label} price must be a non-negative integer (1e8 fixed-point)`,
    };
  }
  let parsed: bigint;
  try {
    parsed = BigInt(trimmed);
  } catch {
    return { value: null, error: `${label} price is not a valid integer` };
  }
  if (parsed <= BigInt(0)) {
    return { value: null, error: `${label} price must be > 0` };
  }
  return { value: trimmed, error: null };
}

/**
 * Pure validator. Returns a per-side error plus an `ok` boolean.
 * Disabled legs are never validated — their fields can stay empty
 * in the UI.
 */
export function validateAttachedTpSl(
  state: AttachedTpSlInputState,
): AttachedTpSlValidation {
  const tpError = state.tpEnabled
    ? parsePositive1e8(state.tpPrice1e8, "Take Profit").error
    : null;
  const slError = state.slEnabled
    ? parsePositive1e8(state.slPrice1e8, "Stop Loss").error
    : null;
  const ok = tpError === null && slError === null;
  return { tpError, slError, ok };
}

/**
 * Build the JSON payload to include under `attached_tp_sl` on the
 * order-submit request body. Returns `undefined` when neither leg
 * is enabled OR when any enabled leg is invalid — both cases mean
 * the ticket MUST omit the field entirely.
 *
 * V1 UX: the single per-side price populates BOTH `trigger_price_1e8`
 * and `limit_price_1e8` on the wire. Backend accepts equal values.
 *
 * The OCO link is forced ON whenever both legs are enabled (V1
 * policy). The backend already enforces `link_as_oco => both legs
 * present`; the helper just guarantees consistency.
 */
export function buildAttachedTpSlPayload(
  state: AttachedTpSlInputState,
): AttachedTpSlRequest | undefined {
  if (!state.tpEnabled && !state.slEnabled) return undefined;
  const validation = validateAttachedTpSl(state);
  if (!validation.ok) return undefined;
  const out: AttachedTpSlRequest = {};
  if (state.tpEnabled) {
    const price = state.tpPrice1e8.trim();
    const leg: AttachedLegRequest = {
      trigger_price_1e8: price,
      limit_price_1e8: price,
    };
    out.take_profit = leg;
  }
  if (state.slEnabled) {
    const price = state.slPrice1e8.trim();
    const leg: AttachedLegRequest = {
      trigger_price_1e8: price,
      limit_price_1e8: price,
    };
    out.stop_loss = leg;
  }
  if (state.tpEnabled && state.slEnabled) {
    out.link_as_oco = true;
  }
  return out;
}
