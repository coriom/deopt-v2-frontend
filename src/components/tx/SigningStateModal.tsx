"use client";

export type SigningPhase =
  | "idle"
  | "fetching_payload"
  | "awaiting_signature"
  | "signed_ready"
  | "submitting"
  | "submitted"
  | "rejected"
  | "wrong_network"
  | "backend_unavailable"
  | "error";

export interface SigningStateModalProps {
  open: boolean;
  phase: SigningPhase;
  detail?: string;
  intentId?: string | null;
  onClose: () => void;
}

const PHASE_LABEL: Record<SigningPhase, string> = {
  idle: "Idle",
  fetching_payload: "Fetching signing payload…",
  awaiting_signature: "Approve the typed-data signature in your wallet",
  signed_ready: "Signed — preparing submission",
  submitting: "Submitting signature to backend…",
  submitted: "Signed and submitted",
  rejected: "Signature rejected in wallet",
  wrong_network: "Wrong network — switch to the testnet",
  backend_unavailable: "Backend submit endpoint unavailable",
  error: "Error",
};

const PHASE_COLOR: Record<SigningPhase, string> = {
  idle: "bg-zinc-400",
  fetching_payload: "bg-amber-500 animate-pulse",
  awaiting_signature: "bg-amber-500 animate-pulse",
  signed_ready: "bg-emerald-500",
  submitting: "bg-amber-500 animate-pulse",
  submitted: "bg-emerald-500",
  rejected: "bg-red-600",
  wrong_network: "bg-red-600",
  backend_unavailable: "bg-red-600",
  error: "bg-red-600",
};

export function SigningStateModal({
  open,
  phase,
  detail,
  intentId,
  onClose,
}: SigningStateModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded border border-zinc-300 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${PHASE_COLOR[phase]}`} />
          <div className="text-sm font-medium">{PHASE_LABEL[phase]}</div>
        </div>
        {detail && (
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{detail}</p>
        )}
        {intentId && (
          <dl className="mt-3 grid grid-cols-2 gap-1 text-[10px] text-zinc-500">
            <dt>intent_id</dt>
            <dd className="text-right font-mono">{intentId}</dd>
          </dl>
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
