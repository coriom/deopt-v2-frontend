"use client";

import { useEffect, useState } from "react";
import { useTxStatus } from "@/hooks/trading";
import { ErrorState, LoadingState } from "@/components/ui";
import { ReportIssueButton } from "@/components/ReportIssueButton";
import { BASE_SEPOLIA } from "@/lib/chains";

const STAGES = [
  "CREATED",
  "SIGNING_PAYLOAD_ISSUED",
  "SIGNED",
  "SIMULATED_OK",
  "BROADCAST",
  "CONFIRMED",
] as const;

const TERMINAL = new Set(["CONFIRMED", "REVERTED", "STUCK"]);

function stageIndex(s: string | undefined): number {
  if (!s) return -1;
  const i = STAGES.indexOf(s as (typeof STAGES)[number]);
  return i;
}

function explorerTxUrl(txHash: string): string {
  return `${BASE_SEPOLIA.explorerUrl}/tx/${txHash}`;
}

export function TxStatusTimeline({ requestId }: { requestId: string }) {
  const { data, isLoading, error, refetch } = useTxStatus(requestId);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!data) return;
    Promise.resolve().then(() => setLastUpdatedAt(Date.now()));
  }, [data]);

  if (isLoading && !data) return <LoadingState label="Loading tx status…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const status = data?.intent?.status ?? "CREATED";
  const isTerminal = TERMINAL.has(status);
  const isReverted = status === "REVERTED";
  const isStuck = status === "STUCK";
  const isFailure = isReverted || isStuck;
  const currentIdx = stageIndex(status);
  const txHash = data?.tx?.tx_hash ?? null;

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2 text-xs">
        {STAGES.map((s, i) => {
          const isPast = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <li
              key={s}
              data-testid={`tx-stage-${s.toLowerCase()}`}
              data-state={isCurrent ? "current" : isPast ? "past" : "future"}
              className={`flex items-center gap-2 rounded border px-3 py-2 ${
                isCurrent
                  ? "border-zinc-900 bg-zinc-50 font-medium dark:border-zinc-100 dark:bg-zinc-800"
                  : isPast
                    ? "border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
                    : "border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isCurrent
                    ? "bg-emerald-500"
                    : isPast
                      ? "bg-zinc-400 dark:bg-zinc-500"
                      : "bg-zinc-300 dark:bg-zinc-700"
                }`}
              />
              {s}
            </li>
          );
        })}
        {isReverted && (
          <li
            data-testid="tx-reverted-banner"
            className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
          >
            REVERTED — {data?.tx?.reverted_reason ?? "no reason returned"}
          </li>
        )}
        {isStuck && (
          <li
            data-testid="tx-stuck-banner"
            className="rounded border border-emerald-500/40 bg-zinc-950 px-3 py-2 text-xs text-emerald-200"
          >
            STUCK — operator review pending
          </li>
        )}
      </ol>

      <dl className="grid grid-cols-2 gap-1 text-[10px] text-zinc-500">
        <dt>intent_id</dt>
        <dd
          data-testid="tx-intent-id"
          className="text-right font-mono"
        >
          {requestId}
        </dd>
        <dt>tx_hash</dt>
        <dd className="flex items-center justify-end gap-1 text-right font-mono">
          {txHash ? (
            <>
              <a
                href={explorerTxUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="tx-explorer-link"
                data-explorer="sepolia.basescan.org"
                className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                title="Open on sepolia.basescan.org (Base Sepolia testnet)"
              >
                {txHash.slice(0, 10)}…{txHash.slice(-6)}
              </a>
              <button
                type="button"
                data-testid="tx-copy-hash-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(txHash);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    // clipboard may be unavailable; selection still works
                  }
                }}
                className="rounded border border-zinc-800 px-1 py-0 text-[9px] text-zinc-200 hover:border-emerald-500/50 hover:bg-emerald-500/5"
                title="Copy tx hash to clipboard"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </>
          ) : (
            "—"
          )}
        </dd>
        <dt>block</dt>
        <dd className="text-right font-mono">
          {data?.tx?.block_number ?? "—"}
        </dd>
        <dt>poll</dt>
        <dd className="text-right">
          {isTerminal ? "stopped (terminal)" : "every 2s"}
        </dd>
        <dt>indexer / reconciliation</dt>
        <dd
          data-testid="tx-reconciliation-status"
          className="text-right"
        >
          {data?.tx ? "events observed" : "awaiting executor"}
        </dd>
        <dt>last refreshed at</dt>
        <dd
          data-testid="tx-last-refreshed-at"
          className="text-right font-mono"
        >
          {lastUpdatedAt ? new Date(lastUpdatedAt).toISOString() : "—"}
        </dd>
      </dl>

      {txHash && status !== "CONFIRMED" && !isFailure && (
        <div
          data-testid="tx-backend-trailing-notice"
          className="rounded border border-emerald-500/30 bg-zinc-950 p-2 text-[11px] text-emerald-200"
        >
          The on-chain transaction is observable on{" "}
          <strong className="text-emerald-300">sepolia.basescan.org</strong>;
          the backend indexer may briefly trail real-time. If the explorer
          shows the trade settled but this page still polls, that&apos;s the
          indexer catching up — your funds (testnet mocks) are not at risk.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          data-testid="tx-refresh-button"
          onClick={refetch}
          className="rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-zinc-200 hover:border-emerald-500/50 hover:bg-emerald-500/5"
        >
          Refresh
        </button>
        {isFailure && (
          <ReportIssueButton
            txHash={txHash}
            intentId={requestId}
            label="Report this failure"
            variant="primary"
          />
        )}
      </div>
    </div>
  );
}
