"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet";
import { useSeriesDetails } from "@/hooks/trading";
import { isSigningEnabled, adaptSigningPayload } from "@/lib/eip712";
import {
  fetchSigningPayload,
  postSignatures,
  TradingApiError,
} from "@/lib/trading-api";
import { OrderbookPanel } from "./OrderbookPanel";
import { QuotePreviewCard } from "./QuotePreviewCard";
import { CreateIntentButton } from "./CreateIntentButton";
import { RoleReadinessCard } from "./RoleReadinessCard";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui";
import {
  SigningStateModal,
  type SigningPhase,
} from "@/components/tx/SigningStateModal";

/**
 * M-P3c — Trade-ticket flow:
 *
 *   1. user selects series + side + size + (optional) price
 *   2. QuotePreviewCard renders the partial-real preview
 *   3. user clicks Create intent — backend mints intent_id (or, if
 *      the backend endpoint is pending, an emerald-bordered notice
 *      + the legacy paste-intent_id input is shown)
 *   4. user clicks Sign typed data — frontend fetches the signing
 *      payload, opens the wallet, surfaces rejection / network /
 *      typed-data errors via the modal
 *   5. on signature success, frontend posts the signature to backend
 *      and navigates to /transactions/:intentId
 *
 *   * No auto-sign.
 *   * No broadcast from the frontend.
 *   * No admin Bearer.
 *   * Mainnet is hard-gated by `useWallet().isExpectedChain`.
 */
export function TradeTicket({ seriesId }: { seriesId: string | null }) {
  const router = useRouter();
  const { address, isExpectedChain, isMainnet, signTypedData } = useWallet();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState("1");
  const [price1e8, setPrice1e8] = useState("");
  const [intentId, setIntentId] = useState("");

  const [phase, setPhase] = useState<SigningPhase>("idle");
  const [detail, setDetail] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [createPendingMessage, setCreatePendingMessage] = useState<string | null>(
    null,
  );

  const { data, isLoading, error, refetch } = useSeriesDetails(seriesId);

  if (!seriesId) {
    return (
      <EmptyState
        title="Pick a series"
        description="Choose a strike from the chain to load the trade ticket."
      />
    );
  }
  if (isLoading && !data) return <LoadingState label="Loading series…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const canSign =
    !!address &&
    isExpectedChain &&
    !isMainnet &&
    isSigningEnabled() &&
    intentId.length > 0;

  const signBlockerReason = !address
    ? "Connect your wallet to sign"
    : isMainnet
      ? "Mainnet is permanently disabled — switch to Base Sepolia"
      : !isExpectedChain
        ? "Wrong network — switch your wallet to Base Sepolia"
        : intentId.length === 0
          ? "Create or paste an execution intent id"
          : null;

  const handleSign = async () => {
    if (!canSign) return;
    setModalOpen(true);
    setPhase("fetching_payload");
    setDetail("Fetching EIP-712 envelope from backend…");
    let payload;
    try {
      payload = await fetchSigningPayload(intentId);
    } catch (e) {
      setPhase("backend_unavailable");
      setDetail((e as TradingApiError).message);
      return;
    }
    if (!payload?.types || !payload?.domain) {
      setPhase("backend_unavailable");
      setDetail("Backend returned an empty signing-payload");
      return;
    }
    const typed = adaptSigningPayload(payload);
    setPhase("awaiting_signature");
    setDetail("Approve in your wallet (no transaction will be sent).");
    const result = await signTypedData(typed);
    if (!result.ok) {
      if (result.reason === "rejected") {
        setPhase("rejected");
        setDetail(result.message ?? "User rejected in wallet.");
        return;
      }
      if (result.reason === "wrong_network") {
        setPhase("wrong_network");
        setDetail("Switch to the expected testnet to sign.");
        return;
      }
      setPhase("error");
      setDetail(result.message ?? "Signing failed");
      return;
    }
    setPhase("submitting");
    setDetail("Posting signature to backend…");
    // The frontend posts ONLY the signer's signature. The other party's
    // signature (counterparty) is posted by their UI; the backend
    // composes both before broadcast. The trading UI NEVER triggers
    // broadcast itself.
    const body =
      side === "buy"
        ? { buyer_signature: result.signature }
        : { seller_signature: result.signature };
    try {
      await postSignatures(intentId, body);
      setPhase("submitted");
      setDetail("Backend accepted the signature. Operator will broadcast.");
      // Navigate to the tx-status page once submitted.
      router.push(`/transactions/${intentId}`);
    } catch (e) {
      setPhase("backend_unavailable");
      setDetail((e as TradingApiError).message);
    }
  };

  return (
    <div
      data-testid="trade-ticket"
      className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3"
    >
      <RoleReadinessCard side={side} />
      <OrderbookPanel seriesId={seriesId} />
      <div className="flex flex-col gap-1">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          Side
        </div>
        <div className="flex gap-2" role="group" aria-label="Trade side">
          <button
            type="button"
            onClick={() => setSide("buy")}
            data-testid="side-buy"
            data-selected={side === "buy" ? "true" : "false"}
            className={`flex-1 rounded px-2 py-1.5 text-xs font-medium ${
              side === "buy"
                ? "border border-emerald-500/60 bg-emerald-500 text-black"
                : "border border-zinc-800 bg-black/40 text-zinc-200 hover:border-emerald-500/40"
            }`}
          >
            Buy (long)
          </button>
          <button
            type="button"
            onClick={() => setSide("sell")}
            data-testid="side-sell"
            data-selected={side === "sell" ? "true" : "false"}
            className={`flex-1 rounded px-2 py-1.5 text-xs font-medium ${
              side === "sell"
                ? "border border-red-500/60 bg-red-950/60 text-red-100"
                : "border border-zinc-800 bg-black/40 text-zinc-200 hover:border-red-500/40"
            }`}
          >
            Sell (short)
          </button>
        </div>
        <p
          data-testid="trade-side-microcopy"
          className="text-[10px] leading-relaxed text-zinc-400"
        >
          {side === "buy"
            ? "Buyer (long): pay the premium up front. No mUSDC collateral required to open the long."
            : "Seller (short): post mUSDC collateral to cover the short. Receive premium on settlement."}
        </p>
      </div>
      <label className="text-xs text-zinc-300">
        Size
        <input
          type="text"
          inputMode="numeric"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          data-testid="trade-size-input"
          className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
        />
      </label>
      <label className="text-xs text-zinc-300">
        Limit price (1e8)
        <input
          type="text"
          inputMode="numeric"
          value={price1e8}
          onChange={(e) => setPrice1e8(e.target.value)}
          placeholder="optional"
          data-testid="trade-price-input"
          className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
        />
      </label>
      <QuotePreviewCard
        seriesId={seriesId}
        side={side}
        size={size}
        price_1e8={price1e8 || undefined}
      />
      <div className="flex flex-col gap-2 rounded border border-zinc-800 bg-black/40 p-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200">
          Step 1 — Create intent
        </div>
        <CreateIntentButton
          request={{
            series_id: seriesId,
            side,
            size_1e8: size,
            price_1e8: price1e8 || "0",
            buyer: side === "buy" ? (address ?? undefined) : undefined,
            seller: side === "sell" ? (address ?? undefined) : undefined,
          }}
          disabled={!address || !isExpectedChain}
          onIntentCreated={(id) => {
            setIntentId(id);
            setCreatePendingMessage(null);
          }}
          onBackendPending={(msg) => {
            setCreatePendingMessage(msg);
            setPhase("intent_pending");
            setDetail(msg);
            setModalOpen(true);
          }}
          onCreateError={(err) => {
            setCreatePendingMessage(null);
            setPhase("error");
            setDetail(err.message);
            setModalOpen(true);
          }}
        />
        {createPendingMessage && (
          <div
            className="rounded border border-emerald-500/30 bg-zinc-950 p-2 text-[10px] text-emerald-200"
            data-testid="create-intent-pending-notice"
          >
            <p className="font-medium">Backend create-intent endpoint pending.</p>
            <p className="mt-1">{createPendingMessage}</p>
            <p className="mt-1">
              Paste an intent_id below — the M-P4c local-test fixture
              and operator-side flows still mint intents.
            </p>
          </div>
        )}
        <label className="text-xs text-zinc-300">
          Execution intent id
          <input
            type="text"
            value={intentId}
            onChange={(e) => setIntentId(e.target.value)}
            placeholder="auto-filled when backend creates it"
            className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-[10px] text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
            data-testid="intent-id-input"
          />
          <p className="mt-1 text-[10px] text-zinc-500">
            On success, the field auto-fills from the backend response.
            Manual paste remains supported for operator-side flows.
          </p>
        </label>
      </div>
      <div className="flex flex-col gap-2 rounded border border-zinc-800 bg-black/40 p-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200">
          Step 2 — Sign typed data
        </div>
        <button
          type="button"
          disabled={!canSign}
          onClick={() => void handleSign()}
          className="rounded bg-emerald-500 px-3 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          data-testid="sign-button"
          title={signBlockerReason ?? ""}
        >
          Sign typed data
        </button>
        {signBlockerReason && (
          <p
            data-testid="sign-blocker-reason"
            className="text-[10px] text-emerald-300"
          >
            {signBlockerReason}
          </p>
        )}
        <ul
          data-testid="sign-microcopy"
          className="ml-3 list-disc text-[10px] leading-relaxed text-zinc-400"
        >
          <li>
            <strong className="text-zinc-200">Your wallet signs typed data.</strong>{" "}
            Nothing is broadcast from your wallet.
          </li>
          <li>
            The operator-side executor submits the testnet transaction on{" "}
            <strong className="text-emerald-300">Base Sepolia (chain 84532)</strong>{" "}
            after both buyer + seller signatures are collected.
          </li>
          <li>
            Settlement happens on chain via the canonical matching engine.{" "}
            <strong className="text-zinc-200">No real funds.</strong>
          </li>
        </ul>
      </div>
      <SigningStateModal
        open={modalOpen}
        phase={phase}
        detail={detail}
        intentId={intentId || null}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
