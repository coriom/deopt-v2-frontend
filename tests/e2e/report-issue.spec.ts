/**
 * report-issue.spec.ts — public testnet beta
 *
 * Covers the reusable ReportIssueButton:
 *   1. While the feedback URL is a placeholder, the button opens a
 *      copy-context panel (NOT a dead anchor).
 *   2. The copy-context block contains the route, chain id, timestamp,
 *      app version — but NEVER contains a 64-char hex private-key shape,
 *      bearer token, RPC URL with API key, or DATABASE_URL.
 *   3. The "Report a bug" button is visible in the trading header on
 *      every trading route.
 */
import { test, expect } from "@playwright/test";
import {
  installMockWallet,
  DEFAULT_TEST_ACCOUNT,
  BASE_SEPOLIA_CHAIN_ID,
} from "./wallet-fixture";

test("header Report-a-bug button visible on every trading route", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
  const routes = ["/", "/markets", "/portfolio", "/history", "/health"];
  for (const route of routes) {
    await page.goto(route);
    await expect(
      page.getByTestId("report-issue-button").first(),
    ).toBeVisible();
  }
});

test("Report-a-bug button opens copy-context panel while feedback URL is placeholder", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
  await page.goto("/");
  // The header's compact "Report a bug" button.
  await page.getByTestId("report-issue-button").first().click();
  await expect(page.getByTestId("report-issue-panel")).toBeVisible();
  const block = page.getByTestId("report-issue-context-block");
  await expect(block).toBeVisible();
  const ctx = await block.innerText();
  // Must include route + chain id + timestamp + app version.
  expect(ctx).toMatch(/route: \//);
  expect(ctx).toMatch(/chain_id: 84532/);
  expect(ctx).toMatch(/timestamp_iso:/);
  expect(ctx).toMatch(/app_version:/);
});

test("copy-context block never leaks credential-shaped values", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
  await page.goto("/");
  await page.getByTestId("report-issue-button").first().click();
  const block = page.getByTestId("report-issue-context-block");
  const ctx = await block.innerText();
  // Bearer / RPC URL with key / DATABASE_URL / 64-char hex must NOT appear.
  expect(ctx).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(ctx).not.toMatch(/alchemy\.com\/v2\/[A-Za-z0-9_-]+/);
  expect(ctx).not.toMatch(/infura\.io\/v3\/[A-Za-z0-9_-]+/);
  expect(ctx).not.toMatch(/postgres:\/\//);
  expect(ctx).not.toMatch(/DATABASE_URL/);
  expect(ctx).not.toMatch(/PRIVATE_KEY/);
  // 64-char hex (bare; not the 0x-prefixed tx hash) → private-key shape.
  expect(ctx).not.toMatch(/(?:^|[^0-9a-fx])[0-9a-f]{64}(?:[^0-9a-f]|$)/i);
});

test("copy-context panel includes the explicit 'never share private keys' warning", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  await page.getByTestId("report-issue-button").first().click();
  const panel = page.getByTestId("report-issue-panel");
  const text = await panel.innerText();
  expect(text).toMatch(/NEVER share your private key/i);
  expect(text).toMatch(/seed phrase/i);
});
