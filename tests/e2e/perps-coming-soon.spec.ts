/**
 * perps-coming-soon.spec.ts — FRONTEND-TERMINAL-WORKSPACE-RESIZABLE-V2
 *
 * /perps now renders the modular Workspace with perps placeholder
 * widgets (no static disclosure block — placeholders + status chips +
 * subtitle carry the honest "not live" copy). The bottom dock is also
 * a workspace widget.
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("/perps renders the modular Workspace shell with the 'perps not live' subtitle", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/perps");
  await expect(page.getByTestId("perps-terminal-shell")).toBeVisible();
  await expect(page.getByTestId("workspace-perps")).toBeVisible();
  await expect(page.getByTestId("workspace-toolbar-perps")).toContainText(
    /perps not live/i,
  );
});

test("/perps renders default placeholder widgets + bottom dock", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/perps");
  for (const id of [
    "widget-perps-stats",
    "widget-perps-chart",
    "widget-perps-orderbook",
    "widget-perps-trade-form",
    "widget-perps-trade-feed",
    "widget-bottom-dock",
  ]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await expect(page.getByTestId("widget-perps-chart-svg")).toBeVisible();
});

test("/perps placeholder widgets are flagged 'coming later'", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/perps");
  for (const t of [
    "widget-status-perps-stats",
    "widget-status-perps-chart",
    "widget-status-perps-orderbook",
    "widget-status-perps-trade-form",
    "widget-status-perps-trade-feed",
  ]) {
    await expect(page.getByTestId(t)).toContainText(/coming later/i);
  }
});

test("/perps surfaces no fake liquidity / positive claims / colour drift", async ({
  page,
}) => {
  await installMockWallet(page);
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
  await installMockWallet(page);
  await page.goto("/perps");
  await page.waitForSelector("[data-testid=perps-terminal-shell]");
  await expect(page.getByTestId("public-beta-footer")).toHaveCount(0);
  await expect(page.getByTestId("trading-main-terminal")).toBeVisible();
});
