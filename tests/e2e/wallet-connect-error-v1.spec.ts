/**
 * wallet-connect-error-v1.spec.ts —
 * FRONTEND-WALLET-CONNECT-RUNTIME-DEBUG-V1.
 *
 * Covers the error UX added by this milestone: when
 * `eth_requestAccounts` rejects (typical dismissed-popup path), the
 * button must:
 *
 *   1. exit the "Approving…" loading state (no infinite spinner);
 *   2. render a user-visible error under the button with a `role=
 *      "alert"` `wallet-connect-error` testid;
 *   3. offer a clear retry affordance ("Retry connect" label + the
 *      button becomes re-enabled).
 *
 * The mock EIP-1193 provider ships a `connectRejected` toggle
 * (added to `wallet-fixture.ts` in the same milestone) that mirrors
 * MetaMask/Rabby's dismissed-popup behaviour: throw with code 4001.
 */
import { test, expect } from "@playwright/test";
import { installMockWallet, BASE_SEPOLIA_CHAIN_ID } from "./wallet-fixture";

test("connect rejection surfaces an error and clears the spinner", async ({
  page,
}) => {
  await installMockWallet(page, {
    chainId: BASE_SEPOLIA_CHAIN_ID,
    connectRejected: true,
  });
  await page.goto("/options");
  const button = page.getByTestId("wallet-connect-button");
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("data-wallet-state", "disconnected");
  await button.click();
  // Loading state must settle; the button must not stay spinning.
  await expect(button).toHaveAttribute("data-wallet-state", "error", {
    timeout: 5_000,
  });
  await expect(button).not.toContainText(/Approving…/i);
  await expect(button).toContainText(/Retry connect/i);
  const err = page.getByTestId("wallet-connect-error");
  await expect(err).toBeVisible();
  await expect(err).toContainText(/wallet connection was rejected/i);
  // Retry after the user grants access next time: the button is
  // re-enabled and remains clickable (we do not re-click here because
  // the mock is still in `connectRejected: true` mode — the point is
  // the button never got stuck).
  await expect(button).toBeEnabled();
});

test("connect button copy stays honest — no false session/gasless claims", async ({
  page,
}) => {
  await installMockWallet(page, {
    chainId: BASE_SEPOLIA_CHAIN_ID,
    connectRejected: true,
  });
  await page.goto("/options");
  await page.getByTestId("wallet-connect-button").click();
  const err = page.getByTestId("wallet-connect-error");
  await expect(err).toBeVisible();
  // The error copy must not overclaim any UX we haven't shipped.
  await expect(err).not.toContainText(/session/i);
  await expect(err).not.toContainText(/trusted device/i);
  await expect(err).not.toContainText(/derive/i);
  await expect(err).not.toContainText(/gasless/i);
});
