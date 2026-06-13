/**
 * perps-coming-soon.spec.ts — FRONTEND-MODULAR-WORKSPACE-V1
 *
 * /perps now renders the modular Workspace with perps placeholder
 * widgets + a static disclosure panel. These specs assert:
 *   - the Workspace shell + perps toolbar render
 *   - the 6 default perps widgets render (stats, chart, orderbook,
 *     trade form, trade feed, balances)
 *   - the static disclosure panel surfaces the testnet posture +
 *     CTAs to Options / Docs / Discord / Feedback
 *   - no positive-claim / fake-liquidity / colour drift / admin /
 *     bearer / RPC URL / DATABASE_URL leak
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("/perps renders the modular Workspace shell", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/perps");
  await expect(page.getByTestId("perps-terminal-shell")).toBeVisible();
  await expect(page.getByTestId("workspace-perps")).toBeVisible();
  await expect(page.getByTestId("workspace-toolbar-perps")).toBeVisible();
});

test("/perps renders default placeholder widgets", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/perps");
  for (const id of [
    "widget-perps-stats",
    "widget-perps-chart",
    "widget-perps-orderbook",
    "widget-perps-trade-form",
    "widget-perps-trade-feed",
    "widget-balances",
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

test("/perps disclosure panel surfaces testnet posture", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/perps");
  const panel = page.getByTestId("perps-disclosure-panel");
  await expect(panel).toContainText(/No real funds/i);
  await expect(panel).toContainText(/Unaudited/i);
  await expect(panel).toContainText(/Experimental/i);
  await expect(page.getByTestId("perps-status-chip")).toContainText(
    /coming later in the public testnet beta/i,
  );
});

test("/perps meanwhile CTAs link Options / Docs / Discord / Feedback", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/perps");
  await expect(page.getByTestId("perps-cta-options")).toHaveAttribute(
    "href",
    "/trade",
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
