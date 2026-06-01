export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonObject = {
  [key: string]: JsonValue;
};

export type AdminEndpointKey =
  | "status"
  | "config"
  | "db"
  | "mmSessions"
  | "executionSummary"
  | "rfqSummary"
  | "optionsSummary"
  | "feeSummary"
  | "feeEvents"
  | "feeVolumes"
  | "feeRebates"
  | "recent";

export type AdminErrorCode =
  | "admin_disabled"
  | "backend_offline"
  | "http_error"
  | "invalid_token"
  | "malformed_response"
  | "missing_token"
  | "unauthorized"
  | "unknown_error";

export type AdminApiErrorDetails = {
  code: AdminErrorCode;
  message: string;
  status?: number;
};

export type AdminEndpointDefinition = {
  key: AdminEndpointKey;
  label: string;
  path: string;
};

export type AdminEndpointSuccess = AdminEndpointDefinition & {
  ok: true;
  data: JsonValue;
  fetchedAt: number;
  status: number;
};

export type AdminEndpointFailure = AdminEndpointDefinition & {
  ok: false;
  error: AdminApiErrorDetails;
  fetchedAt: number;
  status?: number;
};

export type AdminEndpointResult =
  | AdminEndpointSuccess
  | AdminEndpointFailure;

export type AdminSnapshot = Record<AdminEndpointKey, AdminEndpointResult>;

export type RecentLimit = 5 | 20 | 50 | 100;

export type AdminLifecycleSuccess = {
  ok: true;
  label: string;
  path: string;
  data: JsonValue;
  fetchedAt: number;
  status: number;
};

export type AdminLifecycleFailure = {
  ok: false;
  label: string;
  path: string;
  error: AdminApiErrorDetails;
  fetchedAt: number;
  status?: number;
};

export type AdminLifecycleResult =
  | AdminLifecycleSuccess
  | AdminLifecycleFailure;

export type AdminFeesOnchainSuccess = {
  ok: true;
  label: string;
  path: string;
  data: JsonValue;
  fetchedAt: number;
  status: number;
};

export type AdminFeesOnchainFailure = {
  ok: false;
  label: string;
  path: string;
  error: AdminApiErrorDetails;
  fetchedAt: number;
  status?: number;
};

export type AdminFeesOnchainResult =
  | AdminFeesOnchainSuccess
  | AdminFeesOnchainFailure;

// V2G-G: read-only snapshot from /admin/fees/v2/observability.
//
// The backing endpoint always pre-seeds the three consumer buckets
// (`new`/`old`/`unknown`) at zero so the V2G-G Grafana panels have a
// stable signal from the first scrape after boot. Raw addresses are
// never promoted to bucket labels — operators see configured engine
// addresses only via the `contracts` block.
//
// See `deopt-v2-backend/docs/V2_FEE_PRODUCTION_OBSERVABILITY_V2G_G.md`
// for the backend-side overview and
// `deopt-v2-backend/src/fees/v2_observability.rs::admin_v2_observability`
// for the shape contract.
export type AdminFeeV2ObservabilityBuckets = {
  new: number;
  old: number;
  unknown: number;
};

export type AdminFeeV2ObservabilitySuccess = {
  ok: true;
  label: string;
  path: string;
  data: JsonValue;
  fetchedAt: number;
  status: number;
};

export type AdminFeeV2ObservabilityFailure = {
  ok: false;
  label: string;
  path: string;
  error: AdminApiErrorDetails;
  fetchedAt: number;
  status?: number;
};

export type AdminFeeV2ObservabilityResult =
  | AdminFeeV2ObservabilitySuccess
  | AdminFeeV2ObservabilityFailure;

// V2G-M: read-only snapshot from /admin/fees/v2/smoke/readiness.
//
// Shape contract:
// - `engines.*` -- lowercased addresses (or null when unset)
// - `smoke_eoas.tier4_maker_address` / `tier2_taker_address` -- pinned
//   V2G-D2 EOAs (addresses only, NEVER a private key)
// - `smoke_eoas.key_env_vars.{maker,taker}` -- env var NAMES the
//   operator must export for signing; the endpoint never reads values
// - `broadcast_gates.*` -- runtime safety toggles, all `false`
//   (or `dry_run=true`) during the local-compose soak window
// - `dry_run_packets.{perp,option}` -- canonical PERP/OPTION packet
//   skeletons with `null` placeholders for trade-specific basis +
//   expected fee/rebate/budget delta numerics
//
// Backend source-of-truth:
// `deopt-v2-backend/src/fees/smoke_readiness.rs::admin_v2_smoke_readiness`
// Doc: `deopt-v2-backend/docs/V2_FEE_BACKEND_EXECUTOR_READINESS_V2G_M.md`
export type AdminFeeV2SmokeReadinessSuccess = {
  ok: true;
  label: string;
  path: string;
  data: JsonValue;
  fetchedAt: number;
  status: number;
};

export type AdminFeeV2SmokeReadinessFailure = {
  ok: false;
  label: string;
  path: string;
  error: AdminApiErrorDetails;
  fetchedAt: number;
  status?: number;
};

export type AdminFeeV2SmokeReadinessResult =
  | AdminFeeV2SmokeReadinessSuccess
  | AdminFeeV2SmokeReadinessFailure;
