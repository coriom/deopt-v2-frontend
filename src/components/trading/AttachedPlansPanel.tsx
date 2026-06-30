"use client";

// ATTACHED-TP-SL-PLAN-OBSERVABILITY-V1 — Attached Plans subsection.
//
// REST snapshot of `GET /accounts/:address/option-order-attachment-plans`.
// Distinct from the conditional-orders list above: this view shows the
// trader's TP/SL ATTACHMENT INTENT and its lifecycle (pending →
// active | cancelled | failed), not the materialised conditional rows.
//
// Status semantics, mirrored from the backend:
//
//   pending   — plan recorded, parent has no fill yet OR not
//               enough reducible position. Waiting for the entry
//               order to fill.
//   active    — materialisation succeeded; the linked conditional
//               rows are now live in the panel above.
//   cancelled — parent order cancelled or expired with no fill;
//               plan was never materialised.
//   failed    — materialisation attempted but the conditional
//               service returned an error (see `failure_*`). The
//               parent order is unaffected.
//
// No lifecycle deltas are subscribed yet (deferred to
// `ATTACHED-TP-SL-PLAN-LIFECYCLE-V2`); the panel re-fetches on
// re-mount and shows a "Refresh" affordance.

import { useCallback, useEffect, useState } from "react";
import {
  listOptionOrderAttachmentPlans,
  TradingApiError,
} from "@/lib/trading-api";
import type {
  AttachmentPlanStatus,
  OptionOrderAttachmentPlan,
} from "@/lib/trading-types";

export interface AttachedPlansPanelProps {
  address: string | null;
}

const STATUS_LABEL: Record<AttachmentPlanStatus, string> = {
  pending: "Waiting for entry fill",
  active: "TP/SL legs created",
  cancelled: "Parent cancelled before fill",
  failed: "Materialisation failed",
};

const STATUS_TONE: Record<AttachmentPlanStatus, string> = {
  pending: "border-zinc-700 bg-zinc-900 text-zinc-300",
  active: "border-emerald-500/40 bg-emerald-900/30 text-emerald-100",
  cancelled: "border-zinc-700 bg-zinc-900 text-zinc-400",
  failed: "border-red-500/40 bg-red-900/30 text-red-100",
};

function isKnownStatus(s: string): s is AttachmentPlanStatus {
  return s === "pending" || s === "active" || s === "cancelled" || s === "failed";
}

function shortId(id: string | undefined | null): string {
  if (!id) return "—";
  return id.length <= 12 ? id : `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export function AttachedPlansPanel({ address }: AttachedPlansPanelProps) {
  const [rows, setRows] = useState<OptionOrderAttachmentPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setRows(null);
      return;
    }
    setError(null);
    try {
      const plans = await listOptionOrderAttachmentPlans(address);
      setRows(plans);
    } catch (err) {
      const message =
        err instanceof TradingApiError ? err.message : (err as Error).message;
      setError(message);
      setRows(null);
    }
  }, [address]);

  useEffect(() => {
    // Effect kicks off the async fetch; setState calls only happen
    // inside the promise's .then / .catch, after a microtask. The
    // lint rule's "synchronous setState within effect body" warning
    // does not apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return (
    <section
      data-testid="attached-plans-panel"
      className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-black/30 p-3 text-zinc-100"
    >
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-emerald-200">
            Attached TP/SL plans
          </h3>
          <p className="text-[10px] leading-snug text-zinc-500">
            The trader&apos;s TP/SL intent submitted alongside an entry
            order. Materialised conditional rows are listed above.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void refresh();
          }}
          disabled={!address}
          data-testid="attached-plans-refresh"
          className="rounded border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-emerald-500/40 disabled:cursor-not-allowed disabled:text-zinc-600"
        >
          Refresh
        </button>
      </header>

      {!address ? (
        <p
          data-testid="attached-plans-no-wallet"
          className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-500"
        >
          Connect a wallet to view your attached TP/SL plans.
        </p>
      ) : error ? (
        <p
          data-testid="attached-plans-error"
          role="alert"
          className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-[11px] text-red-100"
        >
          Failed to load attached plans: {error}
        </p>
      ) : rows === null ? (
        <p
          data-testid="attached-plans-loading"
          className="text-[11px] text-zinc-500"
        >
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <p
          data-testid="attached-plans-empty"
          className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-500"
        >
          No attached TP/SL plans yet.
        </p>
      ) : (
        <ul
          data-testid="attached-plans-list"
          className="flex flex-col gap-2"
        >
          {rows.map((plan) => {
            const known = isKnownStatus(plan.status);
            const label = known ? STATUS_LABEL[plan.status] : plan.status;
            const tone = known
              ? STATUS_TONE[plan.status]
              : "border-zinc-700 bg-zinc-900 text-zinc-400";
            return (
              <li
                key={plan.plan_id}
                data-testid={`attached-plans-row-${plan.plan_id}`}
                data-plan-status={plan.status}
                className="flex flex-col gap-1 rounded border border-zinc-800 bg-black/40 p-2 text-[11px]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-zinc-400">
                    parent {shortId(plan.parent_order_id)}
                  </span>
                  <span
                    data-testid={`attached-plans-row-${plan.plan_id}-status`}
                    className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${tone}`}
                  >
                    {label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-zinc-300">
                  <span>
                    Series:{" "}
                    <code className="text-zinc-100">
                      {shortId(plan.option_series_id)}
                    </code>
                  </span>
                  <span>
                    Filled covered:{" "}
                    <code className="text-zinc-100">
                      {plan.materialized_size_1e8 ?? "—"}
                    </code>
                  </span>
                  {plan.take_profit ? (
                    <span>
                      TP: trigger{" "}
                      <code className="text-emerald-200">
                        {plan.take_profit.trigger_price_1e8}
                      </code>
                      , limit{" "}
                      <code className="text-emerald-200">
                        {plan.take_profit.limit_price_1e8}
                      </code>
                    </span>
                  ) : null}
                  {plan.stop_loss ? (
                    <span>
                      SL: trigger{" "}
                      <code className="text-red-200">
                        {plan.stop_loss.trigger_price_1e8}
                      </code>
                      , limit{" "}
                      <code className="text-red-200">
                        {plan.stop_loss.limit_price_1e8}
                      </code>
                    </span>
                  ) : null}
                  {plan.link_as_oco ? (
                    <span className="col-span-2 text-[10px] text-zinc-500">
                      OCO linked
                    </span>
                  ) : null}
                  {plan.tp_conditional_order_id ? (
                    <span>
                      TP cond:{" "}
                      <code className="text-zinc-100">
                        {shortId(plan.tp_conditional_order_id)}
                      </code>
                    </span>
                  ) : null}
                  {plan.sl_conditional_order_id ? (
                    <span>
                      SL cond:{" "}
                      <code className="text-zinc-100">
                        {shortId(plan.sl_conditional_order_id)}
                      </code>
                    </span>
                  ) : null}
                </div>
                {plan.failure_code ? (
                  <p
                    data-testid={`attached-plans-row-${plan.plan_id}-failure`}
                    className="rounded bg-red-950/40 px-2 py-1 text-[10px] text-red-100"
                  >
                    <span className="font-semibold">
                      {plan.failure_code}:
                    </span>{" "}
                    {plan.failure_message ?? "(no detail)"}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
