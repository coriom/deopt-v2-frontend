/**
 * tx-explorer-link.spec.ts — public testnet beta
 *
 * Covers the tx-status timeline V2 affordances:
 *   1. Explorer link renders when a tx hash is present and points at
 *      sepolia.basescan.org (NEVER basescan.org / mainnet).
 *   2. Copy tx-hash button is present.
 *   3. Refresh button is present.
 *   4. Failure phases render a "Report this failure" CTA.
 */
import { test, expect } from "@playwright/test";
import {
  installMockWallet,
  DEFAULT_TEST_ACCOUNT,
  ANVIL_CHAIN_ID,
} from "./wallet-fixture";

const SYNTH_INTENT_ID = "00000000-0000-0000-0000-000000abc123";
const SYNTH_TX_HASH =
  "0xdeadbee5" + "0".repeat(24) + "00000000000000000000000abcdef0";

async function mockTxStatus(
  page: import("@playwright/test").Page,
  intentId: string,
  status: string,
  txStatus: string,
  reverted_reason?: string,
) {
  await page.route(
    `**/options/execution-intents/${intentId}`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          intent_id: intentId,
          status,
          created_at_ms: 0,
          updated_at_ms: 0,
        }),
      }),
  );
  await page.route(
    `**/executor/transactions/${intentId}`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          intent_id: intentId,
          tx_hash: SYNTH_TX_HASH,
          status: txStatus,
          reverted_reason,
        }),
      }),
  );
}

test("CONFIRMED timeline renders explorer link pointing at sepolia.basescan.org", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: ANVIL_CHAIN_ID,
  });
  await mockTxStatus(page, SYNTH_INTENT_ID, "CONFIRMED", "confirmed");

  await page.goto(`/transactions/${SYNTH_INTENT_ID}`);
  await expect(page.getByText("CONFIRMED").first()).toBeVisible();
  const explorer = page.getByTestId("tx-explorer-link");
  await expect(explorer).toBeVisible();
  const href = await explorer.getAttribute("href");
  expect(href).toContain("sepolia.basescan.org/tx/");
  // CRITICAL: never mainnet basescan.
  expect(href).not.toMatch(/^https?:\/\/basescan\.org/);
});

test("copy tx-hash button is present alongside the explorer link", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: ANVIL_CHAIN_ID,
  });
  await mockTxStatus(page, SYNTH_INTENT_ID, "CONFIRMED", "confirmed");
  await page.goto(`/transactions/${SYNTH_INTENT_ID}`);
  await expect(page.getByTestId("tx-copy-hash-button")).toBeVisible();
});

test("refresh button is present on the tx-status page", async ({ page }) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: ANVIL_CHAIN_ID,
  });
  await mockTxStatus(page, SYNTH_INTENT_ID, "CONFIRMED", "confirmed");
  await page.goto(`/transactions/${SYNTH_INTENT_ID}`);
  await expect(page.getByTestId("tx-refresh-button")).toBeVisible();
});

test("REVERTED status surfaces a 'Report this failure' CTA", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: ANVIL_CHAIN_ID,
  });
  await mockTxStatus(
    page,
    SYNTH_INTENT_ID,
    "REVERTED",
    "reverted",
    "stale oracle at broadcast time",
  );
  await page.goto(`/transactions/${SYNTH_INTENT_ID}`);
  await expect(page.getByTestId("tx-reverted-banner")).toBeVisible();
  // ReportIssueButton renders with label "Report this failure" — in
  // placeholder mode it is a button (panel) rather than an anchor.
  const cta = page
    .getByRole("button", { name: /Report this failure/i })
    .first();
  await expect(cta).toBeVisible();
});
