/**
 * options-public-beta-feedback-loop-v1.spec.ts
 *
 * Pins the V1 category + severity additions to the /feedback form
 * shipped by OPTIONS-PUBLIC-BETA-FEEDBACK-LOOP-V1. The
 * pre-existing feedback-route.spec.ts already pins the safety
 * banner, copy button, no-submit-on-network, and no-credential-leak
 * guarantees — those tests stay authoritative for the original
 * form fields.
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("feedback form exposes category select with 9 V1 categories", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/feedback");
  const select = page.getByTestId("feedback-input-category");
  await expect(select).toBeVisible();
  const options = await select.locator("option").allTextContents();
  expect(options.sort()).toEqual(
    [
      "api-docs",
      "faucet",
      "history-lifecycle",
      "other",
      "perps-readonly",
      "security-safety",
      "trade-order",
      "ui-ux",
      "wallet-network",
    ].sort(),
  );
});

test("feedback form exposes severity select with 4 V1 levels", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/feedback");
  const select = page.getByTestId("feedback-input-severity");
  await expect(select).toBeVisible();
  const options = await select.locator("option").allTextContents();
  expect(options.sort()).toEqual(["critical", "high", "low", "medium"]);
});

test("selecting category + severity flows into the preview block", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/feedback");
  await page.getByTestId("feedback-input-category").selectOption("faucet");
  await page.getByTestId("feedback-input-severity").selectOption("critical");
  const preview = await page.getByTestId("feedback-preview").innerText();
  expect(preview).toContain("Category / severity");
  expect(preview).toContain("- Category: faucet");
  expect(preview).toContain("- Severity: critical");
});

test("preview still ends with the NEVER-share reminder after category+severity added", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/feedback");
  await page.getByTestId("feedback-input-category").selectOption("security-safety");
  await page.getByTestId("feedback-input-severity").selectOption("critical");
  const preview = await page.getByTestId("feedback-preview").innerText();
  // Every previously-pinned safety guarantee still holds.
  expect(preview).toMatch(/NEVER share private keys/i);
  expect(preview).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(preview).not.toMatch(/alchemy\.com\/v2\/[A-Za-z0-9_-]+/);
  expect(preview).not.toMatch(/postgres:\/\//);
});
