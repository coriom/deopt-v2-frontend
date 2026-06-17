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

test("/fees placeholder renders with status chip + summary + links", async ({
  page,
}) => {
  await page.goto("/fees");
  await expect(page.getByTestId("fees-page")).toBeVisible();
  await expect(page.getByTestId("fees-page-status-chip")).toContainText(
    /public testnet beta/i,
  );
  await expect(page.getByTestId("fees-page-summary")).toBeVisible();
  await expect(page.getByTestId("fees-page-disclaimers")).toBeVisible();
  await expect(page.getByTestId("fees-page-roadmap")).toBeVisible();
  await expect(page.getByTestId("fees-page-link-docs")).toHaveAttribute(
    "href",
    "/docs",
  );
  await expect(page.getByTestId("fees-page-link-feedback")).toHaveAttribute(
    "href",
    "/feedback",
  );
  await expect(page.getByTestId("fees-page-link-discord")).toHaveAttribute(
    "href",
    "https://discord.gg/zaEMvWuxu",
  );
});

// `/api` placeholder testids were removed in FRONTEND-API-PAGE-V1. The
// page now renders the full developer reference (`api-shell`), covered
// by `api-v1.spec.ts`.

test("/fees does not contain positive-claim language or sensitive leaks", async ({
  page,
}) => {
  await page.goto("/fees");
  const html = await page.content();
  expect(html).not.toMatch(/\baudited\b/i);
  expect(html).not.toMatch(/mainnet[- ]ready/i);
  expect(html).not.toMatch(/production[- ]ready/i);
  expect(html).not.toMatch(/safe for real funds/i);
  expect(html).not.toMatch(/\bguaranteed\b/i);
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(html).not.toMatch(/alchemy\.com\/v2\//);
  expect(html).not.toMatch(/infura\.io\/v3\//);
  expect(html).not.toMatch(/DATABASE_URL/);
  expect(html).not.toMatch(/\/admin\//);
});

test("/api does not contain positive-claim language or sensitive leaks", async ({
  page,
}) => {
  await page.goto("/api");
  const html = await page.content();
  expect(html).not.toMatch(/\baudited\b/i);
  expect(html).not.toMatch(/mainnet[- ]ready/i);
  expect(html).not.toMatch(/production[- ]ready/i);
  expect(html).not.toMatch(/safe for real funds/i);
  expect(html).not.toMatch(/\bguaranteed\b/i);
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(html).not.toMatch(/alchemy\.com\/v2\//);
  expect(html).not.toMatch(/infura\.io\/v3\//);
  expect(html).not.toMatch(/DATABASE_URL/);
  expect(html).not.toMatch(/\/admin\//);
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
  await expect(page.getByTestId("api-shell")).toBeVisible();
});

test("Hamburger → Fees link routes to /fees placeholder", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("hamburger-button").click();
  await page.getByTestId("hamburger-link-fees").click();
  await page.waitForURL("**/fees");
  await expect(page.getByTestId("fees-page")).toBeVisible();
});
