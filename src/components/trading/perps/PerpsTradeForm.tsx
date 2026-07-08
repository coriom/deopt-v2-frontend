"use client";

// FRONTEND-PERPS-POLISH-V1 — perps trade form widget.
//
// Visually interactive (tabs, inputs, slider) so the operator can
// preview the UX. Submit posture depends on the strict opt-in flag:
//
//   * `NEXT_PUBLIC_PERPS_TICKET_ENABLED != "true"` (default) — submit
//     is hard-disabled with a "Perps not live" copy. This matches the
//     backend's default `PerpsNotLive` posture on POST /perps/orders.
//   * `NEXT_PUBLIC_PERPS_TICKET_ENABLED = "true"` — submit becomes
//     interactive and calls `submitPerpsOrder(...)` from the API
//     client. The backend still returns 503 unless
//     `PERPS_PUBLIC_TRADING_ENABLED=true` AND a PG repository is
//     wired; the frontend surfaces those errors honestly. Also
//     requires a connected wallet on the expected chain (Base Sepolia
//     84532).
//
// (PERPS-FRONTEND-TICKET-ENABLEMENT-V1)

import { useState } from "react";
import { usePerpsSymbol } from "@/lib/perps-symbol";
import { TifPopover, PostCheckbox, type Tif } from "../TifPopover";
import { isPerpsTicketEnabled } from "@/lib/perps-flag";
import { isPerpsClosedTestEnabled } from "@/lib/perps-closed-test-flag";
import {
  submitPerpsOrder,
  TradingApiError,
  type SubmitPerpsOrderRequest,
} from "@/lib/trading-api";
import { useWallet } from "@/lib/wallet";
import { buildAuthorization, canonicalV2 } from "@/lib/write-auth";

type Side = "long" | "short";
type Mode = "market" | "limit";

export function PerpsTradeFormWidget() {
  const { market } = usePerpsSymbol();
  const wallet = useWallet();
  const ticketEnabled = isPerpsTicketEnabled();
  // PERPS-SUBACCOUNTS-FRONTEND-ROUTING-V1 — informational-only flag
  // used to render honest closed-test copy. Never treated as a gate;
  // even when true the backend's allowlist is authoritative.
  const closedTestCopyVisible = isPerpsClosedTestEnabled();
  const [side, setSide] = useState<Side>("long");
  const [mode, setMode] = useState<Mode>("market");
  const [qty, setQty] = useState<string>("");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const [leverage, setLeverage] = useState<number>(1);
  const [slippagePct, setSlippagePct] = useState<string>("0.5");
  const [tif, setTif] = useState<Tif>("GTC");
  const [postOnly, setPostOnly] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastAcceptedOrderId, setLastAcceptedOrderId] = useState<string | null>(null);

  const walletConnected =
    wallet.address !== null && wallet.isExpectedChain;
  const walletBlocker = !ticketEnabled
    ? null
    : wallet.address === null
      ? "Connect wallet to submit."
      : !wallet.isExpectedChain
        ? "Switch to Base Sepolia to submit."
        : null;

  async function handleSubmit() {
    if (!ticketEnabled || !walletConnected) return;
    setSubmitError(null);
    setLastAcceptedOrderId(null);
    // Very small pre-flight validation matching the backend's
    // `parse_u128_field` gate.
    const size = qty.trim();
    if (size.length === 0 || !/^\d+$/.test(size)) {
      setSubmitError("Size must be a positive integer in 1e8 units.");
      return;
    }
    if (mode === "limit") {
      const price = limitPrice.trim();
      if (price.length === 0 || !/^\d+$/.test(price)) {
        setSubmitError("Limit price must be a positive integer in 1e8 units.");
        return;
      }
    }
    const marketId = market.symbol; // e.g. "ETH-PERP"
    const priceStr =
      mode === "limit" ? limitPrice.trim() : "0"; // V1: market orders send `0` and let the router reject
    const account = wallet.address!;
    const subaccountId = wallet.activeSubaccountId;
    const sideStr: "buy" | "sell" = side === "long" ? "buy" : "sell";
    const tifStr = tif.toLowerCase() as "gtc" | "ioc" | "fok";
    const isolatedMargin1e8 = computeIsolatedMargin1e8(size, priceStr, leverage);
    const clientOrderId = `ticket-${Date.now()}`;
    setSubmitting(true);
    try {
      // PERPS-V2-WRITE-AUTH-ENFORCEMENT-V1 — build v2 canonical bytes,
      // sign, and thread the envelope into the submit body. The backend
      // rebuilds these bytes from the body fields and rejects any
      // divergence at the challenge verifier. Perps mutations require
      // v2 by policy — there is no v1 fallback.
      const canonicalBytes = canonicalV2.perpOrderSubmit({
        account,
        subaccountId,
        marketId,
        side: sideStr,
        price1e8: priceStr,
        size1e8: size,
        timeInForce: tifStr,
        postOnly,
        reduceOnly: false,
        isolatedMargin1e8,
        clientOrderId,
      });
      const authorization = await buildAuthorization({
        account,
        action: "PERP_ORDER_SUBMIT",
        canonical: canonicalBytes,
        signTypedData: wallet.signTypedData,
        version: 2,
      });
      const req: SubmitPerpsOrderRequest = {
        market_id: marketId,
        account,
        subaccount_id: subaccountId,
        side: sideStr,
        price_1e8: priceStr,
        size_1e8: size,
        time_in_force: tifStr,
        post_only: postOnly,
        reduce_only: false,
        isolated_margin_1e8: isolatedMargin1e8,
        client_order_id: clientOrderId,
        authorization,
      };
      const response = await submitPerpsOrder(req);
      setLastAcceptedOrderId(response.order.order_id);
    } catch (err) {
      const message =
        err instanceof TradingApiError ? err.message : (err as Error).message;
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="widget-perps-trade-form-body"
      className="flex h-full min-h-0 flex-col gap-2 px-3 py-2"
    >
      <span
        className="text-[11px] font-mono text-zinc-400"
        style={{ fontFamily: "var(--app-font-mono)" }}
      >
        {market.symbol}
      </span>

      {/* Long / Short */}
      <div
        role="tablist"
        aria-label="Side"
        data-testid="widget-perps-trade-side"
        className="grid grid-cols-2 gap-1"
      >
        <SideTab
          active={side === "long"}
          tone="long"
          onClick={() => setSide("long")}
          testid="widget-perps-trade-side-long"
        >
          Long
        </SideTab>
        <SideTab
          active={side === "short"}
          tone="short"
          onClick={() => setSide("short")}
          testid="widget-perps-trade-side-short"
        >
          Short
        </SideTab>
      </div>

      {/* Market / Limit */}
      <div
        role="tablist"
        aria-label="Order mode"
        data-testid="widget-perps-trade-mode"
        className="flex gap-1 text-[11px]"
      >
        {(["market", "limit"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            data-testid={`widget-perps-trade-mode-${m}`}
            className={
              mode === m
                ? "rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-200"
                : "rounded border border-zinc-800 bg-black/40 px-2 py-1 text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
            }
          >
            {m === "market" ? "Market" : "Limit"}
          </button>
        ))}
      </div>

      {/* Size */}
      <Field label="Size (USD)">
        <input
          type="text"
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="0.00"
          data-testid="widget-perps-trade-qty"
          className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 font-mono text-[12px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          style={{ fontFamily: "var(--app-font-mono)" }}
        />
      </Field>

      {/* Limit price (only in limit mode) */}
      {mode === "limit" ? (
        <Field label="Limit price">
          <input
            type="text"
            inputMode="decimal"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            placeholder="0.00"
            data-testid="widget-perps-trade-limit-price"
            className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 font-mono text-[12px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
            style={{ fontFamily: "var(--app-font-mono)" }}
          />
        </Field>
      ) : (
        <Field label="Slippage tolerance">
          <input
            type="text"
            inputMode="decimal"
            value={slippagePct}
            onChange={(e) => setSlippagePct(e.target.value)}
            placeholder="0.5"
            data-testid="widget-perps-trade-slippage"
            className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 font-mono text-[12px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
            style={{ fontFamily: "var(--app-font-mono)" }}
          />
        </Field>
      )}

      {/* Leverage slider */}
      <Field label={`Leverage ${leverage}×`}>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          data-testid="widget-perps-trade-leverage"
          className="w-full accent-emerald-500"
        />
      </Field>

      {/* Post-only + Time-In-Force */}
      <div
        data-testid="widget-perps-trade-tif-row"
        className="flex items-center justify-between gap-2"
      >
        <PostCheckbox
          checked={postOnly}
          onChange={setPostOnly}
          testid="widget-perps-trade-post"
        />
        <TifPopover
          value={tif}
          onChange={setTif}
          testid="widget-perps-trade-tif"
        />
      </div>

      {/* Summary */}
      <div
        data-testid="widget-perps-trade-summary"
        className="grid grid-cols-3 gap-px overflow-hidden rounded border border-zinc-800 bg-zinc-900 text-[11px]"
      >
        {[
          { label: "Liq", testid: "summary-liq" },
          { label: "Funding", testid: "summary-funding" },
          { label: "Fee", testid: "summary-fee" },
        ].map((s) => (
          <div
            key={s.testid}
            data-testid={`widget-perps-trade-${s.testid}`}
            className="flex flex-col gap-0.5 bg-zinc-950 px-2 py-1"
          >
            <span className="text-[9px] uppercase tracking-[0.12em] text-zinc-500">
              {s.label}
            </span>
            <span
              className="font-mono text-[11px] text-zinc-300"
              style={{ fontFamily: "var(--app-font-mono)" }}
            >
              —
            </span>
          </div>
        ))}
      </div>

      {ticketEnabled ? (
        <button
          type="button"
          disabled={!walletConnected || submitting}
          aria-disabled={!walletConnected || submitting}
          data-testid="widget-perps-trade-submit"
          data-ticket-mode="enabled"
          title={
            walletBlocker ??
            (submitting ? "Submitting…" : "Submit Perps order")
          }
          onClick={() => void handleSubmit()}
          className={
            walletConnected && !submitting
              ? "rounded border border-emerald-500/60 bg-emerald-600/80 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-black hover:bg-emerald-500"
              : "cursor-not-allowed rounded border border-zinc-700 bg-zinc-900/60 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-zinc-500"
          }
        >
          {submitting
            ? "Submitting…"
            : side === "long"
              ? "Open long"
              : "Open short"}
        </button>
      ) : (
        <button
          type="button"
          disabled
          aria-disabled="true"
          data-testid="widget-perps-trade-submit"
          data-ticket-mode="disabled"
          title="Perps execution ships in a later milestone."
          className="cursor-not-allowed rounded border border-zinc-700 bg-zinc-900/60 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-zinc-500"
        >
          Perps not live
        </button>
      )}
      {/*
        * PERPS-SUBACCOUNTS-FRONTEND-ROUTING-V1 — honest not-live copy.
        * Default: Perps public trading is not live. Base Sepolia testnet
        * only. No mainnet. Even when the closed-test UI flag is on, the
        * backend allowlist is authoritative — this copy just tells the
        * operator the closed test exists.
        */}
      <p
        data-testid="widget-perps-trade-posture-copy"
        data-posture={closedTestCopyVisible ? "closed_test" : "not_live"}
        className="text-[10px] leading-snug text-zinc-500"
      >
        {closedTestCopyVisible
          ? "Perps closed test only. Base Sepolia testnet. No real funds. Backend allowlist enforced."
          : "Perps public trading is not live. Base Sepolia testnet. No real funds."}
      </p>
      {ticketEnabled && walletBlocker ? (
        <p
          data-testid="widget-perps-trade-wallet-blocker"
          className="text-[10px] text-emerald-300"
        >
          {walletBlocker}
        </p>
      ) : null}
      {submitError ? (
        <p
          data-testid="widget-perps-trade-error"
          role="alert"
          className="text-[10px] text-rose-400"
        >
          {submitError}
        </p>
      ) : null}
      {lastAcceptedOrderId ? (
        <p
          data-testid="widget-perps-trade-accepted"
          data-order-id={lastAcceptedOrderId}
          className="text-[10px] text-emerald-300"
        >
          Order accepted: {lastAcceptedOrderId.slice(0, 8)}…
        </p>
      ) : null}
    </div>
  );
}

// Compute a naive isolated-margin figure in 1e8 units from the raw
// size + price 1e8 strings and the integer leverage. The backend
// re-validates against the market's `max_leverage` cap so a bad
// number surfaces as a clear rejection there rather than silently
// running. Uses BigInt to avoid drift on large positions.
function computeIsolatedMargin1e8(
  size1e8: string,
  price1e8: string,
  leverage: number,
): string {
  const s = BigInt(size1e8);
  const p = BigInt(price1e8);
  const lev = BigInt(Math.max(1, Math.floor(leverage)));
  const scale = BigInt(100_000_000);
  // notional_1e8 = size * price / 1e8; margin = notional / leverage.
  const notional = (s * p) / scale;
  const margin = notional / lev;
  return margin.toString();
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function SideTab({
  active,
  tone,
  onClick,
  testid,
  children,
}: {
  active: boolean;
  tone: "long" | "short";
  onClick: () => void;
  testid: string;
  children: React.ReactNode;
}) {
  // Subtle tonal hint without using amber/yellow/orange: long stays
  // emerald-family (DeOpt accent), short uses a desaturated red.
  const activeCls =
    tone === "long"
      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
      : "border-red-500/50 bg-red-950/40 text-red-200";
  const idleCls = "border-zinc-800 bg-black/40 text-zinc-300 hover:border-emerald-500/40";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={testid}
      className={`rounded border py-1.5 text-[12px] font-semibold ${
        active ? activeCls : idleCls
      }`}
    >
      {children}
    </button>
  );
}
