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
import { LoadingState, EmptyState, ErrorState } from "@/components/ui";
import {
  SigningStateModal,
  type SigningPhase,
} from "@/components/tx/SigningStateModal";

/**
 * Demo intent id input — until M-P2c wires a real "create intent" endpoint
 * that issues the intent_id from a quoted trade, we collect the intent_id
 * directly. The user obtains it from the backend operator (or anvil dev
 * harness in E2E).
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
      <label className="text-xs">
        Execution intent id
        <input
          type="text"
          value={intentId}
          onChange={(e) => setIntentId(e.target.value)}
          placeholder="e.g. uuid-v4 from backend operator"
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 font-mono text-[10px] dark:border-zinc-700 dark:bg-zinc-900"
        />
        <p className="mt-1 text-[10px] text-zinc-500">
          M-P3b: provide the intent id created by the backend operator.
          The frontend never auto-creates intents nor broadcasts.
        </p>
      </label>
      <button
        type="button"
        disabled={!canSign}
        onClick={() => void handleSign()}
        className="rounded bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        title={
          !address
            ? "Connect your wallet"
            : !isExpectedChain
              ? "Switch to the expected testnet"
              : intentId.length === 0
                ? "Enter an execution intent id"
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
