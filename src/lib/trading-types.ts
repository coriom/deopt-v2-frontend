// Types hand-derived from
// `../../../deopt-v2-backend/docs/openapi/trading-api.openapi.json` against
// the M-P2a backend (commit `d133e2c`; sol freeze tag
// `v2-product-freeze-rc1`).
//
// **Posture:** testnet beta; **NOT AUDITED**. These types describe the
// public-read surface only; admin Bearer is NOT accepted by any handler
// described here.
//
// When the backend schema bumps to `0.1.0` from `0.1.0-mvp`, regenerate
// these types via:
//   npx openapi-typescript ../deopt-v2-backend/docs/openapi/trading-api.openapi.json -o src/lib/trading-types.gen.ts
// and migrate the re-exports below to the generated file.

export type Hex = `0x${string}`;
export type EthAddress = `0x${string}`;
export type DecimalString = string;
export type SeriesId = string;
export type ProductId = `0x${string}`;

export type EnvelopeStatus = "ok" | "stale" | "partial";

export interface MetaBlock {
  source:
    | "db"
    | "rpc"
    | "indexer"
    | "rpc+cache"
    | "cache"
    | "validation"
    | "spec"
    | "internal";
  block_number?: number;
  indexed_block?: number;
  freshness_ms?: number;
  chain_id: number;
  request_id: string;
  generated_at_ms: number;
  pagination?: { next_cursor?: string | null; has_more: boolean };
}

export interface Warning {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface Envelope<T> {
  status: EnvelopeStatus;
  data: T;
  warnings?: Warning[];
  meta: MetaBlock;
}

export type TradingErrorCode =
  | "INVALID_ADDRESS"
  | "INVALID_REQUEST"
  | "PRODUCT_NOT_FOUND"
  | "SERIES_NOT_FOUND"
  | "ORDERBOOK_UNAVAILABLE"
  | "QUOTE_STALE"
  | "QUOTE_UNSUPPORTED"
  | "INSUFFICIENT_BALANCE"
  | "INSUFFICIENT_COLLATERAL"
  | "PREVIEW_REVERTED"
  | "INDEXER_STALE"
  | "RPC_UNAVAILABLE"
  | "SIGNER_UNAVAILABLE"
  | "EXECUTOR_UNAVAILABLE"
  | "SOURCE_UNAVAILABLE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface ErrorEnvelope {
  status: "error";
  error: {
    code: TradingErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: MetaBlock;
}

// --- Products ---

export interface Product {
  product_id: ProductId;
  underlying: EthAddress;
  underlying_symbol?: string;
  settlement_asset: EthAddress;
  settlement_asset_symbol?: string;
  is_call: boolean;
  expiry_ms: number;
  expiry?: string; // RFC3339
  series_count: number;
  is_active_any: boolean;
  spot_price_1e8?: DecimalString;
  spot_price_age_ms?: number;
}

export interface ProductsListData {
  products: Product[];
}

export interface ProductDetailData {
  product: Product;
  series_ids: SeriesId[];
}

export interface ProductsBatchData {
  products: Product[];
}

// --- Series ---

export interface Series {
  series_id: SeriesId;
  product_id: ProductId;
  underlying: EthAddress;
  settlement_asset: EthAddress;
  is_call: boolean;
  strike_1e8: DecimalString;
  expiry_ms: number;
  expiry?: string;
  contract_size_1e8: DecimalString;
  is_active: boolean;
  metadata?: Hex;
}

export interface OrderbookTop {
  best_bid_price_1e8?: DecimalString;
  best_bid_size?: DecimalString;
  best_ask_price_1e8?: DecimalString;
  best_ask_size?: DecimalString;
}

export interface LastFill {
  price_1e8?: DecimalString;
  qty?: DecimalString;
  size_1e8?: DecimalString;
  side?: "buy" | "sell";
  block_number?: number;
  block_timestamp_ms?: number;
  tx_hash?: Hex;
  created_at_ms?: number;
}

export interface SeriesDetailData {
  series: Series;
  orderbook_top?: OrderbookTop | null;
  last_fill?: LastFill | null;
  oracle_mark_1e8?: DecimalString;
}

// --- Quote preview ---

export interface QuotePreview {
  series_id: SeriesId;
  side: "buy" | "sell";
  size: DecimalString;
  price_1e8?: DecimalString;
  premium?: DecimalString;
  buyer_fee?: { ppm_signed?: number; amount?: DecimalString };
  seller_fee?: { ppm_signed?: number; amount?: DecimalString };
  settlement_asset?: EthAddress;
  oracle_mark_1e8?: DecimalString;
  im_impact?: DecimalString;
  free_collateral_after?: DecimalString;
  quote_expires_at_ms?: number;
  position_size_after?: DecimalString;
}

// --- Positions / Portfolio ---

export interface Position {
  series_id: SeriesId;
  product_id?: ProductId;
  size: DecimalString;
  side: "long" | "short";
  avg_entry_price_1e8?: DecimalString;
  mark_price_1e8?: DecimalString;
  unrealised_pnl?: DecimalString;
  im_contribution?: DecimalString;
  mm_contribution?: DecimalString;
  is_exercisable?: boolean;
}

export interface PositionsData {
  address: EthAddress;
  positions: Position[];
}

export interface PortfolioData {
  address: EthAddress;
  equity: DecimalString;
  im: DecimalString;
  mm: DecimalString;
  free_collateral: DecimalString;
  total_notional?: DecimalString;
  open_positions_count?: number;
}

// --- History ---

export type HistoryEventKind =
  | "fill"
  | "rfq_fill"
  | "order_cancel"
  | "rfq_cancel"
  | "exercise"
  | "settle"
  | "deposit"
  | "withdraw";

export interface HistoryItem {
  event_kind: HistoryEventKind;
  series_id?: SeriesId;
  side?: string;
  size_1e8?: DecimalString;
  size?: DecimalString;
  price_1e8?: DecimalString;
  fee_paid?: DecimalString;
  tx_hash?: Hex;
  block_number?: number;
  block_timestamp_ms?: number;
  created_at_ms?: number;
  intent_id?: string;
}

export interface HistoryData {
  items: HistoryItem[];
}

// --- Balances ---

export interface Balance {
  token: EthAddress;
  symbol?: string;
  decimals?: number;
  balance: DecimalString;
  balance_with_yield?: DecimalString;
  strategy_assets_preview?: DecimalString;
  is_collateral_active?: boolean;
}

export interface BalancesData {
  address: EthAddress;
  balances: Balance[];
}

// --- Exercise / Close previews (NOT_READY data when SOURCE_UNAVAILABLE) ---

export interface ExercisePreviewRequest {
  series_id: SeriesId;
  account: EthAddress;
}

export interface ExercisePreviewData {
  series_id: SeriesId;
  account: EthAddress;
  is_already_settled: boolean;
  can_settle: boolean;
  pnl: DecimalString;
  payable_from_settlement_sink?: DecimalString;
  insurance_preview?: DecimalString;
  collectible_from_trader_preview?: DecimalString;
  residual_bad_debt_preview?: DecimalString;
}

export interface ClosePreviewRequest {
  series_id: SeriesId;
  account: EthAddress;
  side: "buy" | "sell";
  size: DecimalString;
  price_1e8?: DecimalString;
}

// --- Trading health ---

export interface TradingHealthData {
  overall_status: "ok" | "degraded" | "unhealthy";
  indexer_lag_blocks?: number | null;
  rpc_reachable: boolean;
  chain_id: number;
  indexed_block?: number | null;
}

// --- NotReady (returned with envelope when SOURCE_UNAVAILABLE) ---

export interface NotReadyData {
  not_ready: boolean;
  reason: string;
}

// --- M-P3b — Signing / intent / tx status ---

// Backend EIP-712 envelope shape returned by
// `/options/execution-intents/:id/signing-payload`.
export interface SigningPayload {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: EthAddress;
  };
  primaryType: string;
  types: Record<string, Array<{ name: string; type: string }>>;
  message: Record<string, unknown>;
  expected_signer?: EthAddress;
  // Whose signature this envelope is for (informational; backend may omit).
  signer_role?: "buyer" | "seller" | "maker" | "taker";
}

export interface SubmitSignaturesRequest {
  submitter: EthAddress;
  role: "buyer" | "seller";
  buyer_signature?: Hex;
  seller_signature?: Hex;
  /** ACCOUNT-WRITE-AUTH-HARDENING-V1 — write authorization envelope.
   * Build via `src/lib/write-auth.ts::buildAuthorization`. */
  authorization: import("./write-auth").AuthorizationEnvelope;
}

export interface SubmitSignaturesResponse {
  intent_id: string;
  status: string;
}

export interface ExecutionIntentStatus {
  intent_id: string;
  status: string; // CREATED | SIGNING_PAYLOAD_ISSUED | SIGNED | SIMULATED_OK | BROADCAST | CONFIRMED | REVERTED | STUCK
  series_id?: SeriesId;
  buyer?: EthAddress;
  seller?: EthAddress;
  qty?: DecimalString;
  price_1e8?: DecimalString;
  buyer_signature?: Hex;
  seller_signature?: Hex;
  created_at_ms?: number;
  updated_at_ms?: number;
}

export interface ExecutorTransaction {
  intent_id: string;
  tx_hash?: Hex;
  status: string;
  block_number?: number;
  block_timestamp_ms?: number;
  reverted_reason?: string;
}

// --- MATCHING-TIF-SEMANTICS-OPTIONS-V1 ------------------------------
// Direct options orderbook endpoint (`POST /options/orders`). This is
// the orderbook-direct path that honours `time_in_force` (gtc / ioc /
// fok) and `post_only`. It is NOT the paired RFQ execution-intent
// flow used by `TradeTicket.tsx` — that one always behaves as GTC and
// ignores post-only.

export type OptionOrderTif = "gtc" | "ioc" | "fok";

export type OptionOrderStatusValue =
  | "open"
  | "partially_filled"
  | "filled"
  | "cancelled"
  | "rejected"
  | "expired";

export type OptionOrderSide = "buy" | "sell";

export interface SubmitOptionOrderRequest {
  option_series_id: SeriesId;
  account: EthAddress;
  side: OptionOrderSide;
  price_1e8: DecimalString;
  size_1e8: DecimalString;
  time_in_force: OptionOrderTif;
  post_only?: boolean;
  client_order_id?: string;
  nonce?: number;
  deadline_ms?: number;
  signature?: Hex;
  /** ACCOUNT-WRITE-AUTH-HARDENING-V1 — write authorization envelope.
   * Build via `src/lib/write-auth.ts::buildAuthorization`. */
  authorization: import("./write-auth").AuthorizationEnvelope;
}

export interface OptionFillResponse {
  fill_id: string;
  option_series_id: SeriesId;
  buy_order_id: string;
  sell_order_id: string;
  buyer: EthAddress;
  seller: EthAddress;
  maker_order_id: string;
  taker_order_id: string;
  taker_side: OptionOrderSide;
  price_1e8: DecimalString;
  size_1e8: DecimalString;
  created_at_ms: number;
}

export interface OptionOrderResponse {
  order_id: string;
  option_series_id: SeriesId;
  account: EthAddress;
  side: OptionOrderSide;
  price_1e8: DecimalString;
  size_1e8: DecimalString;
  remaining_size_1e8: DecimalString;
  time_in_force: OptionOrderTif;
  post_only: boolean;
  client_order_id?: string | null;
  nonce?: string | null;
  deadline_ms?: number | null;
  signature?: Hex | null;
  status: OptionOrderStatusValue;
  created_at_ms: number;
  updated_at_ms: number;
}

/** Flattened response — order fields at the top level + `fills` array. */
export type SubmitOptionOrderResponse = OptionOrderResponse & {
  fills: OptionFillResponse[];
};

// --- OPTIONS-CONDITIONAL-ORDERS-TP-SL-V1 ----------------------------
// Server-side TP / SL conditional exit orders bound to an existing
// option position. Backend at `POST /accounts/:address/conditional-orders`.
//
// Snake_case wire format mirrors the Rust serde shape exactly.

export type ConditionalType = "take_profit" | "stop_loss";
export type TriggerSource = "underlying_oracle";
export type TriggerCondition = "gte" | "lte";
export type ConditionalExecutionType = "ioc_limit";
export type PositionSide = "long" | "short";
export type OptionKind = "call" | "put";
export type ConditionalOrderStatusValue =
  | "armed"
  | "triggering"
  | "executing"
  | "completed"
  | "partially_filled"
  | "cancelled"
  | "failed"
  | "expired";

export interface ConditionalLegRequest {
  conditional_type: ConditionalType;
  trigger_price_1e8: DecimalString;
  limit_price_1e8: DecimalString;
  /** Optional explicit comparator — must match the server-derived one
   *  for the (option_kind, position_side, conditional_type) tuple.
   *  Backend rejects mismatches with `InvalidTriggerDirection`. */
  trigger_condition?: TriggerCondition;
}

export interface CreateConditionalOrderRequest {
  option_series_id: SeriesId;
  quantity_1e8: DecimalString;
  legs: ConditionalLegRequest[];
  /** True ⇒ the two legs share an `oco_group_id`. */
  link_as_oco?: boolean;
  expires_at_ms?: number;
  /** ACCOUNT-WRITE-AUTH-HARDENING-V1 — write authorization envelope.
   * Build via `src/lib/write-auth.ts::buildAuthorization`. */
  authorization: import("./write-auth").AuthorizationEnvelope;
}

export interface ConditionalOrderResponse {
  id: string;
  account: EthAddress;
  option_series_id: SeriesId;
  position_side: PositionSide;
  option_kind: OptionKind;
  conditional_type: ConditionalType;
  trigger_source: TriggerSource;
  trigger_condition: TriggerCondition;
  trigger_price_1e8: DecimalString;
  quantity_1e8: DecimalString;
  execution_type: ConditionalExecutionType;
  limit_price_1e8: DecimalString;
  reduce_only: boolean;
  oco_group_id: string | null;
  status: ConditionalOrderStatusValue;
  child_order_id: string | null;
  failure_code: string | null;
  failure_message: string | null;
  expires_at_ms: number | null;
  triggered_at_ms: number | null;
  completed_at_ms: number | null;
  created_at_ms: number;
  updated_at_ms: number;
  version: number;
}
