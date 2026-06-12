"use client";

import { useState } from "react";
import {
  createExecutionIntent,
  TradingApiError,
  type CreateExecutionIntentRequest,
  type CreateExecutionIntentResult,
} from "@/lib/trading-api";

export interface CreateIntentButtonProps {
  /** Tightly-typed quote inputs from the surrounding TradeTicket. */
  request: CreateExecutionIntentRequest;
  /** Disabled when the wallet is disconnected / on the wrong network. */
  disabled?: boolean;
  /** Called with the backend-issued intent_id on success. */
  onIntentCreated: (intentId: string) => void;
  /**
   * Called when the backend create-intent endpoint is pending (404 /
   * 405 / 501). The TradeTicket renders the legacy "paste intent_id"
   * fallback path in this case.
   */
  onBackendPending: (message: string) => void;
  /** Called for non-pending validation/transport errors. */
  onCreateError: (err: TradingApiError) => void;
}

/**
 * M-P3c — Single-purpose button that mints an execution intent from
 * the trade ticket inputs.
 *
 * **Posture:** **No admin Bearer.** **No silent signing.** **No
 * broadcast.** The button only mints an intent on the backend — the
 * user must explicitly click "Sign" afterwards (separate button in
 * the TradeTicket flow). The button is hard-gated by `disabled` (which
 * the parent sets when the wallet is disconnected, on the wrong
 * network, or on mainnet).
 *
 * **Fallback:** when the backend create-intent endpoint is not yet
 * wired (current behaviour as of M-P2e), `createExecutionIntent`
 * resolves with `status: "pending"` and this button calls
 * `onBackendPending` so the parent renders an amber notice + the
 * legacy intent_id paste path.
 */
export function CreateIntentButton({
  request,
  disabled,
  onIntentCreated,
  onBackendPending,
  onCreateError,
}: CreateIntentButtonProps) {
  const [pending, setPending] = useState(false);
  const onClick = async () => {
    if (pending || disabled) return;
    setPending(true);
    let result: CreateExecutionIntentResult;
    try {
      result = await createExecutionIntent(request);
    } catch (e) {
      setPending(false);
      onCreateError(e as TradingApiError);
      return;
    }
    setPending(false);
    if (result.status === "ok") {
      onIntentCreated(result.data.intent_id);
    } else {
      onBackendPending(result.message);
    }
  };

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() => void onClick()}
      className="rounded border border-emerald-600 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
      data-testid="create-intent-button"
      aria-label="Create intent"
    >
      {pending ? "Creating intent…" : "Create intent"}
    </button>
  );
}
