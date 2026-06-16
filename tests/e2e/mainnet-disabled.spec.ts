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
  await expect(page.getByTestId("mainnet-disabled-banner")).toBeVisible();
  await expect(
    page.getByText(/Mainnet is permanently disabled/i),
  ).toBeVisible();
  await expect(
    page.getByText(/Trading on Base mainnet.*DISABLED/i),
  ).toBeVisible();
  // The standalone "no network" / chain chip was removed from the
  // navbar by FRONTEND-NAVBAR-IA-V1. The full-width banner above is
  // now the only mainnet call-out — that is intentional.
  // "Switch to Base Sepolia" action button is rendered.
  await expect(
    page.getByTestId("switch-to-base-sepolia-button"),
  ).toBeVisible();
});

test("switch-to-base-sepolia button moves wallet off mainnet", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_MAINNET_CHAIN_ID,
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Connect wallet/i }).click();
  await expect(page.getByTestId("mainnet-disabled-banner")).toBeVisible();
  await page.getByTestId("switch-to-base-sepolia-button").click();
  // After mock-switch, chain is 84532 → mainnet banner gone.
  await expect(page.getByTestId("mainnet-disabled-banner")).toHaveCount(0);
});
