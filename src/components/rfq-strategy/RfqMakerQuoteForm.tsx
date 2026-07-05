"use client";

import { useCallback, useState } from "react";
import type { Address } from "viem";
import {
  getOptionsRfqQuoteSigningPayload,
  submitOptionsRfqQuote,
  TradingApiError,
  type OptionRfqQuoteResponse,
  type OptionRfqResponse,
} from "@/lib/trading-api";
import {
  buildAuthorization,
  canonical,
  type SignTypedDataFn,
} from "@/lib/write-auth";
import { useWallet } from "@/lib/wallet";

interface RfqMakerQuoteFormProps {
  rfq: OptionRfqResponse;
  /** Called on successful backend submit (with the backend-confirmed
   *  quote). Parent bumps `refreshNonce` so the quote list refetches
   *  from the real backend — the form NEVER inserts an optimistic row. */
  onSubmitted: (quote: OptionRfqQuoteResponse) => void;
}

type Phase =
  | { kind: "idle" }
  | { kind: "fetching_payload" }
  | { kind: "awaiting_maker_signature" }
  | { kind: "requesting_challenge" }
  | { kind: "awaiting_write_auth_signature" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "rejected"; message: string }
  | { kind: "error"; message: string };

const DEFAULT_QUOTE_TTL_MS = 10_000;

function randomU64Nonce(): number {
  // 53-bit safe integer is sufficient for backend uniqueness on
  // Base Sepolia testnet. Backend accepts u64.
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

// Convert `price` and `size` decimal string inputs into `1e8`
// integer strings deterministically (no float noise for common
// inputs like `250.5`).
function decimalTo1e8(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const padded = (frac + "00000000").slice(0, 8);
  const big = BigInt(whole) * BigInt("100000000") + BigInt(padded || "0");
  if (big < BigInt("0")) return null;
  return big.toString();
}

export function RfqMakerQuoteForm({ rfq, onSubmitted }: RfqMakerQuoteFormProps) {
  const wallet = useWallet();
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const inFlight =
    phase.kind === "fetching_payload" ||
    phase.kind === "awaiting_maker_signature" ||
    phase.kind === "requesting_challenge" ||
    phase.kind === "awaiting_write_auth_signature" ||
    phase.kind === "submitting";

  // ---- Blockers surfaced honestly in the CTA disabled-tooltip ----
  const walletBlocker: string | null = (() => {
    if (!wallet.hasProvider) return "Connect a Base Sepolia wallet to quote.";
    if (!wallet.address) return "Connect your wallet to quote.";
    if (wallet.isMainnet) return "Mainnet is disabled — switch to Base Sepolia.";
    if (!wallet.isExpectedChain) return "Wrong network — switch to Base Sepolia.";
    return null;
  })();

  const roleBlocker: string | null = (() => {
    if (!wallet.address) return null;
    if (wallet.address.toLowerCase() === rfq.taker.toLowerCase()) {
      return "You are the RFQ taker — makers only.";
    }
    return null;
  })();

  const rfqBlocker: string | null =
    rfq.status !== "Open" ? `RFQ is ${rfq.status.toLowerCase()} — quotes only accepted while Open.` : null;

  const price1e8 = decimalTo1e8(price);
  const size1e8 = decimalTo1e8(size);
  const inputBlocker: string | null = (() => {
    if (!price || !price1e8 || BigInt(price1e8) <= BigInt("0"))
      return "Price must be a positive number.";
    if (!size || !size1e8 || BigInt(size1e8) <= BigInt("0"))
      return "Size must be a positive number.";
    if (BigInt(size1e8) > BigInt(rfq.size_1e8))
      return "Size cannot exceed the RFQ's requested size.";
    return null;
  })();

  const anyBlocker =
    walletBlocker ?? roleBlocker ?? rfqBlocker ?? inputBlocker ?? null;

  const submit = useCallback(async () => {
    if (anyBlocker || !wallet.address || !price1e8 || !size1e8) return;
    const rfqId = rfq.option_rfq_id;
    const nonce = randomU64Nonce();
    const ttlMs = DEFAULT_QUOTE_TTL_MS;

    try {
      // 1. Fetch the exact EIP-712 typed data the maker must sign.
      setPhase({ kind: "fetching_payload" });
      const payload = await getOptionsRfqQuoteSigningPayload(rfqId, {
        mm_account: wallet.address,
        price_1e8: price1e8,
        size_1e8: size1e8,
        client_quote_id: null,
        quote_nonce: nonce,
        quote_ttl_ms: ttlMs,
      });

      // 2. Ask the wallet to sign the maker quote EIP-712 payload.
      //    The backend's `types` array is in `{ name, type }` form
      //    (via `#[serde(rename = "type")]`), so it plugs into
      //    viem's `signTypedData` after wrapping in
      //    `{ [primaryType]: fields }`.
      setPhase({ kind: "awaiting_maker_signature" });
      const makerSig = await wallet.signTypedData({
        domain: {
          name: payload.domain.name,
          version: payload.domain.version,
          chainId: payload.domain.chainId,
          verifyingContract: payload.domain.verifyingContract as Address,
        },
        types: {
          [payload.primary_type]: payload.types.map((t) => ({
            name: t.name,
            type: t.type,
          })),
        },
        primaryType: payload.primary_type,
        message: {
          ...payload.message,
        },
      });
      if (!makerSig.ok) {
        setPhase({
          kind: "rejected",
          message: `Maker signature declined: ${makerSig.reason}`,
        });
        return;
      }

      // 3. Build the write-auth envelope for OPTION_RFQ_QUOTE_SUBMIT.
      const canonicalBytes = canonical.optionRfqQuoteSubmit({
        optionRfqId: rfqId,
        mmAccount: wallet.address,
        price1e8,
        size1e8,
        clientQuoteId: null,
        quoteNonce: nonce,
        quoteTtlMs: ttlMs,
      });
      setPhase({ kind: "requesting_challenge" });
      const signTypedForAuth: SignTypedDataFn = async (args) => {
        setPhase({ kind: "awaiting_write_auth_signature" });
        return wallet.signTypedData(args);
      };

      let authorization;
      try {
        authorization = await buildAuthorization({
          account: wallet.address,
          action: "OPTION_RFQ_QUOTE_SUBMIT",
          canonical: canonicalBytes,
          signTypedData: signTypedForAuth,
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

      // 4. Submit the signed quote to the backend.
      setPhase({ kind: "submitting" });
      const response = await submitOptionsRfqQuote(rfqId, {
        mm_account: wallet.address,
        session_id: null,
        client_quote_id: null,
        price_1e8: price1e8,
        size_1e8: size1e8,
        quote_nonce: nonce,
        quote_ttl_ms: ttlMs,
        signature: makerSig.signature,
        authorization,
      });
      setPhase({ kind: "success" });
      // Reset form for the next quote; parent triggers list refresh.
      setPrice("");
      setSize("");
      onSubmitted(response);
    } catch (e) {
      setPhase({
        kind: "error",
        message:
          e instanceof TradingApiError
            ? e.message
            : (e as Error).message || "Submit Quote failed.",
      });
    }
  }, [anyBlocker, wallet, price1e8, size1e8, rfq.option_rfq_id, onSubmitted]);

  const phaseLine = (() => {
    switch (phase.kind) {
      case "idle":
        return "You are signing a maker quote for this RFQ.";
      case "fetching_payload":
        return "Fetching quote-signing payload from backend…";
      case "awaiting_maker_signature":
        return "Awaiting maker EIP-712 signature (OptionRFQQuote) — check your wallet.";
      case "requesting_challenge":
        return "Requesting write-authorization challenge…";
      case "awaiting_write_auth_signature":
        return "Awaiting write-authorization signature (OPTION_RFQ_QUOTE_SUBMIT).";
      case "submitting":
        return "Submitting quote to backend…";
      case "success":
        return "Quote submitted. Book list will refresh from backend.";
      case "rejected":
        return `Signature rejected. ${phase.message}`;
      case "error":
        return `Submit failed: ${phase.message}`;
    }
  })();

  return (
    <div
      data-testid="rfq-strategy-maker-quote-form"
      data-phase={phase.kind}
      className="flex flex-col gap-2 rounded border border-zinc-800 bg-zinc-950 p-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          Submit maker quote
        </span>
        <span
          data-testid="rfq-strategy-maker-quote-role-note"
          className="text-[9px] text-zinc-500"
        >
          Signature covers exact quote payload — no blank cheque.
        </span>
      </div>

      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <label className="flex flex-col gap-1 text-[9px] uppercase tracking-[0.14em] text-zinc-500">
          Price
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={inFlight}
            data-testid="rfq-strategy-maker-quote-price"
            placeholder="e.g. 2500"
            className="rounded border border-zinc-800 bg-black/40 px-2 py-1 text-right font-mono text-[11px] normal-case tracking-normal text-zinc-100 focus:border-emerald-500/60 focus:outline-none disabled:opacity-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-[9px] uppercase tracking-[0.14em] text-zinc-500">
          Size
          <input
            type="text"
            inputMode="decimal"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            disabled={inFlight}
            data-testid="rfq-strategy-maker-quote-size"
            placeholder="e.g. 1"
            className="rounded border border-zinc-800 bg-black/40 px-2 py-1 text-right font-mono text-[11px] normal-case tracking-normal text-zinc-100 focus:border-emerald-500/60 focus:outline-none disabled:opacity-40"
          />
        </label>
        <button
          type="button"
          data-testid="rfq-strategy-maker-quote-submit"
          data-mode={anyBlocker ? "disabled" : "ready"}
          disabled={!!anyBlocker || inFlight}
          onClick={submit}
          title={anyBlocker ?? undefined}
          className={
            anyBlocker || inFlight
              ? "cursor-not-allowed self-end rounded bg-zinc-800 px-3 py-1 text-[11px] font-semibold text-zinc-500"
              : "self-end rounded bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-zinc-950 hover:bg-emerald-400"
          }
        >
          Submit Quote
        </button>
      </div>

      <p
        data-testid="rfq-strategy-maker-quote-phase"
        data-phase={phase.kind}
        className={
          phase.kind === "error" || phase.kind === "rejected"
            ? "rounded border border-red-500/40 bg-red-500/5 px-2 py-1 text-[10px] text-red-300"
            : phase.kind === "success"
              ? "rounded border border-emerald-500/40 bg-emerald-500/5 px-2 py-1 text-[10px] text-emerald-300"
              : "text-[10px] text-zinc-500"
        }
      >
        {phaseLine}
      </p>

      {anyBlocker && (
        <p
          data-testid="rfq-strategy-maker-quote-blocker"
          className="text-[10px] text-amber-400"
        >
          {anyBlocker}
        </p>
      )}
      <p className="text-[9px] text-zinc-600">
        Quote submission does not guarantee execution; the taker must accept
        it in the Book tab.
      </p>
    </div>
  );
}
