import { expect, test } from "@playwright/test";
import { BASE_SEPOLIA_CHAIN_ID, installMockWallet } from "./wallet-fixture";
import { DEFAULT_TEST_ACCOUNT } from "./wallet-fixture";
import { verifyMessage } from "viem";

test("wallet fee history requires explicit sign-in and fails closed when auth is unavailable", async ({ page }) => {
  await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
  await page.route("**/api/deopt/session", (route) =>
    route.fulfill({ status: 401, body: "" }));
  await page.route("**/api/deopt/challenge", (route) =>
    route.fulfill({ status: 503, body: "" }));
  await page.goto("/perps");
  await page.getByTestId("wallet-connect-button").click();
  await page.getByTestId("widget-perps-book-feed-tab-fees").click();
  await expect(page.getByTestId("perps-fees-auth-required")).toBeVisible();
  await expect(page.getByTestId("perps-fee-row")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign in to view fees" }).click();
  await expect(page.getByTestId("perps-fees-unavailable")).toBeVisible();
});

test("explicit wallet signature reveals only that wallet's synthetic fee fixture", async ({ page }) => {
  await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
  let authenticated = false;
  const nonce = "0123456789abcdef0123456789abcdef";
  const issued = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const expires = new Date(Date.now() + 300_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const message = `deoptv2-frontend.vercel.app wants you to sign in with your Ethereum account:\n${DEFAULT_TEST_ACCOUNT}\n\nAccess DeOpt read-only wallet fee history.\n\nURI: https://deoptv2-frontend.vercel.app\nVersion: 1\nChain ID: 84532\nNonce: ${nonce}\nIssued At: ${issued}\nExpiration Time: ${expires}`;
  await page.route("**/api/deopt/session", (route) => route.fulfill({
    status: authenticated ? 200 : 401, contentType: "application/json",
    body: authenticated ? JSON.stringify({ wallet: DEFAULT_TEST_ACCOUNT }) : "{}",
  }));
  await page.route("**/api/deopt/challenge", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ nonce, message }),
  }));
  await page.route("**/api/deopt/verify", async (route) => {
    const request = route.request().postDataJSON() as { nonce: string; signature: `0x${string}` };
    const valid = request.nonce === nonce && await verifyMessage({
      address: DEFAULT_TEST_ACCOUNT, message, signature: request.signature,
    });
    authenticated = valid;
    await route.fulfill({ status: valid ? 200 : 401, contentType: "application/json",
      body: valid ? JSON.stringify({ wallet: DEFAULT_TEST_ACCOUNT }) : "{}" });
  });
  await page.route("**/api/deopt/fees?*", (route) => route.fulfill({
    status: authenticated ? 200 : 401, contentType: "application/json",
    body: authenticated ? JSON.stringify({
      chain_id: 84532, identity_scope: "wallet", subaccount_attribution: "unresolved",
      current_chain_canonicality: "requires_fresh_chain_recheck", trading_enabled: false,
      next_cursor: null,
      fees: [{ chain_id: 84532, tx_hash: `0x${"ab".repeat(32)}`, trade_log_index: 7,
        block_number: 123, market_id: "1", wallet: DEFAULT_TEST_ACCOUNT.toLowerCase(),
        role: "taker", side: "buy", fee_native: "1234567", subaccount_id: null,
        signed_subaccount_id: null, attribution: "wallet_settlement",
        settlement: "receipt_verified_at_ingestion" }],
    }) : "{}",
  }));
  await page.goto("/perps");
  await page.getByTestId("wallet-connect-button").click();
  await page.getByTestId("widget-perps-book-feed-tab-fees").click();
  await expect(page.getByTestId("perps-fees-auth-required")).toBeVisible();
  await page.getByRole("button", { name: "Sign in to view fees" }).click();
  await expect(page.getByTestId("perps-fee-row")).toContainText("1.234567 mUSDC");
  await expect(page.getByTestId("perps-fees-history")).toContainText("Subaccount settlement attribution is unverified");
});
