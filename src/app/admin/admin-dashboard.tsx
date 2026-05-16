"use client";

import {
  fetchAdminSnapshot,
  getAdminBaseUrl,
  RECENT_LIMITS,
} from "@/lib/admin-api";
import type {
  AdminApiErrorDetails,
  AdminEndpointFailure,
  AdminEndpointKey,
  AdminEndpointResult,
  AdminEndpointSuccess,
  AdminSnapshot,
  JsonObject,
  JsonValue,
  RecentLimit,
} from "@/types/admin";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TOKEN_STORAGE_KEY = "deopt.adminToken";
const AUTO_REFRESH_MS = 10_000;

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
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [results, setResults] =
    useState<Partial<AdminSnapshot>>(EMPTY_RESULTS);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
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

  useEffect(() => {
    return () => abortRef.current?.abort();
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
  variant?: "danger" | "muted" | "normal" | "ok";
}) {
  const className =
    variant === "danger"
      ? "border-red-500/50 bg-red-950/70 text-red-100"
      : variant === "ok"
        ? "border-emerald-500/40 bg-emerald-950/60 text-emerald-100"
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
