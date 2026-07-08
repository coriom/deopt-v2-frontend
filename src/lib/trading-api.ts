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
  ConditionalOrderResponse,
  CreateConditionalOrderRequest,
  Envelope,
  ErrorEnvelope,
  ExecutionIntentStatus,
  ExecutorTransaction,
  ExercisePreviewData,
  ExercisePreviewRequest,
  ClosePreviewRequest,
  HistoryData,
  NotReadyData,
  OptionOrderAttachmentPlan,
  PortfolioData,
  PositionsData,
  ProductDetailData,
  ProductsBatchData,
  ProductsListData,
  QuotePreview,
  SeriesDetailData,
  SigningPayload,
  SubmitOptionOrderRequest,
  SubmitOptionOrderResponse,
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

// FRONTEND-BACKEND-HISTORY-V1 — tabbed history payload.
export type HistoryTab =
  | "trades"
  | "transactions"
  | "orders"
  | "settlement"
  | "funding"
  | "interest"
  | "liquidations";

export type HistoryRange =
  | "last_day"
  | "last_week"
  | "last_month"
  | "last_quarter"
  | "all";

export interface HistoryV2Item {
  time_ms: number;
  instrument?: string;
  side?: string;
  amount?: string;
  price?: string;
  total?: string;
  pnl?: string;
  fees?: string;
  status?: string;
  kind?: string;
  role?: string;
  tx_hash?: string;
  asset?: string;
  action?: string;
  block?: number;
  gas?: string;
  order_type?: string;
  limit_price?: string;
  filled?: string;
  settlement_type?: string;
  market?: string;
  position?: string;
  rate?: string;
  payment?: string;
  principal?: string;
  interest?: string;
  size?: string;
  liquidation_price?: string;
  penalty?: string;
  // HISTORY-V2-FAILURE-REASONS-V1 — only populated on the Orders tab;
  // the frontend `deriveOrderReason` helper combines this with
  // `status` and `order_type` (= TIF) to surface a user-facing
  // "Post-only would immediately match" / "IOC remainder cancelled"
  // / etc. label for terminal-non-success rows.
  post_only?: boolean;
  // HISTORY-V2-TERMINAL-REASONS-V1 — persisted terminal reason fields.
  // When present the frontend uses these in preference to TIF-derived
  // inference. `terminal_reason_code` is a snake_case token
  // (`user_cancelled`, `ioc_remainder_cancelled`, …);
  // `terminal_reason_source` records where the transition was authored
  // (`user`, `tif_policy`, `system`).
  terminal_reason_code?: string;
  terminal_reason_message?: string;
  terminal_reason_source?: string;
}

export interface HistoryV2Data {
  address: string;
  chain: string;
  chain_id: number;
  range: string;
  tab: string;
  page: number;
  page_size: number;
  total_records: number;
  items: HistoryV2Item[];
}

export function fetchHistoryV2(
  address: string,
  opts: {
    tab: HistoryTab;
    range: HistoryRange;
    page: number;
    pageSize: number;
    /**
     * SUBACCOUNTS-FRONTEND-SWITCHER-V1 — active subaccount to filter
     * on. Omit for the default (backend defaults to subaccount 1).
     * Pass `all: true` to opt into the wallet-aggregate view.
     */
    subaccountId?: number;
    all?: boolean;
    signal?: AbortSignal;
  },
): Promise<Envelope<HistoryV2Data>> {
  const qs = new URLSearchParams();
  qs.set("tab", opts.tab);
  qs.set("range", opts.range);
  qs.set("page", String(opts.page));
  qs.set("page_size", String(opts.pageSize));
  if (opts.all) {
    qs.set("all", "true");
  } else if (opts.subaccountId !== undefined) {
    qs.set("subaccount_id", String(opts.subaccountId));
  }
  return request<HistoryV2Data>(
    "GET",
    `/accounts/${address}/history/v2?${qs.toString()}`,
    undefined,
    opts.signal,
  );
}

// FRONTEND-BACKEND-LEADERBOARD-V1.
export interface LeaderboardItem {
  rank: number;
  address: string;
  trade_count: number;
  volume_1e8: string;
  realized_pnl_1e8?: string;
}

export interface LeaderboardData {
  chain: string;
  chain_id: number;
  range: string;
  page: number;
  page_size: number;
  total_records: number;
  items: LeaderboardItem[];
}

export function fetchLeaderboard(opts: {
  range: HistoryRange;
  page: number;
  pageSize: number;
  signal?: AbortSignal;
}): Promise<Envelope<LeaderboardData>> {
  const qs = new URLSearchParams();
  qs.set("range", opts.range);
  qs.set("page", String(opts.page));
  qs.set("page_size", String(opts.pageSize));
  return request<LeaderboardData>(
    "GET",
    `/leaderboard?${qs.toString()}`,
    undefined,
    opts.signal,
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
  method: "GET" | "POST" | "DELETE" | "PATCH",
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

/**
 * M-P3c — Frontend create-intent request body. Maps the trade ticket
 * inputs to the operator-side `/options/execution-intents` POST
 * surface. When the backend does NOT expose a public create endpoint
 * (current behaviour as of M-P2e — only operator services and the
 * M-P4c `/admin/test/execution-intents` fixture surface mint
 * intents), `createExecutionIntent` resolves with a
 * `BACKEND_ENDPOINT_PENDING` envelope so the UI can degrade to its
 * legacy manual-intent-id paste path.
 */
export interface CreateExecutionIntentRequest {
  series_id: string;
  side: "buy" | "sell";
  size_1e8: string;
  price_1e8: string;
  buyer?: string;
  seller?: string;
}

export interface CreateExecutionIntentSuccess {
  status: "ok";
  data: { intent_id: string; status: string };
}

export interface CreateExecutionIntentPending {
  status: "pending";
  /** Stable code so UI can switch on it. */
  code: "BACKEND_ENDPOINT_PENDING";
  message: string;
}

export type CreateExecutionIntentResult =
  | CreateExecutionIntentSuccess
  | CreateExecutionIntentPending;

/**
 * Attempt to mint an execution intent from a trade-ticket quote.
 *
 * The natural REST shape is `POST /options/execution-intents`. As of
 * M-P2e the backend does NOT expose a public POST handler for that
 * path — only `GET /options/execution-intents` (list) and the
 * operator-side service mint intents. We detect this by treating any
 * 404, 405, or 501 from the public endpoint as a
 * `BACKEND_ENDPOINT_PENDING` result; the UI renders an
 * emerald-bordered "operator-side endpoint pending" notice and
 * surfaces the legacy manual intent-id paste path.
 *
 * Notes for the frontend:
 *   * NEVER pass an admin Bearer token. This endpoint family is
 *     public; admin headers would be a defence-in-depth violation.
 *   * NEVER fall back to `/admin/test/execution-intents` from the
 *     browser app — that fixture is Playwright-helper-only and lives
 *     in `tests/e2e/backend-fixture.ts`.
 *   * NEVER assume mainnet — `chains.ts::expectedChainId()` is the
 *     single source of truth and silently downgrades to Sepolia.
 */
export async function createExecutionIntent(
  body: CreateExecutionIntentRequest,
  signal?: AbortSignal,
): Promise<CreateExecutionIntentResult> {
  try {
    const ok = await rawRequest<CreateExecutionIntentSuccess["data"]>(
      "POST",
      `/options/execution-intents`,
      body,
      signal,
    );
    if (ok && typeof ok === "object" && "intent_id" in ok) {
      return { status: "ok", data: ok };
    }
    return {
      status: "pending",
      code: "BACKEND_ENDPOINT_PENDING",
      message:
        "Backend create-intent endpoint returned an unexpected shape; using legacy intent-id paste path.",
    };
  } catch (e) {
    const err = e as TradingApiError;
    // 404 / 405 / 501 → endpoint not implemented yet on the public
    // surface. Other status codes (400, 422, etc.) are real
    // validation errors and must propagate.
    if (err.status === 404 || err.status === 405 || err.status === 501) {
      return {
        status: "pending",
        code: "BACKEND_ENDPOINT_PENDING",
        message:
          "Public create-intent endpoint not yet wired (operator-side mint only). Paste an intent_id below to continue.",
      };
    }
    throw err;
  }
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

/**
 * OPTIONS-CONDITIONAL-ORDERS-TP-SL-V1 — server-side TP / SL.
 *
 * The conditional-orders worker evaluates `armed` rows against the
 * underlying oracle and atomically claims + executes a child IOC
 * limit order capped to the live reducible position. These calls
 * just manage the row; they do not trigger anything client-side.
 */
export function createConditionalOrders(
  address: string,
  body: CreateConditionalOrderRequest,
  signal?: AbortSignal,
): Promise<ConditionalOrderResponse[]> {
  return rawRequest<ConditionalOrderResponse[]>(
    "POST",
    `/accounts/${address}/conditional-orders`,
    body,
    signal,
  );
}

export function listConditionalOrders(
  address: string,
  optsOrSignal?:
    | AbortSignal
    | { subaccountId?: number; all?: boolean; signal?: AbortSignal },
): Promise<ConditionalOrderResponse[]> {
  const opts = normalizeListOpts(optsOrSignal);
  const qs = new URLSearchParams();
  if (opts.all) qs.set("all", "true");
  else if (opts.subaccountId !== undefined)
    qs.set("subaccount_id", String(opts.subaccountId));
  const suffix = qs.toString().length ? `?${qs.toString()}` : "";
  return rawRequest<ConditionalOrderResponse[]>(
    "GET",
    `/accounts/${address}/conditional-orders${suffix}`,
    undefined,
    opts.signal,
  );
}

export function cancelConditionalOrder(
  address: string,
  id: string,
  body: {
    authorization: import("./write-auth").AuthorizationEnvelope;
    subaccount_id?: number;
  },
  signal?: AbortSignal,
): Promise<ConditionalOrderResponse> {
  return rawRequest<ConditionalOrderResponse>(
    "DELETE",
    `/accounts/${address}/conditional-orders/${id}`,
    body,
    signal,
  );
}

/**
 * ATTACHED-TP-SL-PLAN-OBSERVABILITY-V1 — list the trader's
 * attached TP/SL plans (the spec the ticket sent, plus its
 * pending/active/cancelled/failed status). Materialised
 * conditional rows are still listed via `listConditionalOrders`;
 * this endpoint is the only window onto pending/failed plans.
 *
 * Returns the raw `OptionOrderAttachmentPlan[]` newest first.
 */
export function listOptionOrderAttachmentPlans(
  address: string,
  opts: { sinceMs?: number; signal?: AbortSignal } = {},
): Promise<OptionOrderAttachmentPlan[]> {
  const params = new URLSearchParams();
  if (opts.sinceMs !== undefined) params.set("since_ms", String(opts.sinceMs));
  const suffix = params.toString().length > 0 ? `?${params.toString()}` : "";
  return rawRequest<{ plans: OptionOrderAttachmentPlan[] }>(
    "GET",
    `/accounts/${address}/option-order-attachment-plans${suffix}`,
    undefined,
    opts.signal,
  ).then((r) =>
    r.plans.map((p) => {
      const tpTrigger = p.take_profit_trigger_price_1e8;
      const tpLimit = p.take_profit_limit_price_1e8;
      const slTrigger = p.stop_loss_trigger_price_1e8;
      const slLimit = p.stop_loss_limit_price_1e8;
      const out: OptionOrderAttachmentPlan = { ...p };
      if (tpTrigger !== undefined && tpLimit !== undefined) {
        out.take_profit = {
          trigger_price_1e8: tpTrigger,
          limit_price_1e8: tpLimit,
        };
      }
      if (slTrigger !== undefined && slLimit !== undefined) {
        out.stop_loss = {
          trigger_price_1e8: slTrigger,
          limit_price_1e8: slLimit,
        };
      }
      if (p.take_profit_conditional_order_id !== undefined) {
        out.tp_conditional_order_id = p.take_profit_conditional_order_id;
      }
      if (p.stop_loss_conditional_order_id !== undefined) {
        out.sl_conditional_order_id = p.stop_loss_conditional_order_id;
      }
      return out;
    }),
  );
}

/**
 * MATCHING-TIF-SEMANTICS-OPTIONS-V1 — submit a direct options
 * orderbook order. Honours `time_in_force` (gtc/ioc/fok) and
 * `post_only`. This is the orderbook-direct path; it is NOT the
 * paired RFQ execution-intent flow used by `TradeTicket.tsx`.
 *
 * On 400 the backend returns `{"error": <message>}` — `rawRequest`
 * rethrows as `TradingApiError` with `message` set to the body's
 * `error` field, so callers can surface stable messages such as
 * `fill-or-kill order is not fully fillable`, `post-only order
 * would immediately match`, and `invalid time-in-force combination:
 * post-only is not compatible with IOC`.
 */
export function submitOptionOrder(
  body: SubmitOptionOrderRequest,
  signal?: AbortSignal,
): Promise<SubmitOptionOrderResponse> {
  return rawRequest<SubmitOptionOrderResponse>(
    "POST",
    `/options/orders`,
    body,
    signal,
  );
}

// ORDER-LIFECYCLE-OBSERVABILITY-V1 — account-scoped lifecycle reads.
// The backend filters by `account` query param (case-insensitive on
// the address). These return the same DB rows the `account.*` private
// WS channels surface; the UI uses them both for initial render and as
// the canonical recovery path after a missed WS event / reconnect.

export interface OptionOrderRow {
  order_id: string;
  option_series_id: string;
  account: string;
  side: "buy" | "sell";
  price_1e8: string;
  size_1e8: string;
  remaining_size_1e8: string;
  time_in_force: string;
  post_only: boolean;
  client_order_id?: string | null;
  status: string;
  created_at_ms: number;
  updated_at_ms: number;
  /**
   * SUBACCOUNTS-OPTIONS-ORDERS-HISTORY-V1 — subaccount that owns the
   * order. Backend emits `1` for pre-migration rows. May be absent on
   * older enveloped responses; treat as `1` in that case.
   */
  subaccount_id?: number;
}

export interface OptionFillRow {
  fill_id: string;
  option_series_id: string;
  buy_order_id: string;
  sell_order_id: string;
  buyer: string;
  seller: string;
  taker_side: "buy" | "sell";
  price_1e8: string;
  size_1e8: string;
  created_at_ms: number;
  /**
   * SUBACCOUNTS-OPTIONS-ORDERS-HISTORY-V1 — per-side subaccount ids
   * so a wallet that owned both sides can still filter by book.
   */
  buyer_subaccount_id?: number;
  seller_subaccount_id?: number;
}

export function listAccountOptionOrders(
  account: string,
  optsOrSignal?:
    | AbortSignal
    | { subaccountId?: number; all?: boolean; signal?: AbortSignal },
): Promise<OptionOrderRow[]> {
  const opts = normalizeListOpts(optsOrSignal);
  const qs = new URLSearchParams({ account: account.toLowerCase() });
  if (opts.all) qs.set("all", "true");
  else if (opts.subaccountId !== undefined)
    qs.set("subaccount_id", String(opts.subaccountId));
  return rawRequest<OptionOrderRow[]>(
    "GET",
    `/options/orders?${qs.toString()}`,
    undefined,
    opts.signal,
  );
}

export function listAccountOptionFills(
  account: string,
  optsOrSignal?:
    | AbortSignal
    | { subaccountId?: number; all?: boolean; signal?: AbortSignal },
): Promise<OptionFillRow[]> {
  const opts = normalizeListOpts(optsOrSignal);
  const qs = new URLSearchParams({ account: account.toLowerCase() });
  if (opts.all) qs.set("all", "true");
  else if (opts.subaccountId !== undefined)
    qs.set("subaccount_id", String(opts.subaccountId));
  return rawRequest<OptionFillRow[]>(
    "GET",
    `/options/fills?${qs.toString()}`,
    undefined,
    opts.signal,
  );
}

function normalizeListOpts(
  arg?:
    | AbortSignal
    | { subaccountId?: number; all?: boolean; signal?: AbortSignal },
): { subaccountId?: number; all?: boolean; signal?: AbortSignal } {
  if (arg == null) return {};
  if (typeof (arg as AbortSignal).aborted === "boolean") {
    return { signal: arg as AbortSignal };
  }
  return arg as { subaccountId?: number; all?: boolean; signal?: AbortSignal };
}

export function cancelOptionOrder(
  orderId: string,
  body: {
    authorization: import("./write-auth").AuthorizationEnvelope;
    subaccount_id?: number;
  },
  signal?: AbortSignal,
): Promise<OptionOrderRow> {
  return rawRequest<OptionOrderRow>(
    "POST",
    `/options/orders/${orderId}/cancel`,
    body,
    signal,
  );
}

// ---------------------------------------------------------------------
// OPTIONS-RFQ-CREATE-AND-LIFECYCLE-V1 — typed Options RFQ client
// methods. Wire contracts mirror `src/api/routes.rs`. All numeric
// fields are 8-decimal string ("1e8") — never a JS number. IDs are
// UUID strings.
// ---------------------------------------------------------------------

export type OptionRfqStatus =
  | "Open"
  | "Expired"
  | "Accepted"
  | "Cancelled"
  | "Failed";

export type OptionRfqQuoteStatus =
  | "Active"
  | "Expired"
  | "Accepted"
  | "Rejected"
  | "Cancelled";

export type OptionRfqQuoteSignatureStatus =
  | "NotRequired"
  | "Verified"
  | "Missing"
  | "Invalid"
  | "SignerMismatch";

export interface OptionSeriesResponse {
  option_series_id: string;
  underlying: string;
  base_asset: string;
  quote_asset: string;
  settlement_asset: string;
  expiry: number;
  strike_1e8: string;
  is_call: boolean;
  contract_size_1e8: string;
  status: string;
  source: string;
  onchain_product_id: string | null;
  onchain_series_id: string | null;
  created_at_ms: number;
  updated_at_ms: number;
}

export function listOptionsSeries(
  opts?: {
    underlying?: string;
    expiry?: number;
    is_call?: boolean;
    status?: string;
    signal?: AbortSignal;
  },
): Promise<OptionSeriesResponse[]> {
  const qs = new URLSearchParams();
  if (opts?.underlying) qs.set("underlying", opts.underlying);
  if (opts?.expiry !== undefined) qs.set("expiry", String(opts.expiry));
  if (opts?.is_call !== undefined) qs.set("is_call", String(opts.is_call));
  if (opts?.status) qs.set("status", opts.status);
  const suffix = qs.toString().length ? `?${qs.toString()}` : "";
  return rawRequest<OptionSeriesResponse[]>(
    "GET",
    `/options/series${suffix}`,
    undefined,
    opts?.signal,
  );
}

export interface CreateOptionRfqRequest {
  taker: string;
  /**
   * SUBACCOUNTS-RFQ-INTEGRATION-V1 — taker subaccount. Omit for
   * legacy Account-1 behaviour. Non-default requires the envelope
   * to carry `version: 2` and v2 canonical bytes.
   */
  subaccount_id?: number;
  option_series_id: string;
  side: "buy" | "sell";
  size_1e8: string;
  limit_price_1e8?: string | null;
  ttl_ms?: number | null;
  authorization: import("./write-auth").AuthorizationEnvelope;
}

export interface OptionRfqResponse {
  option_rfq_id: string;
  taker: string;
  /**
   * SUBACCOUNTS-RFQ-INTEGRATION-V1 — subaccount the taker signed
   * for. Backend emits `1` for pre-migration rows.
   */
  taker_subaccount_id?: number;
  option_series_id: string;
  side: "buy" | "sell";
  size_1e8: string;
  limit_price_1e8: string | null;
  status: OptionRfqStatus;
  created_at_ms: number;
  expires_at_ms: number;
  accepted_quote_id: string | null;
  option_fill_id: string | null;
}

export interface OptionRfqQuoteResponse {
  quote_id: string;
  option_rfq_id: string;
  mm_account: string;
  /**
   * SUBACCOUNTS-RFQ-INTEGRATION-V1 — subaccount the maker signed
   * for.
   */
  maker_subaccount_id?: number;
  session_id: string | null;
  client_quote_id: string | null;
  price_1e8: string;
  size_1e8: string;
  status: OptionRfqQuoteStatus;
  created_at_ms: number;
  expires_at_ms: number;
  signature: string | null;
  quote_digest: string | null;
  quote_nonce: string | null;
  signature_status: OptionRfqQuoteSignatureStatus;
  recovered_signer: string | null;
}

export function createOptionsRfq(
  body: CreateOptionRfqRequest,
  signal?: AbortSignal,
): Promise<OptionRfqResponse> {
  return rawRequest<OptionRfqResponse>(
    "POST",
    `/options/rfqs`,
    body,
    signal,
  );
}

export function listOptionsRfqs(
  signal?: AbortSignal,
): Promise<OptionRfqResponse[]> {
  return rawRequest<OptionRfqResponse[]>(
    "GET",
    `/options/rfqs`,
    undefined,
    signal,
  );
}

export function getOptionsRfq(
  optionRfqId: string,
  signal?: AbortSignal,
): Promise<OptionRfqResponse> {
  return rawRequest<OptionRfqResponse>(
    "GET",
    `/options/rfqs/${optionRfqId}`,
    undefined,
    signal,
  );
}

export function listOptionsRfqQuotes(
  optionRfqId: string,
  signal?: AbortSignal,
): Promise<OptionRfqQuoteResponse[]> {
  return rawRequest<OptionRfqQuoteResponse[]>(
    "GET",
    `/options/rfqs/${optionRfqId}/quotes`,
    undefined,
    signal,
  );
}

export function cancelOptionsRfq(
  optionRfqId: string,
  body: {
    authorization: import("./write-auth").AuthorizationEnvelope;
    subaccount_id?: number;
  },
  signal?: AbortSignal,
): Promise<OptionRfqResponse> {
  return rawRequest<OptionRfqResponse>(
    "POST",
    `/options/rfqs/${optionRfqId}/cancel`,
    body,
    signal,
  );
}

// OPTIONS-RFQ-QUOTE-SIGNING-ACCEPT-V1 — taker accept flow.
//
// Backend contract (see `deopt-v2-backend/src/api/routes.rs::accept_option_rfq_quote`):
//   POST /options/rfqs/{option_rfq_id}/accept/{quote_id}
//   Body: AuthorizationOnlyBody — a single write-auth envelope
//         signed by the RFQ's taker (canonical field order:
//         taker | option_rfq_id | quote_id).
//   Response: rfq/quote status transitions to Accepted, plus a
//   full `OptionRfqFillResponse` describing the created fill row.

export interface OptionRfqFillResponse {
  fill_id: string;
  option_rfq_id: string;
  quote_id: string;
  option_series_id: string;
  buyer: string;
  seller: string;
  taker: string;
  mm_account: string;
  /**
   * SUBACCOUNTS-RFQ-INTEGRATION-V1 — both sides captured on the fill
   * for side-aware filtering by the RFQ fills feed.
   */
  taker_subaccount_id?: number;
  maker_subaccount_id?: number;
  taker_side: "buy" | "sell";
  price_1e8: string;
  size_1e8: string;
  created_at_ms: number;
}

export interface AcceptOptionRfqQuoteResponse {
  option_rfq_id: string;
  quote_id: string;
  status: OptionRfqStatus;
  quote_status: OptionRfqQuoteStatus;
  option_fill_id: string;
  fill: OptionRfqFillResponse;
  mm_notification_sent: boolean;
  mm_notification_warning: string | null;
}

export function acceptOptionsRfqQuote(
  optionRfqId: string,
  quoteId: string,
  body: {
    authorization: import("./write-auth").AuthorizationEnvelope;
    subaccount_id?: number;
  },
  signal?: AbortSignal,
): Promise<AcceptOptionRfqQuoteResponse> {
  return rawRequest<AcceptOptionRfqQuoteResponse>(
    "POST",
    `/options/rfqs/${optionRfqId}/accept/${quoteId}`,
    body,
    signal,
  );
}

// OPTIONS-RFQ-TRADES-FEED-V1 — public list of accepted RFQ fills.
//
// `GET /options/rfq-fills?account=&option_rfq_id=&limit=`.
// Newest-first. `account` matches any of the fill's buyer / seller
// / taker / mm_account addresses. Returns the same
// `OptionRfqFillResponse` shape that the accept endpoint returns
// inline. Response carries NO signatures / authorization / secrets.
// OPTIONS-TWAP-ORDERS-V1 — TWAP parent/child client methods.

export type OptionTwapStatus =
  | "pending"
  | "running"
  | "completed"
  | "cancelled"
  | "failed"
  | "expired";

export type OptionTwapChildStatus =
  | "scheduled"
  | "submitted"
  | "filled"
  | "partially_filled"
  | "rejected"
  | "expired"
  | "failed";

export interface OptionTwapOrderResponse {
  option_twap_id: string;
  account: string;
  /**
   * SUBACCOUNTS-OPTIONS-CONDITIONAL-TWAP-WS-V1 — owning subaccount.
   * Backend returns `1` for pre-migration rows. Optional in case an
   * older enveloped response is still cached client-side.
   */
  subaccount_id?: number;
  option_series_id: string;
  side: "buy" | "sell";
  size_1e8: string;
  remaining_size_1e8: string;
  limit_price_1e8: string;
  running_time_ms: number;
  child_count: number;
  child_interval_ms: number;
  next_execution_at_ms: number;
  started_at_ms: number;
  ends_at_ms: number;
  status: OptionTwapStatus;
  created_child_count: number;
  filled_size_1e8: string;
  failed_child_count: number;
  client_order_id: string | null;
  last_error: string | null;
  created_at_ms: number;
  updated_at_ms: number;
}

export interface OptionTwapChildResponse {
  option_twap_child_id: string;
  option_twap_id: string;
  sequence: number;
  scheduled_at_ms: number;
  submitted_at_ms: number | null;
  child_order_id: string | null;
  status: OptionTwapChildStatus;
  requested_size_1e8: string;
  filled_size_1e8: string;
  limit_price_1e8: string;
  error_message: string | null;
}

export interface CreateOptionTwapRequest {
  account: string;
  /** SUBACCOUNTS-FRONTEND-SWITCHER-V1 — omit for legacy Account 1. */
  subaccount_id?: number;
  option_series_id: string;
  side: "buy" | "sell";
  size_1e8: string;
  limit_price_1e8: string;
  running_time_ms: number;
  child_count: number;
  client_order_id?: string | null;
  authorization: import("./write-auth").AuthorizationEnvelope;
}

export function createOptionsTwapOrder(
  body: CreateOptionTwapRequest,
  signal?: AbortSignal,
): Promise<OptionTwapOrderResponse> {
  return rawRequest<OptionTwapOrderResponse>(
    "POST",
    `/options/twap-orders`,
    body,
    signal,
  );
}

export function listOptionsTwapOrders(
  opts?: {
    account?: string;
    subaccountId?: number;
    all?: boolean;
    signal?: AbortSignal;
  },
): Promise<OptionTwapOrderResponse[]> {
  const qs = new URLSearchParams();
  if (opts?.account) qs.set("account", opts.account.toLowerCase());
  if (opts?.all) qs.set("all", "true");
  else if (opts?.subaccountId !== undefined)
    qs.set("subaccount_id", String(opts.subaccountId));
  const suffix = qs.toString().length ? `?${qs.toString()}` : "";
  return rawRequest<OptionTwapOrderResponse[]>(
    "GET",
    `/options/twap-orders${suffix}`,
    undefined,
    opts?.signal,
  );
}

export function getOptionsTwapOrder(
  optionTwapId: string,
  signal?: AbortSignal,
): Promise<OptionTwapOrderResponse> {
  return rawRequest<OptionTwapOrderResponse>(
    "GET",
    `/options/twap-orders/${optionTwapId}`,
    undefined,
    signal,
  );
}

export function listOptionsTwapChildren(
  optionTwapId: string,
  signal?: AbortSignal,
): Promise<OptionTwapChildResponse[]> {
  return rawRequest<OptionTwapChildResponse[]>(
    "GET",
    `/options/twap-orders/${optionTwapId}/children`,
    undefined,
    signal,
  );
}

export function cancelOptionsTwapOrder(
  optionTwapId: string,
  body: {
    authorization: import("./write-auth").AuthorizationEnvelope;
    subaccount_id?: number;
  },
  signal?: AbortSignal,
): Promise<OptionTwapOrderResponse> {
  return rawRequest<OptionTwapOrderResponse>(
    "POST",
    `/options/twap-orders/${optionTwapId}/cancel`,
    body,
    signal,
  );
}

export function listOptionsRfqFills(
  opts?: {
    account?: string;
    option_rfq_id?: string;
    limit?: number;
    /**
     * SUBACCOUNTS-RFQ-INTEGRATION-V1 — side-aware subaccount filter.
     * Backend defaults to `Some(1)` when `account` is provided but
     * this is omitted, preserving pre-migration semantics.
     */
    subaccountId?: number;
    all?: boolean;
    signal?: AbortSignal;
  },
): Promise<OptionRfqFillResponse[]> {
  const qs = new URLSearchParams();
  if (opts?.account) qs.set("account", opts.account.toLowerCase());
  if (opts?.option_rfq_id) qs.set("option_rfq_id", opts.option_rfq_id);
  if (opts?.limit !== undefined) qs.set("limit", String(opts.limit));
  if (opts?.all) qs.set("all", "true");
  else if (opts?.subaccountId !== undefined)
    qs.set("subaccount_id", String(opts.subaccountId));
  const suffix = qs.toString().length ? `?${qs.toString()}` : "";
  return rawRequest<OptionRfqFillResponse[]>(
    "GET",
    `/options/rfq-fills${suffix}`,
    undefined,
    opts?.signal,
  );
}

// OPTIONS-RFQ-MAKER-QUOTE-SUBMIT-V1 — maker quote flow.
//
// Two backend endpoints:
//   POST /options/rfqs/{id}/quote-signing-payload
//     Auth: none. Returns the exact EIP-712 typed data the maker
//     wallet must sign. The response carries `types` + `message`
//     already in camelCase, matching viem's `signTypedData` shape.
//
//   POST /options/rfqs/{id}/quotes
//     Auth: maker (mm_account) write-auth envelope + optional
//     maker EIP-712 quote signature (required when backend runs in
//     `OPTION_RFQ_QUOTE_SIGNATURE_MODE=Strict`).

export interface OptionRfqQuoteSigningPayloadRequest {
  mm_account: string;
  price_1e8: string;
  size_1e8: string;
  client_quote_id?: string | null;
  quote_nonce: number;
  quote_ttl_ms: number;
}

export interface OptionRfqQuoteSigningPayloadDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export interface OptionRfqQuoteSigningPayloadTypeField {
  name: string;
  type: string;
}

export interface OptionRfqQuoteSigningPayloadMessage {
  optionRfqId: string;
  mmAccount: string;
  optionSeriesId: string;
  takerIsBuyer: boolean;
  price1e8: string;
  size1e8: string;
  quoteNonce: string;
  expiry: string;
}

export interface OptionRfqQuoteSigningPayloadResponse {
  option_rfq_id: string;
  option_rfq_id_b32: string;
  option_series_id_b32: string;
  digest: string;
  domain: OptionRfqQuoteSigningPayloadDomain;
  primary_type: string;
  types: OptionRfqQuoteSigningPayloadTypeField[];
  message: OptionRfqQuoteSigningPayloadMessage;
}

export function getOptionsRfqQuoteSigningPayload(
  optionRfqId: string,
  body: OptionRfqQuoteSigningPayloadRequest,
  signal?: AbortSignal,
): Promise<OptionRfqQuoteSigningPayloadResponse> {
  return rawRequest<OptionRfqQuoteSigningPayloadResponse>(
    "POST",
    `/options/rfqs/${optionRfqId}/quote-signing-payload`,
    body,
    signal,
  );
}

export interface SubmitOptionRfqQuoteRequest {
  mm_account: string;
  /**
   * SUBACCOUNTS-RFQ-INTEGRATION-V1 — maker subaccount. Same rules as
   * `CreateOptionRfqRequest.subaccount_id` but bound to the maker.
   */
  subaccount_id?: number;
  session_id?: string | null;
  client_quote_id?: string | null;
  price_1e8: string;
  size_1e8: string;
  quote_nonce?: number | null;
  quote_ttl_ms?: number | null;
  /** EIP-712 signature over the quote-signing-payload message.
   *  Required in Strict signature mode, ignored in Disabled mode. */
  signature?: string | null;
  authorization: import("./write-auth").AuthorizationEnvelope;
}

export function submitOptionsRfqQuote(
  optionRfqId: string,
  body: SubmitOptionRfqQuoteRequest,
  signal?: AbortSignal,
): Promise<OptionRfqQuoteResponse> {
  return rawRequest<OptionRfqQuoteResponse>(
    "POST",
    `/options/rfqs/${optionRfqId}/quotes`,
    body,
    signal,
  );
}

// ---------------------------------------------------------------------
// PERPS-MINIMAL-MARKET-AND-PRICE-V1 — read-only Perps market + price.
//
// The backend returns 503 `perps_read_layer_is_disabled...` when the
// operator has not turned the reader on, and 503
// `perps_oracle_price_unavailable...` when the RPC/oracle is stale or
// unreachable. Both are surfaced as the same `PerpsReadUnavailable`
// state to the UI — never as a fabricated price.
// ---------------------------------------------------------------------

export type PerpMarketStatus = "read_only" | "paused" | "unknown";
export type PerpMarketSource = "onchain_registry" | "seed";
export type PerpPriceSource = "oracle_router";

export interface PerpMarketRow {
  market_id: string;
  onchain_market_id: string;
  base_asset: string;
  quote_asset: string;
  status: PerpMarketStatus;
  chain_id: number;
  source: PerpMarketSource;
  trading_enabled: false;
}

export interface PerpMarketListing {
  markets: PerpMarketRow[];
  chain_id: number;
  trading_enabled: false;
}

export interface PerpPriceSnapshot {
  market_id: string;
  index_price_1e8: string;
  mark_price_1e8: string;
  oracle_timestamp_ms: number;
  source: PerpPriceSource;
  stale: boolean;
  trading_enabled: false;
  chain_id: number;
}

/** Union that panels/hooks read to render honestly. */
export type PerpPriceState =
  | { kind: "loading" }
  | { kind: "unavailable"; reason: string }
  | { kind: "ok"; snapshot: PerpPriceSnapshot };

export function listPerpsMarkets(signal?: AbortSignal): Promise<PerpMarketListing> {
  return rawRequest<PerpMarketListing>("GET", "/perps/markets", undefined, signal);
}

export function getPerpsMarketPrice(
  marketId: string,
  signal?: AbortSignal,
): Promise<PerpPriceSnapshot> {
  return rawRequest<PerpPriceSnapshot>(
    "GET",
    `/perps/markets/${encodeURIComponent(marketId)}/price`,
    undefined,
    signal,
  );
}

// PERPS-ISOLATED-MARGIN-POSITION-ENGINE-V1 — read-only account
// positions listing. The backend returns `[]` when the trader has no
// positions; risk fields (mark price, unrealised PnL, margin ratio,
// maintenance margin) are `null` when the oracle mark is unavailable
// or stale. Never fabricates.
export type PerpPositionSide = "long" | "short";
export type PerpPositionStatus = "open" | "closed";

export interface PerpPositionView {
  id: string;
  account: string;
  /**
   * PERPS-SUBACCOUNTS-ENGINE-ROUTING-V1 — position owner subaccount.
   * Pre-migration rows deserialize as `1` via the backend's
   * `#[serde(default = "one_subaccount_id")]`.
   */
  subaccount_id: number;
  market_id: string;
  side: PerpPositionSide;
  size_1e8: string;
  entry_price_1e8: string;
  margin_1e8: string;
  realized_pnl_1e8: string;
  status: PerpPositionStatus;
  mark_price_1e8: string | null;
  notional_1e8: string | null;
  unrealized_pnl_1e8: string | null;
  initial_margin_requirement_1e8: string;
  maintenance_margin_requirement_1e8: string | null;
  margin_ratio_bps: string | null;
  estimated_liquidation_price_1e8: string | null;
  opened_at_ms: number;
  updated_at_ms: number;
  closed_at_ms: number | null;
  price_stale: boolean;
  trading_enabled: false;
}

export interface PerpPositionListResponse {
  positions: PerpPositionView[];
  chain_id: number;
  trading_enabled: false;
}

/**
 * PERPS-SUBACCOUNTS-FRONTEND-ROUTING-V1 — read Perps positions for the
 * given wallet and subaccount. When `subaccountId` is omitted the backend
 * defaults to subaccount 1 to preserve v1-callers. Pass `all: true` for
 * the rare aggregate view (currently not exposed in the UI).
 */
export function getPerpsAccountPositions(
  address: string,
  opts: { subaccountId?: number; all?: boolean } = {},
  signal?: AbortSignal,
): Promise<PerpPositionListResponse> {
  const q = buildPerpsAccountReadQuery(opts);
  return rawRequest<PerpPositionListResponse>(
    "GET",
    `/accounts/${encodeURIComponent(address)}/perps/positions${q}`,
    undefined,
    signal,
  );
}

/**
 * PERPS-SUBACCOUNTS-FRONTEND-ROUTING-V1 — shared query builder for all
 * Perps account-scoped reads. Mirrors the backend `PerpsAccountReadQuery`
 * shape (`?subaccount_id=` / `?all=`). Returns an empty string when the
 * caller omits both — the backend then defaults to subaccount 1.
 */
export function buildPerpsAccountReadQuery(opts: {
  subaccountId?: number;
  all?: boolean;
}): string {
  const params = new URLSearchParams();
  if (opts.all === true) {
    params.set("all", "true");
  } else if (
    typeof opts.subaccountId === "number" &&
    Number.isFinite(opts.subaccountId)
  ) {
    params.set("subaccount_id", String(opts.subaccountId));
  }
  const s = params.toString();
  return s.length > 0 ? `?${s}` : "";
}

/**
 * PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 — one row from
 * the account orders history feed. All monetary fields are
 * 1e8-scaled decimal strings; `trading_enabled` is always `false` in
 * V1. Nullable fields (`client_order_id`, `terminal_*`) match the
 * backend wire contract exactly.
 */
export interface PerpOrderView {
  order_id: string;
  account: string;
  /**
   * PERPS-SUBACCOUNTS-ENGINE-ROUTING-V1 — subaccount the order was
   * submitted under. Pre-migration rows arrive as `1` via the backend's
   * `#[serde(default = "one_subaccount_id")]`.
   */
  subaccount_id: number;
  market_id: string;
  side: "buy" | "sell";
  order_type: string;
  price_1e8: string;
  size_1e8: string;
  remaining_size_1e8: string;
  filled_size_1e8: string;
  time_in_force: string;
  post_only: boolean;
  reduce_only: boolean;
  isolated_margin_1e8: string;
  status: string;
  client_order_id: string | null;
  terminal_reason_code: string | null;
  terminal_reason_message: string | null;
  terminal_reason_source: string | null;
  created_at_ms: number;
  updated_at_ms: number;
  trading_enabled: false;
}

export interface PerpOrderListResponse {
  orders: PerpOrderView[];
  chain_id: number;
  trading_enabled: false;
}

/**
 * PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 — account-scoped
 * Perps orders history. Newest-first. Empty array is the honest
 * default; no fake rows are ever fabricated.
 */
export function listPerpOrders(
  address: string,
  opts: { subaccountId?: number; all?: boolean } = {},
  signal?: AbortSignal,
): Promise<PerpOrderListResponse> {
  const q = buildPerpsAccountReadQuery(opts);
  return rawRequest<PerpOrderListResponse>(
    "GET",
    `/accounts/${encodeURIComponent(address)}/perps/orders${q}`,
    undefined,
    signal,
  );
}

/**
 * PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 — one row from
 * the account fills history feed, viewed from the requesting account's
 * perspective. `side` and `liquidity_role` are computed backend-side
 * for the viewer.
 */
export interface PerpFillView {
  fill_id: string;
  market_id: string;
  taker_order_id: string;
  maker_order_id: string;
  taker_account: string;
  maker_account: string;
  /**
   * PERPS-SUBACCOUNTS-ENGINE-ROUTING-V1 — two-sided subaccount ids so
   * a wallet that participated as both taker and maker (or only one
   * side) can filter without ambiguity. Pre-migration rows deserialize
   * both fields as `1`.
   */
  taker_subaccount_id: number;
  maker_subaccount_id: number;
  liquidity_role: "taker" | "maker";
  side: "buy" | "sell";
  price_1e8: string;
  size_1e8: string;
  created_at_ms: number;
  trading_enabled: false;
}

export interface PerpFillListResponse {
  fills: PerpFillView[];
  chain_id: number;
  trading_enabled: false;
}

/**
 * PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 — account-scoped
 * Perps fills history. Newest-first.
 */
export function listPerpFills(
  address: string,
  opts: { subaccountId?: number; all?: boolean } = {},
  signal?: AbortSignal,
): Promise<PerpFillListResponse> {
  const q = buildPerpsAccountReadQuery(opts);
  return rawRequest<PerpFillListResponse>(
    "GET",
    `/accounts/${encodeURIComponent(address)}/perps/fills${q}`,
    undefined,
    signal,
  );
}

/**
 * PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 — one row from
 * the account liquidation history feed. Signed fields
 * (`unrealized_pnl_1e8`, `equity_1e8`, `realized_pnl_1e8`) may start
 * with a `-` sign.
 */
export interface PerpLiquidationEventView {
  liquidation_id: string;
  account: string;
  /**
   * PERPS-SUBACCOUNTS-ENGINE-ROUTING-V1 — subaccount owning the
   * liquidated position at settlement time.
   */
  subaccount_id: number;
  market_id: string;
  position_id: string;
  side: "long" | "short";
  size_1e8: string;
  entry_price_1e8: string;
  mark_price_1e8: string;
  margin_1e8: string;
  unrealized_pnl_1e8: string;
  equity_1e8: string;
  maintenance_margin_requirement_1e8: string;
  margin_ratio_bps: string;
  realized_pnl_1e8: string;
  bad_debt_1e8: string;
  liquidation_fee_1e8: string;
  status: string;
  reason_code: string;
  created_at_ms: number;
  trading_enabled: false;
}

export interface PerpLiquidationListResponse {
  liquidations: PerpLiquidationEventView[];
  chain_id: number;
  trading_enabled: false;
}

/**
 * PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 — account-scoped
 * Perps liquidation history. Newest-first.
 */
export function listPerpLiquidations(
  address: string,
  opts: { subaccountId?: number; all?: boolean } = {},
  signal?: AbortSignal,
): Promise<PerpLiquidationListResponse> {
  const q = buildPerpsAccountReadQuery(opts);
  return rawRequest<PerpLiquidationListResponse>(
    "GET",
    `/accounts/${encodeURIComponent(address)}/perps/liquidations${q}`,
    undefined,
    signal,
  );
}

/**
 * PERPS-FUNDING-V1 — one row from the account funding history feed.
 * All monetary fields are 1e8-scaled decimal strings. Signed values
 * (`payment_1e8`, `funding_delta_1e18`, `funding_index_*`) may start
 * with a `-` sign. `trading_enabled` is always `false` in V1.
 */
export interface PerpFundingEventView {
  funding_event_id: string;
  account: string;
  /**
   * PERPS-SUBACCOUNTS-ENGINE-ROUTING-V1 — subaccount whose margin was
   * settled by this funding payment.
   */
  subaccount_id: number;
  market_id: string;
  position_id: string;
  side: "long" | "short";
  position_size_1e8: string;
  funding_index_before_1e18: string;
  funding_index_after_1e18: string;
  funding_delta_1e18: string;
  payment_1e8: string;
  margin_before_1e8: string;
  margin_after_1e8: string;
  bad_debt_1e8: string;
  reason_code: string;
  created_at_ms: number;
  trading_enabled: false;
}

export interface PerpFundingListResponse {
  funding_events: PerpFundingEventView[];
  chain_id: number;
  trading_enabled: false;
}

/**
 * PERPS-FUNDING-V1 — account-scoped funding history. Newest-first.
 * Empty array is the honest default; no fake rows are ever fabricated.
 */
export function listPerpFundingEvents(
  address: string,
  opts: { subaccountId?: number; all?: boolean } = {},
  signal?: AbortSignal,
): Promise<PerpFundingListResponse> {
  const q = buildPerpsAccountReadQuery(opts);
  return rawRequest<PerpFundingListResponse>(
    "GET",
    `/accounts/${encodeURIComponent(address)}/perps/funding${q}`,
    undefined,
    signal,
  );
}

// =====================================================================
// PERPS-FRONTEND-TICKET-ENABLEMENT-V1 — Perps mutation client.
// =====================================================================
//
// These call `POST /perps/orders` + `DELETE /perps/orders/:id` on the
// backend. Both routes are STRICTLY OPT-IN behind
// `PERPS_PUBLIC_TRADING_ENABLED=true`; when the flag is off the backend
// returns 503 `PerpsNotLive` and this client surfaces the message
// unchanged so the UI can display it honestly.

/**
 * Request body for `POST /perps/orders`. All monetary fields are
 * 1e8-scaled decimal strings. `market_id` is a symbol like
 * `"ETH-PERP"`, not the numeric on-chain market id.
 */
export interface SubmitPerpsOrderRequest {
  market_id: string;
  account: string;
  /**
   * PERPS-SUBACCOUNTS-FRONTEND-ROUTING-V1 — subaccount the order runs
   * under. Optional on the wire so the default fail-closed handler
   * path can 503 without the field. REQUIRED under the closed-test /
   * public paths and must match the value embedded in
   * `authorization`'s v2 canonical bytes.
   */
  subaccount_id?: number;
  side: "buy" | "sell";
  price_1e8: string;
  size_1e8: string;
  time_in_force: "gtc" | "ioc" | "fok";
  post_only: boolean;
  reduce_only: boolean;
  isolated_margin_1e8: string;
  client_order_id?: string | null;
  /**
   * PERPS-V2-WRITE-AUTH-ENFORCEMENT-V1 — v2 authorization envelope.
   *
   * REQUIRED when the backend gate opens (closed-test allowlist or
   * public trading). Perps never shipped a v1 wire; every accepted
   * envelope must declare `version=2`. The default fail-closed handler
   * path (both Perps flags off) still 503s without consulting this
   * field — hence it's optional in the wire type.
   */
  authorization?: import("./write-auth").AuthorizationEnvelope;
}

/**
 * PERPS-V2-WRITE-AUTH-ENFORCEMENT-V1 — request body for
 * `DELETE /perps/orders/:id`. Carries the v2 envelope + subaccount id.
 * The caller wallet is still passed as `?account=` for the query
 * extractor.
 */
export interface CancelPerpsOrderRequest {
  authorization: import("./write-auth").AuthorizationEnvelope;
  subaccount_id: number;
}

export interface SubmitPerpsOrderResponse {
  status: "ok";
  order: PerpOrderView;
  fills: PerpFillView[];
  chain_id: number;
  trading_enabled: true;
}

export interface CancelPerpsOrderResponse {
  status: "ok";
  order: PerpOrderView;
  chain_id: number;
  trading_enabled: true;
}

/**
 * Submit a Perps order. Returns the accepted order and any fills that
 * occurred in the same transaction.
 *
 * Backend behavior:
 *   - Default (`PERPS_PUBLIC_TRADING_ENABLED=false`) → 503 `PerpsNotLive`.
 *   - Enabled without PG repository → 503 `PerpsNotLive` (V1 posture:
 *     durable-only).
 *   - Enabled with PG → order is executed via the PG dispatcher
 *     (`submit_perp_order_via_repository`).
 */
export function submitPerpsOrder(
  request: SubmitPerpsOrderRequest,
  signal?: AbortSignal,
): Promise<SubmitPerpsOrderResponse> {
  return rawRequest<SubmitPerpsOrderResponse>(
    "POST",
    "/perps/orders",
    request,
    signal,
  );
}

/**
 * Cancel an owned Perps order. `caller` must match the account that
 * submitted the order and the `authorization` envelope must be a v2
 * envelope carrying the caller's subaccount id. Otherwise the backend
 * rejects with `PerpInvalidOrderState` or `WriteAuth*`.
 */
export function cancelPerpsOrder(
  orderId: string,
  caller: string,
  body: CancelPerpsOrderRequest,
  signal?: AbortSignal,
): Promise<CancelPerpsOrderResponse> {
  const q = new URLSearchParams({ account: caller }).toString();
  return rawRequest<CancelPerpsOrderResponse>(
    "DELETE",
    `/perps/orders/${encodeURIComponent(orderId)}?${q}`,
    body,
    signal,
  );
}

// ---------------------------------------------------------------------
// SUBACCOUNTS-FRONTEND-SWITCHER-V1 — subaccount CRUD.
//
// The backend exposes `(owner_address, subaccount_id)` composite
// resource under `/accounts/{address}/subaccounts`. GET lazy-creates
// subaccount 1 on first access, so a first-connect always sees at
// least Account 1. Rename PATCHes the `name`; the returned DTO
// carries a stable `display_name` derived server-side.
// ---------------------------------------------------------------------

export interface SubaccountDto {
  owner_address: string;
  subaccount_id: number;
  name: string | null;
  display_name: string;
  created_at_ms: number;
  updated_at_ms: number;
  archived_at_ms?: number | null;
}

export function listSubaccounts(
  address: string,
  signal?: AbortSignal,
): Promise<SubaccountDto[]> {
  return rawRequest<{ subaccounts: SubaccountDto[] }>(
    "GET",
    `/accounts/${address}/subaccounts`,
    undefined,
    signal,
  ).then((r) => r.subaccounts);
}

export function getSubaccount(
  address: string,
  subaccountId: number,
  signal?: AbortSignal,
): Promise<SubaccountDto> {
  return rawRequest<SubaccountDto>(
    "GET",
    `/accounts/${address}/subaccounts/${subaccountId}`,
    undefined,
    signal,
  );
}

export function createSubaccount(
  address: string,
  body: {
    name?: string | null;
    authorization: import("./write-auth").AuthorizationEnvelope;
  },
  signal?: AbortSignal,
): Promise<SubaccountDto> {
  return rawRequest<SubaccountDto>(
    "POST",
    `/accounts/${address}/subaccounts`,
    body,
    signal,
  );
}

export function renameSubaccount(
  address: string,
  subaccountId: number,
  body: {
    name: string;
    authorization: import("./write-auth").AuthorizationEnvelope;
  },
  signal?: AbortSignal,
): Promise<SubaccountDto> {
  return rawRequest<SubaccountDto>(
    "PATCH",
    `/accounts/${address}/subaccounts/${subaccountId}`,
    body,
    signal,
  );
}
