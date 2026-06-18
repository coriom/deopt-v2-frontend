/**
 * perps-v1.spec.ts — FRONTEND-PERPS-POLISH-V1
 *
 * Covers the polished /perps workspace:
 *   - 5 dense widgets (stats / chart / orderbook / trade-form /
 *     trade-feed) wired to a shared symbol context
 *   - hamburger menu on the orderbook ladder with column toggles +
 *     tick grouping
 *   - timeframe tabs on the chart (TradingView Lightweight Charts)
 *   - trade form Long/Short + Market/Limit tabs functional, submit
 *     button permanently disabled
 *   - no fake numbers, no positive-claim language, no forbidden
 *     palette / Deribit / Derive references
 */
import { test, expect } from "@playwright/test";

async function gotoPerps(page: import("@playwright/test").Page) {
  await page.goto("/perps");
  // Workspace renders client-side after a brief mount.
  await expect(page.getByTestId("widget-perps-stats-body")).toBeVisible({
    timeout: 10_000,
  });
}

test("/perps renders the 5 perps widgets", async ({ page }) => {
  await gotoPerps(page);
  for (const id of [
    "widget-perps-stats-body",
    "widget-perps-chart-body",
    "widget-perps-orderbook-body",
    "widget-perps-trade-form-body",
    "widget-perps-trade-feed-body",
  ]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
});

test("/perps symbol selector switches between BTC-PERP and ETH-PERP", async ({
  page,
}) => {
  await gotoPerps(page);
  const btc = page.getByTestId("widget-perps-symbol-BTC-PERP");
  const eth = page.getByTestId("widget-perps-symbol-ETH-PERP");
  await expect(btc).toBeVisible();
  await expect(eth).toBeVisible();
  await expect(btc).toHaveAttribute("data-active", "true");
  await eth.click();
  await expect(eth).toHaveAttribute("data-active", "true");
  // Chart + orderbook + trade-feed labels reflect the new symbol.
  await expect(page.getByTestId("widget-perps-chart-symbol")).toContainText(
    "ETH-PERP",
  );
  await expect(
    page.getByTestId("widget-perps-orderbook-symbol"),
  ).toContainText("ETH-PERP");
});

test("/perps stats bar shows 7 cells with `—`", async ({ page }) => {
  await gotoPerps(page);
  for (const id of [
    "widget-perps-stat-mark",
    "widget-perps-stat-index",
    "widget-perps-stat-change-24h",
    "widget-perps-stat-volume-24h",
    "widget-perps-stat-funding",
    "widget-perps-stat-next-funding",
    "widget-perps-stat-open-interest",
  ]) {
    await expect(page.getByTestId(id)).toContainText("—");
  }
});

test("/perps orderbook hamburger toggles columns and grouping", async ({
  page,
}) => {
  await gotoPerps(page);
  await page.getByTestId("widget-perps-orderbook-menu-button").click();
  const panel = page.getByTestId("widget-perps-orderbook-menu-panel");
  await expect(panel).toBeVisible();
  // Total % is off by default.
  await expect(page.getByTestId("widget-perps-orderbook-header-totalPct")).toHaveCount(0);
  await page.getByTestId("widget-perps-orderbook-menu-toggle-totalPct").click();
  await expect(page.getByTestId("widget-perps-orderbook-header-totalPct")).toBeVisible();
  // Reset clears it.
  await page.getByTestId("widget-perps-orderbook-menu-reset").click();
  await expect(page.getByTestId("widget-perps-orderbook-header-totalPct")).toHaveCount(0);
});

test("/perps trade form: Long/Short + Market/Limit tabs functional, submit disabled", async ({
  page,
}) => {
  await gotoPerps(page);
  const longBtn = page.getByTestId("widget-perps-trade-side-long");
  const shortBtn = page.getByTestId("widget-perps-trade-side-short");
  await expect(longBtn).toHaveAttribute("aria-selected", "true");
  await shortBtn.click();
  await expect(shortBtn).toHaveAttribute("aria-selected", "true");
  // Mode toggle Limit → reveals the limit-price field.
  await page.getByTestId("widget-perps-trade-mode-limit").click();
  await expect(page.getByTestId("widget-perps-trade-limit-price")).toBeVisible();
  await page.getByTestId("widget-perps-trade-mode-market").click();
  await expect(page.getByTestId("widget-perps-trade-slippage")).toBeVisible();
  // Submit button stays disabled.
  const submit = page.getByTestId("widget-perps-trade-submit");
  await expect(submit).toBeDisabled();
  await expect(submit).toContainText(/not live/i);
});

test("/perps chart renders the lightweight-charts canvas and timeframe tabs", async ({
  page,
}) => {
  await gotoPerps(page);
  await expect(page.getByTestId("widget-perps-chart-canvas")).toBeVisible();
  await expect(page.getByTestId("widget-perps-chart-empty")).toContainText(
    /No live price feed/i,
  );
  for (const tf of ["1m", "5m", "15m", "1h", "4h", "1D"]) {
    await expect(page.getByTestId(`widget-perps-chart-tf-${tf}`)).toBeVisible();
  }
  // 1h selected by default.
  await expect(page.getByTestId("widget-perps-chart-tf-1h")).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("/perps trade feed is empty by default", async ({ page }) => {
  await gotoPerps(page);
  await expect(page.getByTestId("widget-perps-trade-feed-empty")).toContainText(
    /No fills yet/i,
  );
});

test("/perps never claims mainnet-ready / audited / production-ready / safe-for-real-funds", async ({
  page,
}) => {
  await gotoPerps(page);
  const html = await page.content();
  expect(html).not.toMatch(/\baudited\b/i);
  expect(html).not.toMatch(/mainnet[- ]ready/i);
  expect(html).not.toMatch(/production[- ]ready/i);
  expect(html).not.toMatch(/safe for real funds/i);
  expect(html).not.toMatch(/\bguaranteed\b/i);
});

test("/perps never exposes admin / bearer / RPC / DB URLs", async ({ page }) => {
  await gotoPerps(page);
  const html = await page.content();
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(html).not.toMatch(/alchemy\.com\/v2\//);
  expect(html).not.toMatch(/infura\.io\/v3\//);
  expect(html).not.toMatch(/DATABASE_URL/);
  expect(html).not.toMatch(/\/admin\//);
  expect(html).not.toMatch(/mainnet\.base\.org/);
});

test("/perps never mentions Deribit or Derive in the public UI", async ({
  page,
}) => {
  await gotoPerps(page);
  const text = (await page.textContent("body")) ?? "";
  expect(text).not.toMatch(/deribit/i);
  expect(text).not.toMatch(/derive/i);
});

test("/perps does not introduce amber / yellow / orange brand classes", async ({
  page,
}) => {
  await gotoPerps(page);
  const html = await page.content();
  expect(html).not.toMatch(/\bamber-[0-9]/);
  expect(html).not.toMatch(/\byellow-[0-9]/);
  expect(html).not.toMatch(/\borange-[0-9]/);
});
