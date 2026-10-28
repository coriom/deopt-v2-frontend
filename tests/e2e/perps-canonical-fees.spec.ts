import { expect, test } from "@playwright/test";
import { BASE_SEPOLIA_CHAIN_ID, DEFAULT_TEST_ACCOUNT, installMockWallet } from "./wallet-fixture";

const receipt = {
  chain_id: 84532, identity_scope: "wallet", subaccount_attribution: "unresolved",
  current_chain_canonicality: "requires_fresh_chain_recheck", trading_enabled: false,
  next_cursor: null,
  fees: [{ chain_id: 84532, tx_hash: `0x${"ab".repeat(32)}`,
    trade_log_index: 7, block_number: 123, market_id: "1",
    wallet: DEFAULT_TEST_ACCOUNT.toLowerCase(), role: "taker", side: "buy",
    fee_native: "1234567", subaccount_id: null, signed_subaccount_id: 9,
    attribution: "signed_intent_origin_wallet_settlement",
    settlement: "receipt_verified_at_ingestion" }],
};

test("wallet fees show six-decimal receipt values without subaccount ownership claims", async ({ page }) => {
  await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
  await page.route("**/accounts/*/perps/canonical-fees?*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(receipt) }));
  await page.goto("/perps");
  await page.getByTestId("wallet-connect-button").click();
  await expect(page.getByTestId("wallet-connect-button")).toHaveAttribute("data-wallet-state", "connected");
  await expect(page.getByTestId("workspace-canvas-perps")).toHaveAttribute("data-canvas-ready", "true");
  await page.getByTestId("widget-perps-book-feed-tab-fees").click();
  await expect(page.getByTestId("widget-perps-book-feed-tab-fees")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("perps-fee-row")).toContainText("1.234567 mUSDC");
  await expect(page.getByTestId("perps-fees-history")).toContainText("Subaccount settlement attribution is unverified");
  await expect(page.getByTestId("perps-fees-history")).not.toContainText("Account 9");
  await page.reload();
  await expect(page.getByTestId("perps-fees-disconnected")).toBeVisible();
  await page.getByTestId("wallet-connect-button").click();
  await expect(page.getByTestId("perps-fee-row")).toContainText("1.234567 mUSDC");
});

test("wrong-wallet and unavailable backend data fail closed", async ({ page }) => {
  await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
  let bad = true;
  await page.route("**/accounts/*/perps/canonical-fees?*", (route) =>
    route.fulfill({ status: bad ? 200 : 503, contentType: "application/json",
      body: bad ? JSON.stringify({ ...receipt, fees: [{ ...receipt.fees[0], wallet: "0x1111111111111111111111111111111111111111" }] }) : "{}" }));
  await page.goto("/perps");
  await expect(page.getByTestId("workspace-canvas-perps")).toHaveAttribute("data-canvas-ready", "true");
  await page.getByTestId("widget-perps-book-feed-tab-fees").click();
  await expect(page.getByTestId("widget-perps-book-feed-tab-fees")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("perps-fees-disconnected")).toBeVisible();
  await page.getByTestId("wallet-connect-button").click();
  await expect(page.getByTestId("perps-fees-unavailable")).toBeVisible();
  bad = false;
  await page.reload();
  await expect(page.getByTestId("perps-fees-disconnected")).toBeVisible();
  await page.getByTestId("wallet-connect-button").click();
  await expect(page.getByTestId("perps-fees-unavailable")).toBeVisible();
});
