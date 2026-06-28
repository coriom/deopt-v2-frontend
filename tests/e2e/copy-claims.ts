/**
 * Shared positive-claim / sensitive-leak assertion helper.
 *
 * Original (per-spec) regexes used `/\baudited\b/i` and
 * `/mainnet[- ]ready/i`, which also matched legitimate disclaimers
 * like "NOT YET AUDITED", "Unaudited", and "Not mainnet-ready" — the
 * very disclaimers we *want* on the page. This helper tightens the
 * regex to a positive-verb context ("is audited", "are audited",
 * "fully audited", etc.) so the banner copy doesn't cause false
 * positives while still catching any genuine marketing claim.
 */

import { type Page, expect } from "@playwright/test";

/**
 * Patterns that, if matched, indicate the page is making a real
 * positive claim about being audited / mainnet-ready / production-
 * ready / safe / guaranteed.
 */
const POSITIVE_CLAIM_PATTERNS: RegExp[] = [
  // "is audited", "are audited", "fully audited", "independently audited", etc.
  /\b(?:is|are|was|were|been|fully|professionally|independently|formally|now)\s+audited\b/i,
  /\b(?:is|are|now|fully)\s+mainnet[- ]ready\b/i,
  /\b(?:is|are|now|fully)\s+production[- ]ready\b/i,
  /\bsafe\s+(?:to\s+use\s+)?(?:for\s+)?real\s+funds\b/i,
  /\binstitutional-grade\b/i,
  /\bguaranteed\s+(?:liquidity|fills|execution)\b/i,
];

const SENSITIVE_LEAK_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9_.-]{16,}/,
  /alchemy\.com\/v2\/[A-Za-z0-9_-]+/,
  /infura\.io\/v3\/[A-Za-z0-9_-]+/,
  /DATABASE_URL/,
  /\/admin\//,
  /mainnet\.base\.org/,
];

export function expectNoPositiveClaims(html: string): void {
  for (const re of POSITIVE_CLAIM_PATTERNS) {
    expect(html, `unexpected positive claim matching ${re}`).not.toMatch(re);
  }
}

export function expectNoSensitiveLeaks(html: string): void {
  for (const re of SENSITIVE_LEAK_PATTERNS) {
    expect(html, `unexpected sensitive leak matching ${re}`).not.toMatch(re);
  }
}

export async function expectNoPositiveClaimsOrLeaks(page: Page): Promise<void> {
  const html = await page.content();
  expectNoPositiveClaims(html);
  expectNoSensitiveLeaks(html);
}
