// PERPS-SUBACCOUNTS-FRONTEND-ROUTING-V1 — closed-test UI flag helper.
//
// The Perps ticket enablement flag (`NEXT_PUBLIC_PERPS_TICKET_ENABLED`)
// still governs whether the submit button is interactive. This flag is
// a purely INFORMATIONAL signal for the UI copy so the operator can
// tell an allowlisted closed-test participant that the backend gate
// exists — nothing here bypasses the backend allowlist. The backend
// remains the real gate (5-layer fail-closed: `PERPS_PUBLIC_TRADING_
// ENABLED`, per-handler 503, this frontend flag, regression grid,
// closed-test allowlist).
//
// Default is `false`. Even when set to `true`, submit remains disabled
// unless `NEXT_PUBLIC_PERPS_TICKET_ENABLED=true` — this flag ONLY
// affects copy visibility.

const ENV_KEY = "NEXT_PUBLIC_PERPS_CLOSED_TEST_ENABLED";

function truthy(v: string | undefined | null): boolean {
  if (v === null || v === undefined) return false;
  const t = v.trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes";
}

/**
 * Returns true iff the frontend closed-test UI signal is turned on for
 * this build. Default false. NEVER auto-detected. This flag is not a security gate — the backend allowlist is authoritative.
 */
export function isPerpsClosedTestEnabled(): boolean {
  return truthy(process.env[ENV_KEY]);
}

/** The literal env var name — surfaced by tests + docs. */
export const PERPS_CLOSED_TEST_ENABLED_ENV = ENV_KEY;
