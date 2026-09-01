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

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { usePerpsSymbol } from "@/lib/perps-symbol";
import { TifPopover, PostCheckbox, type Tif } from "../TifPopover";
import { isPerpsTicketEnabled } from "@/lib/perps-flag";
import { isPerpsClosedTestEnabled } from "@/lib/perps-closed-test-flag";
import {
  getPerpsMarketPrice,
  submitPerpsOrder,
  TradingApiError,
  type SubmitPerpsOrderRequest,
} from "@/lib/trading-api";
import { useWallet } from "@/lib/wallet";
import { buildAuthorization, canonicalV2 } from "@/lib/write-auth";

type Side = "long" | "short";
type Mode = "market" | "limit";

/** Leverage bounds — must match the slider min/max and the backend's
 *  `max_leverage` cap per market. Kept as constants so the slider and
 *  the exact numeric input can never drift out of sync. Step is
 *  fractional (0.1) so operators can dial in a decimal leverage like
 *  1.5× or 3.7×; `computeIsolatedMargin1e8` handles decimals via a
 *  1e8-scaled BigInt division. */
const MIN_LEVERAGE = 1;
const MAX_LEVERAGE = 10;
const LEVERAGE_STEP = 0.1;

function clampLeverage(n: number): number {
  if (!Number.isFinite(n)) return MIN_LEVERAGE;
  if (n < MIN_LEVERAGE) return MIN_LEVERAGE;
  if (n > MAX_LEVERAGE) return MAX_LEVERAGE;
  // Snap to one decimal so the slider + input never surface floating-
  // point noise like 3.6000000000000005.
  return Math.round(n * 10) / 10;
}

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
  const [leverage, setLeverageState] = useState<number>(1);
  // The number input holds a separate "draft" string so the field can
  // be freely cleared, retyped, or left with a trailing "." during
  // editing without the controlled `value={leverage}` snapping it
  // back on every keystroke. `commitLeverage` keeps the numeric state
  // and the draft in lockstep whenever the slider (or blur) writes.
  const [leverageDraft, setLeverageDraft] = useState<string>("1");
  const commitLeverage = (n: number) => {
    const clamped = clampLeverage(n);
    setLeverageState(clamped);
    setLeverageDraft(String(clamped));
  };
  const [slippagePct, setSlippagePct] = useState<string>("0.5");
  const [tif, setTif] = useState<Tif>("GTC");
  const [postOnly, setPostOnly] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastAcceptedOrderId, setLastAcceptedOrderId] = useState<string | null>(null);
  // PERPS-PRICING-AND-EXECUTION-SAFETY-CORE-V1 — reference price used
  // to convert the user's chosen slippage percent into an absolute
  // `max_execution_price_1e8` / `min_execution_price_1e8` bound at
  // submit time. Sourced from the backend mark-price snapshot the
  // stats bandeau already polls (`getPerpsMarketPrice`). When the
  // snapshot is unavailable or stale, this stays null and the ticket
  // refuses to submit rather than sending an unbounded market order.
  const [referencePrice1e8, setReferencePrice1e8] = useState<string | null>(null);
  useEffect(() => {
    // Effect syncs to an external system (the backend price
    // snapshot). State writes happen only inside the async task, not
    // synchronously in the effect body.
    let cancelled = false;
    const ctrl = new AbortController();
    const symbol = market.symbol;
    async function tick() {
      try {
        const snap = await getPerpsMarketPrice(symbol, ctrl.signal);
        if (cancelled) return;
        // Refuse stale marks — a stale reference would produce a
        // stale slippage bound that could accept a fill way off the
        // current book. The submit path surfaces this as a clear
        // error.
        if (snap.stale) {
          setReferencePrice1e8(null);
        } else {
          setReferencePrice1e8(snap.mark_price_1e8);
        }
      } catch (err) {
        if (cancelled || (err as Error)?.name === "AbortError") return;
        setReferencePrice1e8(null);
      }
    }
    void tick();
    const handle = window.setInterval(() => void tick(), 15_000);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(handle);
    };
  }, [market.symbol]);

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
    // PERPS-PRICING-AND-EXECUTION-SAFETY-CORE-V1 — user-chosen bound.
    // LIMIT orders (`price_1e8 != "0"`) send both bounds as `"0"`
    // because the signed exec price IS the limit. MARKET orders
    // convert the chosen slippage percent + a fresh mark reference
    // into an absolute bound and refuse to submit if the mark is
    // unavailable — never sends an unbounded market order.
    let maxExecutionPrice1e8 = "0";
    let minExecutionPrice1e8 = "0";
    if (mode === "market") {
      if (referencePrice1e8 === null) {
        setSubmitError(
          "No fresh mark price available to compute slippage bound — retry when the market price loads.",
        );
        return;
      }
      const bounds = computeSlippageBounds1e8({
        referencePrice1e8,
        slippagePct,
        side: sideStr,
      });
      if (bounds === null) {
        setSubmitError("Max Slippage must be a positive number.");
        return;
      }
      maxExecutionPrice1e8 = bounds.max;
      minExecutionPrice1e8 = bounds.min;
    }
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
        // PERPS-PRICING-AND-EXECUTION-SAFETY-CORE-V1 — the trader's
        // slippage bound flows end-to-end via these two fields; the
        // backend threads them into the on-chain matching engine's
        // PerpTrade EIP-712 payload verbatim. `"0"` means strict.
        max_execution_price_1e8: maxExecutionPrice1e8,
        min_execution_price_1e8: minExecutionPrice1e8,
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
        <MaxSlippageRow value={slippagePct} onChange={setSlippagePct} />
      )}

      {/* Leverage — slider + exact numeric input (both write the
          same state, values clamped to [MIN_LEVERAGE, MAX_LEVERAGE]
          so the numeric input never exceeds the slider range). */}
      <Field label="Leverage">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={MIN_LEVERAGE}
            max={MAX_LEVERAGE}
            step={LEVERAGE_STEP}
            value={leverage}
            onChange={(e) => commitLeverage(Number(e.target.value))}
            data-testid="widget-perps-trade-leverage"
            // `--slider-pct` drives the gradient stop inside
            // `.deopt-slider-dark::-webkit-slider-runnable-track`
            // so the unfilled right portion stays a dark zinc-900
            // strip with only a subtle border instead of the
            // bright default track WebKit paints.
            style={
              {
                "--slider-pct": `${((leverage - MIN_LEVERAGE) / (MAX_LEVERAGE - MIN_LEVERAGE)) * 100}%`,
              } as CSSProperties
            }
            className="deopt-slider-dark min-w-0 flex-1"
          />
          <div className="flex items-center gap-0.5 rounded border border-zinc-800 bg-black/40 pl-1.5 pr-1 py-0.5 focus-within:border-emerald-500/60">
            <input
              type="number"
              min={MIN_LEVERAGE}
              max={MAX_LEVERAGE}
              step={LEVERAGE_STEP}
              value={leverageDraft}
              onChange={(e) => {
                const raw = e.target.value;
                // Always echo the raw keystroke into the draft so the
                // field can be cleared, retyped, or hold intermediate
                // strings like "" or "5.". Only push the numeric
                // state forward when the draft parses to a finite
                // number — otherwise `leverage` stays at its last
                // committed value.
                setLeverageDraft(raw);
                if (raw === "") return;
                const n = Number(raw);
                if (!Number.isFinite(n)) return;
                setLeverageState(clampLeverage(n));
              }}
              onBlur={() => {
                // On focus loss, snap the draft back to the committed
                // leverage so trailing dots / empty strings / out-of-
                // range noise never linger in the field.
                setLeverageDraft(String(leverage));
              }}
              aria-label="Leverage value"
              data-testid="widget-perps-trade-leverage-input"
              className="w-10 bg-transparent text-right font-mono text-[12px] text-zinc-100 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              style={{ fontFamily: "var(--app-font-mono)" }}
            />
            <span className="font-mono text-[12px] text-zinc-500" style={{ fontFamily: "var(--app-font-mono)" }}>
              ×
            </span>
          </div>
        </div>
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
// size + price 1e8 strings and the (possibly fractional) leverage.
// Leverage is scaled to 1e8 as a BigInt so decimals like 1.5× or
// 3.7× divide precisely — a prior version floored the leverage to
// an integer which silently under-utilised any fractional dial-in.
// The backend re-validates against the market's `max_leverage` cap
// so a bad number surfaces as a clear rejection there rather than
// silently running.
function computeIsolatedMargin1e8(
  size1e8: string,
  price1e8: string,
  leverage: number,
): string {
  const s = BigInt(size1e8);
  const p = BigInt(price1e8);
  const scale = BigInt(100_000_000);
  const lev1e8 = BigInt(
    Math.round(Math.max(MIN_LEVERAGE, leverage) * 100_000_000),
  );
  // notional_1e8 = size * price / 1e8;
  // margin_1e8   = notional_1e8 * 1e8 / lev_1e8.
  const notional = (s * p) / scale;
  const margin = (notional * scale) / lev1e8;
  return margin.toString();
}

/** Preset chips (in percent) offered next to the Max Slippage
 *  label. "Custom" hides the chips and reveals a small numeric
 *  input so the operator can dial an exact value. */
const SLIPPAGE_PRESETS = [0.1, 0.25, 0.5, 1] as const;

/** PERPS-PRICING-AND-EXECUTION-SAFETY-CORE-V1 — converts the user's
 *  chosen slippage percent + a fresh oracle reference price into
 *  absolute `max_execution_price_1e8` / `min_execution_price_1e8`
 *  bounds. BigInt arithmetic only — no floating-point drift on the
 *  wire.
 *
 *  Semantics (per the locked Solidity spec):
 *    - Buy  → max = ceil(ref × (1 + pct/100)), min = "0"
 *    - Sell → min = floor(ref × (1 − pct/100)), max = "0"
 *
 *  Returns null for non-positive / non-finite pct or when
 *  Math.round(pct * 100) rounds to 0 (i.e. below 0.01% — the
 *  wire uses bp resolution). */
export function computeSlippageBounds1e8(args: {
  referencePrice1e8: string;
  slippagePct: string;
  side: "buy" | "sell";
}): { max: string; min: string } | null {
  const ZERO = BigInt(0);
  const ONE = BigInt(1);
  const DENOM = BigInt(10_000);
  const pct = Number.parseFloat(args.slippagePct);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  const bps = BigInt(Math.round(pct * 100)); // 0.5% → 50 bps
  if (bps <= ZERO) return null;
  let ref: bigint;
  try {
    ref = BigInt(args.referencePrice1e8);
  } catch {
    return null;
  }
  if (ref <= ZERO) return null;
  if (args.side === "buy") {
    // max = ceil(ref * (DENOM + bps) / DENOM)
    const numer = ref * (DENOM + bps);
    const max = (numer + DENOM - ONE) / DENOM;
    return { max: max.toString(), min: "0" };
  }
  // sell: min = floor(ref * (DENOM - bps) / DENOM). Guard against
  // an absurdly large slippage that would drive the floor negative.
  if (bps >= DENOM) return null;
  const numer = ref * (DENOM - bps);
  const min = numer / DENOM;
  return { max: "0", min: min.toString() };
}

interface MaxSlippageRowProps {
  /** Percent as a string (matches the pre-existing state shape). */
  value: string;
  onChange: (next: string) => void;
}

/** Compact `Max Slippage 0.5%` row with preset chips + a Custom
 *  affordance. Rendered only for Market orders — Limit orders use
 *  the limit price as their own execution-price protection.
 *
 *  PERPS-PRICING-AND-EXECUTION-SAFETY-CORE-V1: the chosen percent
 *  is converted at submit time (via `computeSlippageBounds1e8`)
 *  into an absolute `max_execution_price_1e8` /
 *  `min_execution_price_1e8` bound and threaded into the submit
 *  body. The backend then propagates the bound verbatim into the
 *  on-chain matching engine's `PerpTrade` payload; no server-side
 *  widening. */
function MaxSlippageRow({ value, onChange }: MaxSlippageRowProps) {
  const numeric = Number.parseFloat(value);
  const matchesPreset = SLIPPAGE_PRESETS.some(
    (p) => Number.isFinite(numeric) && Math.abs(p - numeric) < 1e-6,
  );
  // Whether the Custom input is visible. Independent of the value
  // itself — otherwise clicking Custom while `value === "0.5"` (a
  // preset) would leave `showCustom` false and reveal nothing.
  // Initialised from the value so a non-preset default (e.g. loaded
  // from user prefs later) opens the input on mount.
  const [showCustom, setShowCustom] = useState<boolean>(!matchesPreset);
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div
      data-testid="widget-perps-trade-max-slippage"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500"
    >
      <span>Max Slippage</span>
      {SLIPPAGE_PRESETS.map((p) => {
        const active = !showCustom && Math.abs(p - numeric) < 1e-6;
        return (
          <button
            key={p}
            type="button"
            onClick={() => {
              setShowCustom(false);
              onChange(String(p));
            }}
            data-testid={`widget-perps-trade-max-slippage-preset-${p}`}
            aria-pressed={active}
            className={
              active
                ? "rounded border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] normal-case text-emerald-200"
                : "rounded border border-zinc-800 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] normal-case text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
            }
            style={{ fontFamily: "var(--app-font-mono)" }}
          >
            {p}%
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => {
          const next = !showCustom;
          setShowCustom(next);
          if (next) {
            // Wait a tick for the input to mount, then focus + select
            // so typing overwrites the current value immediately.
            requestAnimationFrame(() => inputRef.current?.select());
          }
        }}
        data-testid="widget-perps-trade-max-slippage-custom-toggle"
        aria-pressed={showCustom}
        className={
          showCustom
            ? "rounded border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] normal-case text-emerald-200"
            : "rounded border border-zinc-800 bg-black/40 px-1.5 py-0.5 text-[10px] normal-case text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
        }
      >
        Custom
      </button>
      {showCustom ? (
        <span className="inline-flex items-center gap-0.5 rounded border border-zinc-800 bg-black/40 px-1 py-0.5 focus-within:border-emerald-500/60">
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Custom max slippage percent"
            data-testid="widget-perps-trade-max-slippage-input"
            className="w-10 bg-transparent text-right font-mono text-[11px] normal-case text-zinc-100 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={{ fontFamily: "var(--app-font-mono)" }}
          />
          <span
            className="font-mono text-[11px] normal-case text-zinc-500"
            style={{ fontFamily: "var(--app-font-mono)" }}
          >
            %
          </span>
        </span>
      ) : null}
    </div>
  );
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
