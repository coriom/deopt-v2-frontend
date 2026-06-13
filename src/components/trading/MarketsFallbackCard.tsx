"use client";

import { ReportIssueButton } from "@/components/ReportIssueButton";
import { findPublicBetaLink, isPlaceholderHref } from "@/lib/public-beta-links";

export type MarketsFallbackKind =
  | "backend-unavailable" // network error, /options/products refused
  | "no-products"; // backend responded but the registry has no products

export interface MarketsFallbackCardProps {
  kind: MarketsFallbackKind;
  /** Human-friendly detail from the underlying error/source. */
  detail?: string;
  onRetry?: () => void;
}

const COPY: Record<
  MarketsFallbackKind,
  { title: string; body: string; hint: string }
> = {
  "backend-unavailable": {
    title: "Trading backend temporarily unavailable",
    body: "We can't reach the testnet trading backend right now. This is expected during testnet warm-up or operator-side restarts — nothing on chain is affected.",
    hint: "Retry in a moment, or ping the operator in the public feedback channel.",
  },
  "no-products": {
    title: "No active testnet markets available right now",
    body: "The on-chain registry returned no active option products. The operator may be refreshing the oracle or registering a new series.",
    hint: "Retry shortly. If the empty state persists, the community channel is the fastest way to ask.",
  },
};

/**
 * Modern dark-green fallback for the Markets section. Used when the
 * backend is unreachable or there are no products. Surfaces a Retry
 * button, the shared Report-Issue button, and the live Discord link
 * (when configured). Mentions the testnet-only posture without
 * shouting in red.
 */
export function MarketsFallbackCard({
  kind,
  detail,
  onRetry,
}: MarketsFallbackCardProps) {
  const copy = COPY[kind];
  const discord = findPublicBetaLink("discord");
  const discordLive =
    !!discord?.href && !isPlaceholderHref(discord.href);

  return (
    <div
      data-testid="markets-fallback-card"
      data-kind={kind}
      className="flex flex-col gap-4 rounded-lg border border-emerald-500/30 bg-zinc-950 p-5 text-zinc-100 shadow-[0_0_0_1px_rgba(16,185,129,0.05)]"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30" />
          <h3 className="text-sm font-semibold tracking-tight text-emerald-100">
            {copy.title}
          </h3>
        </div>
        <p className="text-xs leading-relaxed text-zinc-300">{copy.body}</p>
        <p className="text-[11px] leading-relaxed text-zinc-400">{copy.hint}</p>
        {detail && (
          <p className="font-mono text-[10px] text-zinc-500">{detail}</p>
        )}
      </div>

      <details
        data-testid="markets-fallback-preview"
        className="rounded border border-zinc-800 bg-black/40 p-3 text-[11px] text-zinc-300"
      >
        <summary className="cursor-pointer font-medium text-zinc-200">
          What you&apos;ll see here once the backend is back
        </summary>
        <ul className="mt-2 ml-4 list-disc text-zinc-400">
          <li>Active option series (calls / puts on Base Sepolia).</li>
          <li>Quote preview — premium, fees, oracle mark.</li>
          <li>Oracle freshness status (60 s maxDelay on testnet).</li>
          <li>Trade ticket for two-sided EIP-712 signatures.</li>
        </ul>
        <p className="mt-2 text-[10px] text-zinc-500">
          Public testnet beta — Base Sepolia (chain 84532) only. Unaudited.
          Experimental. No real funds.
        </p>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            data-testid="markets-fallback-retry"
            className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-emerald-400"
          >
            Retry
          </button>
        )}
        <ReportIssueButton label="Report issue" variant="ghost" />
        {discordLive && discord && (
          <a
            href={discord.href}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="markets-fallback-community"
            className="rounded border border-emerald-500/50 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/10"
          >
            Check Discord
          </a>
        )}
      </div>
    </div>
  );
}
