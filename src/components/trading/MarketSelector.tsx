"use client";

import Link from "next/link";
import { useProducts } from "@/hooks/trading";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import type { Product } from "@/lib/trading-types";

export function MarketSelector() {
  const { data, error, isLoading, refetch } = useProducts();

  if (isLoading && !data) return <LoadingState label="Loading products…" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const products = data?.data.products ?? [];
  if (products.length === 0) {
    return (
      <EmptyState
        title="No products available"
        description="The backend has no option products configured for this chain yet."
      />
    );
  }
  // Group by underlying for visual organisation.
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
          className="rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {key}
          </div>
          <div className="flex flex-wrap gap-2">
            {list.map((p) => (
              <Link
                key={p.product_id}
                href={`/markets/${p.product_id}`}
                className="rounded border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <span className="font-medium">{p.is_call ? "Call" : "Put"}</span>
                <span className="ml-2 text-zinc-500">
                  expiry {new Date(p.expiry_ms).toISOString().slice(0, 10)}
                </span>
                <span className="ml-2 text-zinc-500">
                  {p.series_count} series
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
