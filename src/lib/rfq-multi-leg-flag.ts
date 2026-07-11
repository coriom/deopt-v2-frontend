// RFQ-MULTI-LEG-FRONTEND-V1 — strict opt-in flag helper.
//
// The RFQ / Strategy workspace only routes `state.legs.length > 1`
// through the backend `/options/multi-leg-rfqs` path when
// `NEXT_PUBLIC_RFQ_MULTI_LEG_ENABLED=true` at build time. Default is
// `false`; the pre-existing single-leg RFQ flow (`legs.length === 1`)
// stays byte-identical.
//
// The flag is frontend-only. Backend `OPTION_RFQ_MULTI_LEG_ENABLED`
// remains the source of truth for whether the multi-leg routes are
// actually served; a frontend build with this flag on will surface an
// honest 503 disabled message if the backend flag is still off.

const ENV_KEY = "NEXT_PUBLIC_RFQ_MULTI_LEG_ENABLED";

function truthy(v: string | undefined | null): boolean {
  if (v === null || v === undefined) return false;
  const t = v.trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes";
}

/**
 * Returns true iff the strict opt-in multi-leg RFQ frontend flag is
 * on for this build. Default false. NEVER auto-detected. NEVER
 * inferred from wallet, network, or backend health.
 */
export function isRfqMultiLegEnabled(): boolean {
  return truthy(process.env[ENV_KEY]);
}

/** The literal env var name — surfaced by tests + docs. */
export const RFQ_MULTI_LEG_ENABLED_ENV = ENV_KEY;
