"use client";

// OPTIONS-ADVANCED-ORDER-TICKET-UX-V1 — Options order ticket form.
//
// Adds an `Order Type` dropdown so operators pick the execution
// model up-front (Derive-style):
//
//   * `Limit`     — submits to `POST /options/orders` with the
//                   existing TIF/post-only/attached TP/SL flow.
//   * `Stop Limit`— honest disabled state; the backend does not
//                   ship a standalone Stop Limit product yet.
//                   Follow-up milestone: OPTIONS-STOP-LIMIT-ORDERS-V1.
//   * `TWAP`      — flag-gated (`NEXT_PUBLIC_OPTIONS_TWAP_ENABLED`).
//                   Renders the shared `OptionsTwapForm` inline;
//                   TWAP is an Order Type, not a separate product.
//
// UX principles honoured here:
//   * Attached TP/SL inputs accept human-readable dollar prices
//     (`$189.1`); the form converts to 1e8 on submit via
//     `humanToScaled1e8` from `@/lib/price-scaling`. The wire body
//     shape is unchanged — `trigger_price_1e8` / `limit_price_1e8`.
//   * No `(1e8)` label leaks into the attached section.
//   * Post + TIF controls only render for `Limit` (not meaningful
//     for TWAP; not for the disabled Stop Limit stub).
//   * Reduce-only is intentionally not exposed: the backend does
//     not accept it on the base order DTO, and attached TP/SL is
//     already flagged reduce-only server-side.
//   * The form does not fabricate margin, buying power, fees, or
//     rewards; the closure lives in the TWAP form's preview panel
//     for the TWAP path.

import { useMemo, useState } from "react";
import { buildAttachedTpSlPayload } from "@/lib/attached-tp-sl-payload";
import { humanToScaled1e8 } from "@/lib/price-scaling";
import { isOptionsTwapEnabled } from "@/lib/options-twap-flag";
import {
  submitOptionOrder,
  TradingApiError,
} from "@/lib/trading-api";
import type {
  OptionOrderTif,
  SubmitOptionOrderRequest,
  SubmitOptionOrderResponse,
} from "@/lib/trading-types";
import { useWallet } from "@/lib/wallet";
import { buildAuthorization, canonical, canonicalV2 } from "@/lib/write-auth";
import { OptionsTwapForm } from "./OptionsTwapForm";
import { TifPopover, PostCheckbox, type Tif } from "./TifPopover";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000001" as const;

type OrderType = "limit" | "stop_limit" | "twap";

function tifWire(tif: Tif): OptionOrderTif {
  return tif.toLowerCase() as OptionOrderTif;
}

interface HumanPriceState {
  tpEnabled: boolean;
  slEnabled: boolean;
  tpPriceHuman: string;
  slPriceHuman: string;
}

interface HumanPriceValidation {
  tpError: string | null;
  slError: string | null;
  ok: boolean;
}

function validatePricePart(
  human: string,
  label: string,
): { scaled: string | null; error: string | null } {
  const trimmed = human.trim();
  if (trimmed.length === 0) {
    return { scaled: null, error: `${label} price is required.` };
  }
  const scaled = humanToScaled1e8(trimmed);
  if (scaled === null) {
    return { scaled: null, error: `${label} price must be a valid price.` };
  }
  if (scaled === "0") {
    return { scaled: null, error: `${label} price must be greater than 0.` };
  }
  return { scaled, error: null };
}

function validateHumanAttachedTpSl(
  state: HumanPriceState,
): HumanPriceValidation {
  const tpError = state.tpEnabled
    ? validatePricePart(state.tpPriceHuman, "Take Profit").error
    : null;
  const slError = state.slEnabled
    ? validatePricePart(state.slPriceHuman, "Stop Loss").error
    : null;
  const ok = tpError === null && slError === null;
  return { tpError, slError, ok };
}

export interface DirectOrderbookFormProps {
  /** Optional pre-fill for the series id (e.g. from a selected chain
   *  row). To force a re-prefill when the parent's selection changes,
   *  the parent should also pass a matching `key` so React remounts
   *  the form and the new initial value takes effect. */
  initialSeriesId?: string;
}

export function DirectOrderbookForm({
  initialSeriesId,
}: DirectOrderbookFormProps = {}) {
  const {
    address: walletAddress,
    isExpectedChain,
    signTypedData,
    activeSubaccountId,
  } = useWallet();
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [seriesId, setSeriesId] = useState(initialSeriesId ?? "");
  const [account, setAccount] = useState<string>(ZERO_ADDRESS);
  // Side is currently pinned to "buy" — the explicit Buy/Sell tabs
  // were retired to declutter the form. When the user picks a leg
  // from the chain (`Bid` for sell, `Ask` for buy), the leg's own
  // `side` drives the multi-leg store; this default only feeds the
  // legacy direct-submit wire body when no chain click has fired.
  const side: "buy" | "sell" = "buy";
  const [price1e8, setPrice1e8] = useState("");
  const [size1e8, setSize1e8] = useState("");
  const [tif, setTif] = useState<Tif>("GTC");
  const [postOnly, setPostOnly] = useState(false);

  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);
  const [tpPriceHuman, setTpPriceHuman] = useState("");
  const [slPriceHuman, setSlPriceHuman] = useState("");

  const [phase, setPhase] = useState<"idle" | "submitting" | "ok" | "err">(
    "idle",
  );
  const [response, setResponse] = useState<SubmitOptionOrderResponse | null>(
    null,
  );
  const [attachedSubmitted, setAttachedSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const twapEnabled = isOptionsTwapEnabled();

  const humanState: HumanPriceState = {
    tpEnabled,
    slEnabled,
    tpPriceHuman,
    slPriceHuman,
  };
  const validation = useMemo(
    () => validateHumanAttachedTpSl(humanState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tpEnabled, slEnabled, tpPriceHuman, slPriceHuman],
  );

  const canSubmit =
    orderType === "limit" &&
    seriesId.length > 0 &&
    account.length > 0 &&
    price1e8.length > 0 &&
    size1e8.length > 0 &&
    validation.ok &&
    phase !== "submitting";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setPhase("submitting");
    setResponse(null);
    setErrorMessage(null);
    try {
      if (!walletAddress) {
        throw new Error("Connect a wallet to sign the write authorization.");
      }
      if (!isExpectedChain) {
        throw new Error("Switch to Base Sepolia to sign the write authorization.");
      }
      if (walletAddress.toLowerCase() !== account.toLowerCase()) {
        throw new Error(
          "Account field must match the connected wallet address.",
        );
      }
      const useV2 = activeSubaccountId > 1;
      const canonicalBytes = useV2
        ? canonicalV2.optionOrderSubmit({
            account: walletAddress,
            subaccountId: activeSubaccountId,
            optionSeriesId: seriesId,
            side,
            price1e8,
            size1e8,
            timeInForce: tifWire(tif),
            postOnly,
          })
        : canonical.optionOrderSubmit({
            account: walletAddress,
            optionSeriesId: seriesId,
            side,
            price1e8,
            size1e8,
            timeInForce: tifWire(tif),
            postOnly,
          });
      const authorization = await buildAuthorization({
        account: walletAddress,
        action: "OPTION_ORDER_SUBMIT",
        canonical: canonicalBytes,
        signTypedData,
        version: useV2 ? 2 : undefined,
      });
      const scaledState = {
        tpEnabled,
        slEnabled,
        tpPrice1e8: tpEnabled ? (humanToScaled1e8(tpPriceHuman) ?? "") : "",
        slPrice1e8: slEnabled ? (humanToScaled1e8(slPriceHuman) ?? "") : "",
      };
      const attached = buildAttachedTpSlPayload(scaledState);
      const body: SubmitOptionOrderRequest = {
        option_series_id: seriesId,
        account: walletAddress,
        subaccount_id: activeSubaccountId,
        side,
        price_1e8: price1e8,
        size_1e8: size1e8,
        time_in_force: tifWire(tif),
        post_only: postOnly,
        authorization,
        ...(attached ? { attached_tp_sl: attached } : {}),
      };
      const res = await submitOptionOrder(body);
      setResponse(res);
      setAttachedSubmitted(attached !== undefined);
      setPhase("ok");
    } catch (err) {
      const message =
        err instanceof TradingApiError ? err.message : (err as Error).message;
      setErrorMessage(message);
      setAttachedSubmitted(false);
      setPhase("err");
    }
  };

  return (
    <form
      data-testid="direct-orderbook-form"
      data-order-type={orderType}
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 text-zinc-100"
    >
      <label className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 text-[11px] text-zinc-300">
        <span className="text-[11px] font-medium text-zinc-300">Order Type</span>
        <select
          data-testid="options-order-type-select"
          value={orderType}
          onChange={(e) => setOrderType(e.target.value as OrderType)}
          className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
        >
          <option value="limit">Limit</option>
          <option value="stop_limit" data-testid="options-order-type-option-stop-limit">
            Stop Limit (not live)
          </option>
          {twapEnabled ? (
            <option value="twap" data-testid="options-order-type-option-twap">
              TWAP
            </option>
          ) : null}
        </select>
      </label>

      {orderType === "stop_limit" ? (
        <div
          data-testid="options-stop-limit-disabled"
          role="note"
          className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-[11px] text-zinc-400"
        >
          <p className="mb-1 text-zinc-200">Stop Limit is not live yet.</p>
          <p className="text-zinc-500">
            Standalone Stop Limit orders are tracked as milestone
            <span className="mx-1 font-mono">OPTIONS-STOP-LIMIT-ORDERS-V1</span>
            and will surface here once the matching engine ships them.
            In the meantime, use an attached <span className="uppercase">SL</span>
            leg below your Limit entry to protect a fill.
          </p>
        </div>
      ) : null}

      {orderType === "twap" ? (
        <div data-testid="options-order-type-body-twap" className="flex flex-col gap-2">
          <OptionsTwapForm optionSeriesId={seriesId || (initialSeriesId ?? "")} />
        </div>
      ) : null}

      {orderType === "limit" ? (
        <div
          data-testid="options-order-type-body-limit"
          className="flex flex-col gap-3"
        >
          {/* OPTIONS-CHAIN-MULTISELECT-EXECUTION-UX-V1 — the Series
              input is now a tester-only affordance. In the normal
              flow the operator clicks a Bid/Ask cell in the chain
              and `initialSeriesId` pre-fills the state. The
              `Advanced` toggle keeps the raw series id available
              for tester submissions and Playwright E2E coverage. */}
          <AdvancedSeriesInput
            seriesId={seriesId}
            setSeriesId={setSeriesId}
          />

          <label className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 text-[11px]">
            <span className="text-[11px] font-medium text-zinc-300">
              Limit Price
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={price1e8}
              onChange={(e) => setPrice1e8(e.target.value)}
              placeholder="0.0"
              data-testid="direct-orderbook-price"
              className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 text-right font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/60 focus:outline-none"
            />
          </label>

          <label className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 text-[11px]">
            <span className="text-[11px] font-medium text-zinc-300">Amount</span>
            <input
              type="text"
              inputMode="numeric"
              value={size1e8}
              onChange={(e) => setSize1e8(e.target.value)}
              placeholder="0.0"
              data-testid="direct-orderbook-size"
              className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 text-right font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/60 focus:outline-none"
            />
          </label>

          <label className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 text-[11px]">
            <span className="text-[11px] font-medium text-zinc-300">Account</span>
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="0x…"
              data-testid="direct-orderbook-account"
              className="w-full rounded border border-zinc-800 bg-black/40 px-2 py-1.5 font-mono text-[11px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
            />
          </label>

          <div
            data-testid="direct-orderbook-tif-row"
            className="flex items-center justify-between gap-2"
          >
            <PostCheckbox
              checked={postOnly}
              onChange={setPostOnly}
              testid="direct-orderbook-post"
            />
            <TifPopover
              value={tif}
              onChange={setTif}
              testid="direct-orderbook-tif"
            />
          </div>

          <section
            data-testid="direct-orderbook-attached-section"
            className="flex flex-col gap-2 border-t border-zinc-800 pt-3 text-xs text-zinc-300"
          >
            <header className="flex items-center justify-between">
              <h3 className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                Attach TP / SL
              </h3>
            </header>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={tpEnabled}
                  onChange={(e) => setTpEnabled(e.target.checked)}
                  data-testid="direct-orderbook-attach-tp-toggle"
                  className="size-3.5 accent-emerald-500"
                />
                TP
              </label>
              <label className="flex items-center gap-1 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={slEnabled}
                  onChange={(e) => setSlEnabled(e.target.checked)}
                  data-testid="direct-orderbook-attach-sl-toggle"
                  className="size-3.5 accent-red-500"
                />
                SL
              </label>
            </div>
            {tpEnabled ? (
              <label className="text-[11px] text-zinc-300">
                Take Profit Price
                <input
                  type="text"
                  inputMode="decimal"
                  value={tpPriceHuman}
                  onChange={(e) => setTpPriceHuman(e.target.value)}
                  data-testid="direct-orderbook-attach-tp-price"
                  aria-invalid={validation.tpError !== null}
                  placeholder="$15.00"
                  className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-xs focus:border-emerald-500/60 focus:outline-none"
                />
                {validation.tpError ? (
                  <span
                    data-testid="direct-orderbook-attach-tp-error"
                    className="block text-[10px] text-red-300"
                  >
                    {validation.tpError}
                  </span>
                ) : null}
              </label>
            ) : null}
            {slEnabled ? (
              <label className="text-[11px] text-zinc-300">
                Stop Loss Price
                <input
                  type="text"
                  inputMode="decimal"
                  value={slPriceHuman}
                  onChange={(e) => setSlPriceHuman(e.target.value)}
                  data-testid="direct-orderbook-attach-sl-price"
                  aria-invalid={validation.slError !== null}
                  placeholder="$5.00"
                  className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-xs focus:border-red-500/60 focus:outline-none"
                />
                {validation.slError ? (
                  <span
                    data-testid="direct-orderbook-attach-sl-error"
                    className="block text-[10px] text-red-300"
                  >
                    {validation.slError}
                  </span>
                ) : null}
              </label>
            ) : null}
            {tpEnabled && slEnabled ? (
              <p
                data-testid="direct-orderbook-attach-oco-copy"
                className="text-[10px] text-zinc-500"
              >
                Take Profit and Stop Loss are linked automatically. When one fills, the other is cancelled.
              </p>
            ) : null}
          </section>

          <button
            type="submit"
            disabled={!canSubmit}
            data-testid="direct-orderbook-submit"
            className="rounded bg-emerald-500 px-3 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {phase === "submitting"
              ? "Submitting…"
              : !size1e8 || size1e8 === "0"
                ? "Enter amount"
                : side === "buy"
                  ? "Buy"
                  : "Sell"}
          </button>

          {phase === "err" && errorMessage ? (
            <div
              data-testid="direct-orderbook-error"
              role="alert"
              className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-100"
            >
              <span className="font-semibold">Rejected — </span>
              <span data-testid="direct-orderbook-error-message">{errorMessage}</span>
            </div>
          ) : null}

          {phase === "ok" && response ? (
            <div
              data-testid="direct-orderbook-result"
              className="flex flex-col gap-2 rounded border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-xs"
            >
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <ResultCell label="Status">
                  <span data-testid="direct-orderbook-result-status">
                    {response.status}
                  </span>
                </ResultCell>
                <ResultCell label="Remaining (1e8)">
                  <span data-testid="direct-orderbook-result-remaining">
                    {response.remaining_size_1e8}
                  </span>
                </ResultCell>
                <ResultCell label="Fills">
                  <span data-testid="direct-orderbook-result-fill-count">
                    {response.fills.length}
                  </span>
                </ResultCell>
              </div>
              {attachedSubmitted ? (
                <p
                  data-testid="direct-orderbook-result-attached"
                  className="rounded border border-emerald-700/40 bg-emerald-900/30 px-2 py-1 text-[11px] text-emerald-100"
                >
                  Attached TP/SL plan submitted. It becomes active after
                  fills. Check Conditional Orders / History for status.
                </p>
              ) : null}
              {response.fills.length > 0 ? (
                <ul
                  data-testid="direct-orderbook-result-fills"
                  className="flex flex-col gap-1 border-t border-zinc-900 pt-2 text-[10px] text-zinc-300"
                >
                  {response.fills.map((fill) => (
                    <li
                      key={fill.fill_id}
                      data-testid={`direct-orderbook-fill-${fill.fill_id}`}
                      className="font-mono"
                    >
                      <span>price={fill.price_1e8}</span>{" "}
                      <span>size={fill.size_1e8}</span>{" "}
                      <span>maker={fill.maker_order_id.slice(0, 8)}…</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function AdvancedSeriesInput({
  seriesId,
  setSeriesId,
}: {
  seriesId: string;
  setSeriesId: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      data-testid="direct-orderbook-advanced"
      data-open={open ? "true" : "false"}
      className="rounded border border-dashed border-zinc-800 bg-zinc-950/40 px-2 py-1 text-[10px] text-zinc-500"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        data-testid="direct-orderbook-advanced-summary"
        aria-expanded={open}
        className="cursor-pointer select-none text-[10px] uppercase tracking-[0.16em] text-zinc-500 hover:text-emerald-200"
      >
        {open ? "▾" : "▸"} Advanced · manual series id (testers)
      </button>
      {open ? (
        <label className="mt-2 block text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          Series
          <input
            type="text"
            value={seriesId}
            onChange={(e) => setSeriesId(e.target.value)}
            placeholder="0x…"
            data-testid="direct-orderbook-series-id"
            className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-[11px] normal-case tracking-normal focus:border-emerald-500/60 focus:outline-none"
          />
        </label>
      ) : null}
    </div>
  );
}

function ResultCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded border border-zinc-800 bg-zinc-950 px-2 py-1">
      <span className="text-[9px] uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </span>
      <span className="font-mono text-[11px] text-zinc-100">{children}</span>
    </div>
  );
}
