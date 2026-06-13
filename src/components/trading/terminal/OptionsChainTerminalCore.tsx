"use client";

// Chain-only variant of OptionsChainTerminal. Publishes selection
// through SelectedOptionProvider context so other widgets (detail
// panel, payoff) can subscribe. NO embedded detail panel. NO embedded
// bottom dock — those are separate widgets in the workspace.

import { useEffect, useMemo, useState } from "react";
import { useProducts, useProductDetails, useSeriesDetails } from "@/hooks/trading";
import { LoadingState } from "@/components/ui";
import { MarketsFallbackCard } from "@/components/trading/MarketsFallbackCard";
import {
  buildOptionsChain,
  distinctExpiries,
  distinctUnderlyings,
  filterByExpiry,
} from "@/lib/options-chain-model";
import type { Product, Series, SeriesId } from "@/lib/trading-types";
import { useSelectedOption } from "@/lib/workspace-selected-option";
import { ExpirySelector } from "./ExpirySelector";
import { OptionsChainGrid } from "./OptionsChainGrid";

function useSeriesById(seriesIds: SeriesId[]) {
  const [target, setTarget] = useState<SeriesId | null>(null);
  const { data } = useSeriesDetails(target);
  const [byId, setById] = useState<Map<SeriesId, Series>>(new Map());

  useEffect(() => {
    if (!data) return;
    const s = data.data?.series;
    if (!s) return;
    Promise.resolve().then(() => {
      setById((prev) => {
        if (prev.has(s.series_id)) return prev;
        const next = new Map(prev);
        next.set(s.series_id, s);
        return next;
      });
    });
  }, [data]);

  useEffect(() => {
    const next = seriesIds.find((sid) => !byId.has(sid));
    if (next && next !== target) {
      Promise.resolve().then(() => setTarget(next));
    }
  }, [seriesIds, byId, target]);

  return byId;
}

export function OptionsChainTerminalCore() {
  const products = useProducts();
  const { selected, setSelected } = useSelectedOption();

  const allProducts = useMemo<Product[]>(
    () => products.data?.data.products ?? [],
    [products.data],
  );
  const underlyings = useMemo(() => distinctUnderlyings(allProducts), [allProducts]);
  const [underlyingKey, setUnderlyingKey] = useState<string | null>(null);

  useEffect(() => {
    if (underlyingKey !== null) return;
    if (allProducts.length === 0) return;
    const next = allProducts[0].underlying;
    Promise.resolve().then(() => setUnderlyingKey(next));
  }, [underlyingKey, allProducts]);

  const filteredProducts = useMemo(
    () =>
      underlyingKey === null
        ? allProducts
        : allProducts.filter((p) => p.underlying === underlyingKey),
    [allProducts, underlyingKey],
  );

  const firstProductId = filteredProducts[0]?.product_id ?? null;
  const firstDetail = useProductDetails(firstProductId);
  const secondProductId = filteredProducts[1]?.product_id ?? null;
  const secondDetail = useProductDetails(secondProductId);

  type ProductWithSeries = Product & { series_ids?: SeriesId[] };
  const productsForChain: ProductWithSeries[] = useMemo(() => {
    const out: ProductWithSeries[] = [];
    if (firstDetail.data) {
      out.push({
        ...firstDetail.data.data.product,
        series_ids: firstDetail.data.data.series_ids,
      });
    }
    if (secondDetail.data) {
      out.push({
        ...secondDetail.data.data.product,
        series_ids: secondDetail.data.data.series_ids,
      });
    }
    return out;
  }, [firstDetail.data, secondDetail.data]);

  const allSeriesIds = useMemo(() => {
    const s = new Set<SeriesId>();
    for (const p of productsForChain) {
      for (const sid of p.series_ids ?? []) s.add(sid);
    }
    return [...s];
  }, [productsForChain]);

  const seriesById = useSeriesById(allSeriesIds);

  const chainRows = useMemo(
    () => buildOptionsChain(productsForChain, seriesById),
    [productsForChain, seriesById],
  );

  const expiries = useMemo(() => distinctExpiries(chainRows), [chainRows]);
  const [expiryPick, setExpiryPick] = useState<number | null>(null);
  const visibleRows = useMemo(
    () => filterByExpiry(chainRows, expiryPick),
    [chainRows, expiryPick],
  );

  if (products.isLoading && !products.data) {
    return <LoadingState label="Loading options chain…" />;
  }
  if (products.error) {
    return (
      <MarketsFallbackCard
        kind="backend-unavailable"
        detail={`${products.error.code}: ${products.error.message}`}
        onRetry={products.refetch}
      />
    );
  }
  if (allProducts.length === 0) {
    return <MarketsFallbackCard kind="no-products" onRetry={products.refetch} />;
  }

  return (
    <div data-testid="options-chain-core" className="flex flex-col gap-2">
      <header
        data-testid="terminal-header"
        className="flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-500/30 bg-zinc-950 px-3 py-1.5 text-[11px]"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">
            Options · v1
          </span>
          <div role="tablist" aria-label="Underlying" className="flex flex-wrap gap-1">
            {underlyings.map((u) => (
              <button
                key={u.key}
                type="button"
                role="tab"
                aria-selected={underlyingKey === u.key}
                onClick={() => {
                  setUnderlyingKey(u.key);
                  setSelected(null);
                  setExpiryPick(null);
                }}
                data-testid={`underlying-pill-${u.label}`}
                data-selected={underlyingKey === u.key ? "true" : "false"}
                className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
                  underlyingKey === u.key
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                    : "border-zinc-800 bg-black/40 text-zinc-300 hover:border-emerald-500/40"
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
        <ExpirySelector
          expiries={expiries}
          selected={expiryPick}
          onSelect={setExpiryPick}
        />
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span data-testid="terminal-stat-chain">chain 84532</span>
          <span>·</span>
          <span>Base Sepolia testnet</span>
          <span>·</span>
          <span className="text-emerald-300">no real funds</span>
        </div>
      </header>
      <OptionsChainGrid
        rows={visibleRows}
        selectedSeriesId={selected?.leg.seriesId ?? null}
        onSelect={(leg, row) =>
          setSelected({ leg, row, productId: leg.productId })
        }
      />
    </div>
  );
}
