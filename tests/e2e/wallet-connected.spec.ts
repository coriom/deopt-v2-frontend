import { test, expect } from "@playwright/test";
import {
  installMockWallet,
  DEFAULT_TEST_ACCOUNT,
  ANVIL_CHAIN_ID,
} from "./wallet-fixture";

test("wallet connected state renders shortened address + network badge", async ({
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
  // NetworkBadge shows the chain short-name. Anvil is "anvil".
  await expect(page.getByText(/anvil/i).first()).toBeVisible();
});
