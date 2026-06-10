"use client";

import { useState } from "react";
import { useProductDetails } from "@/hooks/trading";
import { ErrorState, LoadingState, EmptyState } from "@/components/ui";
import { CallPutToggle } from "./CallPutToggle";
import { StrikeExpirySelector } from "./StrikeExpirySelector";
import { TradeTicket } from "./TradeTicket";

export function OptionChain({ productId }: { productId: string }) {
  const { data, error, isLoading, refetch } = useProductDetails(productId);
  // Toggle is a manual control. Product cp is shown in the header; the
  // toggle starts as "call" and the user can override.
  const [side, setSide] = useState(true);
  const [seriesId, setSeriesId] = useState<string | null>(null);

  if (isLoading && !data) return <LoadingState label="Loading product…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  const product = data.data.product;
  const seriesIds = data.data.series_ids;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-lg font-semibold">{product.underlying_symbol ?? product.underlying}</div>
          <div className="text-xs text-zinc-500">
            expires {new Date(product.expiry_ms).toISOString().slice(0, 10)} ·{" "}
            {product.series_count} series
          </div>
        </div>
        <CallPutToggle value={side} onChange={setSide} />
      </div>

      {seriesIds.length === 0 ? (
        <EmptyState
          title="No series in this product"
          description="Series will appear when the protocol registers them on chain."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <StrikeExpirySelector
            seriesIds={seriesIds}
            selected={seriesId}
            onSelect={setSeriesId}
            resolveSeries={() => undefined}
          />
          <TradeTicket seriesId={seriesId} />
        </div>
      )}
    </div>
  );
}
