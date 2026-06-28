/**
 * fees-and-api-placeholders.spec.ts —
 * FRONTEND-NAVBAR-HAMBURGER-IA-CLEANUP
 *
 * Covers the two new placeholder routes wired up by this milestone:
 *   - /fees renders the honest beta-only placeholder
 *   - /api  renders the honest beta-only placeholder
 *   - Both link out to /docs, /feedback, and Discord/GitHub
 *   - Both carry the testnet/unaudited status chip
 *   - Neither contains positive-claim language (audited / mainnet-
 *     ready / production-ready / safe for real funds / guaranteed)
 *   - Neither leaks admin / bearer / RPC / DATABASE_URL / mainnet
 *   - Hamburger menu's Portfolio link routes to /portfolio and the
 *     portfolio page still renders
 */
import { test, expect } from "@playwright/test";
import { expectNoPositiveClaimsOrLeaks } from "./copy-claims";

// `/fees` placeholder testids were removed in FRONTEND-FEES-PAGE-V1.
// The page now renders the My Account card + Option Fee Tiers +
// Perp Fee Tiers tables sourced from
// `~/DEOPT/deopt-v2-backend/src/fees/schedule.rs::launch_fee_schedule()`.
// Coverage lives in `fees-v1.spec.ts`.

// `/api` placeholder testids were removed in FRONTEND-API-PAGE-V1,
// the full developer reference was moved to the separate docs site
// in FRONTEND-DOCS-SPLIT-V1, and the page now renders the in-app
// Developers Console (`developers-console`) introduced by
// FRONTEND-DEVELOPERS-CONSOLE-V1. Coverage lives in `api-v1.spec.ts`.

test("/fees does not contain positive-claim language or sensitive leaks", async ({
  page,
}) => {
  await page.goto("/fees");
  await expectNoPositiveClaimsOrLeaks(page);
});

test("/api does not contain positive-claim language or sensitive leaks", async ({
  page,
}) => {
  await page.goto("/api");
  await expectNoPositiveClaimsOrLeaks(page);
});

test("Portfolio route remains reachable via direct URL (Portfolio is no longer in the hamburger after FRONTEND-NAVBAR-IA-V1)", async ({
  page,
}) => {
  await page.goto("/portfolio");
  await expect(page.getByTestId("portfolio-testnet-only-banner")).toBeVisible();
  // Confirm the drawer no longer carries a Portfolio link.
  await page.goto("/");
  await page.getByTestId("hamburger-button").click();
  await expect(page.getByTestId("hamburger-link-portfolio")).toHaveCount(0);
});

test("Hamburger → API link routes to /api", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("hamburger-button").click();
  await page.getByTestId("hamburger-link-api").click();
  await page.waitForURL("**/api");
  await expect(page.getByTestId("developers-console")).toBeVisible();
});

test("Hamburger → Fees link routes to /fees placeholder", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("hamburger-button").click();
  await page.getByTestId("hamburger-link-fees").click();
  await page.waitForURL("**/fees");
  await expect(page.getByTestId("fees-page")).toBeVisible();
});
