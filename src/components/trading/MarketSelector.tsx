"use client";

import Link from "next/link";
import { useProducts } from "@/hooks/trading";
import { LoadingState } from "@/components/ui";
import { MarketsFallbackCard } from "./MarketsFallbackCard";
import type { Product } from "@/lib/trading-types";

function shortenId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function ProductCard({ p }: { p: Product }) {
  const expiry = new Date(p.expiry_ms).toISOString().slice(0, 10);
  const settlement = p.settlement_asset_symbol ?? "mUSDC";
  return (
    <Link
      key={p.product_id}
      href={`/markets/${p.product_id}`}
      data-testid={`product-card-${p.product_id}`}
      data-product-id={p.product_id}
      data-is-call={p.is_call ? "true" : "false"}
      className="group flex flex-col gap-2 rounded border border-zinc-800 bg-black/40 p-3 transition hover:border-emerald-500/50 hover:bg-emerald-500/5"
    >
      <div className="flex items-center justify-between">
        <span
          data-testid={`product-card-type-${p.product_id}`}
          className={`rounded px-2 py-0.5 text-[10px] font-medium ${
            p.is_call
              ? "border border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
              : "border border-zinc-600 bg-zinc-900 text-zinc-200"
          }`}
        >
          {p.is_call ? "CALL" : "PUT"}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
          testnet
        </span>
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-zinc-100">
          {p.underlying_symbol ?? p.underlying}
        </span>
        <span className="font-mono text-[10px] text-zinc-500">
          {shortenId(p.product_id)}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-1 text-[11px]">
        <dt className="text-zinc-500">Expiry</dt>
        <dd className="text-right text-zinc-200">{expiry}</dd>
        <dt className="text-zinc-500">Series</dt>
        <dd className="text-right text-zinc-200">{p.series_count}</dd>
        <dt className="text-zinc-500">Collateral</dt>
        <dd className="text-right text-zinc-200">{settlement}</dd>
        <dt className="text-zinc-500">Active</dt>
        <dd className="text-right text-zinc-200">
          {p.is_active_any ? "yes" : "—"}
        </dd>
      </dl>
      <span className="mt-1 text-[10px] text-emerald-300 group-hover:text-emerald-200">
        Open product →
      </span>
    </Link>
  );
}

export function MarketSelector() {
  const { data, error, isLoading, refetch } = useProducts();

  if (isLoading && !data) return <LoadingState label="Loading products…" />;
  if (error) {
    return (
      <MarketsFallbackCard
        kind="backend-unavailable"
        detail={`${error.code}: ${error.message}`}
        onRetry={refetch}
      />
    );
  }
  const products = data?.data.products ?? [];
  if (products.length === 0) {
    return <MarketsFallbackCard kind="no-products" onRetry={refetch} />;
  }
  const byUnderlying = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.underlying_symbol ?? p.underlying;
    const list = byUnderlying.get(key) ?? [];
    list.push(p);
    byUnderlying.set(key, list);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...byUnderlying.entries()].map(([key, list]) => (
        <div
          key={key}
          className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
        >
          <div className="mb-3 flex items-baseline justify-between">
            <div className="text-sm font-semibold tracking-tight text-emerald-200">
              {key}
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              {list.length} product{list.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <ProductCard key={p.product_id} p={p} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
