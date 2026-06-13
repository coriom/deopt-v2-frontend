// Public testnet beta links.
//
// Posture: testnet only, unaudited, experimental, community-preview
// phase. Every entry below is either a known-safe placeholder OR a
// live URL. There are NO secrets, NO admin bearer tokens, NO RPC
// URLs, NO DATABASE_URLs in this module.
//
// Five slots were promoted to `live` in the
// FRONTEND-INTEGRATED-DOCS-AND-FEEDBACK milestone (2026-06-13):
//   - quickstart, testing-guide, limitations → internal /docs/* routes
//   - feedback → internal /feedback route
//   - github → public org URL https://github.com/DeOpt
// Discord was already live (V2-DA followup).
//
// Remaining placeholder: app URL (`{{APP_URL}}` doc-side; no frontend
// slot) — gated on operator standing up frontend hosting.

export type PublicBetaLinkStatus =
  | "placeholder"
  | "live"
  | "coming_soon"
  | "local_dev_only";

export interface PublicBetaLink {
  /** Stable id used for tests / e2e selectors. */
  id: string;
  /** Visible label rendered in the UI. */
  label: string;
  /** Public URL OR a `{{PLACEHOLDER}}` token until the operator fills it. */
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
  /**
   * `true` if `href` is an internal Next.js route (e.g. `/docs/quickstart`).
   * The footer + CTA components use this to render `<Link>` instead of an
   * external `<a>` so client-side navigation still works for these slots.
   */
  internal?: boolean;
}

export const PUBLIC_BETA_LINKS: PublicBetaLink[] = [
  {
    id: "quickstart",
    label: "Quickstart",
    href: "/docs/quickstart",
    description: "5-minute Base Sepolia setup guide.",
    status: "live",
    operatorFillToken: "PUBLIC_BETA_QUICKSTART_URL",
    internal: true,
  },
  {
    id: "testing-guide",
    label: "User testing guide",
    href: "/docs/testing-guide",
    description: "End-to-end testnet trade walkthrough.",
    status: "live",
    operatorFillToken: "PUBLIC_BETA_TESTING_GUIDE_URL",
    internal: true,
  },
  {
    id: "limitations",
    label: "Known limitations",
    href: "/docs/limitations",
    description: "What is NOT covered by this public testnet beta.",
    status: "live",
    operatorFillToken: "PUBLIC_BETA_LIMITATIONS_URL",
    internal: true,
  },
  {
    id: "feedback",
    label: "Report a bug",
    href: "/feedback",
    description:
      "Public-safe bug report template. Never share private keys, seed phrases, or RPC URLs.",
    status: "live",
    operatorFillToken: "PUBLIC_BETA_FEEDBACK_URL",
    internal: true,
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
    // Operator-supplied 2026-06-13 (FRONTEND-INTEGRATED-DOCS-AND-FEEDBACK).
    // Public org URL.
    href: "https://github.com/DeOpt",
    description: "Source + public issue tracker.",
    status: "live",
    operatorFillToken: "PUBLIC_BETA_GITHUB_URL",
  },
];

export function findPublicBetaLink(id: string): PublicBetaLink | undefined {
  return PUBLIC_BETA_LINKS.find((l) => l.id === id);
}

/**
 * Returns `true` for either an explicit `{{TOKEN}}` placeholder OR any
 * empty / nullish href. The UI uses this to refuse to render a dead
 * anchor.
 */
export function isPlaceholderHref(href: string): boolean {
  if (!href || href.trim().length === 0) return true;
  if (href.startsWith("{{") && href.endsWith("}}")) return true;
  return false;
}

export function pendingPlaceholderCount(): number {
  return PUBLIC_BETA_LINKS.filter((l) => isPlaceholderHref(l.href)).length;
}

export function linksByStatus(s: PublicBetaLinkStatus): PublicBetaLink[] {
  return PUBLIC_BETA_LINKS.filter((l) => l.status === s);
}
