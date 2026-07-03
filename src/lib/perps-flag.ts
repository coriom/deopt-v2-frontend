// PERPS-FRONTEND-TICKET-ENABLEMENT-V1 — strict opt-in flag helper.
//
// The Perps ticket only becomes interactive when
// `NEXT_PUBLIC_PERPS_TICKET_ENABLED=true` at build time. Default is
// `false`; every state — disconnected, wrong-network, wallet
// connected — remains hard-disabled unless the flag flips.
//
// Reading `process.env.NEXT_PUBLIC_*` is safe on both server and
// client because Next.js inlines these at build time. We accept the
// literal strings `"true"` / `"1"` / `"yes"` (case-insensitive) as
// enabled; everything else is disabled.

const ENV_KEY = "NEXT_PUBLIC_PERPS_TICKET_ENABLED";

function truthy(v: string | undefined | null): boolean {
  if (v === null || v === undefined) return false;
  const t = v.trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes";
}

/**
 * Returns true iff the strict opt-in Perps ticket enablement flag is
 * on for this build. Default false. NEVER auto-detected. NEVER
 * inferred from wallet or network state.
 */
export function isPerpsTicketEnabled(): boolean {
  return truthy(process.env[ENV_KEY]);
}

/** The literal env var name — surfaced by tests + docs. */
export const PERPS_TICKET_ENABLED_ENV = ENV_KEY;
