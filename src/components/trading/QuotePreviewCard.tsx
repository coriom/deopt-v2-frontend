"use client";

import { useQuotePreview } from "@/hooks/trading";
import { useWallet } from "@/lib/wallet";
import { ErrorState, LoadingState } from "@/components/ui";
import type { NotReadyData, QuotePreview } from "@/lib/trading-types";

function isQuote(x: QuotePreview | NotReadyData): x is QuotePreview {
  return !("not_ready" in x);
}

/**
 * Reasons surfaced as friendly inline messages instead of the generic
 * ErrorState card. Keeps the testnet "this is expected on Sepolia"
 * copy consistent across the trading UI.
 */
function friendlyNotReady(reason: string): { title: string; body: string } {
  const code = reason.toUpperCase();
  if (code.includes("ORACLE_UNAVAILABLE") || code.includes("STALE")) {
    return {
      title: "Oracle price is stale",
      body:
        "The testnet mock oracle has a 60 s freshness window. Wait a moment and retry — the operator will refresh the price shortly. Do NOT sign while the quote shows stale oracle.",
    };
  }
  if (code.includes("SOURCE_UNAVAILABLE")) {
    return {
      title: "Backend data source is starting up",
      body:
        "One of the backend data sources is not ready yet. This is normal during testnet warm-up. Retry in a moment.",
    };
  }
  if (code.includes("RPC_UNAVAILABLE")) {
    return {
      title: "Backend can't reach the chain RPC",
      body:
        "The backend can't currently reach Base Sepolia. This is a backend-side issue, not your wallet — try again shortly.",
    };
  }
  return {
    title: "Quote preview not yet ready",
    body: reason,
  };
}

export function QuotePreviewCard({
  seriesId,
  side,
  size,
  price_1e8,
}: {
  seriesId: string | null;
  side: "buy" | "sell";
  size: string;
  price_1e8?: string;
}) {
  const { address } = useWallet();
  const { data, error, isLoading, refetch } = useQuotePreview({
    series_id: seriesId ?? undefined,
    side,
    size,
    price_1e8,
    account: address ?? undefined,
  });
  if (!seriesId || size.length === 0) return null;
  if (isLoading && !data) return <LoadingState label="Computing quote…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  const payload = data.data;
  if (!isQuote(payload)) {
    const f = friendlyNotReady(payload.reason ?? "");
    return (
      <div
        data-testid="quote-not-ready"
        data-reason={payload.reason ?? ""}
        className="rounded border border-emerald-500/30 bg-zinc-950 p-3 text-xs text-emerald-200"
      >
        <div className="font-medium">{f.title}</div>
        <p className="mt-1">{f.body}</p>
        <button
          type="button"
          onClick={refetch}
          className="mt-2 rounded border border-emerald-500/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200 hover:bg-emerald-500/10"
        >
          Retry quote
        </button>
      </div>
    );
  }
  const warnings = data.warnings ?? [];
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-2 rounded border border-zinc-200 bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
        <dt className="text-zinc-500">Premium</dt>
        <dd className="text-right font-mono">{payload.premium ?? "—"}</dd>
        <dt className="text-zinc-500">Buyer fee</dt>
        <dd className="text-right font-mono">
          {payload.buyer_fee?.amount ?? "—"} ({payload.buyer_fee?.ppm_signed ?? "—"} ppm)
        </dd>
        <dt className="text-zinc-500">Seller fee</dt>
        <dd className="text-right font-mono">
          {payload.seller_fee?.amount ?? "—"} ({payload.seller_fee?.ppm_signed ?? "—"} ppm)
        </dd>
        <dt className="text-zinc-500">Oracle mark</dt>
        <dd className="text-right font-mono">{payload.oracle_mark_1e8 ?? "—"}</dd>
        <dt className="text-zinc-500">IM impact</dt>
        <dd className="text-right font-mono">{payload.im_impact ?? "—"}</dd>
        <dt className="text-zinc-500">Free coll. after</dt>
        <dd className="text-right font-mono">{payload.free_collateral_after ?? "—"}</dd>
        <dt className="col-span-2 text-[10px] text-zinc-400">
          Expires{" "}
          {payload.quote_expires_at_ms
            ? new Date(payload.quote_expires_at_ms).toISOString()
            : "—"}
        </dt>
      </dl>
      {data.status === "partial" && (
        <div
          data-testid="quote-partial-warning"
          className="rounded border border-emerald-500/30 bg-zinc-950 p-2 text-[11px] text-emerald-200"
        >
          Quote returned <strong>partial</strong>. Some fields may be missing
          or based on a stale oracle reading. Do NOT sign against a stale
          quote — the resulting transaction will revert on chain.
          {warnings.length > 0 && (
            <ul className="ml-4 mt-1 list-disc">
              {warnings.map((w, i) => (
                <li key={i}>
                  {typeof w === "string" ? w : (w.code ?? w.message ?? "warning")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
