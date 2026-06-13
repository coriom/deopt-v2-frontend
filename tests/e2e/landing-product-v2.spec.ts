/**
 * landing-product-v2.spec.ts — public testnet beta DA followup
 *
 * Covers the visual-identity landing page after the V2-DA followup:
 *   - intro hero card present with emerald public-beta pill (NOT amber)
 *   - DeOpt heading visible
 *   - safety disclaimers visible
 *   - 3 CTAs (Start testing / Read quickstart / Report feedback)
 *   - HowItWorks block is NOT rendered on the main landing
 *   - no positive-claim language anywhere in main
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("landing intro card renders the public-beta positioning with emerald pill", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  await expect(page.getByTestId("landing-intro")).toBeVisible();
  await expect(
    page.getByText(/Public testnet beta — unaudited — experimental/i),
  ).toBeVisible();
  // Pill is now emerald — text class should contain emerald-200; the
  // brand colors are asserted by the no-amber spec separately.
  const pill = page.getByTestId("landing-public-beta-pill");
  await expect(pill).toBeVisible();
  const pillClass = (await pill.getAttribute("class")) ?? "";
  expect(pillClass).toMatch(/emerald-/);
  expect(pillClass).not.toMatch(/amber-/);
  expect(pillClass).not.toMatch(/yellow-/);
});

test("landing CTAs are present (Start testing + Read quickstart + Report feedback)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  await expect(page.getByTestId("landing-cta-start-testing")).toBeVisible();
  await expect(page.getByTestId("landing-cta-quickstart")).toBeVisible();
  await expect(
    page.getByTestId("report-issue-button").first(),
  ).toBeVisible();
});

test("HowItWorks block is NOT rendered on the main landing", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  // Following the operator decision in the V2-DA followup the tutorial
  // block is removed from the landing and moved into docs.
  await expect(page.getByTestId("how-it-works")).toHaveCount(0);
});

test("landing page contains no positive-claim language", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  const body = await page.locator("main").innerText();
  expect(body).not.toMatch(/\bis audited\b/i);
  expect(body).not.toMatch(/\bmainnet-ready\b/i);
  expect(body).not.toMatch(/\bproduction-ready\b/i);
  expect(body).not.toMatch(/\bsafe for real funds\b/i);
  expect(body).not.toMatch(/\bguaranteed uptime\b/i);
  expect(body).not.toMatch(/\binstitutional-grade\b/i);
});

test("DeOpt heading + Base Sepolia copy visible on the hero", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /on-chain options/i }),
  ).toBeVisible();
  await expect(page.getByText(/Base Sepolia\./i).first()).toBeVisible();
  await expect(page.getByText(/no real funds/i).first()).toBeVisible();
  await expect(page.getByText(/no audit/i).first()).toBeVisible();
  await expect(page.getByText(/Mainnet is permanently disabled/i)).toBeVisible();
});
