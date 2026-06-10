"use client";

// All 14 trading hooks consolidated into one module. Each returns
// `{ data, error, isLoading, refetch }`. Polling intervals follow
// `~/DEOPT/deopt-v2-backend/docs/FRONTEND_TRADING_API_HANDOFF.md §6`.

import { useCallback, useEffect, useState } from "react";
import {
  fetchBalances,
  fetchExecutionIntent,
  fetchExecutorTransaction,
  fetchHistory,
  fetchPortfolio,
  fetchPositions,
  fetchProductDetail,
  fetchProducts,
  fetchProductsBatch,
  fetchQuotePreview,
  fetchSeriesDetails,
  fetchSigningPayload,
  fetchTradingHealth,
  postClosePreview,
  postExercisePreview,
  TradingApiError,
} from "@/lib/trading-api";
import type {
  BalancesData,
  ClosePreviewRequest,
  Envelope,
  ExecutionIntentStatus,
  ExecutorTransaction,
  ExercisePreviewData,
  ExercisePreviewRequest,
  HistoryData,
  NotReadyData,
  PortfolioData,
  PositionsData,
  ProductDetailData,
  ProductsBatchData,
  ProductsListData,
  QuotePreview,
  SeriesDetailData,
  SigningPayload,
  TradingHealthData,
} from "@/lib/trading-types";

export interface HookResult<T> {
  data: T | undefined;
  error: TradingApiError | undefined;
  isLoading: boolean;
  refetch: () => void;
}

interface UsePollOpts {
  refetchInterval?: number; // ms; 0 disables.
  enabled?: boolean;
}

function usePollingFetch<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<Envelope<T>>,
  opts?: UsePollOpts,
): HookResult<Envelope<T>> {
  const [data, setData] = useState<Envelope<T> | undefined>();
  const [error, setError] = useState<TradingApiError | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const enabled = opts?.enabled !== false;
  const interval = opts?.refetchInterval ?? 0;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setIsLoading(true);
    fetcher(controller.signal)
      .then((env) => {
        if (controller.signal.aborted) return;
        setData(env);
        setError(undefined);
      })
      .catch((e: TradingApiError) => {
        if (controller.signal.aborted) return;
        setError(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
    // We intentionally do NOT include `fetcher` in the dep array: the
    // `key` parameter is the single source of truth for "args changed";
    // including the fetcher itself would re-fire on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, tick]);

  useEffect(() => {
    if (!enabled || interval <= 0) return;
    const id = window.setInterval(() => setTick((t) => t + 1), interval);
    return () => window.clearInterval(id);
  }, [enabled, interval]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, isLoading, refetch };
}

export function useProducts(opts?: {
  underlying?: string;
  is_call?: boolean;
  include_inactive?: boolean;
}): HookResult<Envelope<ProductsListData>> {
  const key = `products:${opts?.underlying ?? ""}:${opts?.is_call ?? ""}:${opts?.include_inactive ?? ""}`;
  return usePollingFetch(
    key,
    (signal) =>
      fetchProducts({
        underlying: opts?.underlying,
        is_call: opts?.is_call,
        include_inactive: opts?.include_inactive,
        signal,
      }),
    { refetchInterval: 60_000 },
  );
}

export function useProductDetails(
  productId: string | null,
): HookResult<Envelope<ProductDetailData>> {
  return usePollingFetch(
    `product:${productId ?? ""}`,
    (signal) => fetchProductDetail(productId ?? "", signal),
    { enabled: !!productId, refetchInterval: 60_000 },
  );
}

export function useProductBatch(
  ids: string[],
): HookResult<Envelope<ProductsBatchData>> {
  return usePollingFetch(
    `products-batch:${ids.join(",")}`,
    (signal) => fetchProductsBatch(ids, signal),
    { enabled: ids.length > 0, refetchInterval: 60_000 },
  );
}

export function useSeriesDetails(
  seriesId: string | null,
): HookResult<Envelope<SeriesDetailData>> {
  return usePollingFetch(
    `series-details:${seriesId ?? ""}`,
    (signal) => fetchSeriesDetails(seriesId ?? "", signal),
    { enabled: !!seriesId, refetchInterval: 5_000 },
  );
}

export function useOrderbook(seriesId: string | null): HookResult<Envelope<SeriesDetailData>> {
  // Reuses series-details as the canonical orderbook source until M-P2b
  // wires `/options/orderbooks/:series_id` if a dedicated endpoint is desired.
  return useSeriesDetails(seriesId);
}

export function useQuotePreview(args: {
  series_id?: string;
  side?: "buy" | "sell";
  size?: string;
  price_1e8?: string;
  account?: string;
}): HookResult<Envelope<QuotePreview | NotReadyData>> {
  const ready =
    !!args.series_id && !!args.side && !!args.size && args.size.length > 0;
  return usePollingFetch(
    `quote:${args.series_id ?? ""}:${args.side ?? ""}:${args.size ?? ""}:${args.price_1e8 ?? ""}:${args.account ?? ""}`,
    (signal) =>
      fetchQuotePreview({
        series_id: args.series_id!,
        side: args.side!,
        size: args.size!,
        price_1e8: args.price_1e8,
        account: args.account,
        signal,
      }),
    { enabled: ready, refetchInterval: 0 },
  );
}

export function usePositions(
  address: string | null,
): HookResult<Envelope<PositionsData | NotReadyData>> {
  return usePollingFetch(
    `positions:${address ?? ""}`,
    (signal) => fetchPositions(address ?? "", signal),
    { enabled: !!address, refetchInterval: 30_000 },
  );
}

export function usePortfolio(
  address: string | null,
): HookResult<Envelope<PortfolioData | NotReadyData>> {
  return usePollingFetch(
    `portfolio:${address ?? ""}`,
    (signal) => fetchPortfolio(address ?? "", signal),
    { enabled: !!address, refetchInterval: 30_000 },
  );
}

export function useBalances(
  address: string | null,
): HookResult<Envelope<BalancesData | NotReadyData>> {
  return usePollingFetch(
    `balances:${address ?? ""}`,
    (signal) => fetchBalances(address ?? "", signal),
    { enabled: !!address, refetchInterval: 30_000 },
  );
}

export function useTradeHistory(
  address: string | null,
  opts?: { limit?: number; cursor?: string },
): HookResult<Envelope<HistoryData>> {
  return usePollingFetch(
    `history:${address ?? ""}:${opts?.limit ?? ""}:${opts?.cursor ?? ""}`,
    (signal) =>
      fetchHistory(address ?? "", {
        limit: opts?.limit,
        cursor: opts?.cursor,
        signal,
      }),
    { enabled: !!address, refetchInterval: 0 },
  );
}

// M-P3b: real polling against `/options/execution-intents/:id` AND
// `/executor/transactions/:intent_id`. Combined into a single hook
// surface for the UI to consume in TxStatusTimeline.
export interface TxStatusComposite {
  intent: ExecutionIntentStatus | null;
  tx: ExecutorTransaction | null;
}

export function useTxStatus(
  intentId: string | null,
): HookResult<TxStatusComposite> {
  const [data, setData] = useState<TxStatusComposite | undefined>();
  const [error, setError] = useState<TradingApiError | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!intentId) return;
    const controller = new AbortController();
    setIsLoading(true);
    (async () => {
      try {
        const intent = await fetchExecutionIntent(intentId, controller.signal).catch(
          () => null,
        );
        const tx = await fetchExecutorTransaction(intentId, controller.signal).catch(
          () => null,
        );
        if (controller.signal.aborted) return;
        setData({ intent, tx });
        setError(undefined);
      } catch (e: unknown) {
        if (controller.signal.aborted) return;
        setError(e as TradingApiError);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [intentId, tick]);

  // Poll every 2s while the intent is not yet terminal.
  useEffect(() => {
    if (!intentId) return;
    const terminal =
      data?.intent?.status === "CONFIRMED" ||
      data?.intent?.status === "REVERTED" ||
      data?.intent?.status === "STUCK";
    if (terminal) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 2_000);
    return () => window.clearInterval(id);
  }, [intentId, data?.intent?.status]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, isLoading, refetch };
}

/**
 * Fetch the backend-issued EIP-712 envelope for an execution intent.
 * One-shot (not polled). Use when the user clicks "Sign" in the trade
 * ticket.
 */
export function useSigningPayload(
  intentId: string | null,
): HookResult<SigningPayload> {
  const [data, setData] = useState<SigningPayload | undefined>();
  const [error, setError] = useState<TradingApiError | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!intentId) return;
    const controller = new AbortController();
    // setIsLoading via microtask so the effect body returns before
    // React processes the render — satisfies react-hooks/set-state-in-effect.
    Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
    });
    fetchSigningPayload(intentId, controller.signal)
      .then((p) => {
        if (controller.signal.aborted) return;
        setData(p);
        setError(undefined);
      })
      .catch((e: TradingApiError) => {
        if (controller.signal.aborted) return;
        setError(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [intentId, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, isLoading, refetch };
}

export function useExercisePreview(args: ExercisePreviewRequest | null): HookResult<
  Envelope<ExercisePreviewData | NotReadyData>
> {
  return usePollingFetch(
    `exercise:${args?.series_id ?? ""}:${args?.account ?? ""}`,
    (signal) =>
      postExercisePreview(
        { series_id: args!.series_id, account: args!.account },
        signal,
      ),
    { enabled: !!args, refetchInterval: 0 },
  );
}

export function useClosePreview(args: ClosePreviewRequest | null): HookResult<
  Envelope<QuotePreview | NotReadyData>
> {
  return usePollingFetch(
    `close:${args?.series_id ?? ""}:${args?.account ?? ""}:${args?.side ?? ""}:${args?.size ?? ""}:${args?.price_1e8 ?? ""}`,
    (signal) => postClosePreview(args!, signal),
    { enabled: !!args, refetchInterval: 0 },
  );
}

export function useTradingHealth(): HookResult<Envelope<TradingHealthData>> {
  return usePollingFetch(
    "trading-health",
    (signal) => fetchTradingHealth(signal),
    { refetchInterval: 60_000 },
  );
}
