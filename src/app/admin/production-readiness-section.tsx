// V2G-U — Production-Readiness section for the admin dashboard.
//
// Read-only. Reflects the V2G-T canonical fee audit pack state plus
// any live signal from the V2 observability snapshot the user has
// already loaded.
//
// Contract:
// - No mutations / writes / wallet actions.
// - No required new backend endpoints. Live derivations work from the
//   already-loaded `/admin/fees/v2/observability` JSON. Static fallback
//   when that snapshot is absent or errored.
// - V2G-M `/admin/fees/v2/smoke/readiness` is OPTIONAL — if it errored
//   (backend not restarted), we surface a "pending backend restart"
//   badge rather than crashing.
// - Section never throws on shape changes — every field read goes
//   through guarded JSON helpers.

import type {
  AdminFeeV2ObservabilityResult,
  AdminFeeV2SmokeReadinessResult,
  AdminFeesOnchainResult,
  JsonObject,
  JsonValue,
} from "@/types/admin";

// V2G-T-derived static facts (Base Sepolia, per canonical audit pack §5,
// §8). All addresses are public chain artifacts; no secret leaks.
const STATIC_FACTS = {
  feesManagerV2: "0x00dA0B9876bcBf0c79CB5BcAcfEBAFb8C7Ad774f",
  newPerpEngine: "0xc6c592100723fe0c66343a16e95ec34cc0c2141c",
  oldPerpEngine: "0xb36395b67d0798ada981731c9fa5239f4362b53b",
  newMarginEngine: "0x287Cef479be5889eEfCa847F9e73C860898f48Cc",
  legacyMarginEngine: "0x6c5665de05e7314cb63cd77f82dfa86508a5b5f8",
  feeRecipientTimelock: "0xa67f8e8e673ce4bb2fb563b0e6e9fa8f70e3b588",
  // ProtocolFeeVault is not deployed; future target lives in
  // V2G-R0/R1 docs.
  protocolFeeVault: null,
  // OptionMatchingEngine has never been deployed on Base Sepolia.
  optionMatchingEngine: null,
  // V2G-O selectors — present on offline bytecode only.
  selectors: {
    applyRfqTrade: "0x1ccdd23f",
    executeRfqTrade: "0xb52ce6f5",
  },
  // V2G-E live tx hashes — for cross-reference, not for fetching.
  v2gePerpTxHash:
    "0x5c15e9233d49729cf21058a89f49bc6fdf0f7295cda5a7f313c96556728aa394",
  v2geOptionTxHash:
    "0x9a85cbced2216bf3c18049111cce68883cb0b035e194b3dcbaaf4fe7d5293149",
};

type StatusVariant =
  | "live" // currently live in production
  | "code-ready" // ABI/code exists, awaits broadcast
  | "not-deployed" // explicit not-deployed state on Base Sepolia
  | "pending-restart" // code exists, backend restart needed
  | "stranded" // legacy artifact — must NOT be reused
  | "monitoring-green" // observability path healthy
  | "monitoring-degraded" // observability not yet loaded
  | "unknown";

const VARIANT_STYLES: Record<StatusVariant, string> = {
  live: "border-emerald-500/40 bg-emerald-950/70 text-emerald-100",
  "code-ready": "border-sky-500/50 bg-sky-950/70 text-sky-100",
  "not-deployed": "border-amber-500/50 bg-amber-950/70 text-amber-100",
  "pending-restart": "border-amber-500/50 bg-amber-950/70 text-amber-100",
  stranded: "border-red-500/50 bg-red-950/70 text-red-100",
  "monitoring-green": "border-emerald-500/40 bg-emerald-950/70 text-emerald-100",
  "monitoring-degraded": "border-neutral-700 bg-neutral-900 text-neutral-300",
  unknown: "border-neutral-700 bg-neutral-900 text-neutral-300",
};

const VARIANT_LABELS: Record<StatusVariant, string> = {
  live: "live",
  "code-ready": "code-ready",
  "not-deployed": "not deployed",
  "pending-restart": "pending backend restart",
  stranded: "stranded",
  "monitoring-green": "monitoring green",
  "monitoring-degraded": "monitoring degraded",
  unknown: "unknown",
};

function StatusBadge({ variant }: { variant: StatusVariant }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${VARIANT_STYLES[variant]}`}
    >
      {VARIANT_LABELS[variant]}
    </span>
  );
}

function Row({
  label,
  value,
  badge,
  note,
}: {
  label: string;
  value: string;
  badge: StatusVariant;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded border border-neutral-800 bg-neutral-950/60 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-400">
          {label}
        </div>
        <div className="mt-1 truncate font-mono text-sm text-neutral-100">
          {value}
        </div>
        {note ? (
          <div className="mt-1 text-xs text-neutral-500">{note}</div>
        ) : null}
      </div>
      <div className="shrink-0">
        <StatusBadge variant={badge} />
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs text-neutral-400">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function isObj(value: JsonValue | undefined | null): value is JsonObject {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

function pickAddress(
  value: JsonValue | undefined,
  fallback: string,
): { display: string; fromLive: boolean } {
  if (typeof value === "string" && value.length > 0) {
    return { display: value, fromLive: true };
  }
  return { display: fallback, fromLive: false };
}

function readNumber(value: JsonValue | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

// Inspect the V2 observability snapshot and derive a live-or-static
// view. The endpoint is GET-only, replay-safe, and runs against the
// backend's read replica; we treat ANY successful response as
// "monitoring path is alive". A failure (or absence) downgrades to
// "monitoring-degraded" but never crashes the section.
type Derived = {
  feesManagerV2: { display: string; live: boolean };
  newPerpEngine: { display: string; live: boolean };
  newMarginEngine: { display: string; live: boolean };
  oldPerpEngine: { display: string; live: boolean };
  rebateBudgetByAsset: Array<{ asset: string; amount: string }>;
  oldConsumerEvents: number;
  unknownConsumerEvents: number;
  observabilityHealthy: boolean;
  observabilityNote: string;
};

function deriveFromObservability(
  observability: AdminFeeV2ObservabilityResult | null,
): Derived {
  const empty: Derived = {
    feesManagerV2: { display: STATIC_FACTS.feesManagerV2, live: false },
    newPerpEngine: { display: STATIC_FACTS.newPerpEngine, live: false },
    newMarginEngine: { display: STATIC_FACTS.newMarginEngine, live: false },
    oldPerpEngine: { display: STATIC_FACTS.oldPerpEngine, live: false },
    rebateBudgetByAsset: [],
    oldConsumerEvents: 0,
    unknownConsumerEvents: 0,
    observabilityHealthy: false,
    observabilityNote: "Snapshot not loaded — using V2G-T canonical static facts.",
  };

  if (!observability) return empty;

  if (!observability.ok) {
    return {
      ...empty,
      observabilityNote: `Endpoint error: ${observability.error.code}${
        observability.error.status ? ` (HTTP ${observability.error.status})` : ""
      }. Falling back to V2G-T static facts.`,
    };
  }

  if (!isObj(observability.data)) return empty;

  const contracts = isObj(observability.data.contracts)
    ? observability.data.contracts
    : {};
  const metrics = isObj(observability.data.metrics)
    ? observability.data.metrics
    : {};
  const anomaly = isObj(observability.data.anomaly_totals)
    ? observability.data.anomaly_totals
    : {};

  const feesManagerV2 = pickAddress(
    contracts.fees_manager_v2,
    STATIC_FACTS.feesManagerV2,
  );
  const newPerpEngine = pickAddress(
    contracts.perp_engine_new,
    STATIC_FACTS.newPerpEngine,
  );
  const newMarginEngine = pickAddress(
    contracts.margin_engine_new,
    STATIC_FACTS.newMarginEngine,
  );
  const oldPerpEngine = pickAddress(
    contracts.perp_engine_old,
    STATIC_FACTS.oldPerpEngine,
  );

  const budgetObject = isObj(metrics.fees_manager_v2_rebate_budget_native)
    ? metrics.fees_manager_v2_rebate_budget_native
    : {};
  const rebateBudgetByAsset = Object.entries(budgetObject).map(
    ([asset, amount]) => ({ asset, amount: String(amount) }),
  );

  return {
    feesManagerV2: { display: feesManagerV2.display, live: feesManagerV2.fromLive },
    newPerpEngine: { display: newPerpEngine.display, live: newPerpEngine.fromLive },
    newMarginEngine: {
      display: newMarginEngine.display,
      live: newMarginEngine.fromLive,
    },
    oldPerpEngine: {
      display: oldPerpEngine.display,
      live: oldPerpEngine.fromLive,
    },
    rebateBudgetByAsset,
    oldConsumerEvents: readNumber(anomaly.old_consumer_events) ?? 0,
    unknownConsumerEvents: readNumber(anomaly.unknown_consumer_events) ?? 0,
    observabilityHealthy: true,
    observabilityNote: `Live snapshot at ${new Date(observability.fetchedAt).toLocaleString()}.`,
  };
}

function smokeReadinessVariant(
  smoke: AdminFeeV2SmokeReadinessResult | null,
): { variant: StatusVariant; note: string } {
  if (!smoke) {
    return {
      variant: "code-ready",
      note: "Endpoint not loaded yet. New code from V2G-M may not be live until the next backend restart.",
    };
  }
  if (smoke.ok) {
    return {
      variant: "live",
      note: `Readiness probe responded successfully at ${new Date(smoke.fetchedAt).toLocaleString()}.`,
    };
  }
  // Treat any error as "pending backend restart" — endpoint exists
  // in code but isn't bound yet.
  return {
    variant: "pending-restart",
    note: `Endpoint did not respond (${smoke.error.code}). New code from V2G-M binds after the next backend restart.`,
  };
}

export function ProductionReadinessSection({
  observability,
  smokeReadiness,
  feesOnchain,
}: {
  observability: AdminFeeV2ObservabilityResult | null;
  smokeReadiness: AdminFeeV2SmokeReadinessResult | null;
  feesOnchain: AdminFeesOnchainResult | null;
}) {
  const derived = deriveFromObservability(observability);
  const readiness = smokeReadinessVariant(smokeReadiness);

  const oldConsumerVariant: StatusVariant =
    derived.oldConsumerEvents > 0 ? "stranded" : "live";
  const unknownConsumerVariant: StatusVariant =
    derived.unknownConsumerEvents > 0 ? "stranded" : "live";

  // Monitoring soak: derive from observability success. We never call
  // /health from the dashboard (cross-origin / auth-gated path).
  // Operators check the soak via the local-compose status page; this
  // surface shows the indirect health signal we already have.
  const soakVariant: StatusVariant = derived.observabilityHealthy
    ? "monitoring-green"
    : "monitoring-degraded";

  // /admin/fees/onchain availability is the simplest backend liveness
  // proxy we already have. If a tx_hash query has succeeded, the
  // backend's read path is alive.
  const feesOnchainVariant: StatusVariant = feesOnchain
    ? feesOnchain.ok
      ? "live"
      : "pending-restart"
    : "unknown";

  return (
    <section className="rounded border border-neutral-800 bg-neutral-900/40 p-4">
      <header className="mb-4 border-b border-neutral-800 pb-3">
        <h2 className="text-lg font-semibold text-neutral-100">
          V2 Fee Production Readiness
        </h2>
        <p className="mt-1 text-xs text-neutral-400">
          Read-only summary. Mirrors the V2G-T canonical fee audit pack.
          Falls back to static facts when the V2 observability snapshot
          is not loaded.
        </p>
        <p className="mt-2 text-xs text-neutral-500">{derived.observabilityNote}</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="V2 fee surface — live state"
          description="Addresses sourced from /admin/fees/v2/observability when loaded; otherwise from the V2G-T audit pack."
        >
          <Row
            label="FeesManagerV2"
            value={derived.feesManagerV2.display}
            badge={derived.feesManagerV2.live ? "live" : "unknown"}
            note={
              derived.feesManagerV2.live
                ? "Confirmed by current observability snapshot."
                : "Static fallback — load V2 Fee Observability for live confirmation."
            }
          />
          <Row
            label="NEW PerpEngine (active)"
            value={derived.newPerpEngine.display}
            badge={derived.newPerpEngine.live ? "live" : "unknown"}
            note="V2 fees consumed; V2G-E live verified."
          />
          <Row
            label="OLD PerpEngine"
            value={derived.oldPerpEngine.display}
            badge="stranded"
            note="MUST NOT be used as the active perp engine. FeeOldConsumer alert fires if it ever emits."
          />
          <Row
            label="NEW MarginEngine (active)"
            value={derived.newMarginEngine.display}
            badge={derived.newMarginEngine.live ? "live" : "unknown"}
            note="OPTION fees consumed via this engine. Lacks V2G-O applyRfqTrade until V2G-P broadcast."
          />
          <Row
            label="Legacy MarginEngine (non-V2)"
            value={STATIC_FACTS.legacyMarginEngine}
            badge="stranded"
            note="Pre-V2 deployment; observability-only."
          />
          <Row
            label="V2 fee recipient (Timelock)"
            value={STATIC_FACTS.feeRecipientTimelock}
            badge="live"
            note="Current target for both feeRecipient and rebateFundingAccount. Future target: ProtocolFeeVault (V2G-R5)."
          />
        </SectionCard>

        <SectionCard
          title="Monitoring & anomaly signals"
          description="OLD/unknown consumer counters and rebate budget per asset."
        >
          <Row
            label="OLD consumer events (PERP + OPTION)"
            value={String(derived.oldConsumerEvents)}
            badge={oldConsumerVariant}
            note={
              derived.oldConsumerEvents > 0
                ? "ALERT: OLD_PERP_ENGINE has emitted V2 fee events. Investigate."
                : "Healthy — OLD_PERP_ENGINE is stranded as designed."
            }
          />
          <Row
            label="Unknown consumer events"
            value={String(derived.unknownConsumerEvents)}
            badge={unknownConsumerVariant}
            note={
              derived.unknownConsumerEvents > 0
                ? "ALERT: an unallowed-listed consumer has emitted V2 fee events."
                : "Healthy — no allow-list misses."
            }
          />
          {derived.rebateBudgetByAsset.length === 0 ? (
            <Row
              label="FeesManagerV2 rebate budget"
              value="(snapshot not loaded)"
              badge="unknown"
              note="Load V2 Fee Observability to surface per-asset budget."
            />
          ) : (
            derived.rebateBudgetByAsset.map((entry) => (
              <Row
                key={entry.asset}
                label={`rebateBudget(${entry.asset})`}
                value={entry.amount}
                badge="live"
                note="Native units. V2G-E reference: rebateBudget(mUSDC) = 999987 after first live smoke."
              />
            ))
          )}
          <Row
            label="Local monitoring soak"
            value={soakVariant === "monitoring-green" ? "GREEN" : "AWAITING SNAPSHOT"}
            badge={soakVariant}
            note="Derived indirectly: a successful observability snapshot implies the indexer + backend read path are alive. Day-1 24h gate is 2026-06-01T17:38Z."
          />
        </SectionCard>

        <SectionCard
          title="OPTION RFQ readiness"
          description="V2G-N (math) + V2G-O (flow) + V2G-P0/P1 (operator packet) — offline-ready, awaiting V2G-P broadcast."
        >
          <Row
            label="RFQ fee math"
            value="FeesManagerV2._effectiveRatePpm (Option A)"
            badge="live"
            note="Math is in the deployed FeesManagerV2 bytecode (V2G-N). RFQ discount applies to positive ppm only; maker rebates preserved."
          />
          <Row
            label="RFQ flow wiring (Solidity)"
            value={`applyRfqTrade=${STATIC_FACTS.selectors.applyRfqTrade}, executeRfqTrade=${STATIC_FACTS.selectors.executeRfqTrade}`}
            badge="code-ready"
            note="V2G-O contract code in out/. Live MarginEngine lacks the applyRfqTrade entrypoint."
          />
          <Row
            label="OptionMatchingEngine (live)"
            value="(not deployed)"
            badge="not-deployed"
            note="No OptionMatchingEngine has ever been deployed on Base Sepolia. V2G-P broadcast is greenfield for OPTION."
          />
          <Row
            label="Backend RFQ signing surface"
            value="OPTION_RFQ_TRADE_TYPE / option_rfq_trade_digest / executeRfqTrade calldata"
            badge="code-ready"
            note="V2G-P0/P1 library + operator-packet module ready in target/. Backend restart needed to expose them on /admin endpoints."
          />
          <Row
            label="Operator preflight script"
            value="script/PreflightOptionRfqEntryPoints.s.sol"
            badge="code-ready"
            note="Bytecode-scan selector probe. Read-only; safe to dry-run against any address."
          />
          <Row
            label="Deploy / rewire status"
            value="Pending V2G-P operator window"
            badge="pending-restart"
            note="Strategy A: redeploy MarginEngine V2G-O + first-deploy OptionMatchingEngine in a single operator window. Awaiting V2G-K day-1 gate clearance + governance."
          />
        </SectionCard>

        <SectionCard
          title="ProtocolFeeVault — future fee treasury"
          description="V2G-R0 design + V2G-R1 offline implementation. Future feeRecipient / rebateFundingAccount."
        >
          <Row
            label="Design spec"
            value="docs/PROTOCOL_FEE_VAULT_DESIGN_V2G_R.md"
            badge="code-ready"
            note="V2G-R0: single-module design with internal feeBalance / rebateReserve / grossFeesCollected / rebatesPaid / netRevenue buckets."
          />
          <Row
            label="Implementation"
            value="src/fees/ProtocolFeeVault.sol (offline)"
            badge="code-ready"
            note="V2G-R1: 45 tests green (40 unit + 5 invariants). Not deployed."
          />
          <Row
            label="On-chain deployment"
            value="(not deployed)"
            badge="not-deployed"
            note="Prerequisites: V2G-R3 (FM-V2 hook ABI extension + CollateralVault.transferFromInternalAccount), then V2G-R5 broadcast + recipient rotation."
          />
          <Row
            label="Future feeRecipient target"
            value="ProtocolFeeVault (TBD address)"
            badge="not-deployed"
            note={`Current target is the Timelock ${STATIC_FACTS.feeRecipientTimelock}. After V2G-R5 cutover the vault becomes the single counterparty for both positive fees and rebate funding.`}
          />
        </SectionCard>

        <SectionCard
          title="Admin endpoints"
          description="Liveness indicators derived from already-loaded fetches."
        >
          <Row
            label="/admin/fees/v2/observability"
            value={derived.observabilityHealthy ? "Loaded successfully" : "Not loaded"}
            badge={derived.observabilityHealthy ? "live" : "unknown"}
            note="Click 'Load' on the V2 Fee Observability section above to populate this signal."
          />
          <Row
            label="/admin/fees/v2/smoke/readiness"
            value={readiness.variant === "live" ? "Loaded successfully" : "Awaiting backend restart"}
            badge={readiness.variant}
            note={readiness.note}
          />
          <Row
            label="/admin/fees/onchain"
            value={
              feesOnchain == null
                ? "Not queried"
                : feesOnchain.ok
                  ? `Last query at ${new Date(feesOnchain.fetchedAt).toLocaleString()}`
                  : `Error: ${feesOnchain.error.code}`
            }
            badge={feesOnchainVariant}
            note="Replay-safe per V2G-S — query the same tx_hash multiple times safely."
          />
        </SectionCard>

        <SectionCard
          title="V2G-E live cross-reference"
          description="Hashes from the first live PERP + OPTION V2 rebate smoke (V2G-E)."
        >
          <Row
            label="PERP rebate tx"
            value={STATIC_FACTS.v2gePerpTxHash}
            badge="live"
            note="Tier 4 maker / Tier 2 taker. Query via /admin/fees/onchain to verify event payloads."
          />
          <Row
            label="OPTION rebate tx"
            value={STATIC_FACTS.v2geOptionTxHash}
            badge="live"
            note="Same configuration as the PERP smoke. V2G-E doc: FEES_MANAGER_V2_LIVE_REBATE_SMOKE_RESULT_V2G_E.md."
          />
        </SectionCard>
      </div>

      <footer className="mt-4 border-t border-neutral-800 pt-3 text-xs text-neutral-500">
        Source-of-truth doc: <span className="font-mono">docs/DEOPT_V2_CANONICAL_FEE_AUDIT_PACK_V2G_T.md</span>.
        This section is read-only. No transactions, broadcasts, or
        wallet writes are issued from this page.
      </footer>
    </section>
  );
}
