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
 *      the backend endpoint is pending, an amber notice + the
 *      legacy paste-intent_id input is shown)
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
  const { address, isExpectedChain, signTypedData } = useWallet();
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
    !!address && isExpectedChain && isSigningEnabled() && intentId.length > 0;

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
    <div className="flex flex-col gap-3 rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <OrderbookPanel seriesId={seriesId} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSide("buy")}
          className={`flex-1 rounded px-2 py-1 text-xs ${
            side === "buy" ? "bg-emerald-600 text-white" : "border border-zinc-300 dark:border-zinc-700"
          }`}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => setSide("sell")}
          className={`flex-1 rounded px-2 py-1 text-xs ${
            side === "sell" ? "bg-red-600 text-white" : "border border-zinc-300 dark:border-zinc-700"
          }`}
        >
          Sell
        </button>
      </div>
      <label className="text-xs">
        Size
        <input
          type="text"
          inputMode="numeric"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="text-xs">
        Limit price (1e8)
        <input
          type="text"
          inputMode="numeric"
          value={price1e8}
          onChange={(e) => setPrice1e8(e.target.value)}
          placeholder="optional"
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <QuotePreviewCard
        seriesId={seriesId}
        side={side}
        size={size}
        price_1e8={price1e8 || undefined}
      />
      <div className="flex flex-col gap-2 rounded border border-zinc-200 p-2 dark:border-zinc-800">
        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
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
            className="rounded border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
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
        <label className="text-xs">
          Execution intent id
          <input
            type="text"
            value={intentId}
            onChange={(e) => setIntentId(e.target.value)}
            placeholder="auto-filled when backend creates it"
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 font-mono text-[10px] dark:border-zinc-700 dark:bg-zinc-900"
            data-testid="intent-id-input"
          />
          <p className="mt-1 text-[10px] text-zinc-500">
            On success, the field auto-fills from the backend response.
            Manual paste remains supported for operator-side flows.
          </p>
        </label>
      </div>
      <div className="flex flex-col gap-2 rounded border border-zinc-200 p-2 dark:border-zinc-800">
        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Step 2 — Sign typed data
        </div>
        <button
          type="button"
          disabled={!canSign}
          onClick={() => void handleSign()}
          className="rounded bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          data-testid="sign-button"
          title={
            !address
              ? "Connect your wallet"
              : !isExpectedChain
                ? "Switch to the expected testnet"
                : intentId.length === 0
                  ? "Create or paste an execution intent id"
                  : ""
          }
        >
          Sign typed data
        </button>
        <p className="text-[10px] text-zinc-500">
          Clicking opens your wallet for an EIP-712 typed-data signature.
          Nothing is broadcast from the UI; the backend operator handles
          broadcast after both buyer + seller sign.
        </p>
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
