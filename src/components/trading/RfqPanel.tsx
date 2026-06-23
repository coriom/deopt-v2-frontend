"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import { isSigningEnabled } from "@/lib/eip712";
import {
  fetchSigningPayload,
  postSignatures,
  TradingApiError,
} from "@/lib/trading-api";
import {
  buildAuthorization,
  canonicalPayload,
  cv,
} from "@/lib/write-auth";
import {
  SigningStateModal,
  type SigningPhase,
} from "@/components/tx/SigningStateModal";
import { EmptyState } from "@/components/ui";

export function RfqPanel({ seriesId }: { seriesId: string | null }) {
  const { address, isExpectedChain, signTypedData } = useWallet();
  const [intentId, setIntentId] = useState("");
  const [phase, setPhase] = useState<SigningPhase>("idle");
  const [detail, setDetail] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);

  if (!seriesId) {
    return (
      <EmptyState
        title="No series selected"
        description="Pick a strike to sign an RFQ envelope."
      />
    );
  }

  const canSign =
    !!address && isExpectedChain && isSigningEnabled() && intentId.length > 0;

  const handleSign = async () => {
    if (!canSign) return;
    setModalOpen(true);
    setPhase("fetching_payload");
    setDetail("Fetching RFQ EIP-712 envelope…");
    let payload;
    try {
      payload = await fetchSigningPayload(intentId);
    } catch (e) {
      setPhase("backend_unavailable");
      setDetail((e as TradingApiError).message);
      return;
    }
    setPhase("awaiting_signature");
    setDetail("Approve the RFQ envelope in your wallet.");
    const res = await signTypedData({
      domain: payload.domain,
      primaryType: payload.primaryType,
      types: payload.types,
      message: payload.message,
    });
    if (!res.ok) {
      setPhase(res.reason === "rejected" ? "rejected" : "error");
      setDetail(res.message ?? res.reason);
      return;
    }
    setPhase("submitting");
    setDetail("Posting signature…");
    if (!address) {
      setPhase("error");
      setDetail("Wallet disconnected.");
      return;
    }
    try {
      // RFQ envelope is buyer or seller depending on role; backend
      // tells us which via `expected_signer`. UI posts buyer_signature
      // by default; counterparty submits the other side via their own UI.
      const authorization = await buildAuthorization({
        account: address,
        action: "OPTION_EXECUTION_INTENT_SIGNATURE_SUBMIT",
        canonical: canonicalPayload(
          "OPTION_EXECUTION_INTENT_SIGNATURE_SUBMIT",
          [
            ["submitter", cv.addr(address)],
            ["intent_id", cv.str(intentId)],
            ["role", cv.str("buyer")],
          ],
        ),
        signTypedData,
      });
      await postSignatures(intentId, {
        submitter: address,
        role: "buyer",
        buyer_signature: res.signature,
        authorization,
      });
      setPhase("submitted");
      setDetail("Backend accepted the RFQ signature.");
    } catch (e) {
      setPhase("backend_unavailable");
      setDetail((e as TradingApiError).message);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        RFQ flow: the taker creates the request via{" "}
        <code>POST /options/rfqs</code> (operator UI). The maker fetches
        the quote-signing payload and signs here.
      </p>
      <label className="text-xs">
        RFQ / execution intent id
        <input
          type="text"
          value={intentId}
          onChange={(e) => setIntentId(e.target.value)}
          placeholder="uuid-v4 from backend operator"
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 font-mono text-[10px] dark:border-zinc-700 dark:bg-zinc-900"
        />
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
                ? "Enter an intent id"
                : ""
        }
      >
        Sign RFQ envelope
      </button>
      <p className="text-[10px] text-zinc-500">
        No transaction is sent. The backend operator handles broadcast.
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
