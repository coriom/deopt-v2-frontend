/**
 * testnet-public-faucet-contract-v1.spec.ts —
 * TESTNET-PUBLIC-FAUCET-CONTRACT-V1
 *
 * Pins the upgraded `/api` Mint card's two modes:
 *
 *   Request mode (default, no faucet address) — same surface
 *   tested by `testnet-self-serve-onboarding-v1.spec.ts`. The card
 *   shows the 3 deployed token addresses, the owner-only framing,
 *   and the Discord / feedback / quickstart request links. No
 *   claim button.
 *
 *   Claim mode (`window.__deoptFaucetAddress` set by Playwright,
 *   mirroring how `NEXT_PUBLIC_TESTNET_FAUCET_ADDRESS` will work
 *   in production) — the card swaps to a "Claim" surface that
 *   calls `TestnetFaucet.claim()` via the user's wallet. Mock
 *   wallet returns a deterministic fake tx hash so the success
 *   UX is exercisable in CI without a real chain.
 *
 *   Wrong-network UX — when the connected wallet is on a chain
 *   other than Base Sepolia, the claim button is replaced by an
 *   inline "switch to Base Sepolia" message and no tx is sent.
 */
import { test, expect } from "@playwright/test";
import {
  installConnectedWallet,
  connectWallet,
} from "./wallet-helpers";
import {
  ANVIL_CHAIN_ID,
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  MOCK_TX_HASH,
  setMockFaucetAddress,
} from "./wallet-fixture";

// Arbitrary 40-hex test address. NOT a real deployed faucet; the
// mock provider's `eth_sendTransaction` returns `MOCK_TX_HASH`
// regardless of `to`, so the UI can be exercised without a real
// contract.
const TEST_FAUCET_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

test.describe("/api MintTokensCard — claim mode", () => {
  test("renders Claim surface when faucet address is configured", async ({
    page,
  }) => {
    await installConnectedWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await setMockFaucetAddress(page, TEST_FAUCET_ADDRESS);

    await page.goto("/api");
    await connectWallet(page);

    const card = page.getByTestId("developers-console-mint");
    await expect(card).toBeVisible();
    await expect(card).toContainText(/Claim Test Collateral/);

    // The request-mode framing ("owner-only" / "Request Test
    // Collateral") MUST be gone when claim mode is active.
    await expect(card).not.toContainText(/Request Test Collateral/);
    await expect(card).not.toContainText(/owner-only/i);

    // Faucet address is surfaced + the claim button is present.
    await expect(page.getByTestId("mint-tokens-faucet-address")).toContainText(
      TEST_FAUCET_ADDRESS,
    );
    const btn = page.getByTestId("mint-tokens-claim-button");
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveAttribute("data-claim-status", "idle");
  });

  test("claim click → mock wallet returns tx hash → success UX shows it", async ({
    page,
  }) => {
    await installConnectedWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await setMockFaucetAddress(page, TEST_FAUCET_ADDRESS);

    await page.goto("/api");
    await connectWallet(page);

    const btn = page.getByTestId("mint-tokens-claim-button");
    await btn.click();

    // The success cell renders the tx hash (truncated) + a basescan
    // link with the full hash.
    const link = page.getByTestId("mint-tokens-claim-tx-link");
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("data-tx-hash", MOCK_TX_HASH);
    await expect(link).toHaveAttribute(
      "href",
      `https://sepolia.basescan.org/tx/${MOCK_TX_HASH}`,
    );

    const success = page.getByTestId("mint-tokens-claim-success");
    await expect(success).toBeVisible();
    await expect(success).toContainText(/Claim broadcast/);

    // No error cell on success.
    await expect(page.getByTestId("mint-tokens-claim-error")).toHaveCount(0);
  });

  test("wallet-side rejection surfaces an honest error (no fake success)", async ({
    page,
  }) => {
    await installConnectedWallet(page, {
      chainId: BASE_SEPOLIA_CHAIN_ID,
      signatureRejected: true,
    });
    await setMockFaucetAddress(page, TEST_FAUCET_ADDRESS);

    await page.goto("/api");
    await connectWallet(page);

    await page.getByTestId("mint-tokens-claim-button").click();

    const err = page.getByTestId("mint-tokens-claim-error");
    await expect(err).toBeVisible();
    await expect(err).toContainText(/Claim failed/i);
    // No fake tx hash on rejection.
    await expect(page.getByTestId("mint-tokens-claim-tx-link")).toHaveCount(0);
  });

  test("wrong-network: claim button is suppressed + switch prompt is shown", async ({
    page,
  }) => {
    // Connect to anvil (chain 31337) — the expected chain is Base
    // Sepolia, so the wallet is on a non-expected chain.
    await installConnectedWallet(page, { chainId: ANVIL_CHAIN_ID });
    await setMockFaucetAddress(page, TEST_FAUCET_ADDRESS);

    await page.goto("/api");
    await connectWallet(page);

    await expect(page.getByTestId("mint-tokens-wrong-network")).toBeVisible();
    await expect(page.getByTestId("mint-tokens-claim-button")).toHaveCount(0);
  });

  test("mainnet-chain rejection: claim button still suppressed (no mainnet path)", async ({
    page,
  }) => {
    await installConnectedWallet(page, { chainId: BASE_MAINNET_CHAIN_ID });
    await setMockFaucetAddress(page, TEST_FAUCET_ADDRESS);

    await page.goto("/api");
    await connectWallet(page);

    await expect(page.getByTestId("mint-tokens-claim-button")).toHaveCount(0);
  });

  test("disconnected wallet prompts to connect (no claim button)", async ({
    page,
  }) => {
    // installConnectedWallet sets the mock provider but we never
    // call connectWallet → the WalletProvider sees no connected
    // address. Faucet mode is still on (address present), so the
    // card should render but with the connect-prompt branch.
    await installConnectedWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await setMockFaucetAddress(page, TEST_FAUCET_ADDRESS);

    await page.goto("/api");
    // Note: not calling connectWallet here.
    await expect(page.getByTestId("mint-tokens-no-wallet")).toBeVisible();
    await expect(page.getByTestId("mint-tokens-claim-button")).toHaveCount(0);
  });

  test("claim button exposes both `idle` and `pending` status attributes during a click", async ({
    page,
  }) => {
    // Defence in depth: assert the data-claim-status attribute
    // ratchet so that a future regression (e.g. forgetting to set
    // status to `pending` before the await) is caught.
    await installConnectedWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await setMockFaucetAddress(page, TEST_FAUCET_ADDRESS);

    await page.goto("/api");
    await connectWallet(page);

    const btn = page.getByTestId("mint-tokens-claim-button");
    await expect(btn).toHaveAttribute("data-claim-status", "idle");
    await btn.click();
    // Either pending → success, or success directly if the mock
    // resolved before the render committed. Both are acceptable;
    // the failure mode we want to catch is a stuck `idle`.
    await expect(btn).not.toHaveAttribute(
      "data-claim-status",
      "idle",
      { timeout: 3_000 },
    );
  });
});

test.describe("/api MintTokensCard — request mode (no faucet address)", () => {
  test("falls back to request mode when no faucet address is configured", async ({
    page,
  }) => {
    // Explicitly clear the override so the build-time env (also
    // unset in CI) doesn't accidentally enable claim mode.
    await setMockFaucetAddress(page, null);

    await page.goto("/api");

    const card = page.getByTestId("developers-console-mint");
    await expect(card).toContainText(/Request Test Collateral/);
    await expect(card).toContainText(/owner-only/i);

    // No claim button when faucet is absent.
    await expect(page.getByTestId("mint-tokens-claim-button")).toHaveCount(0);
    await expect(page.getByTestId("mint-tokens-faucet-address")).toHaveCount(0);
  });
});
