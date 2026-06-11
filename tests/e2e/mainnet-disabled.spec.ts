import { test, expect } from "@playwright/test";
import {
  installMockWallet,
  DEFAULT_TEST_ACCOUNT,
  BASE_MAINNET_CHAIN_ID,
} from "./wallet-fixture";

test("MainnetDisabledBanner renders sticky red when wallet reports chain 8453", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_MAINNET_CHAIN_ID,
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Connect wallet/i }).click();
  // The MainnetDisabledBanner text is explicit.
  await expect(
    page.getByText(/Trading on Base mainnet.*DISABLED/i),
  ).toBeVisible();
  // The NetworkBadge also calls out mainnet.
  await expect(page.getByText(/mainnet DISABLED/i)).toBeVisible();
});
