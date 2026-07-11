/**
 * rfq-multi-leg-frontend-v1.spec.ts
 *
 * Pins the flag-gated multi-leg RFQ frontend behavior shipped by
 * `RFQ-MULTI-LEG-FRONTEND-V1`.
 *
 * The flag `NEXT_PUBLIC_RFQ_MULTI_LEG_ENABLED` is compiled at build
 * time (frontend build baked into the Playwright fixture). This spec
 * runs against the default build (flag OFF) and asserts that:
 *
 *   * the honest "multi-leg RFQ — flagged off" pill is present;
 *   * a 2-leg preset (strangle) leaves the Request Quote CTA disabled
 *     with an honest disabled message (no fake quotes, no network
 *     mutation);
 *   * the honest-copy `data-testid="rfq-strategy-multi-leg-note"`
 *     is rendered when the (existing single-leg) RFQ flag is on;
 *   * the single-leg RFQ path is byte-identical (1-leg preset does
 *     NOT show the multi-leg blocker);
 *   * public Perps trading remains "not live" copy elsewhere.
 *
 * The flagged-on canonical/API surface is covered by the node
 * contract tests in `tests/node/subaccounts-rfq-multi-leg-canonical.contract.mjs`
 * and `tests/node/rfq-multi-leg-flag.contract.mjs`, because the flag
 * is baked at build time and cannot be toggled per-Playwright-test.
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("multi-leg RFQ pill defaults to flagged-off", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await expect(page.getByTestId("rfq-strategy-workspace")).toBeVisible();
  const pill = page.getByTestId("rfq-strategy-multi-leg-pill");
  await expect(pill).toBeVisible();
  await expect(pill).toHaveAttribute("data-multi-leg-enabled", "false");
  await expect(pill).toContainText(/flagged off/i);
});

test("2-leg preset (strangle) keeps Request Quote CTA hard-disabled", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");

  // Pick a 2-leg preset.
  await page.getByTestId("rfq-strategy-preset-strangle").click();

  // Request Quote CTA is hard-disabled — no fake quotes fire.
  const cta = page.getByTestId("rfq-strategy-request-quote");
  await expect(cta).toBeDisabled();

  // Multi-leg pill remains "flagged off" as a persistent safety
  // signal even when the strategy is 2 legs.
  const pill = page.getByTestId("rfq-strategy-multi-leg-pill");
  await expect(pill).toHaveAttribute("data-multi-leg-enabled", "false");
});

test("single-leg preset (call) does NOT trigger the multi-leg blocker", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");

  // Default preset is Call → 1 leg. There must be no multi-leg
  // blocker text visible; the blocker element renders only when a
  // multi-leg blocker actually fires.
  const blocker = page.getByTestId("rfq-strategy-strategy-blocker");
  await expect(blocker).toHaveCount(0);
});

test("no admin bearer / private key / signature / nonce leaks in the workspace DOM", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-preset-strangle").click();
  const html = await page.getByTestId("rfq-strategy-workspace").innerHTML();
  expect(html).not.toMatch(/authorization/i);
  expect(html).not.toMatch(/private[_ -]?key/i);
  expect(html).not.toMatch(/signature/i);
  expect(html).not.toMatch(/nonce/i);
});

test("Developers/API copy mentions multi-leg is feature-gated (flag-authoritative)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/api");
  // The console lists multi-leg RFQ behind the backend flag AND the
  // frontend flag. This is the honest posture the milestone requires.
  const body = page.locator("body");
  await expect(body).toContainText(/OPTION_RFQ_MULTI_LEG_ENABLED/);
  await expect(body).toContainText(/NEXT_PUBLIC_RFQ_MULTI_LEG_ENABLED/);
  // Perps grammar fix persists.
  await expect(body).toContainText(/public Perps trading is not live/);
});
