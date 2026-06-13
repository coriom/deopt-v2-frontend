"use client";

import { useState } from "react";
import { useProductDetails } from "@/hooks/trading";
import { ErrorState, LoadingState, EmptyState } from "@/components/ui";
import { CallPutToggle } from "./CallPutToggle";
import { StrikeExpirySelector } from "./StrikeExpirySelector";
import { TradeTicket } from "./TradeTicket";

export function OptionChain({ productId }: { productId: string }) {
  const { data, error, isLoading, refetch } = useProductDetails(productId);
  const [side, setSide] = useState(true);
  const [seriesId, setSeriesId] = useState<string | null>(null);

  if (isLoading && !data) return <LoadingState label="Loading product…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  const product = data.data.product;
  const seriesIds = data.data.series_ids;
  const expiry = new Date(product.expiry_ms).toISOString().slice(0, 10);
  const settlement = product.settlement_asset_symbol ?? "mUSDC";

  return (
    <section
      data-testid="option-chain"
      className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              data-testid="option-chain-type-badge"
              className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                product.is_call
                  ? "border border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                  : "border border-zinc-600 bg-zinc-900 text-zinc-200"
              }`}
            >
              {product.is_call ? "CALL" : "PUT"}
            </span>
            <span className="text-lg font-semibold tracking-tight text-zinc-100">
              {product.underlying_symbol ?? product.underlying}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
            <span>expires {expiry}</span>
            <span className="text-zinc-700">·</span>
            <span>{product.series_count} series</span>
            <span className="text-zinc-700">·</span>
            <span>collateral {settlement}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-emerald-300">testnet only</span>
          </div>
        </div>
        <CallPutToggle value={side} onChange={setSide} />
      </header>

      {seriesIds.length === 0 ? (
        <EmptyState
          title="No series in this product"
          description="Series will appear when the protocol registers them on chain. Ping the operator on Discord if this state persists."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
              Pick a series
            </h3>
            <StrikeExpirySelector
              seriesIds={seriesIds}
              selected={seriesId}
              onSelect={setSeriesId}
              resolveSeries={() => undefined}
            />
          </div>
          <TradeTicket seriesId={seriesId} />
        </div>
      )}
    </section>
  );
}
