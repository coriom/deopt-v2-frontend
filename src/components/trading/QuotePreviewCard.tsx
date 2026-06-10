"use client";

import { useQuotePreview } from "@/hooks/trading";
import { useWallet } from "@/lib/wallet";
import { ErrorState, LoadingState } from "@/components/ui";
import type { NotReadyData, QuotePreview } from "@/lib/trading-types";

function isQuote(x: QuotePreview | NotReadyData): x is QuotePreview {
  return !("not_ready" in x);
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
    return (
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
        <div className="font-medium">Quote preview not yet wired</div>
        <p className="mt-1">{payload.reason}</p>
      </div>
    );
  }
  return (
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
  );
}
