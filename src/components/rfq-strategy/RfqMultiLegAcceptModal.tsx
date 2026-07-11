"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import {
  acceptOptionsMultiLegRfqQuote,
  TradingApiError,
  type AcceptOptionMultiLegRfqQuoteResponse,
  type OptionMultiLegRfqQuoteResponse,
  type OptionMultiLegRfqResponse,
} from "@/lib/trading-api";
import {
  buildAuthorization,
  canonicalV2,
  type SignTypedDataFn,
} from "@/lib/write-auth";
import { useWallet } from "@/lib/wallet";

interface RfqMultiLegAcceptModalProps {
  rfq: OptionMultiLegRfqResponse;
  quote: OptionMultiLegRfqQuoteResponse;
  onCancel: () => void;
  onAccepted: (response: AcceptOptionMultiLegRfqQuoteResponse) => void;
}

type Phase =
  | { kind: "review" }
  | { kind: "requesting_challenge" }
  | { kind: "awaiting_signature" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "rejected"; message: string }
  | { kind: "error"; message: string };

const ONE_E8 = BigInt("100000000");

function fmt1e8Signed(v: string): string {
  try {
    const big = BigInt(v);
    const neg = big < BigInt(0);
    const abs = neg ? -big : big;
    const whole = abs / ONE_E8;
    const frac = (abs % ONE_E8).toString().padStart(8, "0");
    return `${neg ? "-" : ""}${whole}.${frac}`;
  } catch {
    return v;
  }
}

function shortAddr(a: string): string {
  if (a.length <= 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * RFQ-MULTI-LEG-FRONTEND-V1 — review + sign + submit modal for
 * accepting a maker multi-leg package quote.
 *
 * The taker canonical commits to the exact package price, leg count,
 * and per-leg prices as they exist on the persisted quote at signing
 * time. Any subsequent maker mutation invalidates one of the byte-
 * frozen inputs and the backend refuses the accept before persistence.
 */
export function RfqMultiLegAcceptModal({
  rfq,
  quote,
  onCancel,
  onAccepted,
}: RfqMultiLegAcceptModalProps) {
  const wallet = useWallet();
  const [phase, setPhase] = useState<Phase>({ kind: "review" });

  // Guard: if the taker/wallet mismatch changes mid-flight, close
  // the modal safely.
  useEffect(() => {
    if (!wallet.address) {
      onCancel();
      return;
    }
    if (wallet.address.toLowerCase() !== rfq.taker.toLowerCase()) {
      onCancel();
    }
  }, [wallet.address, rfq.taker, onCancel]);

  const inFlight =
    phase.kind === "requesting_challenge" ||
    phase.kind === "awaiting_signature" ||
    phase.kind === "submitting";

  const onConfirm = useCallback(async () => {
    if (!wallet.address) return;
    if (wallet.address.toLowerCase() !== rfq.taker.toLowerCase()) {
      setPhase({
        kind: "error",
        message: "Connected wallet is not the RFQ taker.",
      });
      return;
    }
    const effectiveSubaccountId = rfq.taker_subaccount_id;
    const expectedLegPrices = [...quote.legs]
      .sort((a, b) => a.leg_index - b.leg_index)
      .map((l) => l.price_1e8);
    try {
      const canonicalBytes = canonicalV2.optionMultiLegRfqAccept({
        taker: wallet.address as Address,
        subaccountId: effectiveSubaccountId,
        optionRfqId: rfq.option_rfq_id,
        quoteId: quote.quote_id,
        expectedPackagePrice1e8: quote.package_price_1e8,
        expectedLegsCount: quote.legs.length,
        expectedLegPrices1e8: expectedLegPrices,
      });

      setPhase({ kind: "requesting_challenge" });
      const signTyped: SignTypedDataFn = async (args) => {
        setPhase({ kind: "awaiting_signature" });
        return wallet.signTypedData(args);
      };

      let authorization;
      try {
        authorization = await buildAuthorization({
          account: wallet.address as Address,
          action: "OPTION_MULTI_LEG_RFQ_ACCEPT",
          canonical: canonicalBytes,
          signTypedData: signTyped,
          version: 2,
        });
      } catch (e) {
        const msg = (e as Error).message ?? "signature failed";
        if (/refused to sign|rejected/i.test(msg)) {
          setPhase({ kind: "rejected", message: msg });
        } else {
          setPhase({ kind: "error", message: msg });
        }
        return;
      }

      setPhase({ kind: "submitting" });
      const response = await acceptOptionsMultiLegRfqQuote(
        rfq.option_rfq_id,
        quote.quote_id,
        {
          authorization,
          subaccount_id: effectiveSubaccountId,
          expected_package_price_1e8: quote.package_price_1e8,
          expected_legs_count: quote.legs.length,
          expected_leg_prices_1e8: expectedLegPrices,
        },
      );
      setPhase({ kind: "success" });
      onAccepted(response);
    } catch (e) {
      setPhase({
        kind: "error",
        message:
          e instanceof TradingApiError
            ? e.message
            : (e as Error).message || "Accept failed.",
      });
    }
  }, [wallet, rfq, quote, onAccepted]);

  const phaseCopy = (() => {
    switch (phase.kind) {
      case "review":
        return "Review the maker package quote below. Confirm to sign OPTION_MULTI_LEG_RFQ_ACCEPT.";
      case "requesting_challenge":
        return "Requesting write-authorization challenge…";
      case "awaiting_signature":
        return "Awaiting wallet signature — check your wallet prompt.";
      case "submitting":
        return "Submitting accept to backend…";
      case "success":
        return "Accepted. Quote status = Accepted; fill recorded.";
      case "rejected":
        return `Wallet declined the signature. ${phase.message}`;
      case "error":
        return `Accept failed: ${phase.message}`;
    }
  })();

  const sortedLegs = [...quote.legs].sort(
    (a, b) => a.leg_index - b.leg_index,
  );

  return (
    <div
      role="dialog"
      aria-label="Accept multi-leg RFQ quote"
      data-testid="rfq-multi-leg-accept-modal"
      data-phase={phase.kind}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-md rounded border border-zinc-800 bg-zinc-950 p-4 text-zinc-200 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[13px] font-semibold text-zinc-100">
            Accept multi-leg RFQ quote
          </h2>
          <button
            type="button"
            data-testid="rfq-multi-leg-accept-modal-close"
            onClick={onCancel}
            className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:border-red-500/60 hover:text-red-300"
          >
            Close
          </button>
        </div>

        <dl className="mt-3 grid grid-cols-[minmax(7.5rem,auto)_1fr] gap-x-3 gap-y-1.5 rounded border border-zinc-800 bg-black/40 p-3 text-[11px]">
          <dt className="text-zinc-500">RFQ id</dt>
          <dd
            data-testid="rfq-multi-leg-accept-modal-rfq-id"
            className="font-mono text-zinc-200"
          >
            {rfq.option_rfq_id}
          </dd>
          <dt className="text-zinc-500">Quote id</dt>
          <dd
            data-testid="rfq-multi-leg-accept-modal-quote-id"
            className="font-mono text-zinc-200"
          >
            {quote.quote_id}
          </dd>
          <dt className="text-zinc-500">Maker</dt>
          <dd
            data-testid="rfq-multi-leg-accept-modal-maker"
            className="font-mono text-zinc-300"
          >
            {shortAddr(quote.mm_account)}
          </dd>
          <dt className="text-zinc-500">Legs</dt>
          <dd
            data-testid="rfq-multi-leg-accept-modal-legs-count"
            className="font-mono text-zinc-200"
          >
            {quote.legs.length}
          </dd>
          <dt className="text-zinc-500">Package price</dt>
          <dd
            data-testid="rfq-multi-leg-accept-modal-package-price"
            className="font-mono text-zinc-200"
          >
            {fmt1e8Signed(quote.package_price_1e8)}
          </dd>
          <dt className="text-zinc-500">Size</dt>
          <dd
            data-testid="rfq-multi-leg-accept-modal-size"
            className="font-mono text-zinc-200"
          >
            {fmt1e8Signed(quote.size_1e8)}
          </dd>
        </dl>

        <div
          data-testid="rfq-multi-leg-accept-modal-legs"
          className="mt-2 rounded border border-zinc-800 bg-black/40 p-3 text-[11px]"
        >
          <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            Per-leg prices (byte-frozen)
          </div>
          <ul className="space-y-0.5">
            {sortedLegs.map((leg) => (
              <li
                key={leg.leg_index}
                data-testid={`rfq-multi-leg-accept-modal-leg-${leg.leg_index}`}
                className="flex justify-between font-mono text-zinc-300"
              >
                <span className="text-zinc-500">leg {leg.leg_index}</span>
                <span>{fmt1e8Signed(leg.price_1e8)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p
          data-testid="rfq-multi-leg-accept-modal-warning"
          className="mt-3 rounded border border-amber-500/40 bg-amber-500/5 px-2 py-1.5 text-[10px] text-amber-200"
        >
          Accepting a package quote executes the RFQ atomically. The
          signature covers the exact
          <code className="mx-1 rounded bg-black/40 px-1 text-emerald-300">
            OPTION_MULTI_LEG_RFQ_ACCEPT
          </code>
          canonical payload including every ordered per-leg price —
          never a blank cheque.
        </p>

        <p
          data-testid="rfq-multi-leg-accept-modal-phase"
          data-phase={phase.kind}
          className={
            phase.kind === "error" || phase.kind === "rejected"
              ? "mt-3 rounded border border-red-500/40 bg-red-500/5 px-2 py-1.5 text-[10px] text-red-300"
              : phase.kind === "success"
                ? "mt-3 rounded border border-emerald-500/40 bg-emerald-500/5 px-2 py-1.5 text-[10px] text-emerald-300"
                : "mt-3 rounded border border-zinc-800 bg-black/40 px-2 py-1.5 text-[10px] text-zinc-400"
          }
        >
          {phaseCopy}
        </p>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            data-testid="rfq-multi-leg-accept-modal-cancel"
            onClick={onCancel}
            disabled={inFlight}
            className="rounded border border-zinc-700 px-3 py-1 text-[11px] text-zinc-300 hover:border-red-500/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="rfq-multi-leg-accept-modal-confirm"
            onClick={onConfirm}
            disabled={inFlight || phase.kind === "success"}
            className={
              inFlight || phase.kind === "success"
                ? "cursor-not-allowed rounded bg-zinc-800 px-3 py-1 text-[11px] font-semibold text-zinc-500"
                : "rounded bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-zinc-950 hover:bg-emerald-400"
            }
          >
            {phase.kind === "success" ? "Accepted" : "Confirm & sign"}
          </button>
        </div>
      </div>
    </div>
  );
}
