"use client";

// MATCHING-TIF-SEMANTICS-OPTIONS-V1 — direct options orderbook form.
//
// Submits to `POST /options/orders` and exercises the new
// time-in-force + post-only semantics (see
// `deopt-v2-backend/docs/MATCHING_TIF_SEMANTICS_OPTIONS_V1_RESULT.md`).
//
// This widget is INTENTIONALLY DISTINCT from `TradeTicket.tsx`. The
// trade ticket drives the paired RFQ-style execution-intent flow
// (`/options/execution-intents`), which always behaves as GTC and
// ignores post-only. This form drives the orderbook-direct path
// where the matching engine honours GTC / IOC / FOK / post-only.
//
// No wallet signing, no operator broadcast: the backend matches the
// order against the in-memory or DB book and returns the final
// state. The form surfaces:
//   * the final order status (open / partially_filled / filled /
//     cancelled / rejected / expired)
//   * `remaining_size_1e8` (so callers can compute `filled = size -
//     remaining`)
//   * each executed fill leg (maker, price, size)
//   * stable backend error messages for `FokNotFillable`,
//     `PostOnlyWouldMatch`, and invalid TIF combinations

import { useState } from "react";
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
import { buildAuthorization, canonical } from "@/lib/write-auth";
import { TifPopover, PostCheckbox, type Tif } from "./TifPopover";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000001" as const;

function tifWire(tif: Tif): OptionOrderTif {
  return tif.toLowerCase() as OptionOrderTif;
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
  const { address: walletAddress, isExpectedChain, signTypedData } = useWallet();
  const [seriesId, setSeriesId] = useState(initialSeriesId ?? "");
  const [account, setAccount] = useState<string>(ZERO_ADDRESS);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [price1e8, setPrice1e8] = useState("1000000000");
  const [size1e8, setSize1e8] = useState("100000000");
  const [tif, setTif] = useState<Tif>("GTC");
  const [postOnly, setPostOnly] = useState(false);

  const [phase, setPhase] = useState<"idle" | "submitting" | "ok" | "err">(
    "idle",
  );
  const [response, setResponse] = useState<SubmitOptionOrderResponse | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit =
    seriesId.length > 0 &&
    account.length > 0 &&
    price1e8.length > 0 &&
    size1e8.length > 0 &&
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
      const authorization = await buildAuthorization({
        account: walletAddress,
        action: "OPTION_ORDER_SUBMIT",
        canonical: canonical.optionOrderSubmit({
          account: walletAddress,
          optionSeriesId: seriesId,
          side,
          price1e8,
          size1e8,
          timeInForce: tifWire(tif),
          postOnly,
        }),
        signTypedData,
      });
      const body: SubmitOptionOrderRequest = {
        option_series_id: seriesId,
        account: walletAddress,
        side,
        price_1e8: price1e8,
        size_1e8: size1e8,
        time_in_force: tifWire(tif),
        post_only: postOnly,
        authorization,
      };
      const res = await submitOptionOrder(body);
      setResponse(res);
      setPhase("ok");
    } catch (err) {
      const message =
        err instanceof TradingApiError ? err.message : (err as Error).message;
      setErrorMessage(message);
      setPhase("err");
    }
  };

  return (
    <form
      data-testid="direct-orderbook-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-zinc-950 p-3 text-zinc-100"
    >
      <header className="flex flex-col gap-1 border-b border-zinc-900 pb-2">
        <h2 className="text-sm font-semibold text-emerald-200">
          Direct orderbook submit
        </h2>
        <p
          data-testid="direct-orderbook-scope"
          className="text-[11px] leading-snug text-zinc-400"
        >
          Posts to{" "}
          <code className="rounded bg-zinc-900 px-1 text-emerald-300">
            POST /options/orders
          </code>
          . Honours GTC / IOC / FOK and post-only. Separate from the
          paired RFQ execution-intent flow that the standard Trade
          ticket drives.
        </p>
      </header>

      <label className="text-xs text-zinc-300">
        Option series id
        <input
          type="text"
          value={seriesId}
          onChange={(e) => setSeriesId(e.target.value)}
          placeholder="0x… (paste from /options/series)"
          data-testid="direct-orderbook-series-id"
          className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-[11px] focus:border-emerald-500/60 focus:outline-none"
        />
      </label>

      <label className="text-xs text-zinc-300">
        Account (EVM address)
        <input
          type="text"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="0x…"
          data-testid="direct-orderbook-account"
          className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-[11px] focus:border-emerald-500/60 focus:outline-none"
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSide("buy")}
          aria-pressed={side === "buy"}
          data-testid="direct-orderbook-side-buy"
          data-selected={side === "buy" ? "true" : "false"}
          className={`flex-1 rounded px-2 py-1.5 text-xs font-medium ${
            side === "buy"
              ? "border border-emerald-500/60 bg-emerald-500 text-black"
              : "border border-zinc-800 bg-black/40 text-zinc-200 hover:border-emerald-500/40"
          }`}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => setSide("sell")}
          aria-pressed={side === "sell"}
          data-testid="direct-orderbook-side-sell"
          data-selected={side === "sell" ? "true" : "false"}
          className={`flex-1 rounded px-2 py-1.5 text-xs font-medium ${
            side === "sell"
              ? "border border-red-500/60 bg-red-950/60 text-red-100"
              : "border border-zinc-800 bg-black/40 text-zinc-200 hover:border-red-500/40"
          }`}
        >
          Sell
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-zinc-300">
          Price (1e8)
          <input
            type="text"
            inputMode="numeric"
            value={price1e8}
            onChange={(e) => setPrice1e8(e.target.value)}
            data-testid="direct-orderbook-price"
            className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-xs focus:border-emerald-500/60 focus:outline-none"
          />
        </label>
        <label className="text-xs text-zinc-300">
          Size (1e8)
          <input
            type="text"
            inputMode="numeric"
            value={size1e8}
            onChange={(e) => setSize1e8(e.target.value)}
            data-testid="direct-orderbook-size"
            className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-xs focus:border-emerald-500/60 focus:outline-none"
          />
        </label>
      </div>

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

      <button
        type="submit"
        disabled={!canSubmit}
        data-testid="direct-orderbook-submit"
        className="rounded bg-emerald-500 px-3 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        {phase === "submitting" ? "Submitting…" : "Submit to orderbook"}
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
    </form>
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
