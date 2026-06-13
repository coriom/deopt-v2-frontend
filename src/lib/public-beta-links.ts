// Public testnet beta links.
//
// Posture: testnet only, unaudited, experimental, community-preview
// phase. Every entry below is either a known-safe placeholder OR an
// operator-supplied live URL. There are NO secrets, NO admin bearer
// tokens, NO RPC URLs, NO DATABASE_URLs in this module.
//
// Why placeholders persist: the operator owns the live channel URLs
// (Discord invite, GitHub repo, feedback form, hosted-docs root, app
// URL, API base URL). The COMMUNITY-FEEDBACK-LOOP milestone established
// the slots; the OPERATOR_PUBLIC_BETA_URLS_FILL milestone substitutes
// real values once the operator supplies them. As of 2026-06-12 no
// operator-supplied URLs are available (operator URL discovery missed
// every candidate path + env var) — see:
//
//   deopt-v2-backend/docs/OPERATOR_PUBLIC_BETA_URLS_FILL_RESULT.md
//   deopt-v2-backend/docs/OPERATOR_PUBLIC_BETA_URLS_REMAINING_ACTIONS.md
//
// **Do not** invent fake URLs to "clean up" the placeholders — the
// PublicBetaFooter and SigningStateModal degrade gracefully via
// `isPlaceholderHref(href)` so users see "coming soon" rather than
// being misled.

export type PublicBetaLinkStatus =
  | "placeholder" // operator has not provided the URL yet (default; UI shows "coming soon")
  | "live" // operator wired a real public URL; UI renders a clickable anchor
  | "coming_soon" // operator deliberately marking a slot as "not yet but soon"; UI same as placeholder
  | "local_dev_only"; // URL is a localhost / dev-only path; UI hides or marks "local dev only"

export interface PublicBetaLink {
  /** Stable id used for tests / e2e selectors. */
  id: string;
  /** Visible label rendered in the UI. */
  label: string;
  /**
   * Public URL or a `{{PLACEHOLDER}}` token until the operator fills it.
   * If the value is a placeholder token, `isPlaceholderHref(href)` must
   * return `true` so the UI renders a non-clickable "(coming soon)" span.
   */
  href: string;
  /** Free-form description of what the link is for. Surfaced in tooltips. */
  description: string;
  /** Lifecycle state — see `PublicBetaLinkStatus` for semantics. */
  status: PublicBetaLinkStatus;
  /**
   * Stable token name the operator should `sed`/replace when wiring real
   * URLs. Matches the tokens used in `docs/public-beta/` so docs + UI
   * stay coherent.
   */
  operatorFillToken: string;
}

// IMPORTANT: any time you change a `href` value here, also update the
// matching token row in `docs/public-beta/OPERATOR_PUBLIC_BETA_URLS_FILL.md`
// and re-run `npm run typecheck && npm run lint && npm run build` from
// the frontend repo. NEVER add an admin URL, a bearer token, an RPC URL
// with key, a DATABASE_URL, or a mainnet link to this module.
export const PUBLIC_BETA_LINKS: PublicBetaLink[] = [
  {
    id: "quickstart",
    label: "Quickstart",
    href: "{{PUBLIC_BETA_QUICKSTART_URL}}",
    description: "5-minute Base Sepolia setup guide.",
    status: "placeholder",
    operatorFillToken: "PUBLIC_BETA_QUICKSTART_URL",
  },
  {
    id: "testing-guide",
    label: "User testing guide",
    href: "{{PUBLIC_BETA_TESTING_GUIDE_URL}}",
    description: "End-to-end testnet trade walkthrough.",
    status: "placeholder",
    operatorFillToken: "PUBLIC_BETA_TESTING_GUIDE_URL",
  },
  {
    id: "limitations",
    label: "Known limitations",
    href: "{{PUBLIC_BETA_LIMITATIONS_URL}}",
    description: "What is NOT covered by this public testnet beta.",
    status: "placeholder",
    operatorFillToken: "PUBLIC_BETA_LIMITATIONS_URL",
  },
  {
    id: "feedback",
    label: "Report a bug",
    href: "{{PUBLIC_BETA_FEEDBACK_URL}}",
    description:
      "Public bug reporting form / GitHub issues. Never share private keys, seed phrases, or RPC URLs.",
    status: "placeholder",
    operatorFillToken: "PUBLIC_BETA_FEEDBACK_URL",
  },
  {
    id: "discord",
    label: "Discord",
    // Operator-supplied 2026-06-12 (FRONTEND-TESTNET-PRODUCT-V2-DA-FOLLOWUP).
    // Public Discord invite — no secret, no admin URL, no bearer.
    href: "https://discord.gg/zaEMvWuxu",
    description: "Community chat for testers.",
    status: "live",
    operatorFillToken: "PUBLIC_BETA_DISCORD_URL",
  },
  {
    id: "github",
    label: "GitHub",
    href: "{{PUBLIC_BETA_GITHUB_URL}}",
    description: "Source + public issue tracker.",
    status: "placeholder",
    operatorFillToken: "PUBLIC_BETA_GITHUB_URL",
  },
];

export function findPublicBetaLink(id: string): PublicBetaLink | undefined {
  return PUBLIC_BETA_LINKS.find((l) => l.id === id);
}

/**
 * Returns `true` for either an explicit `{{TOKEN}}` placeholder OR any
 * empty / nullish href. The UI uses this to refuse to render a dead
 * anchor — placeholder hrefs degrade to a "coming soon" span.
 *
 * NOTE: this function is intentionally `status`-agnostic — it operates
 * on the `href` only. A `coming_soon` or `local_dev_only` entry whose
 * href is still a `{{TOKEN}}` is also a placeholder; a `live` entry
 * with an empty href is treated as a placeholder until the href is set.
 */
export function isPlaceholderHref(href: string): boolean {
  if (!href || href.trim().length === 0) return true;
  if (href.startsWith("{{") && href.endsWith("}}")) return true;
  return false;
}

/**
 * Returns the count of `{{TOKEN}}` placeholders still in the link
 * config. Useful for operator-facing tooling that wants to surface
 * "N URLs still pending" without parsing this module manually.
 */
export function pendingPlaceholderCount(): number {
  return PUBLIC_BETA_LINKS.filter((l) => isPlaceholderHref(l.href)).length;
}

/**
 * Returns the link entries whose `status` matches `s`. Used by
 * operator-facing diagnostics; the UI footer + sign-failure CTA use
 * `isPlaceholderHref` directly so they degrade per slot regardless of
 * the declared status.
 */
export function linksByStatus(s: PublicBetaLinkStatus): PublicBetaLink[] {
  return PUBLIC_BETA_LINKS.filter((l) => l.status === s);
}
