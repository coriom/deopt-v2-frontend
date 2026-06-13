/**
 * perps-coming-soon.spec.ts — FRONTEND-NAVBAR-OPTIONS-PERPS-LOCAL-QA
 *
 * Verifies /perps renders an honest placeholder page:
 *   - "Perps" heading and explicit "coming later" chip
 *   - Disclosure panel covers testnet posture (no real funds, unaudited)
 *   - Meanwhile-CTAs link to /trade (Options), /markets, /docs,
 *     /feedback, and the public Discord
 *   - No fake bid/ask/mark/IV/Greeks/liquidity
 *   - No positive claims (audited / mainnet-ready / production-ready /
 *     safe for real funds / guaranteed liquidity / institutional-grade)
 *   - No amber/yellow/orange brand styling
 *   - No admin / bearer / RPC URL / DATABASE_URL leak
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("/perps renders the coming-soon placeholder", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/perps");
  await expect(page.getByTestId("perps-coming-soon")).toBeVisible();
  await expect(page.getByTestId("perps-status-chip")).toContainText(
    /coming later in the public testnet beta/i,
  );
});

test("/perps disclosure panel surfaces testnet posture", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/perps");
  const panel = page.getByTestId("perps-disclosure-panel");
  await expect(panel).toContainText(/No real funds/i);
  await expect(panel).toContainText(/Unaudited/i);
  await expect(panel).toContainText(/Experimental/i);
});

test("/perps meanwhile CTAs link Options / Markets / Docs / Feedback / Discord", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/perps");
  await expect(page.getByTestId("perps-cta-options")).toHaveAttribute(
    "href",
    "/trade",
  );
  await expect(page.getByTestId("perps-cta-markets")).toHaveAttribute(
    "href",
    "/markets",
  );
  await expect(page.getByTestId("perps-cta-docs")).toHaveAttribute(
    "href",
    "/docs",
  );
  await expect(page.getByTestId("perps-cta-feedback")).toHaveAttribute(
    "href",
    "/feedback",
  );
  await expect(page.getByTestId("perps-cta-discord")).toHaveAttribute(
    "href",
    "https://discord.gg/zaEMvWuxu",
  );
});

test("/perps surfaces no fake liquidity / positive claims / colour drift", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/perps");
  await page.waitForSelector("[data-testid=perps-coming-soon]");
  const main = page.locator("main");
  const text = await main.innerText();
  expect(text).not.toMatch(/\bis audited\b/i);
  expect(text).not.toMatch(/\bmainnet-ready\b/i);
  expect(text).not.toMatch(/\bproduction-ready\b/i);
  expect(text).not.toMatch(/\bsafe for real funds\b/i);
  expect(text).not.toMatch(/\bguaranteed liquidity\b/i);
  expect(text).not.toMatch(/\binstitutional-grade\b/i);
  expect(text).not.toMatch(/\bbid:\s*\$/i);
  expect(text).not.toMatch(/\bask:\s*\$/i);

  const html = await main.innerHTML();
  expect(html).not.toMatch(/class="[^"]*\bamber-/);
  expect(html).not.toMatch(/class="[^"]*\byellow-/);
  expect(html).not.toMatch(/class="[^"]*\borange-/);
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(html).not.toMatch(/alchemy\.com\/v2\/[A-Za-z0-9_-]+/);
  expect(html).not.toMatch(/infura\.io\/v3\/[A-Za-z0-9_-]+/);
  expect(html).not.toMatch(/DATABASE_URL/);
  expect(html).not.toMatch(/\/admin\//);
  expect(html).not.toMatch(/mainnet\.base\.org/);
});
