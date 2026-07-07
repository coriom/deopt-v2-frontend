"use client";

// OPTIONS-CONDITIONAL-ORDERS-TP-SL-V1 — frontend manager.
//
// Minimal Take Profit / Stop Loss UI bound to an existing option
// position. Wire-up: the parent passes a `seriesId` (typically the
// row selected in the chain) + the connected wallet address. Without
// a wallet or a series the component renders an honest disabled
// state.
//
// What this component does:
//   * lets the operator arm a TP, an SL, or a TP+SL OCO pair against
//     the selected series via `POST /accounts/{address}/conditional-orders`
//   * lists active conditional orders for the wallet and offers
//     per-row cancellation
//   * surfaces the stable backend error messages on rejection
//
// What this component does NOT do:
//   * evaluate triggers in the browser — the server-side worker does
//   * apply to perps (perps have no orderbook engine yet)
//   * apply to the paired RFQ execution-intent flow

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cancelConditionalOrder,
  createConditionalOrders,
  listConditionalOrders,
  TradingApiError,
} from "@/lib/trading-api";
import type {
  ConditionalOrderResponse,
  CreateConditionalOrderRequest,
} from "@/lib/trading-types";
import { useWallet } from "@/lib/wallet";
import {
  buildAuthorization,
  canonical,
  canonicalV2,
} from "@/lib/write-auth";

export interface TpSlManagerProps {
  /** Connected wallet address. `null` ⇒ disabled state. */
  address: string | null;
  /** Selected series id (e.g. from the chain). `null` ⇒ disabled. */
  seriesId: string | null;
}

export function TpSlManager({ address, seriesId }: TpSlManagerProps) {
  const { signTypedData, activeSubaccountId } = useWallet();
  const [includeTp, setIncludeTp] = useState(true);
  const [includeSl, setIncludeSl] = useState(false);
  const [linkAsOco, setLinkAsOco] = useState(false);
  const [quantity1e8, setQuantity1e8] = useState("100000000");
  const [tpTrigger1e8, setTpTrigger1e8] = useState("");
  const [tpLimit1e8, setTpLimit1e8] = useState("");
  const [slTrigger1e8, setSlTrigger1e8] = useState("");
  const [slLimit1e8, setSlLimit1e8] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [okBanner, setOkBanner] = useState<string | null>(null);

  const [orders, setOrders] = useState<ConditionalOrderResponse[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const disabled =
    !address || !seriesId || submitting || (!includeTp && !includeSl);
  const ocoEffective = linkAsOco && includeTp && includeSl;

  const refresh = useCallback(async () => {
    if (!address) return;
    setListLoading(true);
    setListError(null);
    try {
      const all = await listConditionalOrders(address);
      // Show only the rows relevant to the connected wallet, the
      // active subaccount, and (when a series is selected) the
      // current series. Filter subaccount client-side because the
      // list route is not yet subaccount-scoped on the backend.
      const filtered = all.filter((o) => {
        if (
          o.subaccount_id !== undefined &&
          o.subaccount_id !== activeSubaccountId
        ) {
          return false;
        }
        if (seriesId && o.option_series_id !== seriesId) return false;
        return true;
      });
      setOrders(filtered);
    } catch (err) {
      const message =
        err instanceof TradingApiError ? err.message : (err as Error).message;
      setListError(message);
    } finally {
      setListLoading(false);
    }
  }, [address, seriesId, activeSubaccountId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || !address || !seriesId) return;
    setSubmitting(true);
    setErrorMessage(null);
    setOkBanner(null);
    const legs: CreateConditionalOrderRequest["legs"] = [];
    if (includeTp) {
      legs.push({
        conditional_type: "take_profit",
        trigger_price_1e8: tpTrigger1e8,
        limit_price_1e8: tpLimit1e8,
      });
    }
    if (includeSl) {
      legs.push({
        conditional_type: "stop_loss",
        trigger_price_1e8: slTrigger1e8,
        limit_price_1e8: slLimit1e8,
      });
    }
    try {
      const useV2 = activeSubaccountId > 1;
      const legsForCanonical = legs.map((leg) => ({
        conditionalType: leg.conditional_type,
        triggerPrice1e8: leg.trigger_price_1e8,
        limitPrice1e8: leg.limit_price_1e8,
        triggerCondition: leg.trigger_condition ?? null,
      }));
      const canonicalBytes = useV2
        ? canonicalV2.conditionalOrderCreate({
            account: address as `0x${string}`,
            subaccountId: activeSubaccountId,
            optionSeriesId: seriesId,
            quantity1e8: quantity1e8,
            linkAsOco: ocoEffective,
            legs: legsForCanonical,
          })
        : canonical.conditionalOrderCreate({
            account: address as `0x${string}`,
            optionSeriesId: seriesId,
            quantity1e8: quantity1e8,
            linkAsOco: ocoEffective,
            legs: legsForCanonical,
          });
      const authorization = await buildAuthorization({
        account: address as `0x${string}`,
        action: "CONDITIONAL_ORDER_CREATE",
        canonical: canonicalBytes,
        signTypedData,
        version: useV2 ? 2 : undefined,
      });
      const created = await createConditionalOrders(address, {
        option_series_id: seriesId,
        quantity_1e8: quantity1e8,
        legs,
        link_as_oco: ocoEffective,
        authorization,
        subaccount_id: activeSubaccountId,
      });
      setOkBanner(
        ocoEffective
          ? `Armed OCO pair (group ${created[0]?.oco_group_id?.slice(0, 8) ?? "?"}…)`
          : `Armed ${created.length} conditional order${created.length === 1 ? "" : "s"}.`,
      );
      await refresh();
    } catch (err) {
      const message =
        err instanceof TradingApiError ? err.message : (err as Error).message;
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string, rowSubaccountId: number | undefined) => {
    if (!address) return;
    try {
      const effectiveSubaccountId = rowSubaccountId ?? activeSubaccountId;
      const useV2 = effectiveSubaccountId > 1;
      const canonicalBytes = useV2
        ? canonicalV2.conditionalOrderCancel({
            account: address as `0x${string}`,
            subaccountId: effectiveSubaccountId,
            conditionalOrderId: id,
          })
        : canonical.conditionalOrderCancel({
            account: address as `0x${string}`,
            conditionalOrderId: id,
          });
      const authorization = await buildAuthorization({
        account: address as `0x${string}`,
        action: "CONDITIONAL_ORDER_CANCEL",
        canonical: canonicalBytes,
        signTypedData,
        version: useV2 ? 2 : undefined,
      });
      await cancelConditionalOrder(address, id, {
        authorization,
        subaccount_id: effectiveSubaccountId,
      });
      await refresh();
    } catch (err) {
      const message =
        err instanceof TradingApiError ? err.message : (err as Error).message;
      setListError(message);
    }
  };

  const triggerDirectionHint = useMemo(
    () =>
      "Triggers use the underlying oracle price. Execution uses a price-protected IOC order and may fill partially or not fill.",
    [],
  );

  return (
    <section
      data-testid="tp-sl-manager"
      data-tp-sl-disabled={disabled ? "true" : "false"}
      className="flex flex-col gap-3 border-t border-zinc-800 pt-3"
    >
      <header className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-emerald-200">TP / SL</h3>
        <p
          data-testid="tp-sl-safety"
          className="text-[10px] leading-snug text-zinc-400"
        >
          {triggerDirectionHint}
        </p>
      </header>

      {!address ? (
        <p
          data-testid="tp-sl-disabled-reason"
          className="rounded border border-zinc-800 bg-black/40 px-2 py-1 text-[11px] text-zinc-400"
        >
          Connect your wallet to manage TP / SL.
        </p>
      ) : !seriesId ? (
        <p
          data-testid="tp-sl-disabled-reason"
          className="rounded border border-zinc-800 bg-black/40 px-2 py-1 text-[11px] text-zinc-400"
        >
          Pick a series from the chain to arm a conditional order.
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2"
        data-testid="tp-sl-form"
      >
        <label className="flex items-center gap-2 text-[11px] text-zinc-300">
          <input
            type="checkbox"
            checked={includeTp}
            onChange={(e) => setIncludeTp(e.target.checked)}
            data-testid="tp-sl-include-tp"
            className="h-3 w-3 accent-emerald-500"
          />
          Take Profit
        </label>
        {includeTp ? (
          <div className="grid grid-cols-2 gap-2 pl-5">
            <label className="text-[10px] text-zinc-400">
              Trigger (1e8)
              <input
                type="text"
                inputMode="numeric"
                value={tpTrigger1e8}
                onChange={(e) => setTpTrigger1e8(e.target.value)}
                data-testid="tp-sl-tp-trigger"
                className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-[11px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
              />
            </label>
            <label className="text-[10px] text-zinc-400">
              IOC limit (1e8)
              <input
                type="text"
                inputMode="numeric"
                value={tpLimit1e8}
                onChange={(e) => setTpLimit1e8(e.target.value)}
                data-testid="tp-sl-tp-limit"
                className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-[11px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
              />
            </label>
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-[11px] text-zinc-300">
          <input
            type="checkbox"
            checked={includeSl}
            onChange={(e) => setIncludeSl(e.target.checked)}
            data-testid="tp-sl-include-sl"
            className="h-3 w-3 accent-emerald-500"
          />
          Stop Loss
        </label>
        {includeSl ? (
          <div className="grid grid-cols-2 gap-2 pl-5">
            <label className="text-[10px] text-zinc-400">
              Trigger (1e8)
              <input
                type="text"
                inputMode="numeric"
                value={slTrigger1e8}
                onChange={(e) => setSlTrigger1e8(e.target.value)}
                data-testid="tp-sl-sl-trigger"
                className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-[11px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
              />
            </label>
            <label className="text-[10px] text-zinc-400">
              IOC limit (1e8)
              <input
                type="text"
                inputMode="numeric"
                value={slLimit1e8}
                onChange={(e) => setSlLimit1e8(e.target.value)}
                data-testid="tp-sl-sl-limit"
                className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-[11px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
              />
            </label>
          </div>
        ) : null}

        <label className="text-[10px] text-zinc-400">
          Close quantity (1e8)
          <input
            type="text"
            inputMode="numeric"
            value={quantity1e8}
            onChange={(e) => setQuantity1e8(e.target.value)}
            data-testid="tp-sl-quantity"
            className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-[11px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          />
        </label>

        <label className="flex items-center gap-2 text-[11px] text-zinc-300">
          <input
            type="checkbox"
            checked={linkAsOco}
            disabled={!(includeTp && includeSl)}
            onChange={(e) => setLinkAsOco(e.target.checked)}
            data-testid="tp-sl-link-oco"
            className="h-3 w-3 accent-emerald-500 disabled:cursor-not-allowed"
          />
          Link as OCO (one triggers, the other auto-cancels)
        </label>

        <p
          data-testid="tp-sl-reduce-only-note"
          className="text-[10px] text-zinc-500"
        >
          Reduce-only: the child order can never increase or reverse
          the position. Direction is derived server-side from
          option_kind × position_side × leg.
        </p>

        <button
          type="submit"
          disabled={disabled}
          data-testid="tp-sl-submit"
          className="rounded bg-emerald-500 px-3 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {submitting ? "Arming…" : "Create TP / SL"}
        </button>

        {errorMessage ? (
          <p
            data-testid="tp-sl-error"
            role="alert"
            className="rounded border border-red-500/40 bg-red-950/40 px-2 py-1 text-[11px] text-red-100"
          >
            {errorMessage}
          </p>
        ) : null}
        {okBanner ? (
          <p
            data-testid="tp-sl-ok"
            className="rounded border border-emerald-500/40 bg-emerald-950/30 px-2 py-1 text-[11px] text-emerald-100"
          >
            {okBanner}
          </p>
        ) : null}
      </form>

      <div className="flex flex-col gap-1 border-t border-zinc-900 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            Active conditional orders
          </h4>
          <button
            type="button"
            onClick={() => void refresh()}
            data-testid="tp-sl-refresh"
            className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-200"
          >
            {listLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {listError ? (
          <p
            data-testid="tp-sl-list-error"
            className="text-[10px] text-red-300"
          >
            {listError}
          </p>
        ) : null}
        {orders.length === 0 ? (
          <p
            data-testid="tp-sl-empty"
            className="text-[10px] text-zinc-500"
          >
            No conditional orders for this account/series.
          </p>
        ) : (
          <table
            data-testid="tp-sl-table"
            className="w-full font-mono text-[10px] text-zinc-300"
          >
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="font-normal">Type</th>
                <th className="font-normal">Trig</th>
                <th className="font-normal">Qty</th>
                <th className="font-normal">Limit</th>
                <th className="font-normal">Status</th>
                <th className="font-normal">OCO</th>
                <th className="font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  data-testid={`tp-sl-row-${o.id}`}
                  data-status={o.status}
                  className="border-t border-zinc-900"
                >
                  <td>{o.conditional_type === "take_profit" ? "TP" : "SL"}</td>
                  <td>
                    {o.trigger_condition === "gte" ? "≥" : "≤"}{" "}
                    {o.trigger_price_1e8}
                  </td>
                  <td>{o.quantity_1e8}</td>
                  <td>{o.limit_price_1e8}</td>
                  <td data-testid={`tp-sl-status-${o.id}`}>{o.status}</td>
                  <td>{o.oco_group_id ? "yes" : "—"}</td>
                  <td>
                    {o.status === "armed" ? (
                      <button
                        type="button"
                        data-testid={`tp-sl-cancel-${o.id}`}
                        onClick={() =>
                          void handleCancel(o.id, o.subaccount_id)
                        }
                        className="rounded border border-transparent px-1 text-zinc-500 hover:border-red-500/40 hover:text-red-200"
                      >
                        cancel
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
