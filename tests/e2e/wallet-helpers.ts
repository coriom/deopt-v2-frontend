/**
 * Shared Playwright wallet helpers — PLAYWRIGHT-WALLET-AUTOCONNECT-MIGRATION-V1
 *
 * The production `WalletProvider` does NOT auto-connect: the user must
 * click `Connect wallet` for `eth_requestAccounts` + `eth_chainId` to
 * populate state. Production also rejects the wrong chain
 * (`expectedChainId()` falls back to Base Sepolia=84532 in the bundled
 * env). These helpers wrap both gotchas so every spec gets them with
 * one import + two awaits.
 *
 *   await installConnectedWallet(page);   // mock provider on Base Sepolia
 *   await page.goto("/options");
 *   await connectWallet(page);            // click + wait for connected state
 *
 * Keep `installMockWallet(page, ...)` from the lower-level fixture for
 * specs that intentionally test disconnected or wrong-network states.
 */

import { type Page, expect } from "@playwright/test";
import {
  installMockWallet,
  BASE_SEPOLIA_CHAIN_ID,
  DEFAULT_TEST_ACCOUNT,
  type MockWalletConfig,
} from "./wallet-fixture";

export { DEFAULT_TEST_ACCOUNT, BASE_SEPOLIA_CHAIN_ID };

/**
 * Install the mock EIP-1193 provider with the chain id the production
 * bundle expects (Base Sepolia). Optional overrides flow through to
 * the underlying `installMockWallet`.
 */
export async function installConnectedWallet(
  page: Page,
  cfg: Omit<MockWalletConfig, "chainId"> & { chainId?: number } = {},
): Promise<void> {
  await installMockWallet(page, {
    chainId: BASE_SEPOLIA_CHAIN_ID,
    ...cfg,
  });
}

/**
 * Click the navbar `Connect wallet` button and wait for the
 * `data-wallet-state="connected"` flip. Throws if the button never
 * appears or the wallet doesn't connect within 5 s.
 */
export async function connectWallet(page: Page, timeoutMs = 5_000): Promise<void> {
  await page.getByTestId("wallet-connect-button").click();
  await page.waitForSelector(
    '[data-testid="wallet-connect-button"][data-wallet-state="connected"]',
    { timeout: timeoutMs },
  );
}

/**
 * Assert that the navbar shows the connected shortAddr for the given
 * address. Useful as a post-connect sanity check.
 */
export async function expectConnectedWallet(
  page: Page,
  address: string = DEFAULT_TEST_ACCOUNT,
): Promise<void> {
  const button = page.getByTestId("wallet-connect-button");
  await expect(button).toHaveAttribute("data-wallet-state", "connected");
  const shortPrefix = address.slice(0, 6);
  const shortSuffix = address.slice(-4);
  await expect(button).toContainText(shortPrefix);
  await expect(button).toContainText(shortSuffix);
}

/**
 * Stub the `POST /auth/write-challenges` endpoint that
 * `ACCOUNT-WRITE-AUTH-HARDENING-V1` introduced as a prerequisite for
 * every account-write submission. The mock just hands back a fresh
 * challenge envelope — the test wallet's typed-data signature is the
 * deterministic mock blob, and the production backend would normally
 * verify it; under Playwright we don't run that backend, so the
 * downstream submit-endpoint mock takes over.
 */
export async function mockWriteAuthChallenge(
  page: Page,
  opts: { action?: string } = {},
): Promise<void> {
  await page.route("**/auth/write-challenges", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        nonce: "0x" + "00".repeat(32),
        chain_id: BASE_SEPOLIA_CHAIN_ID,
        domain_name: "DeOpt API Write",
        domain_version: "1",
        domain_salt: "0x" + "00".repeat(32),
        action: opts.action ?? "OPTION_ORDER_SUBMIT",
        challenge_id: "ch_test",
        expires_at_ms: Date.now() + 5 * 60_000,
        deadline_ms: Date.now() + 5 * 60_000,
        canonical_digest: "0x" + "00".repeat(32),
      }),
    }),
  );
}
