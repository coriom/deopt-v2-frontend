"use client";

import { useTxStatus } from "@/hooks/trading";
import { ErrorState, LoadingState } from "@/components/ui";

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

export function TxStatusTimeline({ requestId }: { requestId: string }) {
  const { data, isLoading, error } = useTxStatus(requestId);

  if (isLoading && !data) return <LoadingState label="Loading tx status…" />;
  if (error) return <ErrorState error={error} />;

  const status = data?.intent?.status ?? "CREATED";
  const isTerminal = TERMINAL.has(status);
  const isReverted = status === "REVERTED";
  const isStuck = status === "STUCK";
  const currentIdx = stageIndex(status);

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2 text-xs">
        {STAGES.map((s, i) => {
          const isPast = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <li
              key={s}
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
          <li className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            REVERTED — {data?.tx?.reverted_reason ?? "no reason returned"}
          </li>
        )}
        {isStuck && (
          <li className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            STUCK — operator review pending
          </li>
        )}
      </ol>
      <dl className="grid grid-cols-2 gap-1 text-[10px] text-zinc-500">
        <dt>intent_id</dt>
        <dd className="text-right font-mono">{requestId}</dd>
        <dt>tx_hash</dt>
        <dd className="text-right font-mono">{data?.tx?.tx_hash ?? "—"}</dd>
        <dt>block</dt>
        <dd className="text-right font-mono">{data?.tx?.block_number ?? "—"}</dd>
        <dt>poll</dt>
        <dd className="text-right">{isTerminal ? "stopped (terminal)" : "every 2s"}</dd>
      </dl>
    </div>
  );
}
