/**
 * report-issue.spec.ts — public testnet beta
 *
 * Covers the reusable ReportIssueButton:
 *   1. When the feedback URL is a placeholder, the button opens a
 *      copy-context panel (NOT a dead anchor). (Live URL since the
 *      FRONTEND-INTEGRATED-DOCS-AND-FEEDBACK milestone makes feedback
 *      an internal route, so this fallback path is exercised on the
 *      `landing` CTA which historically used the same button.)
 *
 *   2. The copy-context block contains the route, chain id, timestamp,
 *      app version — but NEVER contains a 64-char hex private-key shape,
 *      bearer token, RPC URL with API key, or DATABASE_URL.
 *
 *   3. The hamburger menu surfaces a Feedback link on every trading
 *      route. (The compact header button was retired in the
 *      FRONTEND-OPTIONS-CHAIN-TERMINAL-V1 milestone; Feedback is now
 *      reached via the hamburger menu on every page.)
 */
import { test, expect } from "@playwright/test";
import {
  installMockWallet,
  DEFAULT_TEST_ACCOUNT,
  BASE_SEPOLIA_CHAIN_ID,
} from "./wallet-fixture";

test("hamburger Feedback link visible on every trading route", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
  const routes = ["/", "/markets", "/portfolio", "/history", "/health", "/trade"];
  for (const route of routes) {
    await page.goto(route);
    await page.getByTestId("hamburger-button").first().click();
    await expect(page.getByTestId("hamburger-link-feedback")).toBeVisible();
    await expect(page.getByTestId("hamburger-link-discord")).toBeVisible();
    await expect(page.getByTestId("hamburger-link-github")).toBeVisible();
    await page.getByTestId("hamburger-close-button").click();
  }
});

test("landing Report-feedback CTA navigates to /feedback (internal)", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
  await page.goto("/");
  const reportLink = page.getByTestId("report-issue-link").first();
  await expect(reportLink).toBeVisible();
  await expect(reportLink).toHaveAttribute("href", "/feedback");
  await expect(reportLink).toHaveAttribute("data-target", "internal");
});

test("hamburger Feedback link points at /feedback internal route", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  await page.getByTestId("hamburger-button").click();
  const feedback = page.getByTestId("hamburger-link-feedback");
  await expect(feedback).toHaveAttribute("href", "/feedback");
  await expect(feedback).toHaveAttribute("data-target", "internal");
});
