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
import {
  useSelectedLegs,
  useSelectedOption,
} from "@/lib/workspace-selected-option";
import { legKey, type SelectedOptionLeg } from "@/lib/execution-mode";
import { underlyingDisplaySymbol } from "@/lib/underlying-symbols";
import { scaled1e8ToHuman } from "@/lib/price-scaling";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { useChainColumnPrefs } from "@/hooks/useChainColumnPrefs";
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
  const { legs, addOrToggleLeg } = useSelectedLegs();
  const chainPrefs = useChainColumnPrefs();

  const selectedLegKeys = useMemo(
    () => new Set(legs.map((l) => legKey(l))),
    [legs],
  );

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
  // Auto-select the nearest available expiry once expiries load. The
  // former "All" pill (which mapped `null` → show every expiry) was
  // retired for visual polish, so `null` would leave the grid empty
  // until the user clicks; auto-picking the earliest expiry keeps the
  // grid populated on first load. Users can still switch expiries via
  // the pill row.
  useEffect(() => {
    if (expiryPick !== null) return;
    if (expiries.length === 0) return;
    const first = expiries[0].ms;
    Promise.resolve().then(() => setExpiryPick(first));
  }, [expiryPick, expiries]);
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
        className="flex flex-wrap items-center gap-3 rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[11px]"
      >
        <NativeSelect
          aria-label="Underlying"
          value={underlyingKey ?? ""}
          onChange={(e) => {
            setUnderlyingKey(e.target.value);
            setSelected(null);
            setExpiryPick(null);
          }}
          data-testid="underlying-select"
          variant="ghost"
        >
          {underlyings.map((u) => (
            <option key={u.key} value={u.key} className="bg-zinc-950 text-zinc-100">
              {u.label}
            </option>
          ))}
        </NativeSelect>
        <ExpirySelector
          expiries={expiries}
          selected={expiryPick}
          onSelect={setExpiryPick}
        />
        {/* OPTIONS-CHAIN-WIDGET-MENU-V1 — the column-visibility
            hamburger that used to live here (`ChainColumnsMenu`)
            moved into the widget's kebab (⋮) menu, wired through
            `WidgetDef.MenuActions` on the `options-chain` registry
            entry. The grid still consumes `chainPrefs` directly. */}
      </header>
      <OptionsChainGrid
        rows={visibleRows}
        selectedSeriesId={selected?.leg.seriesId ?? null}
        selectedLegKeys={selectedLegKeys}
        prefs={chainPrefs}
        onSelect={(leg, row) =>
          setSelected({ leg, row, productId: leg.productId })
        }
        onCellAction={({ leg, row, columnId }) => {
          if (leg.seriesId === null) return;
          if (columnId !== "bid" && columnId !== "ask") return;
          const sourcePriceSide = columnId;
          const sideForOrder = columnId === "ask" ? "buy" : "sell";
          const displayPrice =
            columnId === "bid"
              ? leg.bid !== null && leg.bidAvail === "live"
                ? leg.bid
                : undefined
              : leg.ask !== null && leg.askAvail === "live"
                ? leg.ask
                : undefined;
          const productLike = filteredProducts.find(
            (p) => p.product_id === leg.productId,
          );
          const underlyingLabel = productLike
            ? underlyingDisplaySymbol(
                productLike.underlying,
                productLike.underlying_symbol,
              )
            : "";
          const nextLeg: SelectedOptionLeg = {
            seriesId: leg.seriesId,
            underlying: underlyingLabel,
            expiry: row.expiryLabel,
            strike: row.strikeLabel,
            optionType: leg.isCall ? "call" : "put",
            side: sideForOrder,
            sourcePriceSide,
            displayPrice: displayPrice
              ? scaled1e8ToHuman(displayPrice)
              : undefined,
            ratio: "1",
            productId: leg.productId,
          };
          addOrToggleLeg(nextLeg);
          setSelected({ leg, row, productId: leg.productId });
        }}
      />
    </div>
  );
}
