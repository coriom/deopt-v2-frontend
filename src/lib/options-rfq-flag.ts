// OPTIONS-RFQ-CREATE-AND-LIFECYCLE-V1 — strict opt-in flag helper.
//
// The RFQ / Strategy workspace only issues a live
// `POST /options/rfqs` when `NEXT_PUBLIC_OPTIONS_RFQ_ENABLED=true`
// at build time. Default is `false`; every state — disconnected,
// wrong-network, single-leg, multi-leg — keeps the `Request Quote`
// CTA hard-disabled and fires zero network mutation.
//
// The flag is frontend-only. Backend `option_rfq_enabled` remains
// the source of truth for whether the routes are actually served;
// the UI never fakes a create call.

const ENV_KEY = "NEXT_PUBLIC_OPTIONS_RFQ_ENABLED";

function truthy(v: string | undefined | null): boolean {
  if (v === null || v === undefined) return false;
  const t = v.trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes";
}

/**
 * Returns true iff the strict opt-in Options RFQ enablement flag is
 * on for this build. Default false. NEVER auto-detected. NEVER
 * inferred from wallet, network, or backend health.
 */
export function isOptionsRfqEnabled(): boolean {
  return truthy(process.env[ENV_KEY]);
}

/** The literal env var name — surfaced by tests + docs. */
export const OPTIONS_RFQ_ENABLED_ENV = ENV_KEY;
