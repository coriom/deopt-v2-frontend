// Trading API fetch client.
//
// Public reads against the M-P2a backend. **No admin Bearer.** The
// `Authorization` header is NOT set by this client; trading routes do
// not accept or require it.
//
// Base URL: `NEXT_PUBLIC_TRADING_API_BASE_URL` (defaults to
// `http://localhost:3000` for a local backend; or `http://localhost:4010`
// for a prism mock against the OpenAPI spec — see
// `docs/TRADING_UI_MOCK_API_RUNBOOK.md`).

import type {
  BalancesData,
  Envelope,
  ErrorEnvelope,
  ExecutionIntentStatus,
  ExecutorTransaction,
  ExercisePreviewData,
  ExercisePreviewRequest,
  ClosePreviewRequest,
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
  SubmitSignaturesRequest,
  SubmitSignaturesResponse,
  TradingErrorCode,
  TradingHealthData,
} from "./trading-types";

export class TradingApiError extends Error {
  code: TradingErrorCode | "NETWORK" | "PARSE";
  status: number;
  request_id?: string;
  constructor(opts: {
    code: TradingErrorCode | "NETWORK" | "PARSE";
    message: string;
    status: number;
    request_id?: string;
  }) {
    super(opts.message);
    this.code = opts.code;
    this.status = opts.status;
    this.request_id = opts.request_id;
  }
}

export function tradingApiBaseUrl(): string {
  if (typeof process !== "undefined") {
    const v = process.env.NEXT_PUBLIC_TRADING_API_BASE_URL;
    if (v && v.length > 0) return v.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<Envelope<T>> {
  const url = `${tradingApiBaseUrl()}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      cache: "no-store",
    });
  } catch (e) {
    throw new TradingApiError({
      code: "NETWORK",
      message: `Network error: ${(e as Error).message}`,
      status: 0,
    });
  }
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text.length ? JSON.parse(text) : {};
  } catch {
    throw new TradingApiError({
      code: "PARSE",
      message: `Backend returned non-JSON response`,
      status: res.status,
    });
  }
  if (!res.ok) {
    const env = parsed as Partial<ErrorEnvelope>;
    throw new TradingApiError({
      code: env.error?.code ?? "INTERNAL_ERROR",
      message: env.error?.message ?? `HTTP ${res.status}`,
      status: res.status,
      request_id: env.meta?.request_id,
    });
  }
  return parsed as Envelope<T>;
}

// ---------------------------------------------------------------------
// Products / Series
// ---------------------------------------------------------------------

export function fetchProducts(opts?: {
  underlying?: string;
  is_call?: boolean;
  include_inactive?: boolean;
  signal?: AbortSignal;
}): Promise<Envelope<ProductsListData>> {
  const qs = new URLSearchParams();
  if (opts?.underlying) qs.set("underlying", opts.underlying);
  if (opts?.is_call !== undefined) qs.set("is_call", String(opts.is_call));
  if (opts?.include_inactive) qs.set("include_inactive", "true");
  const suffix = qs.toString().length ? `?${qs.toString()}` : "";
  return request<ProductsListData>(
    "GET",
    `/options/products${suffix}`,
    undefined,
    opts?.signal,
  );
}

export function fetchProductDetail(
  productId: string,
  signal?: AbortSignal,
): Promise<Envelope<ProductDetailData>> {
  return request<ProductDetailData>(
    "GET",
    `/options/products/${productId}`,
    undefined,
    signal,
  );
}

export function fetchProductsBatch(
  ids: string[],
  signal?: AbortSignal,
): Promise<Envelope<ProductsBatchData>> {
  const qs = new URLSearchParams({ ids: ids.join(",") });
  return request<ProductsBatchData>(
    "GET",
    `/options/products/batch?${qs.toString()}`,
    undefined,
    signal,
  );
}

export function fetchSeriesDetails(
  seriesId: string,
  signal?: AbortSignal,
): Promise<Envelope<SeriesDetailData>> {
  return request<SeriesDetailData>(
    "GET",
    `/options/series/${seriesId}/details`,
    undefined,
    signal,
  );
}

// ---------------------------------------------------------------------
// Quote / Exercise / Close previews
// ---------------------------------------------------------------------

export function fetchQuotePreview(opts: {
  series_id: string;
  side: "buy" | "sell";
  size: string;
  price_1e8?: string;
  account?: string;
  signal?: AbortSignal;
}): Promise<Envelope<QuotePreview | NotReadyData>> {
  const qs = new URLSearchParams({
    series_id: opts.series_id,
    side: opts.side,
    size: opts.size,
  });
  if (opts.price_1e8) qs.set("price_1e8", opts.price_1e8);
  if (opts.account) qs.set("account", opts.account);
  return request<QuotePreview | NotReadyData>(
    "GET",
    `/options/quotes/preview?${qs.toString()}`,
    undefined,
    opts.signal,
  );
}

export function postExercisePreview(
  req: ExercisePreviewRequest,
  signal?: AbortSignal,
): Promise<Envelope<ExercisePreviewData | NotReadyData>> {
  return request<ExercisePreviewData | NotReadyData>(
    "POST",
    `/options/exercise/preview`,
    req,
    signal,
  );
}

export function postClosePreview(
  req: ClosePreviewRequest,
  signal?: AbortSignal,
): Promise<Envelope<QuotePreview | NotReadyData>> {
  return request<QuotePreview | NotReadyData>(
    "POST",
    `/options/close/preview`,
    req,
    signal,
  );
}

// ---------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------

export function fetchPositions(
  address: string,
  signal?: AbortSignal,
): Promise<Envelope<PositionsData | NotReadyData>> {
  return request<PositionsData | NotReadyData>(
    "GET",
    `/accounts/${address}/positions`,
    undefined,
    signal,
  );
}

export function fetchPortfolio(
  address: string,
  signal?: AbortSignal,
): Promise<Envelope<PortfolioData | NotReadyData>> {
  return request<PortfolioData | NotReadyData>(
    "GET",
    `/accounts/${address}/portfolio`,
    undefined,
    signal,
  );
}

export function fetchBalances(
  address: string,
  signal?: AbortSignal,
): Promise<Envelope<BalancesData | NotReadyData>> {
  return request<BalancesData | NotReadyData>(
    "GET",
    `/accounts/${address}/balances`,
    undefined,
    signal,
  );
}

export function fetchHistory(
  address: string,
  opts?: { limit?: number; cursor?: string; signal?: AbortSignal },
): Promise<Envelope<HistoryData>> {
  const qs = new URLSearchParams();
  if (opts?.limit) qs.set("limit", String(opts.limit));
  if (opts?.cursor) qs.set("cursor", opts.cursor);
  const suffix = qs.toString().length ? `?${qs.toString()}` : "";
  return request<HistoryData>(
    "GET",
    `/accounts/${address}/history${suffix}`,
    undefined,
    opts?.signal,
  );
}

// ---------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------

export function fetchTradingHealth(
  signal?: AbortSignal,
): Promise<Envelope<TradingHealthData>> {
  return request<TradingHealthData>("GET", `/trading/health`, undefined, signal);
}

// ---------------------------------------------------------------------
// M-P3b — Signing / intent / tx status
//
// These endpoints exist on the backend (`/options/execution-intents/*`,
// `/executor/transactions/*`) but were not yet consumed by the trading
// UI in M-P3. They are public reads / wallet-signed writes; the trading
// client does NOT attach an admin Bearer. The frontend NEVER calls
// `/options/execution-intents/:id/broadcast` — that endpoint is
// operator-side and frontend code paths intentionally cannot reach it.
// ---------------------------------------------------------------------

/**
 * NOTE: the M-P3b backend response shape for some of these endpoints
 * is not yet enveloped (they predate the M-P2a envelope convention).
 * The frontend client wraps the raw response into a minimal Envelope
 * so the hook layer stays uniform; M-P2c will harmonise.
 */
async function rawRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const url = `${tradingApiBaseUrl()}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      cache: "no-store",
    });
  } catch (e) {
    throw new TradingApiError({
      code: "NETWORK",
      message: `Network error: ${(e as Error).message}`,
      status: 0,
    });
  }
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text.length ? JSON.parse(text) : {};
  } catch {
    throw new TradingApiError({
      code: "PARSE",
      message: `Backend returned non-JSON response`,
      status: res.status,
    });
  }
  if (!res.ok) {
    const env = parsed as { error?: string };
    throw new TradingApiError({
      code: "INTERNAL_ERROR",
      message: env.error ?? `HTTP ${res.status}`,
      status: res.status,
    });
  }
  return parsed as T;
}

export function fetchSigningPayload(
  intentId: string,
  signal?: AbortSignal,
): Promise<SigningPayload> {
  return rawRequest<SigningPayload>(
    "GET",
    `/options/execution-intents/${intentId}/signing-payload`,
    undefined,
    signal,
  );
}

export function postSignatures(
  intentId: string,
  body: SubmitSignaturesRequest,
  signal?: AbortSignal,
): Promise<SubmitSignaturesResponse> {
  return rawRequest<SubmitSignaturesResponse>(
    "POST",
    `/options/execution-intents/${intentId}/signatures`,
    body,
    signal,
  );
}

export function fetchExecutionIntent(
  intentId: string,
  signal?: AbortSignal,
): Promise<ExecutionIntentStatus> {
  return rawRequest<ExecutionIntentStatus>(
    "GET",
    `/options/execution-intents/${intentId}`,
    undefined,
    signal,
  );
}

export function fetchExecutorTransaction(
  intentId: string,
  signal?: AbortSignal,
): Promise<ExecutorTransaction | null> {
  return rawRequest<ExecutorTransaction | null>(
    "GET",
    `/executor/transactions/${intentId}`,
    undefined,
    signal,
  );
}
