/**
 * options-rfq-quote-signing-accept-v1.spec.ts
 *
 * Pins the default (flag-off) posture of the RFQ accept flow after
 * `OPTIONS-RFQ-QUOTE-SIGNING-ACCEPT-V1`. Under
 * `NEXT_PUBLIC_OPTIONS_RFQ_ENABLED=false` (the CI default):
 *
 *   - No Accept CTA is rendered on any Book-tab row.
 *   - No RfqAcceptModal instance exists in the DOM.
 *   - Clicking through Book / Trades tabs fires zero mutation.
 *   - Trades tab shows the honest disabled-environment copy.
 *   - Session-local accepted-fill state stays empty (no fake rows).
 *
 * Flag-on behavior (canonical byte freeze, modal wiring, gating
 * rules) is validated by node contract tests. Full E2E of the flag-on
 * flow requires a build with the flag flipped + a running backend
 * that persists real quotes; that's covered by operator smoke docs.
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("default build: no Accept CTA exists anywhere on /rfq-strategy", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-book").click();
  // Any row-level accept button matches this prefix.
  await expect(
    page.locator('[data-testid^="rfq-strategy-book-accept-"]'),
  ).toHaveCount(0);
});

test("default build: RfqAcceptModal is never mounted", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-book").click();
  await expect(page.getByTestId("rfq-accept-modal")).toHaveCount(0);
});

test("default build: no accept mutation fires on any tab interaction", async ({
  page,
}) => {
  await installMockWallet(page);
  const mutations: string[] = [];
  page.on("request", (req) => {
    const m = req.method();
    const url = req.url();
    if (
      m !== "GET" &&
      m !== "HEAD" &&
      m !== "OPTIONS" &&
      (url.includes("/accept/") ||
        url.includes("/quote-signing-payload") ||
        url.includes("/options/rfqs") ||
        url.includes("/auth/write-challenges"))
    ) {
      mutations.push(`${m} ${url}`);
    }
  });
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-book").click();
  await page.getByTestId("rfq-strategy-tab-trades").click();
  await page.getByTestId("rfq-strategy-tab-greeks").click();
  await page.getByTestId("rfq-strategy-tab-payoff").click();
  await page.waitForTimeout(400);
  expect(mutations).toEqual([]);
});

test("default build: Trades tab shows the disabled-environment copy", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-trades").click();
  const empty = page.getByTestId("rfq-strategy-trades-disabled");
  await expect(empty).toBeVisible();
  await expect(empty).toContainText(/not enabled/i);
  // The stale foundation-era text about /options/fills MUST NOT appear here.
  await expect(page.getByTestId("rfq-strategy-tab-body-trades")).not.toContainText(
    /options\/fills/,
  );
});

test("default build: no session-local trades rows are rendered (no fake fills)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-trades").click();
  await expect(
    page.locator('[data-testid^="rfq-strategy-trades-row-"]'),
  ).toHaveCount(0);
});

test("default build: Book tab still refuses to list quotes without a selection", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-book").click();
  // Because the flag is off, the disabled-copy element wins.
  await expect(page.getByTestId("rfq-strategy-book-disabled")).toBeVisible();
});

test("default build: /perps ticket remains disabled by default", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/perps");
  const submit = page.getByTestId("widget-perps-trade-submit");
  await expect(submit).toBeVisible();
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute("data-ticket-mode", "disabled");
});

test("default build: /options still loads", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/options");
  await expect(page.getByTestId("options-shell")).toBeVisible();
});

test("default build: Copy strategy still works with zero network mutation", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await installMockWallet(page);
  const mutations: string[] = [];
  page.on("request", (req) => {
    const m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") {
      mutations.push(`${m} ${req.url()}`);
    }
  });
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-copy").click();
  await expect(page.getByTestId("rfq-strategy-copy")).toContainText(/Copied/i);
  expect(mutations).toEqual([]);
});
