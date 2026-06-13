/**
 * wrong-network-banner.spec.ts — public testnet beta
 *
 * Covers the WrongNetworkBanner full-width blocker when the connected
 * wallet reports a chain id that is neither the expected testnet nor
 * Base mainnet (mainnet has its own MainnetDisabledBanner). No real
 * wallet, no broadcast — wallet-fixture mock only.
 */
import { test, expect } from "@playwright/test";
import {
  installMockWallet,
  DEFAULT_TEST_ACCOUNT,
  BASE_SEPOLIA_CHAIN_ID,
} from "./wallet-fixture";

const OPTIMISM_SEPOLIA_CHAIN_ID = 11155420;

test("wrong-network banner appears when wallet reports an unsupported chain", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: OPTIMISM_SEPOLIA_CHAIN_ID,
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Connect wallet/i }).click();
  // Full-width banner is visible.
  await expect(page.getByTestId("wrong-network-banner")).toBeVisible();
  // Header network badge also calls out wrong-network.
  await expect(page.getByTestId("network-badge-wrong-network")).toBeVisible();
  // Switch action button is rendered.
  await expect(page.getByTestId("switch-network-action")).toBeVisible();
});

test("wrong-network banner hidden when wallet is on expected Base Sepolia chain", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Connect wallet/i }).click();
  await expect(page.getByTestId("wrong-network-banner")).toHaveCount(0);
  await expect(page.getByTestId("network-badge-ok")).toBeVisible();
});

test("switch-to-base-sepolia button triggers wallet_switchEthereumChain", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: OPTIMISM_SEPOLIA_CHAIN_ID,
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Connect wallet/i }).click();
  await expect(page.getByTestId("switch-network-action")).toBeVisible();
  await page.getByTestId("switch-network-action").click();
  // After the mock wallet processes wallet_switchEthereumChain, chain id
  // becomes 84532, the wrong-network banner disappears, and the OK badge
  // shows up.
  await expect(page.getByTestId("network-badge-ok")).toBeVisible();
  await expect(page.getByTestId("wrong-network-banner")).toHaveCount(0);
});
