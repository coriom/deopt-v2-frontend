/**
 * perps-coming-soon.spec.ts — FRONTEND-TERMINAL-WORKSPACE-RESIZABLE-V2
 *
 * Updated by PLAYWRIGHT-WALLET-AUTOCONNECT-MIGRATION-V1 to reflect
 * the current perps layout:
 *
 *   * 4 default widgets — perps-chart (stats merged in), perps-book-
 *     feed (book + feed merged with tabs), perps-trade-form,
 *     bottom-dock.
 *   * Widgets are `implemented: true` in the registry; they render
 *     real perps UI shells (no "coming later" status badge anymore).
 *   * The page-level "perps not live" subtitle / `workspace-toolbar-
 *     perps` element was retired alongside the FRONTEND-NAVBAR-IA-V1
 *     header cleanup.
 *
 * Perps itself is still NOT a live product (the fail-closed posture
 * from `ACCOUNT-WRITE-AUTH-HARDENING-V1` is unchanged); these tests
 * just assert the rendered surface matches reality.
 */
import { test, expect } from "@playwright/test";

test("/perps renders the workspace shell", async ({ page }) => {
  await page.goto("/perps");
  await expect(page.getByTestId("perps-terminal-shell")).toBeVisible();
  await expect(page.getByTestId("workspace-perps")).toBeVisible();
});

test("/perps renders the 4 default widgets (chart / book-feed / trade-form / bottom-dock)", async ({
  page,
}) => {
  await page.goto("/perps");
  for (const id of [
    "widget-perps-chart",
    "widget-perps-book-feed",
    "widget-perps-trade-form",
    "widget-bottom-dock",
  ]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
});

test("/perps surfaces no fake liquidity / positive claims / colour drift", async ({
  page,
}) => {
  await page.goto("/perps");
  await page.waitForSelector("[data-testid=perps-terminal-shell]");
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

test("/perps does NOT render the PublicBetaFooter on the terminal route", async ({
  page,
}) => {
  await page.goto("/perps");
  await page.waitForSelector("[data-testid=perps-terminal-shell]");
  await expect(page.getByTestId("public-beta-footer")).toHaveCount(0);
  await expect(page.getByTestId("trading-main-terminal")).toBeVisible();
});
