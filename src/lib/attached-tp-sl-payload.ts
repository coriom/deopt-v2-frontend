// ATTACHED-TP-SL-ON-ENTRY-V1 / ATTACHED-TP-SL-TICKET-UI-V1
//
// Pure helpers shared between the order ticket and node tests for
// building the `attached_tp_sl` payload from the ticket's user
// input. Keeping these here (rather than inline in the component)
// lets the node test exercise every branch without rendering React.
//
// Validation rules (mirror the backend's
// `validate_attached_tp_sl` in `deopt-v2-backend/src/options/service.rs`):
//
//   * Each enabled leg's trigger price AND limit price must be
//     non-empty digit-only strings parseable to a positive BigInt
//     (the project's 1e8 fixed-point convention).
//   * When both legs are enabled, `link_as_oco` is forced to
//     `true` by the ticket UI; standalone TP/SL remains available
//     for the non-OCO case via the existing TpSlManager panel.
//   * When neither leg is enabled, the payload is `undefined` —
//     the ticket MUST omit the `attached_tp_sl` field entirely
//     (the backend rejects `{}` with `at least one of …`).
//
// The helpers never throw — invalid inputs produce a `null` leg
// (or `undefined` payload) and the UI surfaces a per-field error.

import type {
  AttachedLegRequest,
  AttachedTpSlRequest,
} from "./trading-types";

export interface AttachedTpSlInputState {
  tpEnabled: boolean;
  slEnabled: boolean;
  tpTrigger1e8: string;
  tpLimit1e8: string;
  slTrigger1e8: string;
  slLimit1e8: string;
}

export interface AttachedTpSlValidation {
  tpTriggerError: string | null;
  tpLimitError: string | null;
  slTriggerError: string | null;
  slLimitError: string | null;
  /** `true` iff every enabled leg has valid prices. When neither
   * leg is enabled, returns `true` (the payload is simply omitted). */
  ok: boolean;
}

/**
 * Parse a "stringified u128 × 1e8" input and return either the
 * canonical string (whitespace-stripped) or an error message. Only
 * digit characters are accepted; the upper bound is u128 but we
 * accept any non-negative BigInt the backend would (negative inputs
 * are rejected by both the UI and the backend's `parse_fixed_u128`).
 */
function parsePositive1e8(raw: string, label: string): { value: string | null; error: string | null } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { value: null, error: `${label} is required` };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { value: null, error: `${label} must be a non-negative integer (1e8 fixed-point)` };
  }
  let parsed: bigint;
  try {
    parsed = BigInt(trimmed);
  } catch {
    return { value: null, error: `${label} is not a valid integer` };
  }
  if (parsed <= BigInt(0)) {
    return { value: null, error: `${label} must be > 0` };
  }
  return { value: trimmed, error: null };
}

/**
 * Pure validator. Returns a per-field error map plus an `ok`
 * boolean. Disabled legs are never validated — their fields can
 * stay empty in the UI.
 */
export function validateAttachedTpSl(
  state: AttachedTpSlInputState,
): AttachedTpSlValidation {
  let tpTriggerError: string | null = null;
  let tpLimitError: string | null = null;
  let slTriggerError: string | null = null;
  let slLimitError: string | null = null;
  if (state.tpEnabled) {
    tpTriggerError = parsePositive1e8(state.tpTrigger1e8, "TP trigger").error;
    tpLimitError = parsePositive1e8(state.tpLimit1e8, "TP limit").error;
  }
  if (state.slEnabled) {
    slTriggerError = parsePositive1e8(state.slTrigger1e8, "SL trigger").error;
    slLimitError = parsePositive1e8(state.slLimit1e8, "SL limit").error;
  }
  const ok =
    tpTriggerError === null &&
    tpLimitError === null &&
    slTriggerError === null &&
    slLimitError === null;
  return { tpTriggerError, tpLimitError, slTriggerError, slLimitError, ok };
}

/**
 * Build the JSON payload to include under `attached_tp_sl` on the
 * order-submit request body. Returns `undefined` when neither leg
 * is enabled OR when any enabled leg is invalid — both cases mean
 * the ticket MUST omit the field entirely.
 *
 * The OCO link is forced ON whenever both legs are enabled (V1
 * policy). The backend already enforces `link_as_oco => both
 * legs present`; the helper just guarantees consistency.
 */
export function buildAttachedTpSlPayload(
  state: AttachedTpSlInputState,
): AttachedTpSlRequest | undefined {
  if (!state.tpEnabled && !state.slEnabled) return undefined;
  const validation = validateAttachedTpSl(state);
  if (!validation.ok) return undefined;
  const out: AttachedTpSlRequest = {};
  if (state.tpEnabled) {
    const leg: AttachedLegRequest = {
      trigger_price_1e8: state.tpTrigger1e8.trim(),
      limit_price_1e8: state.tpLimit1e8.trim(),
    };
    out.take_profit = leg;
  }
  if (state.slEnabled) {
    const leg: AttachedLegRequest = {
      trigger_price_1e8: state.slTrigger1e8.trim(),
      limit_price_1e8: state.slLimit1e8.trim(),
    };
    out.stop_loss = leg;
  }
  if (state.tpEnabled && state.slEnabled) {
    out.link_as_oco = true;
  }
  return out;
}
