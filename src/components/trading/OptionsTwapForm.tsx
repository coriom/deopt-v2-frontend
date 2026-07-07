"use client";

// OPTIONS-TWAP-ORDERS-V1 — compact TWAP order form.
//
// Only mounts when `NEXT_PUBLIC_OPTIONS_TWAP_ENABLED=true`.
// Reuses `useWallet` + `buildAuthorization` for the write-auth
// signing flow (mirror of the RFQ create pattern). Never fabricates
// preview numbers: Max Cost is a real product of price × size;
// Margin Required / Buying Power / Est. Fees render as `—` because
// the backend does not expose a preview endpoint yet.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import {
  cancelOptionsTwapOrder,
  createOptionsTwapOrder,
  listOptionsTwapOrders,
  TradingApiError,
  type OptionTwapOrderResponse,
} from "@/lib/trading-api";
import { buildAuthorization, canonical, canonicalV2 } from "@/lib/write-auth";
import { useWallet } from "@/lib/wallet";
import { isOptionsTwapEnabled } from "@/lib/options-twap-flag";

interface OptionsTwapFormProps {
  /** Pre-fill for the option series id (from the selected chain row). */
  optionSeriesId: string;
}

type Phase =
  | { kind: "idle" }
  | { kind: "requesting_challenge" }
  | { kind: "awaiting_signature" }
  | { kind: "submitting" }
  | { kind: "success"; twapId: string }
  | { kind: "rejected"; message: string }
  | { kind: "error"; message: string };

const ONE_E8 = BigInt("100000000");

function decimalTo1e8(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const padded = (frac + "00000000").slice(0, 8);
  const big = BigInt(whole) * BigInt("100000000") + BigInt(padded || "0");
  return big < BigInt("0") ? null : big.toString();
}

function fmt1e8(v: string): string {
  try {
    const big = BigInt(v);
    const whole = big / ONE_E8;
    const frac = (big % ONE_E8).toString().padStart(8, "0").replace(/0+$/, "");
    return frac.length > 0 ? `${whole}.${frac}` : `${whole}`;
  } catch {
    return v;
  }
}

function humanDurationMs(ms: number): string {
  if (ms >= 3_600_000) {
    const hours = Math.floor(ms / 3_600_000);
    const mins = Math.round((ms - hours * 3_600_000) / 60_000);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  if (ms >= 60_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 1000)}s`;
}

export function OptionsTwapForm({ optionSeriesId }: OptionsTwapFormProps) {
  const enabled = isOptionsTwapEnabled();
  const wallet = useWallet();

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [priceInput, setPriceInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("10");
  const [childCount, setChildCount] = useState("10");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [twaps, setTwaps] = useState<OptionTwapOrderResponse[]>([]);

  const price1e8 = decimalTo1e8(priceInput);
  const size1e8 = decimalTo1e8(amountInput);
  const runningTimeMs = useMemo(() => {
    const h = Number(hours);
    const m = Number(minutes);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
    return Math.max(0, Math.floor(h * 3_600_000 + m * 60_000));
  }, [hours, minutes]);
  const childCountNum = useMemo(() => {
    const n = Number(childCount);
    return Number.isFinite(n) ? Math.floor(n) : 0;
  }, [childCount]);
  const intervalMs = useMemo(() => {
    if (childCountNum <= 0) return 0;
    return Math.floor(runningTimeMs / childCountNum);
  }, [runningTimeMs, childCountNum]);

  const maxCost1e8 = useMemo(() => {
    if (!price1e8 || !size1e8) return null;
    try {
      return (BigInt(price1e8) * BigInt(size1e8)) / ONE_E8;
    } catch {
      return null;
    }
  }, [price1e8, size1e8]);

  const blocker: string | null = (() => {
    if (!enabled) return "TWAP is not enabled in this environment.";
    if (!wallet.hasProvider) return "Connect a Base Sepolia wallet.";
    if (!wallet.address) return "Connect your wallet.";
    if (wallet.isMainnet) return "Mainnet is disabled — switch to Base Sepolia.";
    if (!wallet.isExpectedChain) return "Wrong network — switch to Base Sepolia.";
    if (!optionSeriesId) return "Select an option instrument first.";
    if (!price1e8 || BigInt(price1e8) <= BigInt("0")) return "Price must be > 0.";
    if (!size1e8 || BigInt(size1e8) <= BigInt("0")) return "Amount must be > 0.";
    if (runningTimeMs <= 0) return "Running time must be > 0.";
    if (childCountNum <= 0) return "Number of orders must be > 0.";
    if (childCountNum > 50) return "Number of orders exceeds max (50).";
    if (runningTimeMs > 24 * 60 * 60_000) return "Running time exceeds 24h max.";
    if (intervalMs < 10_000) return "Child interval must be ≥ 10s.";
    return null;
  })();

  const refresh = useCallback(async () => {
    if (!enabled || !wallet.address) {
      setTwaps([]);
      return;
    }
    try {
      const rows = await listOptionsTwapOrders({
        account: wallet.address,
        subaccountId: wallet.activeSubaccountId,
      });
      setTwaps(rows);
    } catch (e) {
      // best-effort; leave the list as-is so we don't wipe a good view.
      const msg = e instanceof TradingApiError ? e.message : (e as Error).message;
      // The list is auxiliary — surface via last-error span but don't
      // block the form.
      console.warn("TWAP list refresh failed:", msg);
    }
  }, [enabled, wallet.address, wallet.activeSubaccountId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = useCallback(async () => {
    if (blocker || !wallet.address || !price1e8 || !size1e8) return;
    try {
      const useV2 = wallet.activeSubaccountId > 1;
      const canonicalBytes = useV2
        ? canonicalV2.optionTwapCreate({
            account: wallet.address as Address,
            subaccountId: wallet.activeSubaccountId,
            optionSeriesId,
            side,
            size1e8,
            limitPrice1e8: price1e8,
            runningTimeMs,
            childCount: childCountNum,
            clientOrderId: null,
          })
        : canonical.optionTwapCreate({
            account: wallet.address as Address,
            optionSeriesId,
            side,
            size1e8,
            limitPrice1e8: price1e8,
            runningTimeMs,
            childCount: childCountNum,
            clientOrderId: null,
          });
      setPhase({ kind: "requesting_challenge" });
      const signTyped = async (args: Parameters<typeof wallet.signTypedData>[0]) => {
        setPhase({ kind: "awaiting_signature" });
        return wallet.signTypedData(args);
      };
      let authorization;
      try {
        authorization = await buildAuthorization({
          account: wallet.address as Address,
          action: "OPTION_TWAP_CREATE",
          canonical: canonicalBytes,
          signTypedData: signTyped,
          version: useV2 ? 2 : undefined,
        });
      } catch (e) {
        const msg = (e as Error).message ?? "signature failed";
        setPhase(
          /refused to sign|rejected/i.test(msg)
            ? { kind: "rejected", message: msg }
            : { kind: "error", message: msg },
        );
        return;
      }
      setPhase({ kind: "submitting" });
      const twap = await createOptionsTwapOrder({
        account: wallet.address,
        subaccount_id: wallet.activeSubaccountId,
        option_series_id: optionSeriesId,
        side,
        size_1e8: size1e8,
        limit_price_1e8: price1e8,
        running_time_ms: runningTimeMs,
        child_count: childCountNum,
        client_order_id: null,
        authorization,
      });
      setPhase({ kind: "success", twapId: twap.option_twap_id });
      await refresh();
    } catch (e) {
      setPhase({
        kind: "error",
        message:
          e instanceof TradingApiError
            ? e.message
            : (e as Error).message || "Create TWAP failed.",
      });
    }
  }, [
    blocker,
    wallet,
    price1e8,
    size1e8,
    optionSeriesId,
    side,
    runningTimeMs,
    childCountNum,
    refresh,
  ]);

  const onCancel = useCallback(
    async (twapId: string, rowSubaccountId: number | undefined) => {
      if (!wallet.address) return;
      try {
        const effectiveSubaccountId =
          rowSubaccountId ?? wallet.activeSubaccountId;
        const useV2 = effectiveSubaccountId > 1;
        const canonicalBytes = useV2
          ? canonicalV2.optionTwapCancel({
              account: wallet.address as Address,
              subaccountId: effectiveSubaccountId,
              optionTwapId: twapId,
            })
          : canonical.optionTwapCancel({
              account: wallet.address as Address,
              optionTwapId: twapId,
            });
        const authorization = await buildAuthorization({
          account: wallet.address as Address,
          action: "OPTION_TWAP_CANCEL",
          canonical: canonicalBytes,
          signTypedData: wallet.signTypedData,
          version: useV2 ? 2 : undefined,
        });
        await cancelOptionsTwapOrder(twapId, {
          authorization,
          subaccount_id: effectiveSubaccountId,
        });
        await refresh();
      } catch (e) {
        console.warn(
          "TWAP cancel failed:",
          e instanceof TradingApiError ? e.message : (e as Error).message,
        );
      }
    },
    [wallet, refresh],
  );

  if (!enabled) {
    return (
      <div
        data-testid="options-twap-form-disabled"
        className="rounded border border-zinc-800 bg-black/40 p-3 text-[11px] text-zinc-500"
      >
        TWAP is not enabled in this environment.
      </div>
    );
  }

  const priceLabel = side === "buy" ? "Max Price" : "Min Price";
  const submitLabel = (() => {
    if (phase.kind === "requesting_challenge") return "Requesting challenge…";
    if (phase.kind === "awaiting_signature") return "Awaiting signature…";
    if (phase.kind === "submitting") return "Submitting…";
    return "Create TWAP";
  })();
  const inFlight =
    phase.kind === "requesting_challenge" ||
    phase.kind === "awaiting_signature" ||
    phase.kind === "submitting";

  return (
    <div
      data-testid="options-twap-form"
      className="flex flex-col gap-2 rounded border border-zinc-800 bg-zinc-950 p-3 text-zinc-200"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          TWAP Order
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            data-testid="options-twap-side-buy"
            data-selected={side === "buy" ? "true" : "false"}
            onClick={() => setSide("buy")}
            className={
              side === "buy"
                ? "rounded border border-emerald-500/60 bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-black"
                : "rounded border border-zinc-800 bg-black/40 px-2 py-0.5 text-[10px] text-zinc-400"
            }
          >
            Buy
          </button>
          <button
            type="button"
            data-testid="options-twap-side-sell"
            data-selected={side === "sell" ? "true" : "false"}
            onClick={() => setSide("sell")}
            className={
              side === "sell"
                ? "rounded border border-red-500/60 bg-red-950/60 px-2 py-0.5 text-[10px] font-semibold text-red-100"
                : "rounded border border-zinc-800 bg-black/40 px-2 py-0.5 text-[10px] text-zinc-400"
            }
          >
            Sell
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          {priceLabel}
          <input
            type="text"
            inputMode="decimal"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            disabled={inFlight}
            data-testid="options-twap-price"
            placeholder="0.0"
            className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 text-right font-mono text-[11px] normal-case tracking-normal focus:border-emerald-500/60 focus:outline-none disabled:opacity-40"
          />
        </label>
        <label className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          Amount
          <input
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            disabled={inFlight}
            data-testid="options-twap-amount"
            placeholder="0.0"
            className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 text-right font-mono text-[11px] normal-case tracking-normal focus:border-emerald-500/60 focus:outline-none disabled:opacity-40"
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          Hours
          <input
            type="text"
            inputMode="numeric"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            disabled={inFlight}
            data-testid="options-twap-hours"
            className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 text-right font-mono text-[11px] normal-case tracking-normal focus:border-emerald-500/60 focus:outline-none disabled:opacity-40"
          />
        </label>
        <label className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          Minutes
          <input
            type="text"
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            disabled={inFlight}
            data-testid="options-twap-minutes"
            className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 text-right font-mono text-[11px] normal-case tracking-normal focus:border-emerald-500/60 focus:outline-none disabled:opacity-40"
          />
        </label>
        <label className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          No. Orders
          <input
            type="text"
            inputMode="numeric"
            value={childCount}
            onChange={(e) => setChildCount(e.target.value)}
            disabled={inFlight}
            data-testid="options-twap-child-count"
            className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 text-right font-mono text-[11px] normal-case tracking-normal focus:border-emerald-500/60 focus:outline-none disabled:opacity-40"
          />
        </label>
      </div>

      <dl
        data-testid="options-twap-preview"
        className="mt-1 grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-3 gap-y-1 rounded border border-zinc-900 bg-black/30 p-2 text-[10px] font-mono"
      >
        <dt className="text-zinc-500">Runtime</dt>
        <dd className="text-right text-zinc-200">
          {runningTimeMs > 0 ? humanDurationMs(runningTimeMs) : "—"}
        </dd>
        <dt className="text-zinc-500">No. of Orders</dt>
        <dd className="text-right text-zinc-200">
          {childCountNum > 0 ? childCountNum : "—"}
        </dd>
        <dt className="text-zinc-500">Frequency</dt>
        <dd data-testid="options-twap-frequency" className="text-right text-zinc-200">
          {intervalMs > 0 ? humanDurationMs(intervalMs) : "—"}
        </dd>
        <dt className="text-zinc-500">Max Cost</dt>
        <dd data-testid="options-twap-max-cost" className="text-right text-zinc-200">
          {maxCost1e8 !== null ? fmt1e8(maxCost1e8.toString()) : "—"}
        </dd>
        <dt className="text-zinc-500">Margin Required</dt>
        <dd className="text-right text-zinc-400">—</dd>
        <dt className="text-zinc-500">Buying Power</dt>
        <dd className="text-right text-zinc-400">—</dd>
        <dt className="text-zinc-500">Est. Fee</dt>
        <dd className="text-right text-zinc-400">—</dd>
        <dt className="text-zinc-500">Est. Rewards</dt>
        <dd className="text-right text-zinc-400">—</dd>
      </dl>

      <button
        type="button"
        data-testid="options-twap-submit"
        data-ticket-mode={blocker || inFlight ? "disabled" : "ready"}
        disabled={!!blocker || inFlight}
        onClick={submit}
        title={blocker ?? undefined}
        className={
          blocker || inFlight
            ? "cursor-not-allowed rounded bg-zinc-800 px-3 py-2 text-[12px] font-semibold text-zinc-500"
            : "rounded bg-emerald-500 px-3 py-2 text-[12px] font-semibold text-black hover:bg-emerald-400"
        }
      >
        {submitLabel}
      </button>

      {phase.kind === "success" && (
        <p
          data-testid="options-twap-submit-success"
          className="rounded border border-emerald-500/40 bg-emerald-500/5 px-2 py-1 text-[10px] text-emerald-300"
        >
          TWAP created: <span className="font-mono">{phase.twapId}</span>
        </p>
      )}
      {(phase.kind === "error" || phase.kind === "rejected") && (
        <p
          data-testid="options-twap-submit-error"
          className="rounded border border-red-500/40 bg-red-500/5 px-2 py-1 text-[10px] text-red-300"
        >
          {phase.message}
        </p>
      )}
      {blocker && (
        <p
          data-testid="options-twap-blocker"
          className="text-[10px] text-amber-400"
        >
          {blocker}
        </p>
      )}

      {twaps.length > 0 && (
        <div
          data-testid="options-twap-list"
          className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto rounded border border-zinc-900 p-2"
        >
          <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            Your TWAP orders
          </span>
          <ul className="flex flex-col gap-1">
            {twaps.map((t) => (
              <li
                key={t.option_twap_id}
                data-testid={`options-twap-row-${t.option_twap_id}`}
                className="flex items-center justify-between rounded border border-transparent px-1 py-0.5 text-[10px] font-mono hover:border-zinc-800"
              >
                <span className="text-zinc-400">
                  {t.option_twap_id.slice(0, 8)}
                </span>
                <span className="text-zinc-300">
                  {t.side} · {fmt1e8(t.size_1e8)} · {t.created_child_count}/
                  {t.child_count}
                </span>
                <span
                  className={
                    t.status === "running" || t.status === "pending"
                      ? "text-emerald-300"
                      : t.status === "cancelled" || t.status === "failed"
                        ? "text-red-300"
                        : "text-zinc-400"
                  }
                >
                  {t.status}
                </span>
                {(t.status === "pending" || t.status === "running") && (
                  <button
                    type="button"
                    data-testid={`options-twap-cancel-${t.option_twap_id}`}
                    onClick={() => onCancel(t.option_twap_id, t.subaccount_id)}
                    className="rounded border border-zinc-700 px-1 text-[9px] text-zinc-300 hover:border-red-500/60 hover:text-red-300"
                  >
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
