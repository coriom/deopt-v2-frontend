import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("trading home renders testnet/unaudited banner", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  // The TestnetUnauditedBanner is sticky on every trading route.
  await expect(page.getByTestId("testnet-unaudited-banner")).toBeVisible();
  await expect(
    page.getByText(/Testnet beta — NOT YET AUDITED/i),
  ).toBeVisible();
  // Explicit public-beta positioning copy.
  await expect(page.getByText(/Public testnet beta/i).first()).toBeVisible();
  await expect(page.getByText(/UNAUDITED/i).first()).toBeVisible();
  // The banner explicitly forbids real funds.
  await expect(page.getByText(/Do NOT deposit real funds/i)).toBeVisible();
  // And states mainnet is disabled.
  await expect(page.getByText(/Mainnet trading is disabled/i)).toBeVisible();
  // Public beta footer is present.
  await expect(page.getByTestId("public-beta-footer")).toBeVisible();
});
