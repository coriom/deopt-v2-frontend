"use client";

import {
  fetchAdminFeesOnchain,
  fetchAdminFeesV2Observability,
  fetchAdminFeesV2SmokeReadiness,
  fetchAdminSnapshot,
  fetchOptionExecutionLifecycle,
  getAdminBaseUrl,
  RECENT_LIMITS,
  toAdminErrorDetails,
} from "@/lib/admin-api";
import type {
  AdminApiErrorDetails,
  AdminEndpointFailure,
  AdminEndpointKey,
  AdminEndpointResult,
  AdminEndpointSuccess,
  AdminFeesOnchainResult,
  AdminFeeV2ObservabilityResult,
  AdminFeeV2SmokeReadinessResult,
  AdminLifecycleResult,
  AdminSnapshot,
  JsonObject,
  JsonValue,
  RecentLimit,
} from "@/types/admin";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ProductionReadinessSection } from "./production-readiness-section";

const TOKEN_STORAGE_KEY = "deopt.adminToken";
const AUTO_REFRESH_MS = 10_000;
const KNOWN_V1S_OPTION_INTENT_ID = "e6d2941b-65f7-413a-958f-74ab22c53b08";
const KNOWN_V2E_G_OPTION_INTENT_ID = "94897ee5-e855-40b6-a917-1476578fe48b";
const KNOWN_V2E_G_TX_HASH =
  "0xd51ea881cdbc32fe724034c0f7e25ade7359ea3d5b6cadb17b7c345effefc72c";
// V2G-E live rebate broadcasts (PERP + OPTION). These two tx hashes are
// the source-of-truth fixtures the V2G-G dashboard panel quick-fills.
// See `deopt-v2-backend/docs/FEES_MANAGER_V2_LIVE_REBATE_SMOKE_RESULT_V2G_E.md`.
const KNOWN_V2G_E_PERP_TX_HASH =
  "0x5c15e9233d49729cf21058a89f49bc6fdf0f7295cda5a7f313c96556728aa394";
const KNOWN_V2G_E_OPTION_TX_HASH =
  "0x9a85cbced2216bf3c18049111cce68883cb0b035e194b3dcbaaf4fe7d5293149";

const EMPTY_RESULTS: Partial<AdminSnapshot> = {};

const STATUS_FIELDS = [
  "service",
  "ok",
  "timestamp_ms",
  "network",
  "chain_id",
  "persistence_enabled",
  "execution_enabled",
  "real_broadcast_enabled",
  "indexer_enabled",
  "reconciliation_enabled",
  "confirmation_enabled",
  "mm_gateway_enabled",
  "rfq_enabled",
  "options_enabled",
  "option_rfq_enabled",
] as const;

const FEE_EVENT_COLUMNS = [
  "source_type",
  "source_id",
  "market_type",
  "flow_type",
  "maker",
  "taker",
  "payer",
  "recipient",
  "fee_asset",
  "notional_1e8",
  "fee_rate_micro_bps",
  "fee_amount_1e8",
  "rebate_rate_micro_bps",
  "rebate_amount_1e8",
  "protocol_amount_1e8",
  "status",
  "created_at_ms",
] as const;

const VOLUME_BUCKET_COLUMNS = [
  "account",
  "bucket_day",
  "market_type",
  "maker_volume_1e8",
  "taker_volume_1e8",
  "total_volume_1e8",
  "updated_at_ms",
] as const;

const REBATE_ACCRUAL_COLUMNS = [
  "account",
  "source_type",
  "source_id",
  "rebate_asset",
  "rebate_amount_1e8",
  "status",
  "created_at_ms",
] as const;

const SECTION_ORDER: AdminEndpointKey[] = [
  "status",
  "config",
  "db",
  "mmSessions",
  "executionSummary",
  "rfqSummary",
  "optionsSummary",
];

const FEE_ENDPOINT_KEYS = [
  "feeSummary",
  "feeEvents",
  "feeVolumes",
  "feeRebates",
] as const satisfies readonly AdminEndpointKey[];

export function AdminDashboard() {
  const [token, setToken] = useState("");
  const [tokenReady, setTokenReady] = useState(false);
  const [recentLimit, setRecentLimit] = useState<RecentLimit>(20);
  const [feeEventsLimit, setFeeEventsLimit] = useState<RecentLimit>(20);
  const [feeAccountFilter, setFeeAccountFilter] = useState("");
  const [lifecycleIntentId, setLifecycleIntentId] = useState("");
  const [isLifecycleLoading, setIsLifecycleLoading] = useState(false);
  const [lifecycleResult, setLifecycleResult] =
    useState<AdminLifecycleResult | null>(null);
  const [feesOnchainTxHash, setFeesOnchainTxHash] = useState("");
  const [isFeesOnchainLoading, setIsFeesOnchainLoading] = useState(false);
  const [feesOnchainResult, setFeesOnchainResult] =
    useState<AdminFeesOnchainResult | null>(null);
  const [isV2ObservabilityLoading, setIsV2ObservabilityLoading] =
    useState(false);
  const [v2ObservabilityResult, setV2ObservabilityResult] =
    useState<AdminFeeV2ObservabilityResult | null>(null);
  const [isV2SmokeReadinessLoading, setIsV2SmokeReadinessLoading] =
    useState(false);
  const [v2SmokeReadinessResult, setV2SmokeReadinessResult] =
    useState<AdminFeeV2SmokeReadinessResult | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [results, setResults] =
    useState<Partial<AdminSnapshot>>(EMPTY_RESULTS);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lifecycleAbortRef = useRef<AbortController | null>(null);
  const feesOnchainAbortRef = useRef<AbortController | null>(null);
  const v2ObservabilityAbortRef = useRef<AbortController | null>(null);
  const v2SmokeReadinessAbortRef = useRef<AbortController | null>(null);
  const didInitialRefreshRef = useRef(false);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;
    setIsRefreshing(true);

    try {
      const snapshot = await fetchAdminSnapshot(
        token,
        recentLimit,
        feeEventsLimit,
        feeAccountFilter,
        controller.signal,
      );
      setResults(snapshot);
      setLastRefreshAt(Date.now());
    } catch (error) {
      if (!isAbortError(error)) {
        setResults((currentResults) => ({
          ...currentResults,
        }));
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsRefreshing(false);
      }
    }
  }, [feeAccountFilter, feeEventsLimit, recentLimit, token]);

  const loadLifecycle = useCallback(async () => {
    const normalizedIntentId = lifecycleIntentId.trim();
    if (!normalizedIntentId) {
      return;
    }

    lifecycleAbortRef.current?.abort();

    const controller = new AbortController();
    lifecycleAbortRef.current = controller;
    setIsLifecycleLoading(true);

    const path = `/admin/options/executions/${encodeURIComponent(
      normalizedIntentId,
    )}/lifecycle`;

    try {
      const result = await fetchOptionExecutionLifecycle(
        token,
        normalizedIntentId,
        controller.signal,
      );
      setLifecycleResult(result);
    } catch (error) {
      if (!isAbortError(error)) {
        const details = toAdminErrorDetails(error);
        setLifecycleResult({
          error: details,
          fetchedAt: Date.now(),
          label: "Option Execution Lifecycle",
          ok: false,
          path,
          status: details.status,
        });
      }
    } finally {
      if (lifecycleAbortRef.current === controller) {
        lifecycleAbortRef.current = null;
        setIsLifecycleLoading(false);
      }
    }
  }, [lifecycleIntentId, token]);

  useEffect(() => {
    const storedToken = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedToken) {
      setToken(storedToken);
    }
    setTokenReady(true);
  }, []);

  useEffect(() => {
    if (tokenReady && !didInitialRefreshRef.current) {
      didInitialRefreshRef.current = true;
      void refresh();
    }
  }, [refresh, tokenReady]);

  useEffect(() => {
    if (!autoRefresh || !tokenReady) {
      return;
    }

    const interval = window.setInterval(() => {
      void refresh();
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(interval);
  }, [autoRefresh, refresh, tokenReady]);

  const loadFeesOnchain = useCallback(async () => {
    const normalizedTxHash = feesOnchainTxHash.trim();

    feesOnchainAbortRef.current?.abort();

    const controller = new AbortController();
    feesOnchainAbortRef.current = controller;
    setIsFeesOnchainLoading(true);

    const query = normalizedTxHash
      ? `?tx_hash=${encodeURIComponent(normalizedTxHash)}`
      : "";
    const path = `/admin/fees/onchain${query}`;

    try {
      const result = await fetchAdminFeesOnchain(
        token,
        normalizedTxHash,
        controller.signal,
      );
      setFeesOnchainResult(result);
    } catch (error) {
      if (!isAbortError(error)) {
        const details = toAdminErrorDetails(error);
        setFeesOnchainResult({
          error: details,
          fetchedAt: Date.now(),
          label: "On-chain Fee Events",
          ok: false,
          path,
          status: details.status,
        });
      }
    } finally {
      if (feesOnchainAbortRef.current === controller) {
        feesOnchainAbortRef.current = null;
        setIsFeesOnchainLoading(false);
      }
    }
  }, [feesOnchainTxHash, token]);

  const loadV2Observability = useCallback(async () => {
    v2ObservabilityAbortRef.current?.abort();

    const controller = new AbortController();
    v2ObservabilityAbortRef.current = controller;
    setIsV2ObservabilityLoading(true);

    try {
      const result = await fetchAdminFeesV2Observability(
        token,
        controller.signal,
      );
      setV2ObservabilityResult(result);
    } catch (error) {
      if (!isAbortError(error)) {
        const details = toAdminErrorDetails(error);
        setV2ObservabilityResult({
          error: details,
          fetchedAt: Date.now(),
          label: "V2 Fee Observability",
          ok: false,
          path: "/admin/fees/v2/observability",
          status: details.status,
        });
      }
    } finally {
      if (v2ObservabilityAbortRef.current === controller) {
        v2ObservabilityAbortRef.current = null;
        setIsV2ObservabilityLoading(false);
      }
    }
  }, [token]);

  // Auto-load the V2G-G observability snapshot once on token-ready.
  // The snapshot is read-only and cheap, so it doubles as an at-a-glance
  // health card; explicit refresh remains available via the button.
  useEffect(() => {
    if (tokenReady) {
      void loadV2Observability();
    }
  }, [tokenReady, loadV2Observability]);

  const loadV2SmokeReadiness = useCallback(async () => {
    v2SmokeReadinessAbortRef.current?.abort();

    const controller = new AbortController();
    v2SmokeReadinessAbortRef.current = controller;
    setIsV2SmokeReadinessLoading(true);

    try {
      const result = await fetchAdminFeesV2SmokeReadiness(
        token,
        controller.signal,
      );
      setV2SmokeReadinessResult(result);
    } catch (error) {
      if (!isAbortError(error)) {
        const details = toAdminErrorDetails(error);
        setV2SmokeReadinessResult({
          error: details,
          fetchedAt: Date.now(),
          label: "V2 Fee Smoke Readiness",
          ok: false,
          path: "/admin/fees/v2/smoke/readiness",
          status: details.status,
        });
      }
    } finally {
      if (v2SmokeReadinessAbortRef.current === controller) {
        v2SmokeReadinessAbortRef.current = null;
        setIsV2SmokeReadinessLoading(false);
      }
    }
  }, [token]);

  // Auto-load the V2G-M smoke readiness snapshot on token-ready. Like
  // the observability snapshot, this is read-only and cheap.
  useEffect(() => {
    if (tokenReady) {
      void loadV2SmokeReadiness();
    }
  }, [tokenReady, loadV2SmokeReadiness]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      lifecycleAbortRef.current?.abort();
      feesOnchainAbortRef.current?.abort();
      v2ObservabilityAbortRef.current?.abort();
      v2SmokeReadinessAbortRef.current?.abort();
    };
  }, []);

  const systemMessage = useMemo(() => getSystemMessage(results), [results]);
  const statusResult = results.status;
  const configResult = results.config;
  const dangerFlags = getDangerFlags(statusResult, configResult);

  function handleTokenChange(value: string) {
    setToken(value);

    if (value) {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, value);
    } else {
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }

  function clearToken() {
    setToken("");
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-neutral-800 pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              DeOpt v2
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-white sm:text-3xl">
              Admin Operations
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
              <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 font-mono">
                GET only
              </span>
              <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 font-mono">
                {getAdminBaseUrl()}
              </span>
              <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1">
                Last refresh:{" "}
                {lastRefreshAt ? formatDateTime(lastRefreshAt) : "never"}
              </span>
            </div>
          </div>

          <div className="grid gap-3 rounded border border-neutral-800 bg-neutral-900/80 p-3 sm:grid-cols-[minmax(220px,360px)_auto_auto] sm:items-end">
            <label className="grid gap-1">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">
                Admin Token
              </span>
              <input
                className="h-9 rounded border border-neutral-700 bg-neutral-950 px-3 font-mono text-sm text-neutral-100 outline-none transition focus:border-cyan-400"
                onChange={(event) => handleTokenChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void refresh();
                  }
                }}
                placeholder="X-Admin-Token"
                spellCheck={false}
                type="password"
                value={token}
              />
            </label>
            <button
              className="h-9 rounded border border-neutral-700 px-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!token}
              onClick={clearToken}
              type="button"
            >
              Clear
            </button>
            <button
              className="h-9 rounded bg-cyan-400 px-4 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-70"
              disabled={isRefreshing || !tokenReady}
              onClick={() => void refresh()}
              type="button"
            >
              {isRefreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </header>

        <section className="grid gap-3 rounded border border-neutral-800 bg-neutral-900/60 p-3 xl:grid-cols-[1fr_auto_auto_auto_minmax(240px,380px)] xl:items-center">
          <div className="flex flex-wrap items-center gap-2">
            {dangerFlags.map((flag) => (
              <span
                className={
                  flag.active
                    ? "rounded border border-red-500/60 bg-red-950 px-2.5 py-1 text-sm font-semibold text-red-100"
                    : "rounded border border-emerald-500/40 bg-emerald-950/70 px-2.5 py-1 text-sm font-medium text-emerald-100"
                }
                key={flag.key}
              >
                {flag.label}: {flag.active ? "true" : "false"}
              </span>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input
              checked={autoRefresh}
              className="h-4 w-4 accent-cyan-400"
              onChange={(event) => setAutoRefresh(event.target.checked)}
              type="checkbox"
            />
            Auto-refresh 10s
          </label>

          <label className="flex items-center gap-2 text-sm text-neutral-300">
            Recent limit
            <select
              className="h-8 rounded border border-neutral-700 bg-neutral-950 px-2 text-sm text-neutral-100"
              onChange={(event) => {
                const value = Number(event.target.value) as RecentLimit;
                if (RECENT_LIMITS.includes(value)) {
                  setRecentLimit(value);
                }
              }}
              value={recentLimit}
            >
              {RECENT_LIMITS.map((limit) => (
                <option key={limit} value={limit}>
                  {limit}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-neutral-300">
            Fee events
            <select
              className="h-8 rounded border border-neutral-700 bg-neutral-950 px-2 text-sm text-neutral-100"
              onChange={(event) => {
                const value = Number(event.target.value) as RecentLimit;
                if (RECENT_LIMITS.includes(value)) {
                  setFeeEventsLimit(value);
                }
              }}
              value={feeEventsLimit}
            >
              {RECENT_LIMITS.map((limit) => (
                <option key={limit} value={limit}>
                  {limit}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm text-neutral-300">
            <span>Fee account filter</span>
            <input
              className="h-8 rounded border border-neutral-700 bg-neutral-950 px-2 font-mono text-sm text-neutral-100 outline-none transition focus:border-cyan-400"
              onChange={(event) => setFeeAccountFilter(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void refresh();
                }
              }}
              placeholder="All accounts or 0x..."
              spellCheck={false}
              value={feeAccountFilter}
            />
          </label>
        </section>

        {systemMessage ? <SystemBanner message={systemMessage} /> : null}

        <div className="grid gap-4">
          {SECTION_ORDER.map((key) => {
            const result = results[key];
            return (
              <DashboardSection
                isLoading={isRefreshing && !result}
                key={key}
                result={result}
                sectionKey={key}
              />
            );
          })}
          <OptionLifecycleSection
            intentId={lifecycleIntentId}
            isLoading={isLifecycleLoading}
            onIntentIdChange={setLifecycleIntentId}
            onLoad={() => void loadLifecycle()}
            onQuickFillV1S={() =>
              setLifecycleIntentId(KNOWN_V1S_OPTION_INTENT_ID)
            }
            onQuickFillV2EG={() =>
              setLifecycleIntentId(KNOWN_V2E_G_OPTION_INTENT_ID)
            }
            result={lifecycleResult}
          />
          <ProductionReadinessSection
            observability={v2ObservabilityResult}
            smokeReadiness={v2SmokeReadinessResult}
            feesOnchain={feesOnchainResult}
          />
          <V2FeeObservabilitySection
            isLoading={isV2ObservabilityLoading}
            onLoad={() => void loadV2Observability()}
            onQuickFillPerpTxHash={() =>
              setFeesOnchainTxHash(KNOWN_V2G_E_PERP_TX_HASH)
            }
            onQuickFillOptionTxHash={() =>
              setFeesOnchainTxHash(KNOWN_V2G_E_OPTION_TX_HASH)
            }
            result={v2ObservabilityResult}
          />
          <V2FeeSmokeReadinessSection
            isLoading={isV2SmokeReadinessLoading}
            onLoad={() => void loadV2SmokeReadiness()}
            result={v2SmokeReadinessResult}
          />
          <AdminFeesOnchainSection
            isLoading={isFeesOnchainLoading}
            onLoad={() => void loadFeesOnchain()}
            onQuickFillV2EG={() => setFeesOnchainTxHash(KNOWN_V2E_G_TX_HASH)}
            onTxHashChange={setFeesOnchainTxHash}
            result={feesOnchainResult}
            txHash={feesOnchainTxHash}
          />
          <FeesDashboardSection
            accountFilter={feeAccountFilter}
            eventsLimit={feeEventsLimit}
            isRefreshing={isRefreshing}
            results={results}
          />
          <DashboardSection
            isLoading={isRefreshing && !results.recent}
            result={results.recent}
            sectionKey="recent"
          />
        </div>
      </div>
    </main>
  );
}

function DashboardSection({
  isLoading,
  result,
  sectionKey,
}: {
  isLoading: boolean;
  result?: AdminEndpointResult;
  sectionKey: AdminEndpointKey;
}) {
  const title = result?.label ?? fallbackLabel(sectionKey);
  const path = result?.path ?? fallbackPath(sectionKey);

  return (
    <section className="rounded border border-neutral-800 bg-neutral-900/70">
      <div className="flex flex-col gap-2 border-b border-neutral-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="mt-1 font-mono text-xs text-neutral-500">{path}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          {result ? (
            <>
              <span
                className={
                  result.ok
                    ? "rounded bg-emerald-950 px-2 py-1 text-emerald-200"
                    : "rounded bg-red-950 px-2 py-1 text-red-200"
                }
              >
                {result.ok ? `HTTP ${result.status}` : errorStatus(result)}
              </span>
              <span>{formatDateTime(result.fetchedAt)}</span>
            </>
          ) : (
            <span>{isLoading ? "Loading" : "Idle"}</span>
          )}
        </div>
      </div>

      <div className="p-4">
        {!result ? (
          <EmptyState text={isLoading ? "Loading section." : "No data loaded."} />
        ) : result.ok ? (
          <SectionBody result={result} sectionKey={sectionKey} />
        ) : (
          <ErrorPanel error={result.error} />
        )}
      </div>
    </section>
  );
}

function OptionLifecycleSection({
  intentId,
  isLoading,
  onIntentIdChange,
  onLoad,
  onQuickFillV1S,
  onQuickFillV2EG,
  result,
}: {
  intentId: string;
  isLoading: boolean;
  onIntentIdChange: (value: string) => void;
  onLoad: () => void;
  onQuickFillV1S: () => void;
  onQuickFillV2EG: () => void;
  result: AdminLifecycleResult | null;
}) {
  const path =
    result?.path ??
    "/admin/options/executions/:intent_id/lifecycle";
  const canLoad = Boolean(intentId.trim()) && !isLoading;

  return (
    <section className="rounded border border-neutral-800 bg-neutral-900/70">
      <div className="flex flex-col gap-3 border-b border-neutral-800 px-4 py-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">
            Option Execution Lifecycle
          </h2>
          <p className="mt-1 font-mono text-xs text-neutral-500">
            GET {path}
          </p>
        </div>
        <LifecycleEndpointStatus isLoading={isLoading} result={result} />
      </div>

      <div className="grid gap-4 p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto_auto_auto] xl:items-end">
          <label className="grid gap-1 text-sm text-neutral-300">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">
              Intent ID
            </span>
            <input
              className="h-9 rounded border border-neutral-700 bg-neutral-950 px-3 font-mono text-sm text-neutral-100 outline-none transition focus:border-cyan-400"
              onChange={(event) => onIntentIdChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canLoad) {
                  onLoad();
                }
              }}
              placeholder="Option execution intent UUID"
              spellCheck={false}
              value={intentId}
            />
          </label>
          <button
            className="h-9 rounded border border-neutral-700 px-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800"
            onClick={onQuickFillV1S}
            type="button"
          >
            Fill V1S Intent
          </button>
          <button
            className="h-9 rounded border border-neutral-700 px-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800"
            onClick={onQuickFillV2EG}
            type="button"
          >
            Fill V2E-G Intent
          </button>
          <button
            className="h-9 rounded bg-cyan-400 px-4 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canLoad}
            onClick={onLoad}
            type="button"
          >
            {isLoading ? "Loading" : "Load lifecycle"}
          </button>
        </div>

        {!result ? (
          <EmptyState
            text={
              isLoading
                ? "Loading lifecycle."
                : "Enter an option execution intent id to load the lifecycle."
            }
          />
        ) : result.ok ? (
          <OptionLifecycleView data={result.data} />
        ) : (
          <ErrorPanel error={result.error} />
        )}
      </div>
    </section>
  );
}

function LifecycleEndpointStatus({
  isLoading,
  result,
}: {
  isLoading: boolean;
  result: AdminLifecycleResult | null;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500">
      {result ? (
        <>
          <span
            className={
              result.ok
                ? "rounded bg-emerald-950 px-2 py-1 text-emerald-200"
                : "rounded bg-red-950 px-2 py-1 text-red-200"
            }
          >
            {result.ok ? `HTTP ${result.status}` : lifecycleErrorStatus(result)}
          </span>
          <span>{formatDateTime(result.fetchedAt)}</span>
        </>
      ) : (
        <span>{isLoading ? "Loading" : "Idle"}</span>
      )}
    </div>
  );
}

function AdminFeesOnchainSection({
  isLoading,
  onLoad,
  onQuickFillV2EG,
  onTxHashChange,
  result,
  txHash,
}: {
  isLoading: boolean;
  onLoad: () => void;
  onQuickFillV2EG: () => void;
  onTxHashChange: (value: string) => void;
  result: AdminFeesOnchainResult | null;
  txHash: string;
}) {
  const trimmedTxHash = txHash.trim();
  const queryFragment = trimmedTxHash
    ? `?tx_hash=${trimmedTxHash}`
    : "";
  const path = result?.path ?? `/admin/fees/onchain${queryFragment}`;
  const canLoad = !isLoading;

  return (
    <section className="rounded border border-neutral-800 bg-neutral-900/70">
      <div className="flex flex-col gap-3 border-b border-neutral-800 px-4 py-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">
            On-chain Fee Events
          </h2>
          <p className="mt-1 font-mono text-xs text-neutral-500">
            GET {path}
          </p>
        </div>
        <FeesOnchainEndpointStatus isLoading={isLoading} result={result} />
      </div>

      <div className="grid gap-4 p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto_auto] xl:items-end">
          <label className="grid gap-1 text-sm text-neutral-300">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">
              Tx Hash (optional)
            </span>
            <input
              className="h-9 rounded border border-neutral-700 bg-neutral-950 px-3 font-mono text-sm text-neutral-100 outline-none transition focus:border-cyan-400"
              onChange={(event) => onTxHashChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canLoad) {
                  onLoad();
                }
              }}
              placeholder="0x... (empty = all observed fee events)"
              spellCheck={false}
              value={txHash}
            />
          </label>
          <button
            className="h-9 rounded border border-neutral-700 px-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800"
            onClick={onQuickFillV2EG}
            type="button"
          >
            Fill V2E-G Tx
          </button>
          <button
            className="h-9 rounded bg-cyan-400 px-4 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canLoad}
            onClick={onLoad}
            type="button"
          >
            {isLoading ? "Loading" : "Load on-chain fees"}
          </button>
        </div>

        {!result ? (
          <EmptyState
            text={
              isLoading
                ? "Loading on-chain fees."
                : "Load to fetch /admin/fees/onchain. Optional tx_hash filter."
            }
          />
        ) : result.ok ? (
          <AdminFeesOnchainView data={result.data} />
        ) : (
          <ErrorPanel error={result.error} />
        )}
      </div>
    </section>
  );
}

// V2G-M: read-only V2 fee smoke readiness section. Reads
// `/admin/fees/v2/smoke/readiness` and renders the V2G-D2 EOA
// registry, the broadcast-gate snapshot, and the canonical PERP/OPTION
// dry-run packet skeletons that operators preflight before broadcast.
// NEVER displays a private key — only the boolean presence of the
// maker/taker env vars. No write buttons, no wallet signing.
function V2FeeSmokeReadinessSection({
  isLoading,
  onLoad,
  result,
}: {
  isLoading: boolean;
  onLoad: () => void;
  result: AdminFeeV2SmokeReadinessResult | null;
}) {
  const path = result?.path ?? "/admin/fees/v2/smoke/readiness";

  return (
    <section className="rounded border border-neutral-800 bg-neutral-900/70">
      <div className="flex flex-col gap-3 border-b border-neutral-800 px-4 py-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">
            V2 Fee Smoke Readiness (V2G-M)
          </h2>
          <p className="mt-1 font-mono text-xs text-neutral-500">GET {path}</p>
        </div>
        <V2SmokeReadinessEndpointStatus
          isLoading={isLoading}
          result={result}
        />
      </div>

      <div className="grid gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="h-9 rounded bg-cyan-400 px-4 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={onLoad}
            type="button"
          >
            {isLoading ? "Refreshing" : "Refresh snapshot"}
          </button>
          <span className="text-xs text-neutral-500">
            Read-only. No keys. No writes.
          </span>
        </div>

        {!result ? (
          <EmptyState
            text={
              isLoading
                ? "Loading V2 fee smoke readiness snapshot."
                : "Snapshot not loaded yet. Click Refresh."
            }
          />
        ) : result.ok ? (
          <V2FeeSmokeReadinessView data={result.data} />
        ) : (
          <ErrorPanel error={result.error} />
        )}
      </div>
    </section>
  );
}

function V2SmokeReadinessEndpointStatus({
  isLoading,
  result,
}: {
  isLoading: boolean;
  result: AdminFeeV2SmokeReadinessResult | null;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500">
      {result ? (
        <>
          <span
            className={
              result.ok
                ? "rounded bg-emerald-950 px-2 py-1 text-emerald-200"
                : "rounded bg-red-950 px-2 py-1 text-red-200"
            }
          >
            {result.ok
              ? `HTTP ${result.status}`
              : result.status
                ? `HTTP ${result.status}`
                : "ERR"}
          </span>
          <span>{formatDateTime(result.fetchedAt)}</span>
        </>
      ) : (
        <span>{isLoading ? "Loading" : "Idle"}</span>
      )}
    </div>
  );
}

function V2FeeSmokeReadinessView({ data }: { data: JsonValue }) {
  if (!isJsonObject(data)) {
    return <EmptyState text="Snapshot response was not a JSON object." />;
  }

  const engines = isJsonObject(data.engines) ? data.engines : {};
  const smokeEoas = isJsonObject(data.smoke_eoas) ? data.smoke_eoas : {};
  const keyEnvs = isJsonObject(smokeEoas.key_env_vars)
    ? smokeEoas.key_env_vars
    : {};
  const gates = isJsonObject(data.broadcast_gates) ? data.broadcast_gates : {};
  const packets = isJsonObject(data.dry_run_packets)
    ? data.dry_run_packets
    : {};
  const safe = data.soak_safe_for_local_compose === true;
  const activeIsOld = data.active_perp_is_old_engine === true;

  return (
    <div className="grid gap-4">
      <div>
        <Subheading>Status flags</Subheading>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="safe_to_broadcast_today"
            value={safe ? "yes" : "no"}
            variant={safe ? "ok" : "warn"}
          />
          <MetricCard
            label="active_perp_is_old_engine"
            value={activeIsOld ? "YES — abort" : "no"}
            variant={activeIsOld ? "danger" : "ok"}
          />
          <MetricCard
            label="Milestone"
            value={valueAsString(data.milestone) || "V2G-M"}
          />
          <MetricCard
            label="Soak mode"
            value="local-compose"
            variant="muted"
          />
        </div>
      </div>

      <div>
        <Subheading>Smoke EOAs (V2G-D2)</Subheading>
        <div className="grid gap-2 sm:grid-cols-2">
          <MetricCard
            label="Tier 4 maker"
            value={valueAsString(smokeEoas.tier4_maker_address) || "unset"}
          />
          <MetricCard
            label="Tier 2 taker"
            value={valueAsString(smokeEoas.tier2_taker_address) || "unset"}
          />
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Private keys are shell-only. The names below are the env vars
          the operator exports for the standalone signing CLIs — the
          backend never reads their values.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <MetricCard
            label={`Maker key env (set? = ${gates.maker_key_env_set ? "yes" : "no"})`}
            value={valueAsString(keyEnvs.maker) || "unset"}
            variant={gates.maker_key_env_set ? "ok" : "muted"}
          />
          <MetricCard
            label={`Taker key env (set? = ${gates.taker_key_env_set ? "yes" : "no"})`}
            value={valueAsString(keyEnvs.taker) || "unset"}
            variant={gates.taker_key_env_set ? "ok" : "muted"}
          />
        </div>
      </div>

      <div>
        <Subheading>Engine wiring</Subheading>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="NEW PerpEngine"
            value={valueAsString(engines.perp_engine_new) || "unset"}
            variant={engines.perp_engine_new ? "normal" : "warn"}
          />
          <MetricCard
            label="OLD PerpEngine (observability-only)"
            value={valueAsString(engines.perp_engine_old) || "unset"}
            variant="muted"
          />
          <MetricCard
            label="NEW MarginEngine"
            value={valueAsString(engines.margin_engine_new) || "unset"}
            variant={engines.margin_engine_new ? "normal" : "warn"}
          />
          <MetricCard
            label="OLD MarginEngine (observability-only)"
            value={valueAsString(engines.margin_engine_old) || "unset"}
            variant="muted"
          />
          <MetricCard
            label="FeesManagerV2"
            value={valueAsString(engines.fees_manager_v2) || "unset"}
            variant={engines.fees_manager_v2 ? "normal" : "warn"}
          />
        </div>
      </div>

      <div>
        <Subheading>Broadcast gates</Subheading>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="execution_enabled"
            value={String(gates.execution_enabled ?? false)}
            variant={gates.execution_enabled ? "warn" : "ok"}
          />
          <MetricCard
            label="executor_dry_run"
            value={String(gates.executor_dry_run ?? false)}
            variant={gates.executor_dry_run ? "ok" : "warn"}
          />
          <MetricCard
            label="executor_real_broadcast_enabled"
            value={String(gates.executor_real_broadcast_enabled ?? false)}
            variant={
              gates.executor_real_broadcast_enabled ? "danger" : "ok"
            }
          />
          <MetricCard
            label="option_execution_broadcast_enabled"
            value={String(
              gates.option_execution_broadcast_enabled ?? false,
            )}
            variant={
              gates.option_execution_broadcast_enabled ? "danger" : "ok"
            }
          />
          <MetricCard
            label="executor_private_key_set"
            value={String(gates.executor_private_key_set ?? false)}
            variant={gates.executor_private_key_set ? "warn" : "muted"}
          />
        </div>
      </div>

      <div>
        <Subheading>Dry-run packet skeletons</Subheading>
        <p className="mb-2 text-xs text-neutral-500">
          Trade-specific numeric fields (`basis_amount_native`,
          `expected_fee_amount_native`, `expected_rebate_amount_native`,
          `expected_rebate_budget_delta_native`) start as `null`. The
          operator fills them per broadcast and re-runs the
          `validate_numeric_invariants` test before signing.
        </p>
        <div className="grid gap-4 xl:grid-cols-2">
          <SmokePacketCard
            label="PERP packet"
            packet={isJsonObject(packets.perp) ? packets.perp : null}
          />
          <SmokePacketCard
            label="OPTION packet"
            packet={isJsonObject(packets.option) ? packets.option : null}
          />
        </div>
      </div>
    </div>
  );
}

function SmokePacketCard({
  label,
  packet,
}: {
  label: string;
  packet: JsonObject | null;
}) {
  if (!packet) {
    return (
      <div className="rounded border border-neutral-800 bg-neutral-950/60 p-3">
        <Subheading>{label}</Subheading>
        <EmptyState text="Packet not present (engines unset)." />
      </div>
    );
  }
  const makerProfile = isJsonObject(packet.maker_profile)
    ? packet.maker_profile
    : {};
  const takerProfile = isJsonObject(packet.taker_profile)
    ? packet.taker_profile
    : {};
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/60 p-3">
      <Subheading>{label}</Subheading>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="text-neutral-500">product</span>
        <span className="font-mono text-neutral-200">
          {valueAsString(packet.product)}
        </span>
        <span className="text-neutral-500">flow</span>
        <span className="font-mono text-neutral-200">
          {valueAsString(packet.flow)}
        </span>
        <span className="text-neutral-500">fee_consumer</span>
        <span className="break-all font-mono text-neutral-200">
          {valueAsString(packet.fee_consumer_address)}
        </span>
        <span className="text-neutral-500">maker_address</span>
        <span className="break-all font-mono text-neutral-200">
          {valueAsString(packet.maker_address)}
        </span>
        <span className="text-neutral-500">taker_address</span>
        <span className="break-all font-mono text-neutral-200">
          {valueAsString(packet.taker_address)}
        </span>
        <span className="text-neutral-500">
          maker tier / ppm (maker / taker)
        </span>
        <span className="font-mono text-neutral-200">
          {String(makerProfile.tier ?? "?")} / {String(makerProfile.maker_ppm ?? "?")} /{" "}
          {String(makerProfile.taker_ppm ?? "?")}
        </span>
        <span className="text-neutral-500">
          taker tier / ppm (maker / taker)
        </span>
        <span className="font-mono text-neutral-200">
          {String(takerProfile.tier ?? "?")} / {String(takerProfile.maker_ppm ?? "?")} /{" "}
          {String(takerProfile.taker_ppm ?? "?")}
        </span>
        <span className="text-neutral-500">basis_amount_native</span>
        <span className="font-mono text-neutral-200">
          {packet.basis_amount_native == null
            ? "null (operator fills)"
            : String(packet.basis_amount_native)}
        </span>
        <span className="text-neutral-500">expected_fee_amount_native</span>
        <span className="font-mono text-neutral-200">
          {packet.expected_fee_amount_native == null
            ? "null"
            : String(packet.expected_fee_amount_native)}
        </span>
        <span className="text-neutral-500">expected_rebate_amount_native</span>
        <span className="font-mono text-neutral-200">
          {packet.expected_rebate_amount_native == null
            ? "null"
            : String(packet.expected_rebate_amount_native)}
        </span>
        <span className="text-neutral-500">
          expected_rebate_budget_delta_native
        </span>
        <span className="font-mono text-neutral-200">
          {packet.expected_rebate_budget_delta_native == null
            ? "null"
            : String(packet.expected_rebate_budget_delta_native)}
        </span>
        <span className="text-neutral-500">safe_to_broadcast_today</span>
        <span className="font-mono text-neutral-200">
          {String(packet.safe_to_broadcast_today)}
        </span>
      </div>
    </div>
  );
}

// V2G-G: read-only V2 fee observability section. Reads
// `/admin/fees/v2/observability` and surfaces the same data the V2G-G
// Grafana dashboard renders: PERP + OPTION FeeChargedV2 / FeeRebatedV2
// bucketed by consumer (`new` / `old` / `unknown`), the derived rebate
// budget per settlement asset, and the configured engine addresses the
// classifier is using right now. OLD-consumer / unknown-consumer
// counts are highlighted when non-zero so operators see the same
// alert state Prometheus does, without leaving the admin page.
function V2FeeObservabilitySection({
  isLoading,
  onLoad,
  onQuickFillPerpTxHash,
  onQuickFillOptionTxHash,
  result,
}: {
  isLoading: boolean;
  onLoad: () => void;
  onQuickFillPerpTxHash: () => void;
  onQuickFillOptionTxHash: () => void;
  result: AdminFeeV2ObservabilityResult | null;
}) {
  const path = result?.path ?? "/admin/fees/v2/observability";

  return (
    <section className="rounded border border-neutral-800 bg-neutral-900/70">
      <div className="flex flex-col gap-3 border-b border-neutral-800 px-4 py-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">
            V2 Fee Observability (V2G-G)
          </h2>
          <p className="mt-1 font-mono text-xs text-neutral-500">
            GET {path}
          </p>
        </div>
        <V2ObservabilityEndpointStatus
          isLoading={isLoading}
          result={result}
        />
      </div>

      <div className="grid gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="h-9 rounded border border-neutral-700 px-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800"
            onClick={onQuickFillPerpTxHash}
            type="button"
          >
            Fill V2G-E PERP tx (below)
          </button>
          <button
            className="h-9 rounded border border-neutral-700 px-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800"
            onClick={onQuickFillOptionTxHash}
            type="button"
          >
            Fill V2G-E OPTION tx (below)
          </button>
          <button
            className="h-9 rounded bg-cyan-400 px-4 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={onLoad}
            type="button"
          >
            {isLoading ? "Refreshing" : "Refresh snapshot"}
          </button>
        </div>

        {!result ? (
          <EmptyState
            text={
              isLoading
                ? "Loading V2 fee observability snapshot."
                : "Snapshot not loaded yet. Click Refresh."
            }
          />
        ) : result.ok ? (
          <V2FeeObservabilityView data={result.data} />
        ) : (
          <ErrorPanel error={result.error} />
        )}
      </div>
    </section>
  );
}

function V2ObservabilityEndpointStatus({
  isLoading,
  result,
}: {
  isLoading: boolean;
  result: AdminFeeV2ObservabilityResult | null;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500">
      {result ? (
        <>
          <span
            className={
              result.ok
                ? "rounded bg-emerald-950 px-2 py-1 text-emerald-200"
                : "rounded bg-red-950 px-2 py-1 text-red-200"
            }
          >
            {result.ok
              ? `HTTP ${result.status}`
              : result.status
                ? `HTTP ${result.status}`
                : "ERR"}
          </span>
          <span>{formatDateTime(result.fetchedAt)}</span>
        </>
      ) : (
        <span>{isLoading ? "Loading" : "Idle"}</span>
      )}
    </div>
  );
}

function V2FeeObservabilityView({ data }: { data: JsonValue }) {
  if (!isJsonObject(data)) {
    return <EmptyState text="Snapshot response was not a JSON object." />;
  }

  const network = isJsonObject(data.network) ? data.network : {};
  const features = isJsonObject(data.features) ? data.features : {};
  const contracts = isJsonObject(data.contracts) ? data.contracts : {};
  const metrics = isJsonObject(data.metrics) ? data.metrics : {};
  const anomaly = isJsonObject(data.anomaly_totals)
    ? data.anomaly_totals
    : {};

  const oldEvents = readBucketCount(anomaly.old_consumer_events);
  const unknownEvents = readBucketCount(anomaly.unknown_consumer_events);
  const oldVariant = oldEvents > 0 ? "danger" : "ok";
  const unknownVariant = unknownEvents > 0 ? "warn" : "ok";

  const budgetObject = isJsonObject(metrics.fees_manager_v2_rebate_budget_native)
    ? metrics.fees_manager_v2_rebate_budget_native
    : {};

  const perpCharged = bucketsFromValue(
    metrics.perp_fee_charged_v2_by_consumer,
  );
  const perpRebated = bucketsFromValue(
    metrics.perp_fee_rebated_v2_by_consumer,
  );
  const optionCharged = bucketsFromValue(
    metrics.option_fee_charged_v2_by_consumer,
  );
  const optionRebated = bucketsFromValue(
    metrics.option_fee_rebated_v2_by_consumer,
  );

  return (
    <div className="grid gap-4">
      <div>
        <Subheading>Anomaly totals</Subheading>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="OLD consumer events (PERP+OPTION)"
            value={oldEvents.toString()}
            variant={oldVariant}
          />
          <MetricCard
            label="Unknown consumer events (PERP+OPTION)"
            value={unknownEvents.toString()}
            variant={unknownVariant}
          />
          <MetricCard
            label="Network"
            value={`${valueAsString(network.network_name) || "unknown"} (chain ${
              valueAsString(network.chain_id) || "?"
            })`}
          />
          <MetricCard
            label="Milestone"
            value={valueAsString(data.milestone) || "V2G-G"}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BucketCountsCard
          title="PERP FeeChargedV2 by consumer"
          buckets={perpCharged}
        />
        <BucketCountsCard
          title="PERP FeeRebatedV2 by consumer"
          buckets={perpRebated}
        />
        <BucketCountsCard
          title="OPTION FeeChargedV2 by consumer"
          buckets={optionCharged}
        />
        <BucketCountsCard
          title="OPTION FeeRebatedV2 by consumer"
          buckets={optionRebated}
        />
      </div>

      <div>
        <Subheading>FeesManagerV2 rebate budget (native units)</Subheading>
        <RebateBudgetTable budget={budgetObject} />
      </div>

      <div>
        <Subheading>Active engine wiring (classifier inputs)</Subheading>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="NEW PerpEngine"
            value={valueAsString(contracts.perp_engine_new) || "unset"}
            variant={contracts.perp_engine_new == null ? "warn" : "normal"}
          />
          <MetricCard
            label="OLD PerpEngine (observability-only)"
            value={valueAsString(contracts.perp_engine_old) || "unset"}
            variant="muted"
          />
          <MetricCard
            label="NEW MarginEngine"
            value={valueAsString(contracts.margin_engine_new) || "unset"}
            variant={contracts.margin_engine_new == null ? "warn" : "normal"}
          />
          <MetricCard
            label="OLD MarginEngine (observability-only)"
            value={valueAsString(contracts.margin_engine_old) || "unset"}
            variant="muted"
          />
          <MetricCard
            label="FeesManagerV2"
            value={valueAsString(contracts.fees_manager_v2) || "unset"}
            variant={contracts.fees_manager_v2 == null ? "warn" : "normal"}
          />
        </div>
      </div>

      <div>
        <Subheading>Runtime feature flags</Subheading>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="metrics_enabled"
            value={String(features.metrics_enabled ?? false)}
            variant={features.metrics_enabled ? "ok" : "warn"}
          />
          <MetricCard
            label="option_event_indexer_enabled"
            value={String(features.option_event_indexer_enabled ?? false)}
            variant={
              features.option_event_indexer_enabled ? "ok" : "warn"
            }
          />
          <MetricCard
            label="fees_enabled"
            value={String(features.fees_enabled ?? false)}
          />
          <MetricCard
            label="rebates_enabled"
            value={String(features.rebates_enabled ?? false)}
          />
          <MetricCard
            label="persistence_enabled"
            value={String(features.persistence_enabled ?? false)}
          />
        </div>
      </div>
    </div>
  );
}

function BucketCountsCard({
  title,
  buckets,
}: {
  title: string;
  buckets: { new: number; old: number; unknown: number };
}) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/60 p-3">
      <Subheading>{title}</Subheading>
      <div className="grid grid-cols-3 gap-2">
        <MetricCard label="new" value={buckets.new.toString()} variant="ok" />
        <MetricCard
          label="old"
          value={buckets.old.toString()}
          variant={buckets.old > 0 ? "danger" : "muted"}
        />
        <MetricCard
          label="unknown"
          value={buckets.unknown.toString()}
          variant={buckets.unknown > 0 ? "warn" : "muted"}
        />
      </div>
    </div>
  );
}

function RebateBudgetTable({
  budget,
}: {
  budget: JsonObject;
}) {
  const entries = Object.entries(budget);
  if (entries.length === 0) {
    return (
      <EmptyState text="No RebateBudgetFunded/Spent/Withdrawn events indexed yet." />
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-neutral-800 bg-neutral-950/60">
      <table className="min-w-full text-xs">
        <thead className="bg-neutral-900 text-left text-[11px] uppercase tracking-[0.08em] text-neutral-400">
          <tr>
            <th className="px-3 py-2">Settlement asset (lowercased)</th>
            <th className="px-3 py-2">Derived budget (native units)</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([asset, value]) => {
            const numeric = readBucketCount(value);
            return (
              <tr key={asset} className="border-t border-neutral-800">
                <td className="px-3 py-2 font-mono text-neutral-200">
                  {asset}
                </td>
                <td className="px-3 py-2 font-mono text-neutral-100">
                  {numeric.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function bucketsFromValue(value: JsonValue | undefined) {
  if (!isJsonObject(value)) {
    return { new: 0, old: 0, unknown: 0 };
  }
  return {
    new: readBucketCount(value.new),
    old: readBucketCount(value.old),
    unknown: readBucketCount(value.unknown),
  };
}

function readBucketCount(value: JsonValue | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function valueAsString(value: JsonValue | undefined): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value.toString();
  }
  return "";
}

function FeesOnchainEndpointStatus({
  isLoading,
  result,
}: {
  isLoading: boolean;
  result: AdminFeesOnchainResult | null;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500">
      {result ? (
        <>
          <span
            className={
              result.ok
                ? "rounded bg-emerald-950 px-2 py-1 text-emerald-200"
                : "rounded bg-red-950 px-2 py-1 text-red-200"
            }
          >
            {result.ok
              ? `HTTP ${result.status}`
              : result.status
                ? `HTTP ${result.status}`
                : "ERR"}
          </span>
          <span>{formatDateTime(result.fetchedAt)}</span>
        </>
      ) : (
        <span>{isLoading ? "Loading" : "Idle"}</span>
      )}
    </div>
  );
}

function AdminFeesOnchainView({ data }: { data: JsonValue }) {
  if (!isJsonObject(data)) {
    return <GenericDataView value={data} />;
  }

  const eventModel = stringValue(data.event_model);
  const sourcePriority = stringValue(data.source_priority);
  const feeRebatedV2Count = toFiniteNumber(data.fee_rebated_v2_count);
  const feeChargedV2Count = toFiniteNumber(data.fee_charged_v2_count);
  const transactions = arrayField(data, "transactions");
  const events = arrayField(data, "events");
  const byTrader = objectField(data, "by_trader");
  const byRecipient = objectField(data, "by_recipient");
  const bySide = objectField(data, "by_side");
  const rebatedByTrader = objectField(data, "rebated_by_trader");
  const filter = objectField(data, "filter");

  return (
    <div className="grid gap-4">
      <LifecycleFeesEventModelBanner
        eventModel={eventModel}
        feeRebatedV2Count={feeRebatedV2Count}
        sourcePriority={sourcePriority}
      />

      {filter ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
          <span className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono">
            tx_hash: {filter.tx_hash ? String(filter.tx_hash) : "all"}
          </span>
          <span className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono">
            limit: {filter.limit !== undefined ? String(filter.limit) : "n/a"}
          </span>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <MetricCard
          label="Event Model"
          value={formatDisplayValue("event_model", data.event_model)}
          variant={
            eventModel === "mixed"
              ? "warn"
              : eventModel === "v2"
                ? "ok"
                : "normal"
          }
        />
        <MetricCard
          label="Source Priority"
          value={formatDisplayValue("source_priority", data.source_priority)}
          variant={sourcePriority === "v2" ? "ok" : "muted"}
        />
        <MetricCard
          label="FeeChargedV2 Count"
          value={formatDisplayValue(
            "fee_charged_v2_count",
            data.fee_charged_v2_count,
          )}
          variant={
            feeChargedV2Count !== null && feeChargedV2Count > 0
              ? "ok"
              : "muted"
          }
        />
        <MetricCard
          label="FeeRebatedV2 Count"
          value={formatDisplayValue(
            "fee_rebated_v2_count",
            data.fee_rebated_v2_count,
          )}
          variant={
            feeRebatedV2Count !== null && feeRebatedV2Count > 0
              ? "ok"
              : "muted"
          }
        />
        <MetricCard
          label="Trading Fee Event Count"
          value={formatDisplayValue(
            "trading_fee_event_count",
            data.trading_fee_event_count,
          )}
        />
        <MetricCard
          label="Observed Total Charged"
          value={formatDisplayValue(
            "observed_total_charged",
            data.observed_total_charged,
          )}
        />
        <MetricCard
          label="Observed Total Rebated"
          value={formatDisplayValue(
            "observed_total_rebated",
            data.observed_total_rebated,
          )}
        />
        <MetricCard
          label="Net Protocol Fee"
          value={formatDisplayValue("net_protocol_fee", data.net_protocol_fee)}
        />
        <MetricCard
          label="Backend Ledger Status"
          value={formatDisplayValue(
            "backend_ledger_status",
            data.backend_ledger_status,
          )}
          variant="muted"
        />
        <MetricCard
          label="Reconciliation Status"
          value={formatDisplayValue(
            "reconciliation_status",
            data.reconciliation_status,
          )}
          variant="muted"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <Subheading>By Side</Subheading>
          <LifecycleCountTable
            emptyText="No per-side totals."
            keyLabel="Side"
            value={bySide}
            valueLabel="Charged"
          />
        </div>
        <div>
          <Subheading>By Trader (Charged)</Subheading>
          <LifecycleCountTable
            emptyText="No per-trader totals."
            keyLabel="Trader"
            value={byTrader}
            valueLabel="Charged"
          />
        </div>
        <div>
          <Subheading>By Recipient</Subheading>
          <LifecycleCountTable
            emptyText="No per-recipient totals."
            keyLabel="Recipient"
            value={byRecipient}
            valueLabel="Total"
          />
        </div>
      </div>

      {rebatedByTrader && Object.keys(rebatedByTrader).length ? (
        <div>
          <Subheading>Rebated By Trader (V2)</Subheading>
          <LifecycleCountTable
            emptyText="No rebates recorded."
            keyLabel="Trader"
            value={rebatedByTrader}
            valueLabel="Rebated"
          />
        </div>
      ) : null}

      <div>
        <Subheading>Per-Tx Breakdown</Subheading>
        {transactions?.length ? (
          <JsonTable rows={transactions} />
        ) : (
          <EmptyState text="No per-tx breakdown." />
        )}
      </div>

      <div>
        <Subheading>Fee Events</Subheading>
        {events?.length ? (
          <JsonTable rows={events} />
        ) : (
          <EmptyState text="No fee events." />
        )}
      </div>
    </div>
  );
}

function OptionLifecycleView({ data }: { data: JsonValue }) {
  if (!isJsonObject(data)) {
    return <GenericDataView value={data} />;
  }

  return (
    <div className="grid gap-5">
      <LifecycleHealthSection health={objectField(data, "health")} />
      <LifecycleIntentSection data={data} />
      <LifecycleMetadataSection metadata={objectField(data, "metadata")} />
      <LifecycleSignaturesSection signatures={objectField(data, "signatures")} />
      <LifecycleSimulationSection simulation={objectField(data, "simulation")} />
      <LifecycleCalldataSection calldata={objectField(data, "calldata")} />
      <LifecycleBroadcastSection broadcast={objectField(data, "broadcast")} />
      <LifecycleConfirmationSection
        confirmation={objectField(data, "confirmation")}
      />
      <LifecycleEventsSection events={objectField(data, "events")} />
      <LifecycleFeesSection fees={objectField(data, "fees")} />
      <LifecycleTransfersSection transfers={objectField(data, "transfers")} />
      <LifecycleReconciliationSection
        reconciliation={objectField(data, "reconciliation")}
      />
    </div>
  );
}

function LifecycleDetailSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="border-t border-neutral-800 pt-5 first:border-t-0 first:pt-0">
      <Subheading>{title}</Subheading>
      {children}
    </div>
  );
}

function LifecycleHealthSection({
  health,
}: {
  health: JsonObject | null;
}) {
  if (!health) {
    return (
      <LifecycleDetailSection title="Health">
        <EmptyState text="No health data." />
      </LifecycleDetailSection>
    );
  }

  const stage = stringValue(health.stage);
  const warnings = stringArrayField(health, "warnings");
  const errors = stringArrayField(health, "errors");
  const isTerminalSuccess = health.is_terminal_success === true;
  const stageTone =
    stage === "failed" || errors.length
      ? "danger"
      : warnings.length
        ? "warn"
        : stage === "reconciled"
          ? "ok"
          : "neutral";

  return (
    <LifecycleDetailSection title="Health">
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <LifecycleBadge tone={stageTone}>stage: {stage || "n/a"}</LifecycleBadge>
          <LifecycleBadge tone={isTerminalSuccess ? "ok" : "neutral"}>
            terminal success: {isTerminalSuccess ? "true" : "false"}
          </LifecycleBadge>
          <LifecycleBadge tone={warnings.length ? "warn" : "neutral"}>
            warnings: {warnings.length}
          </LifecycleBadge>
          <LifecycleBadge tone={errors.length ? "danger" : "neutral"}>
            errors: {errors.length}
          </LifecycleBadge>
        </div>

        {warnings.length ? (
          <LifecycleList title="Warnings" values={warnings} />
        ) : null}
        {errors.length ? <LifecycleList title="Errors" values={errors} /> : null}
      </div>
    </LifecycleDetailSection>
  );
}

function LifecycleIntentSection({ data }: { data: JsonObject }) {
  const intent = objectField(data, "intent");
  const source = objectField(data, "source");
  const trade = objectField(data, "trade");

  const fields: LifecycleField[] = [
    {
      key: "intent_id",
      label: "Intent ID",
      value: firstDefined(data.intent_id, intent?.intent_id),
    },
    {
      key: "status",
      label: "Status",
      value: firstDefined(data.status, intent?.status),
    },
    {
      key: "source_type",
      label: "Source Type",
      value: firstDefined(source?.source_type, intent?.source_type),
    },
    {
      key: "source_id",
      label: "Source ID",
      value: firstDefined(source?.source_id, intent?.source_id),
    },
    {
      key: "buyer",
      label: "Buyer",
      value: firstDefined(trade?.buyer, intent?.buyer),
    },
    {
      key: "seller",
      label: "Seller",
      value: firstDefined(trade?.seller, intent?.seller),
    },
    {
      key: "option_id",
      label: "Option ID",
      value: firstDefined(trade?.option_id, intent?.option_id),
    },
    {
      key: "quantity_contracts",
      label: "Quantity",
      value: firstDefined(
        trade?.quantity,
        trade?.quantity_contracts,
        intent?.quantity,
        intent?.quantity_contracts,
      ),
    },
    {
      key: "premium_per_contract_native",
      label: "Premium",
      value: firstDefined(
        trade?.premium,
        trade?.premium_per_contract_native,
        intent?.premium,
        intent?.premium_per_contract_native,
      ),
    },
    {
      key: "buyer_is_maker",
      label: "Buyer Is Maker",
      value: firstDefined(trade?.buyer_is_maker, intent?.buyer_is_maker),
    },
    {
      key: "onchain_intent_id",
      label: "Onchain Intent ID",
      value: firstDefined(trade?.onchain_intent_id, intent?.onchain_intent_id),
    },
  ];

  return (
    <LifecycleDetailSection title="Intent / Trade">
      <LifecycleFieldTable fields={fields} />
    </LifecycleDetailSection>
  );
}

function LifecycleMetadataSection({
  metadata,
}: {
  metadata: JsonObject | null;
}) {
  const fields: LifecycleField[] = [
    {
      key: "underlying",
      label: "Underlying",
      value: metadata?.underlying,
    },
    {
      key: "settlement_asset",
      label: "Settlement Asset",
      value: metadata?.settlement_asset,
    },
    {
      key: "expiry",
      label: "Expiry",
      value: metadata?.expiry,
    },
    {
      key: "strike_1e8",
      label: "Strike",
      value: firstDefined(metadata?.strike, metadata?.strike_1e8),
    },
    {
      key: "contract_size_1e8",
      label: "Contract Size 1e8",
      value: metadata?.contract_size_1e8,
    },
    {
      key: "is_call",
      label: "Is Call",
      value: metadata?.is_call,
    },
    {
      key: "is_european",
      label: "Is European",
      value: metadata?.is_european,
    },
  ];

  return (
    <LifecycleDetailSection title="Option Metadata">
      <LifecycleFieldTable fields={fields} />
    </LifecycleDetailSection>
  );
}

function LifecycleSignaturesSection({
  signatures,
}: {
  signatures: JsonObject | null;
}) {
  const fields: LifecycleField[] = [
    {
      key: "buyer_signature_present",
      label: "Buyer Signature Present",
      value: signatures?.buyer_signature_present,
    },
    {
      key: "seller_signature_present",
      label: "Seller Signature Present",
      value: signatures?.seller_signature_present,
    },
    {
      key: "signature_mode",
      label: "Signature Mode",
      value: signatures?.signature_mode,
    },
  ];

  return (
    <LifecycleDetailSection title="Signatures">
      <LifecycleFieldTable fields={fields} />
    </LifecycleDetailSection>
  );
}

function LifecycleSimulationSection({
  simulation,
}: {
  simulation: JsonObject | null;
}) {
  const fields: LifecycleField[] = [
    {
      key: "status",
      label: "Simulation Status",
      value: simulation?.status,
    },
    {
      key: "block_number",
      label: "Simulation Block",
      value: simulation?.block_number,
    },
    {
      key: "simulated_at_ms",
      label: "Simulated At",
      value: simulation?.simulated_at_ms,
    },
    {
      key: "error",
      label: "Error",
      value: simulation?.error,
    },
    {
      key: "revert_selector",
      label: "Revert Selector",
      value: simulation?.revert_selector,
    },
  ];

  return (
    <LifecycleDetailSection title="Simulation">
      <LifecycleFieldTable fields={fields} />
    </LifecycleDetailSection>
  );
}

function LifecycleCalldataSection({
  calldata,
}: {
  calldata: JsonObject | null;
}) {
  const fields: LifecycleField[] = [
    {
      key: "present",
      label: "Present",
      value: calldata?.present,
    },
    {
      key: "selector",
      label: "Calldata Selector",
      value: calldata?.selector,
    },
    {
      key: "hex_length",
      label: "Calldata Hex Length",
      value: calldata?.hex_length,
    },
    {
      key: "byte_length",
      label: "Calldata Byte Length",
      value: calldata?.byte_length,
    },
  ];

  return (
    <LifecycleDetailSection title="Calldata">
      <LifecycleFieldTable fields={fields} />
    </LifecycleDetailSection>
  );
}

function LifecycleBroadcastSection({
  broadcast,
}: {
  broadcast: JsonObject | null;
}) {
  if (!broadcast) {
    return (
      <LifecycleDetailSection title="Broadcast / Gas Safety">
        <EmptyState text="No broadcast transaction row." />
      </LifecycleDetailSection>
    );
  }

  const fields: LifecycleField[] = [
    {
      key: "transaction_id",
      label: "Transaction ID",
      value: broadcast.transaction_id,
    },
    {
      key: "tx_hash",
      label: "Tx Hash",
      value: broadcast.tx_hash,
    },
    {
      key: "from",
      label: "From",
      value: broadcast.from,
    },
    {
      key: "to",
      label: "To",
      value: broadcast.to,
    },
    {
      key: "status",
      label: "Broadcast Status",
      value: broadcast.status,
    },
    {
      key: "gas_check_status",
      label: "Gas Check Status",
      value: broadcast.gas_check_status,
    },
    {
      key: "estimated_gas",
      label: "Estimated Gas",
      value: broadcast.estimated_gas,
    },
    {
      key: "required_gas",
      label: "Required Gas",
      value: broadcast.required_gas,
    },
    {
      key: "broadcast_gas_limit",
      label: "Broadcast Gas Limit",
      value: broadcast.broadcast_gas_limit,
    },
    {
      key: "gas_safety_bps",
      label: "Gas Safety Bps",
      value: broadcast.gas_safety_bps,
    },
    {
      key: "gas_limit",
      label: "Gas Limit",
      value: broadcast.gas_limit,
    },
    {
      key: "simulation_gas_limit",
      label: "Simulation Gas Limit",
      value: broadcast.simulation_gas_limit,
    },
    {
      key: "gas_check_error",
      label: "Gas Check Error",
      value: broadcast.gas_check_error,
    },
    {
      key: "created_at_ms",
      label: "Created At",
      value: broadcast.created_at_ms,
    },
    {
      key: "updated_at_ms",
      label: "Updated At",
      value: broadcast.updated_at_ms,
    },
  ];

  return (
    <LifecycleDetailSection title="Broadcast / Gas Safety">
      <LifecycleFieldTable fields={fields} />
    </LifecycleDetailSection>
  );
}

function LifecycleConfirmationSection({
  confirmation,
}: {
  confirmation: JsonObject | null;
}) {
  if (!confirmation) {
    return (
      <LifecycleDetailSection title="Confirmation">
        <EmptyState text="No confirmation data." />
      </LifecycleDetailSection>
    );
  }

  const fields: LifecycleField[] = [
    {
      key: "confirmation_status",
      label: "Confirmation Status",
      value: confirmation.confirmation_status,
    },
    {
      key: "receipt_status",
      label: "Receipt Status",
      value: confirmation.receipt_status,
    },
    {
      key: "confirmed_block_number",
      label: "Confirmed Block",
      value: confirmation.confirmed_block_number,
    },
    {
      key: "confirmed_at_ms",
      label: "Confirmed At",
      value: confirmation.confirmed_at_ms,
    },
    {
      key: "gas_used",
      label: "Gas Used",
      value: confirmation.gas_used,
    },
    {
      key: "effective_gas_price",
      label: "Effective Gas Price",
      value: confirmation.effective_gas_price,
    },
    {
      key: "cumulative_gas_used",
      label: "Cumulative Gas Used",
      value: confirmation.cumulative_gas_used,
    },
    {
      key: "receipt_block_hash",
      label: "Receipt Block Hash",
      value: confirmation.receipt_block_hash,
    },
    {
      key: "receipt_transaction_index",
      label: "Receipt Transaction Index",
      value: confirmation.receipt_transaction_index,
    },
    {
      key: "receipt_observed_at_ms",
      label: "Receipt Observed At",
      value: confirmation.receipt_observed_at_ms,
    },
    {
      key: "confirmation_error",
      label: "Confirmation Error",
      value: confirmation.confirmation_error,
    },
  ];

  return (
    <LifecycleDetailSection title="Confirmation">
      <LifecycleFieldTable fields={fields} />
    </LifecycleDetailSection>
  );
}

function LifecycleEventsSection({ events }: { events: JsonObject | null }) {
  const recent = arrayField(events, "recent");
  const countsByName = objectField(events, "counts_by_event_name");
  const countsByAddress = objectField(events, "counts_by_contract_address");

  return (
    <LifecycleDetailSection title="Events">
      {!events ? (
        <EmptyState text="No event summary." />
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total Event Count"
              value={formatDisplayValue("total", events.total)}
              variant="normal"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <Subheading>Counts By Event Name</Subheading>
              <LifecycleCountTable
                emptyText="No event-name counts."
                keyLabel="Event"
                value={countsByName}
                valueLabel="Count"
              />
            </div>
            <div>
              <Subheading>Counts By Contract Address</Subheading>
              <LifecycleCountTable
                emptyText="No contract-address counts."
                keyLabel="Contract Address"
                value={countsByAddress}
                valueLabel="Count"
              />
            </div>
          </div>

          <div>
            <Subheading>Recent Events</Subheading>
            {recent?.length ? (
              <JsonTable rows={recent} />
            ) : (
              <EmptyState text="No recent events." />
            )}
          </div>
        </div>
      )}
    </LifecycleDetailSection>
  );
}

function LifecycleFeesSection({ fees }: { fees: JsonObject | null }) {
  const feeEvents = arrayField(fees, "events");
  const totalsByRecipient = objectField(
    fees,
    "by_recipient",
  ) ?? objectField(fees, "total_by_recipient");
  const byTrader = objectField(fees, "by_trader");
  const bySide = objectField(fees, "by_side");
  const rebatedByTrader = objectField(fees, "rebated_by_trader");

  const eventModel = stringValue(fees?.event_model);
  const sourcePriority = stringValue(fees?.source_priority);
  const feeChargedV2Count = toFiniteNumber(fees?.fee_charged_v2_count);
  const feeRebatedV2Count = toFiniteNumber(fees?.fee_rebated_v2_count);

  const v2Charged =
    feeEvents?.filter(
      (row) =>
        isJsonObject(row) &&
        row.event_name === "FeeChargedV2",
    ) ?? [];
  const v2Rebated =
    feeEvents?.filter(
      (row) =>
        isJsonObject(row) &&
        row.event_name === "FeeRebatedV2",
    ) ?? [];

  return (
    <LifecycleDetailSection title="Fees">
      {!fees ? (
        <EmptyState text="No fee summary." />
      ) : (
        <div className="grid gap-4">
          <LifecycleFeesEventModelBanner
            eventModel={eventModel}
            feeRebatedV2Count={feeRebatedV2Count}
            sourcePriority={sourcePriority}
          />

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <MetricCard
              label="Event Model"
              value={formatDisplayValue("event_model", fees.event_model)}
              variant={
                eventModel === "mixed"
                  ? "warn"
                  : eventModel === "v2"
                    ? "ok"
                    : "normal"
              }
            />
            <MetricCard
              label="Source Priority"
              value={formatDisplayValue("source_priority", fees.source_priority)}
              variant={sourcePriority === "v2" ? "ok" : "muted"}
            />
            <MetricCard
              label="Trading Fee Event Count"
              value={formatDisplayValue(
                "trading_fee_event_count",
                fees.trading_fee_event_count,
              )}
            />
            <MetricCard
              label="FeeChargedV2 Count"
              value={formatDisplayValue(
                "fee_charged_v2_count",
                fees.fee_charged_v2_count,
              )}
              variant={
                feeChargedV2Count !== null && feeChargedV2Count > 0
                  ? "ok"
                  : "muted"
              }
            />
            <MetricCard
              label="FeeRebatedV2 Count"
              value={formatDisplayValue(
                "fee_rebated_v2_count",
                fees.fee_rebated_v2_count,
              )}
              variant={
                feeRebatedV2Count !== null && feeRebatedV2Count > 0
                  ? "ok"
                  : "muted"
              }
            />
            <MetricCard
              label="Observed Total Charged"
              value={formatDisplayValue(
                "observed_total_charged",
                fees.observed_total_charged,
              )}
            />
            <MetricCard
              label="Observed Total Rebated"
              value={formatDisplayValue(
                "observed_total_rebated",
                fees.observed_total_rebated,
              )}
            />
            <MetricCard
              label="Net Protocol Fee"
              value={formatDisplayValue(
                "net_protocol_fee",
                fees.net_protocol_fee,
              )}
            />
            <MetricCard
              label="Backend Ledger Status"
              value={formatDisplayValue(
                "backend_ledger_status",
                fees.backend_ledger_status,
              )}
              variant="muted"
            />
            <MetricCard
              label="Reconciliation Status"
              value={formatDisplayValue(
                "reconciliation_status",
                fees.reconciliation_status,
              )}
              variant="muted"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Subheading>By Side</Subheading>
              <LifecycleCountTable
                emptyText="No per-side totals."
                keyLabel="Side"
                value={bySide}
                valueLabel="Charged"
              />
            </div>
            <div>
              <Subheading>By Trader (Charged)</Subheading>
              <LifecycleCountTable
                emptyText="No per-trader totals."
                keyLabel="Trader"
                value={byTrader}
                valueLabel="Charged"
              />
            </div>
            <div>
              <Subheading>By Recipient</Subheading>
              <LifecycleCountTable
                emptyText="No recipient fee totals."
                keyLabel="Recipient"
                value={totalsByRecipient}
                valueLabel="Total"
              />
            </div>
          </div>

          {rebatedByTrader && Object.keys(rebatedByTrader).length ? (
            <div>
              <Subheading>Rebated By Trader (V2)</Subheading>
              <LifecycleCountTable
                emptyText="No rebates recorded."
                keyLabel="Trader"
                value={rebatedByTrader}
                valueLabel="Rebated"
              />
            </div>
          ) : null}

          <div className="grid gap-3">
            <Subheading>FeeChargedV2 Events</Subheading>
            {v2Charged.length ? (
              <LifecycleV2FeeEventCards entries={v2Charged} kind="charged" />
            ) : (
              <EmptyState text="No FeeChargedV2 events." />
            )}
          </div>

          {v2Rebated.length ? (
            <div className="grid gap-3">
              <Subheading>FeeRebatedV2 Events</Subheading>
              <LifecycleV2FeeEventCards entries={v2Rebated} kind="rebated" />
            </div>
          ) : null}

          <div>
            <Subheading>All Fee Events</Subheading>
            {feeEvents?.length ? (
              <JsonTable rows={feeEvents} />
            ) : (
              <EmptyState text="No fee events." />
            )}
          </div>
        </div>
      )}
    </LifecycleDetailSection>
  );
}

function LifecycleFeesEventModelBanner({
  eventModel,
  feeRebatedV2Count,
  sourcePriority,
}: {
  eventModel: string;
  feeRebatedV2Count: number | null;
  sourcePriority: string;
}) {
  const messages: { tone: "ok" | "warn" | "neutral"; text: string }[] = [];

  if (eventModel === "mixed") {
    messages.push({
      tone: "warn",
      text:
        "event_model = mixed: V2 is the source of truth; V1 compatibility " +
        "events (TradingFeeCharged) are present but not used for totals.",
    });
  } else if (eventModel === "v2") {
    messages.push({
      tone: "ok",
      text:
        "event_model = v2: totals come from FeeChargedV2 / FeeRebatedV2 only.",
    });
  } else if (eventModel === "v1") {
    messages.push({
      tone: "neutral",
      text:
        "event_model = v1: totals come from the legacy TradingFeeCharged " +
        "event stream only.",
    });
  } else if (eventModel === "none") {
    messages.push({
      tone: "neutral",
      text: "event_model = none: no fee events were indexed for this trade.",
    });
  }

  if (sourcePriority === "v2") {
    messages.push({
      tone: "ok",
      text: "source_priority = v2: totals use V2 FeeChargedV2 / FeeRebatedV2.",
    });
  }

  if (feeRebatedV2Count === 0) {
    messages.push({
      tone: "neutral",
      text: "No FeeRebatedV2 emitted (Tier0 has no negative maker ppm).",
    });
  }

  if (!messages.length) {
    return null;
  }

  return (
    <div className="grid gap-2">
      {messages.map((message, index) => (
        <div
          className={
            message.tone === "ok"
              ? "rounded border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100"
              : message.tone === "warn"
                ? "rounded border border-amber-500/50 bg-amber-950/50 px-3 py-2 text-sm text-amber-100"
                : "rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-300"
          }
          key={index}
        >
          {message.text}
        </div>
      ))}
    </div>
  );
}

function LifecycleV2FeeEventCards({
  entries,
  kind,
}: {
  entries: JsonValue[];
  kind: "charged" | "rebated";
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {entries.map((entry, index) => {
        if (!isJsonObject(entry)) {
          return (
            <div
              className="rounded border border-neutral-800 bg-neutral-950 p-3"
              key={index}
            >
              <JsonBlock compact value={entry} />
            </div>
          );
        }

        const fields: LifecycleField[] = [
          { key: "trader", label: "Trader", value: entry.trader },
          { key: "recipient", label: "Recipient", value: entry.recipient },
          {
            key: "productKind",
            label: "Product Kind",
            value: firstDefined(entry.product_kind, entry.productKind),
          },
          {
            key: "flowKind",
            label: "Flow Kind",
            value: firstDefined(entry.flow_kind, entry.flowKind),
          },
          {
            key: "isMaker",
            label: "Is Maker",
            value: firstDefined(entry.is_maker, entry.isMaker),
          },
          {
            key: "side",
            label: "Side",
            value: entry.side,
          },
          {
            key: "feePpm",
            label: kind === "rebated" ? "Rebate Ppm" : "Fee Ppm",
            value: firstDefined(
              kind === "rebated" ? entry.rebate_ppm : entry.fee_ppm,
              kind === "rebated" ? entry.rebatePpm : entry.feePpm,
            ),
          },
          {
            key: "basisAmount",
            label: "Basis Amount",
            value: firstDefined(entry.basis_amount, entry.basisAmount),
          },
          {
            key: "feeAmount",
            label: kind === "rebated" ? "Rebate Amount" : "Fee Amount",
            value: firstDefined(
              kind === "rebated" ? entry.rebate_amount : entry.fee_amount,
              kind === "rebated" ? entry.rebateAmount : entry.feeAmount,
              entry.applied_fee,
            ),
          },
          {
            key: "tx_hash",
            label: "Tx Hash",
            value: entry.tx_hash,
          },
          {
            key: "log_index",
            label: "Log Index",
            value: entry.log_index,
          },
          {
            key: "block_number",
            label: "Block",
            value: entry.block_number,
          },
          {
            key: "source_contract",
            label: "Source Contract",
            value: entry.source_contract,
          },
        ];

        return (
          <div
            className={
              kind === "rebated"
                ? "rounded border border-emerald-500/40 bg-emerald-950/30 p-3"
                : "rounded border border-cyan-500/40 bg-cyan-950/20 p-3"
            }
            key={index}
          >
            <LifecycleFieldTable fields={fields} />
          </div>
        );
      })}
    </div>
  );
}

function LifecycleTransfersSection({
  transfers,
}: {
  transfers: JsonObject | null;
}) {
  const transferEvents = arrayField(transfers, "events");

  return (
    <LifecycleDetailSection title="Transfers">
      {!transfers ? (
        <EmptyState text="No transfer summary." />
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Internal Transfer Count"
              value={formatDisplayValue(
                "internal_transfer_count",
                transfers.internal_transfer_count,
              )}
            />
          </div>
          <div>
            <Subheading>Transfer Events</Subheading>
            {transferEvents?.length ? (
              <JsonTable rows={transferEvents} />
            ) : (
              <EmptyState text="No transfer events." />
            )}
          </div>
        </div>
      )}
    </LifecycleDetailSection>
  );
}

function LifecycleReconciliationSection({
  reconciliation,
}: {
  reconciliation: JsonObject | null;
}) {
  if (!reconciliation) {
    return (
      <LifecycleDetailSection title="Reconciliation">
        <EmptyState text="No reconciliation row." />
      </LifecycleDetailSection>
    );
  }

  const fields: LifecycleField[] = [
    {
      key: "status",
      label: "Status",
      value: reconciliation.status,
    },
    {
      key: "event_check_status",
      label: "Event Check Status",
      value: reconciliation.event_check_status,
    },
    {
      key: "fee_check_status",
      label: "Fee Check Status",
      value: reconciliation.fee_check_status,
    },
    {
      key: "premium_check_status",
      label: "Premium Check Status",
      value: reconciliation.premium_check_status,
    },
    {
      key: "error",
      label: "Error",
      value: firstDefined(
        reconciliation.error,
        reconciliation.mismatch_reason,
        reconciliation.missing_required,
      ),
    },
    {
      key: "checked_at_ms",
      label: "Checked At",
      value: firstDefined(
        reconciliation.checked_at,
        reconciliation.checked_at_ms,
        reconciliation.reconciled_at_ms,
        reconciliation.updated_at_ms,
      ),
    },
    {
      key: "id",
      label: "Reconciliation ID",
      value: reconciliation.id,
    },
    {
      key: "trade_executed_event_id",
      label: "Trade Executed Event ID",
      value: reconciliation.trade_executed_event_id,
    },
    {
      key: "margin_trade_event_id",
      label: "Margin Trade Event ID",
      value: reconciliation.margin_trade_event_id,
    },
    {
      key: "trading_fee_event_count",
      label: "Trading Fee Event Count",
      value: reconciliation.trading_fee_event_count,
    },
    {
      key: "internal_transfer_event_count",
      label: "Internal Transfer Event Count",
      value: reconciliation.internal_transfer_event_count,
    },
    {
      key: "decoded_event_count",
      label: "Decoded Event Count",
      value: reconciliation.decoded_event_count,
    },
    {
      key: "strict",
      label: "Strict",
      value: reconciliation.strict,
    },
    {
      key: "requires_events",
      label: "Requires Events",
      value: reconciliation.requires_events,
    },
  ];

  return (
    <LifecycleDetailSection title="Reconciliation">
      <div className="grid gap-4">
        <LifecycleFieldTable fields={fields} />
        <div>
          <Subheading>Details JSON</Subheading>
          <JsonBlock compact value={reconciliation} />
        </div>
      </div>
    </LifecycleDetailSection>
  );
}

function LifecycleList({
  title,
  values,
}: {
  title: string;
  values: string[];
}) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
        {title}
      </div>
      <ul className="grid gap-1 text-sm text-neutral-200">
        {values.map((value, index) => (
          <li className="break-words font-mono" key={`${value}-${index}`}>
            {value}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LifecycleBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "danger" | "neutral" | "ok" | "warn";
}) {
  const className =
    tone === "danger"
      ? "border-red-500/50 bg-red-950/70 text-red-100"
      : tone === "ok"
        ? "border-emerald-500/40 bg-emerald-950/60 text-emerald-100"
        : tone === "warn"
          ? "border-amber-500/50 bg-amber-950/60 text-amber-100"
          : "border-neutral-800 bg-neutral-950 text-neutral-300";

  return (
    <span className={`rounded border px-2.5 py-1 text-sm font-medium ${className}`}>
      {children}
    </span>
  );
}

type LifecycleField = {
  key: string;
  label: string;
  value: JsonValue | undefined;
};

function LifecycleFieldTable({ fields }: { fields: LifecycleField[] }) {
  return (
    <div className="overflow-x-auto rounded border border-neutral-800">
      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
        <tbody>
          {fields.map((field) => (
            <tr
              className="border-b border-neutral-800 last:border-b-0"
              key={`${field.key}-${field.label}`}
            >
              <th className="w-64 bg-neutral-950 px-3 py-2 align-top text-xs font-medium uppercase tracking-[0.08em] text-neutral-500">
                {field.label}
              </th>
              <td className="px-3 py-2 align-top font-mono text-neutral-200">
                <LifecycleValue fieldKey={field.key} value={field.value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LifecycleCountTable({
  emptyText,
  keyLabel,
  value,
  valueLabel,
}: {
  emptyText: string;
  keyLabel: string;
  value: JsonObject | null;
  valueLabel: string;
}) {
  const entries = value ? Object.entries(value) : [];

  if (!entries.length) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <div className="overflow-x-auto rounded border border-neutral-800">
      <table className="w-full min-w-[420px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-950">
            <th className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
              {keyLabel}
            </th>
            <th className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
              {valueLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, entryValue]) => (
            <tr className="border-b border-neutral-800 last:border-b-0" key={key}>
              <td className="max-w-[420px] px-3 py-2 align-top font-mono text-xs text-neutral-200">
                <LifecycleValue fieldKey={keyLabel} value={key} />
              </td>
              <td className="px-3 py-2 align-top font-mono text-xs text-neutral-200">
                <LifecycleValue fieldKey={valueLabel} value={entryValue} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LifecycleValue({
  fieldKey,
  value,
}: {
  fieldKey: string;
  value: JsonValue | undefined;
}) {
  if (value === undefined) {
    return <span className="text-neutral-500">n/a</span>;
  }

  if (value === null) {
    return <span className="text-neutral-500">null</span>;
  }

  if (Array.isArray(value) || isJsonObject(value)) {
    return <JsonBlock compact value={value} />;
  }

  if (typeof value === "string" && isCopyableIdentifier(value)) {
    return <CopyableValue value={value} />;
  }

  if (fieldKey === "expiry") {
    return <>{formatTimestampWithRaw(value)}</>;
  }

  return <>{formatDisplayValue(fieldKey, value)}</>;
}

function CopyableValue({ value }: { value: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 align-top">
      <span
        className="inline-block max-w-[min(34rem,70vw)] select-all truncate align-top"
        title={value}
      >
        {shortenLongIdentifier(value)}
      </span>
      <button
        className="shrink-0 rounded border border-neutral-700 px-1.5 py-0.5 text-[11px] font-medium text-neutral-300 transition hover:border-neutral-500 hover:bg-neutral-800"
        onClick={() => copyToClipboard(value)}
        type="button"
      >
        Copy
      </button>
    </span>
  );
}

function objectField(value: JsonObject | null | undefined, key: string) {
  if (!value) {
    return null;
  }

  const entry = value[key];
  return isJsonObject(entry) ? entry : null;
}

function arrayField(value: JsonObject | null | undefined, key: string) {
  if (!value) {
    return null;
  }

  const entry = value[key];
  return Array.isArray(entry) ? entry : null;
}

function firstDefined(...values: (JsonValue | undefined)[]) {
  return values.find((value) => value !== undefined);
}

function toFiniteNumber(value: JsonValue | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    return readFiniteNumber(value);
  }
  return null;
}

function stringValue(value: JsonValue | undefined) {
  return typeof value === "string" ? value : "";
}

function stringArrayField(value: JsonObject, key: string) {
  const entry = value[key];
  if (!Array.isArray(entry)) {
    return [];
  }

  return entry.filter((item): item is string => typeof item === "string");
}

function isCopyableIdentifier(value: string) {
  return (
    /^0x[a-fA-F0-9]{16,}$/.test(value) ||
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      value,
    ) ||
    (value.length > 48 && !/\s/.test(value))
  );
}

function shortenLongIdentifier(value: string) {
  if (value.length <= 32) {
    return value;
  }

  if (value.startsWith("0x")) {
    return `${value.slice(0, 10)}...${value.slice(-8)}`;
  }

  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

function copyToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return;
  }

  void navigator.clipboard.writeText(value).catch(() => undefined);
}

function formatTimestampWithRaw(value: JsonValue) {
  if (typeof value !== "string" && typeof value !== "number") {
    return formatDisplayValue("expiry", value);
  }

  const timestamp = readFiniteNumber(value);
  const rawValue = String(value);
  if (timestamp === null) {
    return rawValue;
  }

  const formatted = formatDateTime(timestamp);
  return formatted === "n/a" ? rawValue : `${formatted} (${rawValue})`;
}

function lifecycleErrorStatus(result: Extract<AdminLifecycleResult, { ok: false }>) {
  return result.status ? `HTTP ${result.status}` : "ERR";
}

function FeesDashboardSection({
  accountFilter,
  eventsLimit,
  isRefreshing,
  results,
}: {
  accountFilter: string;
  eventsLimit: RecentLimit;
  isRefreshing: boolean;
  results: Partial<AdminSnapshot>;
}) {
  const feeResults = FEE_ENDPOINT_KEYS.map((key) => results[key]);
  const hasAnyResult = feeResults.some(Boolean);
  const trimmedAccount = accountFilter.trim();

  return (
    <section className="rounded border border-neutral-800 bg-neutral-900/70">
      <div className="flex flex-col gap-2 border-b border-neutral-800 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Fees & Rebates</h2>
          <p className="mt-1 font-mono text-xs text-neutral-500">
            GET /admin/fees/summary · /events · /volumes · /rebates
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <span className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1">
            events limit: {eventsLimit}
          </span>
          <span className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono">
            account: {trimmedAccount || "all"}
          </span>
          {!hasAnyResult ? (
            <span>{isRefreshing ? "Loading" : "Idle"}</span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 p-4">
        <FeeResultSection
          isLoading={isRefreshing && !results.feeSummary}
          result={results.feeSummary}
          sectionKey="feeSummary"
        >
          {(result) => <FeeSummarySection data={result.data} />}
        </FeeResultSection>

        <FeeResultSection
          isLoading={isRefreshing && !results.feeEvents}
          result={results.feeEvents}
          sectionKey="feeEvents"
        >
          {(result) => <FeeEventsSection data={result.data} />}
        </FeeResultSection>

        <FeeResultSection
          isLoading={isRefreshing && !results.feeVolumes}
          result={results.feeVolumes}
          sectionKey="feeVolumes"
        >
          {(result) => (
            <VolumeBucketsSection
              accountFilter={trimmedAccount}
              data={result.data}
            />
          )}
        </FeeResultSection>

        <FeeResultSection
          isLoading={isRefreshing && !results.feeRebates}
          result={results.feeRebates}
          sectionKey="feeRebates"
        >
          {(result) => (
            <RebateAccrualsSection
              accountFilter={trimmedAccount}
              data={result.data}
            />
          )}
        </FeeResultSection>
      </div>
    </section>
  );
}

function FeeResultSection({
  children,
  isLoading,
  result,
  sectionKey,
}: {
  children: (result: AdminEndpointSuccess) => React.ReactNode;
  isLoading: boolean;
  result?: AdminEndpointResult;
  sectionKey: AdminEndpointKey;
}) {
  return (
    <div className="grid gap-3 border-t border-neutral-800 pt-5 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-100">
            {result?.label ?? fallbackLabel(sectionKey)}
          </h3>
          <p className="mt-1 font-mono text-xs text-neutral-500">
            {result?.path ?? fallbackPath(sectionKey)}
          </p>
        </div>
        <EndpointStatus isLoading={isLoading} result={result} />
      </div>

      {!result ? (
        <EmptyState text={isLoading ? "Loading section." : "No data loaded."} />
      ) : result.ok ? (
        children(result)
      ) : (
        <ErrorPanel error={result.error} />
      )}
    </div>
  );
}

function EndpointStatus({
  isLoading,
  result,
}: {
  isLoading: boolean;
  result?: AdminEndpointResult;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500">
      {result ? (
        <>
          <span
            className={
              result.ok
                ? "rounded bg-emerald-950 px-2 py-1 text-emerald-200"
                : "rounded bg-red-950 px-2 py-1 text-red-200"
            }
          >
            {result.ok ? `HTTP ${result.status}` : errorStatus(result)}
          </span>
          <span>{formatDateTime(result.fetchedAt)}</span>
        </>
      ) : (
        <span>{isLoading ? "Loading" : "Idle"}</span>
      )}
    </div>
  );
}

function SectionBody({
  result,
  sectionKey,
}: {
  result: AdminEndpointSuccess;
  sectionKey: AdminEndpointKey;
}) {
  if (sectionKey === "status") {
    return <StatusSection data={result.data} />;
  }

  if (sectionKey === "mmSessions") {
    return <MmSessionsSection data={result.data} />;
  }

  if (sectionKey === "recent") {
    return <RecentActivitySection data={result.data} />;
  }

  return <GenericDataView value={result.data} />;
}

function FeeSummarySection({ data }: { data: JsonValue }) {
  if (!isJsonObject(data)) {
    return <GenericDataView value={data} />;
  }

  const ledger = isJsonObject(data.ledger) ? data.ledger : null;
  const metricCandidates: [string, JsonValue | undefined][] = [
    ["fees_enabled", data.fees_enabled ?? data.enabled],
    ["rebates_enabled", data.rebates_enabled],
    ["event_count", data.event_count ?? ledger?.event_count],
    ["fee_total_1e8", data.fee_total_1e8 ?? ledger?.fee_total_1e8],
    ["rebate_total_1e8", data.rebate_total_1e8 ?? ledger?.rebate_total_1e8],
    [
      "protocol_total_1e8",
      data.protocol_total_1e8 ?? ledger?.protocol_total_1e8,
    ],
  ];
  const metrics = metricCandidates.filter(
    (entry): entry is [string, JsonValue] => entry[1] !== undefined,
  );
  const countEntries = getFeeCountEntries(data, ledger);
  const additional = getFeeSummaryRemainder(data, ledger);

  return (
    <div className="grid gap-4">
      {metrics.length ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {metrics.map(([key, value]) => (
            <MetricCard
              key={key}
              label={formatKey(key)}
              value={formatDisplayValue(key, value)}
              variant={statusVariant(key, value)}
            />
          ))}
        </div>
      ) : (
        <EmptyState text="Fee summary response did not include known fields." />
      )}

      {countEntries.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {countEntries.map(([key, value]) => (
            <div key={key}>
              <Subheading>{formatKey(key)}</Subheading>
              <GenericDataView value={value} />
            </div>
          ))}
        </div>
      ) : null}

      {data.schedule !== undefined ? (
        <div>
          <Subheading>Schedule</Subheading>
          <GenericDataView value={data.schedule} />
        </div>
      ) : null}

      {Object.keys(additional).length ? (
        <div>
          <Subheading>Additional Fields</Subheading>
          <GenericDataView value={additional} />
        </div>
      ) : null}
    </div>
  );
}

function FeeEventsSection({ data }: { data: JsonValue }) {
  const rows = findPrimaryArray(data, [
    "events",
    "fee_events",
    "items",
    "recent",
    "rows",
  ]);

  if (!rows) {
    return <GenericDataView value={data} />;
  }

  return rows.length ? (
    <JsonTable
      maxColumns={undefined}
      preferredColumns={FEE_EVENT_COLUMNS}
      rows={rows}
    />
  ) : (
    <EmptyState text="No fee events." />
  );
}

function VolumeBucketsSection({
  accountFilter,
  data,
}: {
  accountFilter: string;
  data: JsonValue;
}) {
  const rows = findPrimaryArray(data, [
    "volumes",
    "volume_buckets",
    "buckets",
    "items",
    "rows",
  ]);

  if (!rows) {
    return <GenericDataView value={data} />;
  }

  return (
    <div className="grid gap-3">
      <div className="text-xs text-neutral-500">
        Account filter:{" "}
        <span className="font-mono text-neutral-300">
          {accountFilter || "all accounts"}
        </span>
      </div>
      {rows.length ? (
        <JsonTable
          maxColumns={undefined}
          preferredColumns={VOLUME_BUCKET_COLUMNS}
          rows={rows}
        />
      ) : (
        <EmptyState text="No volume buckets." />
      )}
    </div>
  );
}

function RebateAccrualsSection({
  accountFilter,
  data,
}: {
  accountFilter: string;
  data: JsonValue;
}) {
  const rows = findPrimaryArray(data, [
    "rebates",
    "rebate_accruals",
    "accruals",
    "items",
    "rows",
  ]);

  if (!rows) {
    return <GenericDataView value={data} />;
  }

  const accruedCount = countRowsByStatus(rows, "accrued");

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <span>
          Account filter:{" "}
          <span className="font-mono text-neutral-300">
            {accountFilter || "all accounts"}
          </span>
        </span>
        <span className="rounded border border-cyan-500/40 bg-cyan-950/40 px-2 py-1 font-mono text-cyan-100">
          status=accrued: {accruedCount}
        </span>
        <span className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-neutral-400">
          ledger accruals only; no payout action
        </span>
      </div>
      {rows.length ? (
        <JsonTable
          maxColumns={undefined}
          preferredColumns={REBATE_ACCRUAL_COLUMNS}
          rows={rows}
        />
      ) : (
        <EmptyState text="No rebate accruals." />
      )}
    </div>
  );
}

function StatusSection({ data }: { data: JsonValue }) {
  if (!isJsonObject(data)) {
    return <GenericDataView value={data} />;
  }

  const knownEntries = STATUS_FIELDS.filter((field) => field in data).map(
    (field) => [field, data[field]] as const,
  );
  const unknownFields = omitKeys(data, new Set(STATUS_FIELDS));

  return (
    <div className="grid gap-4">
      {knownEntries.length ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {knownEntries.map(([key, value]) => (
            <MetricCard
              key={key}
              label={formatKey(key)}
              value={formatDisplayValue(key, value)}
              variant={statusVariant(key, value)}
            />
          ))}
        </div>
      ) : (
        <EmptyState text="Status response did not include known fields." />
      )}

      {Object.keys(unknownFields).length ? (
        <div>
          <Subheading>Additional Fields</Subheading>
          <GenericDataView value={unknownFields} />
        </div>
      ) : null}
    </div>
  );
}

function MmSessionsSection({ data }: { data: JsonValue }) {
  const objectData = isJsonObject(data) ? data : null;
  const sessions = objectData?.sessions;
  const enabled = objectData?.enabled;

  return (
    <div className="grid gap-4">
      {typeof enabled === "boolean" ? (
        <MetricCard
          label="MM Gateway Enabled"
          value={enabled ? "true" : "false"}
          variant={enabled ? "normal" : "muted"}
        />
      ) : null}

      {Array.isArray(sessions) ? (
        sessions.length ? (
          <JsonTable rows={sessions} />
        ) : (
          <EmptyState text="No MM sessions." />
        )
      ) : (
        <GenericDataView value={data} />
      )}

      {objectData ? (
        <NestedRemainder
          data={objectData}
          omittedKeys={new Set(["enabled", "sessions"])}
        />
      ) : null}
    </div>
  );
}

function RecentActivitySection({ data }: { data: JsonValue }) {
  const rows = findPrimaryArray(data, [
    "activity",
    "events",
    "items",
    "recent",
    "rows",
  ]);

  if (rows) {
    return rows.length ? <JsonTable rows={rows} /> : <EmptyState text="No recent activity." />;
  }

  return <GenericDataView value={data} />;
}

function GenericDataView({ value }: { value: JsonValue }) {
  if (isEmptyJson(value)) {
    return <EmptyState text="Empty data." />;
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return <EmptyState text="Empty list." />;
    }

    return isRecordArray(value) ? <JsonTable rows={value} /> : <JsonBlock value={value} />;
  }

  if (!isJsonObject(value)) {
    return (
      <div className="rounded border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200">
        {formatDisplayValue("", value)}
      </div>
    );
  }

  const primitiveEntries = Object.entries(value).filter(([, entryValue]) =>
    isPrimitive(entryValue),
  );
  const complexEntries = Object.entries(value).filter(
    ([, entryValue]) => !isPrimitive(entryValue),
  );

  return (
    <div className="grid gap-4">
      {primitiveEntries.length ? (
        <KeyValueTable entries={primitiveEntries} />
      ) : null}

      {complexEntries.length ? (
        <div className="grid gap-4">
          {complexEntries.map(([key, entryValue]) => (
            <div key={key}>
              <Subheading>{formatKey(key)}</Subheading>
              {Array.isArray(entryValue) && entryValue.length && isRecordArray(entryValue) ? (
                <JsonTable rows={entryValue} />
              ) : (
                <GenericDataView value={entryValue} />
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function KeyValueTable({ entries }: { entries: [string, JsonValue][] }) {
  return (
    <div className="overflow-x-auto rounded border border-neutral-800">
      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
        <tbody>
          {entries.map(([key, value]) => (
            <tr className="border-b border-neutral-800 last:border-b-0" key={key}>
              <th className="w-64 bg-neutral-950 px-3 py-2 align-top text-xs font-medium uppercase tracking-[0.08em] text-neutral-500">
                {formatKey(key)}
              </th>
              <td className="px-3 py-2 font-mono text-neutral-200">
                {formatDisplayValue(key, value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JsonTable({
  maxColumns,
  preferredColumns = [],
  rows,
}: {
  maxColumns?: number;
  preferredColumns?: readonly string[];
  rows: JsonValue[];
}) {
  if (!rows.length) {
    return <EmptyState text="Empty list." />;
  }

  if (!isRecordArray(rows)) {
    return <JsonBlock value={rows} />;
  }

  const resolvedMaxColumns = maxColumns ?? (preferredColumns.length ? undefined : 10);
  const columns = getTableColumns(rows, preferredColumns, resolvedMaxColumns);

  return (
    <div className="overflow-x-auto rounded border border-neutral-800">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-950">
            {columns.map((column) => (
              <th
                className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500"
                key={column}
              >
                {formatKey(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const record = row as JsonObject;
            return (
              <tr className="border-b border-neutral-800 last:border-b-0" key={index}>
                {columns.map((column) => (
                  <td
                    className="max-w-[360px] px-3 py-2 align-top font-mono text-xs text-neutral-200"
                    key={column}
                  >
                    {isPrimitive(record[column]) ? (
                      formatDisplayValue(column, record[column])
                    ) : (
                      <JsonBlock compact value={record[column] ?? null} />
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function JsonBlock({
  compact,
  value,
}: {
  compact?: boolean;
  value: JsonValue;
}) {
  return (
    <pre
      className={
        compact
          ? "max-h-28 overflow-auto whitespace-pre-wrap break-words rounded bg-neutral-950/70 p-2 text-[11px] leading-4 text-neutral-300"
          : "max-h-80 overflow-auto whitespace-pre-wrap break-words rounded border border-neutral-800 bg-neutral-950 p-3 text-xs leading-5 text-neutral-300"
      }
    >
      {JSON.stringify(value, null, compact ? 0 : 2)}
    </pre>
  );
}

function MetricCard({
  label,
  value,
  variant = "normal",
}: {
  label: string;
  value: string;
  variant?: "danger" | "muted" | "normal" | "ok" | "warn";
}) {
  const className =
    variant === "danger"
      ? "border-red-500/50 bg-red-950/70 text-red-100"
      : variant === "ok"
        ? "border-emerald-500/40 bg-emerald-950/60 text-emerald-100"
        : variant === "warn"
          ? "border-amber-500/50 bg-amber-950/60 text-amber-100"
          : variant === "muted"
            ? "border-neutral-800 bg-neutral-950 text-neutral-400"
            : "border-neutral-800 bg-neutral-950 text-neutral-100";

  return (
    <div className={`rounded border p-3 ${className}`}>
      <div className="text-xs font-medium uppercase tracking-[0.08em] text-current opacity-70">
        {label}
      </div>
      <div className="mt-2 break-words font-mono text-sm font-semibold">
        {value}
      </div>
    </div>
  );
}

function ErrorPanel({ error }: { error: AdminApiErrorDetails }) {
  return (
    <div className="rounded border border-red-500/40 bg-red-950/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-red-500/20 px-2 py-1 font-mono text-xs text-red-100">
          {error.code}
        </span>
        {error.status ? (
          <span className="rounded bg-red-500/20 px-2 py-1 font-mono text-xs text-red-100">
            HTTP {error.status}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-red-100">{error.message}</p>
    </div>
  );
}

function SystemBanner({
  message,
}: {
  message: { tone: "danger" | "warn"; text: string };
}) {
  return (
    <div
      className={
        message.tone === "danger"
          ? "rounded border border-red-500/50 bg-red-950/60 px-4 py-3 text-sm font-medium text-red-100"
          : "rounded border border-amber-500/50 bg-amber-950/50 px-4 py-3 text-sm font-medium text-amber-100"
      }
    >
      {message.text}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded border border-dashed border-neutral-800 bg-neutral-950/60 px-3 py-6 text-center text-sm text-neutral-500">
      {text}
    </div>
  );
}

function Subheading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
      {children}
    </h3>
  );
}

function NestedRemainder({
  data,
  omittedKeys,
}: {
  data: JsonObject;
  omittedKeys: Set<string>;
}) {
  const rest = omitKeys(data, omittedKeys);

  if (!Object.keys(rest).length) {
    return null;
  }

  return (
    <div>
      <Subheading>Additional Fields</Subheading>
      <GenericDataView value={rest} />
    </div>
  );
}

function getSystemMessage(results: Partial<AdminSnapshot>) {
  const failures = Object.values(results).filter(
    (result): result is AdminEndpointFailure => Boolean(result && !result.ok),
  );

  if (!failures.length) {
    return null;
  }

  if (failures.every((failure) => failure.error.code === "backend_offline")) {
    return {
      tone: "danger" as const,
      text: "Backend offline or unreachable.",
    };
  }

  if (failures.some((failure) => failure.error.code === "admin_disabled")) {
    return {
      tone: "danger" as const,
      text: "Admin API is disabled by the backend.",
    };
  }

  if (
    failures.some((failure) =>
      ["missing_token", "invalid_token", "unauthorized"].includes(
        failure.error.code,
      ),
    )
  ) {
    return {
      tone: "warn" as const,
      text: "Admin token missing or rejected.",
    };
  }

  if (failures.some((failure) => failure.error.code === "malformed_response")) {
    return {
      tone: "danger" as const,
      text: "One or more admin responses were malformed.",
    };
  }

  return {
    tone: "warn" as const,
    text: "One or more admin sections failed to load.",
  };
}

function getDangerFlags(
  statusResult?: AdminEndpointResult,
  configResult?: AdminEndpointResult,
) {
  return [
    {
      key: "execution_enabled",
      label: "execution_enabled",
      active:
        readBoolean(statusResult, "execution_enabled") ??
        readBoolean(configResult, "execution_enabled") ??
        false,
    },
    {
      key: "real_broadcast_enabled",
      label: "real_broadcast_enabled",
      active:
        readBoolean(statusResult, "real_broadcast_enabled") ??
        readBoolean(configResult, "real_broadcast_enabled") ??
        false,
    },
  ];
}

function readBoolean(result: AdminEndpointResult | undefined, key: string) {
  if (!result?.ok || !isJsonObject(result.data)) {
    return undefined;
  }

  const value = result.data[key];
  return typeof value === "boolean" ? value : undefined;
}

function getFeeCountEntries(data: JsonObject, ledger: JsonObject | null) {
  const countKeys = new Set(
    [...Object.keys(data), ...Object.keys(ledger ?? {})].filter((key) =>
      key.endsWith("_counts"),
    ),
  );
  const entries: [string, JsonObject][] = [];

  for (const key of countKeys) {
    const value = data[key] ?? ledger?.[key];
    if (isJsonObject(value)) {
      entries.push([key, value]);
    }
  }

  return entries;
}

function getFeeSummaryRemainder(data: JsonObject, ledger: JsonObject | null) {
  const topKnownKeys = new Set([
    "enabled",
    "fees_enabled",
    "rebates_enabled",
    "event_count",
    "fee_total_1e8",
    "rebate_total_1e8",
    "protocol_total_1e8",
    "ledger",
    "schedule",
    ...Object.keys(data).filter((key) => key.endsWith("_counts")),
  ]);
  const ledgerKnownKeys = new Set([
    "event_count",
    "fee_total_1e8",
    "rebate_total_1e8",
    "protocol_total_1e8",
    ...Object.keys(ledger ?? {}).filter((key) => key.endsWith("_counts")),
  ]);
  const rest = omitKeys(data, topKnownKeys);

  if (ledger) {
    const ledgerRest = omitKeys(ledger, ledgerKnownKeys);
    if (Object.keys(ledgerRest).length) {
      rest.ledger = ledgerRest;
    }
  }

  return rest;
}

function countRowsByStatus(rows: JsonValue[], status: string) {
  const normalizedStatus = status.toLowerCase();
  return rows.filter((row) => {
    if (!isJsonObject(row)) {
      return false;
    }

    const rowStatus = row.status;
    return (
      typeof rowStatus === "string" &&
      rowStatus.toLowerCase() === normalizedStatus
    );
  }).length;
}

function getTableColumns(
  rows: JsonObject[],
  preferredColumns: readonly string[] = [],
  maxColumns?: number,
) {
  const primitiveColumns: string[] = [];
  const complexColumns: string[] = [];

  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      const target = isPrimitive(value) ? primitiveColumns : complexColumns;
      if (!target.includes(key)) {
        target.push(key);
      }
    }
  }

  const discoveredColumns = [...primitiveColumns, ...complexColumns];
  const orderedColumns = [
    ...preferredColumns.filter((column) => discoveredColumns.includes(column)),
    ...discoveredColumns.filter((column) => !preferredColumns.includes(column)),
  ];

  return typeof maxColumns === "number"
    ? orderedColumns.slice(0, maxColumns)
    : orderedColumns;
}

function findPrimaryArray(value: JsonValue, preferredKeys: string[]) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isJsonObject(value)) {
    return null;
  }

  for (const key of preferredKeys) {
    const entry = value[key];
    if (Array.isArray(entry)) {
      return entry;
    }
  }

  const firstArray = Object.values(value).find(Array.isArray);
  return firstArray ?? null;
}

function omitKeys(data: JsonObject, keys: Set<string>) {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => !keys.has(key)),
  ) as JsonObject;
}

function isRecordArray(value: JsonValue[]): value is JsonObject[] {
  return value.every(isJsonObject);
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPrimitive(value: JsonValue | undefined) {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function isEmptyJson(value: JsonValue) {
  if (value === null) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (isJsonObject(value)) {
    return Object.keys(value).length === 0;
  }

  return false;
}

function formatDisplayValue(key: string, value: JsonValue | undefined) {
  if (value === undefined) {
    return "n/a";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "string" || typeof value === "number") {
    const keyLower = key.toLowerCase();
    const rawValue = String(value);

    if (keyLower.endsWith("_ms")) {
      const timestamp = readFiniteNumber(value);
      const formatted = timestamp === null ? null : formatDateTime(timestamp);
      return formatted && formatted !== "n/a"
        ? `${formatted} (${rawValue})`
        : rawValue;
    }

    if (keyLower.endsWith("_micro_bps")) {
      const formatted = formatMicroBps(value);
      return formatted ? `${formatted} (${rawValue})` : rawValue;
    }

    if (keyLower.endsWith("_1e8")) {
      const formatted = formatOneE8Approx(value);
      return formatted ? `${formatted} (${rawValue})` : rawValue;
    }

    if (typeof value === "string" && isAddressField(keyLower, value)) {
      return `${shortenAddress(value)} (${value})`;
    }

    return rawValue;
  }

  return JSON.stringify(value);
}

function readFiniteNumber(value: string | number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatOneE8Approx(value: string | number) {
  const rawValue = String(value).trim();
  if (!/^-?\d+$/.test(rawValue)) {
    return null;
  }

  const negative = rawValue.startsWith("-");
  const sign = negative ? "-" : "";
  const unsigned = (negative ? rawValue.slice(1) : rawValue).replace(
    /^0+(?=\d)/,
    "",
  );

  if (unsigned === "0") {
    return "0";
  }

  const padded = unsigned.padStart(9, "0");
  const whole = padded.slice(0, -8).replace(/^0+(?=\d)/, "") || "0";
  const fractional = padded.slice(-8);
  const visibleFraction = fractional.slice(0, 4).replace(/0+$/, "");
  const hiddenFraction = fractional.slice(4);
  const hasHiddenPrecision = /[1-9]/.test(hiddenFraction);

  if (!visibleFraction && whole === "0" && /[1-9]/.test(fractional)) {
    return `${sign}<0.0001`;
  }

  const prefix = hasHiddenPrecision ? "~" : "";
  return `${prefix}${sign}${whole}${visibleFraction ? `.${visibleFraction}` : ""}`;
}

function formatMicroBps(value: string | number) {
  const numericValue = readFiniteNumber(value);
  if (numericValue === null) {
    return null;
  }

  const bps = numericValue / 10_000;
  const percent = bps / 100;
  return `${formatDecimal(bps, 4)} bps / ${formatDecimal(percent, 6)}%`;
}

function formatDecimal(value: number, maximumFractionDigits: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
}

function isAddressField(key: string, value: string) {
  return (
    /^0x[a-fA-F0-9]{40}$/.test(value) &&
    (key === "account" ||
      key.endsWith("_account") ||
      key.includes("address") ||
      key.includes("maker") ||
      key.includes("payer") ||
      key.includes("recipient") ||
      key.includes("taker"))
  );
}

function shortenAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatDateTime(value: number) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  const timestamp = value > 0 && value < 10_000_000_000 ? value * 1000 : value;
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "n/a";
  }

  return date.toLocaleString();
}

function formatKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusVariant(key: string, value: JsonValue) {
  if (
    (key === "execution_enabled" || key === "real_broadcast_enabled") &&
    value === true
  ) {
    return "danger";
  }

  if (typeof value === "boolean") {
    return value ? "ok" : "muted";
  }

  return "normal";
}

function fallbackLabel(key: AdminEndpointKey) {
  const labels: Record<AdminEndpointKey, string> = {
    config: "Config",
    db: "Database",
    executionSummary: "Execution Summary",
    feeEvents: "Recent Fee Events",
    feeRebates: "Rebate Accruals",
    feeSummary: "Fee Summary",
    feeVolumes: "Volume Buckets",
    mmSessions: "MM Sessions",
    optionsSummary: "Options Summary",
    recent: "Recent Activity",
    rfqSummary: "RFQ Summary",
    status: "Status",
  };

  return labels[key];
}

function fallbackPath(key: AdminEndpointKey) {
  const paths: Record<AdminEndpointKey, string> = {
    config: "/admin/config",
    db: "/admin/db",
    executionSummary: "/admin/execution/summary",
    feeEvents: "/admin/fees/events?limit=20",
    feeRebates: "/admin/fees/rebates",
    feeSummary: "/admin/fees/summary",
    feeVolumes: "/admin/fees/volumes",
    mmSessions: "/admin/mm/sessions",
    optionsSummary: "/admin/options/summary",
    recent: "/admin/recent?limit=20",
    rfqSummary: "/admin/rfq/summary",
    status: "/admin/status",
  };

  return paths[key];
}

function errorStatus(result: AdminEndpointFailure) {
  return result.status ? `HTTP ${result.status}` : "ERR";
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
