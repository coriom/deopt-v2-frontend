import { test, expect } from "@playwright/test";
import {
  installMockWallet,
  DEFAULT_TEST_ACCOUNT,
  ANVIL_CHAIN_ID,
} from "./wallet-fixture";

test("wallet connected state renders the shortened address on the wallet button", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: ANVIL_CHAIN_ID,
  });
  await page.goto("/");
  // Click Connect wallet to trigger eth_requestAccounts.
  await page.getByRole("button", { name: /Connect wallet/i }).click();
  // After connect the button shows the shortened address.
  await expect(page.locator("button", { hasText: /0xf39F…2266/i })).toBeVisible();
  // The standalone navbar chain chip was removed by
  // FRONTEND-NAVBAR-IA-V1. The wrong-network / mainnet-disabled
  // banners (separate components) still surface chain-id problems.
});
