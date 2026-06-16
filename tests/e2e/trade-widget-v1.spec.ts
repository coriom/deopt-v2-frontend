/**
 * trade-widget-v1.spec.ts — FRONTEND-TRADE-WIDGET-V1
 *
 * Covers the redesigned `trade` workspace widget:
 *   - widget id renamed from `option-details` → `trade`
 *   - WIDGET_LAYOUT_VERSION bumped 7 → 8 so V7 buckets carrying
 *     `option-details` are dropped on load
 *   - compact header with instrument title + Book/RFQ mode selector
 *   - Buy to Open / Sell to Open segmented side selector
 *   - dense order fields (Order Type, Limit Price + Ask hint, Amount,
 *     Post checkbox, GTC dropdown)
 *   - channel notice + Enable Trading button
 *   - cost breakdown (Max Cost / Margin Required / Buying Power /
 *     Est. Fee / Est. Rewards)
 *   - 4-tab body: Payoff / Greeks / Trades / Book
 *   - Book ladder with ask / spread / bid rows
 *   - RFQ compact body with Buy/Sell, Instrument, Ratio, Amount
 *   - no amber / yellow / orange brand classes
 *   - no positive-claim language
 *   - no Derive branding
 *   - no admin / RPC / DATABASE_URL leaks
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("default Options workspace renders `widget-trade` (renamed from `option-details`)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/trade");
  await expect(page.getByTestId("widget-trade")).toBeVisible();
  await expect(page.getByTestId("widget-option-details")).toHaveCount(0);
});

test("Widget chrome title is exactly `Trade`", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/trade");
  const widget = page.getByTestId("widget-trade");
  await expect(widget).toBeVisible();
  await expect(widget).toHaveAttribute("aria-label", "Trade");
  // The widget-chrome header shows the registry title in a top strip.
  // It must NOT contain any of the legacy variants of the name.
  const widgetText = await widget.innerText();
  expect(widgetText).not.toMatch(/Trade Detail/);
  expect(widgetText).not.toMatch(/Trade\s*·\s*detail/i);
  expect(widgetText).not.toMatch(/Trade\.detail/i);
  // Strip whitespace / line breaks before asserting the chrome label.
  const chromeHeader = widget.locator("header").first();
  const chromeText = (await chromeHeader.innerText()).replace(/\s+/g, " ").trim();
  // The chrome reads "Trade ✕" (title + remove). Just ensure the title
  // token "Trade" stands alone, not as part of "Trade Detail".
  expect(chromeText).toMatch(/^Trade(\s|$|✕)/);
});

test("Trade widget header surfaces an instrument title + mode selector", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/trade");
  await expect(page.getByTestId("trade-instrument-title")).toBeVisible();
  await expect(page.getByTestId("trade-mode-select")).toBeVisible();
  await expect(page.getByTestId("trade-mode-select")).toHaveValue("book");
});

test("Buy to Open is selected by default and switches to Sell to Open", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/trade");
  const buy = page.getByTestId("trade-side-buy");
  const sell = page.getByTestId("trade-side-sell");
  await expect(buy).toContainText(/Buy to Open/);
  await expect(sell).toContainText(/Sell to Open/);
  await expect(buy).toHaveAttribute("data-selected", "true");
  await expect(sell).toHaveAttribute("data-selected", "false");
  await sell.click();
  await expect(sell).toHaveAttribute("data-selected", "true");
  await expect(buy).toHaveAttribute("data-selected", "false");
});

test("Order ticket exposes Order Type, Limit Price with Ask hint, Amount", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/trade");
  await expect(page.getByTestId("trade-order-type")).toBeVisible();
  await expect(page.getByTestId("trade-order-type")).toHaveValue("limit");
  await expect(page.getByTestId("trade-limit-price")).toBeVisible();
  await expect(page.getByTestId("trade-ask-hint")).toContainText(/Ask:/);
  const amount = page.getByTestId("trade-amount");
  await expect(amount).toBeVisible();
  await expect(amount).toHaveAttribute("placeholder", /0\.0/);
});

test("Post checkbox + GTC time-in-force are wired", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/trade");
  const post = page.getByTestId("trade-post-checkbox");
  await expect(post).toBeVisible();
  await expect(post).not.toBeChecked();
  await post.check();
  await expect(post).toBeChecked();
  const tif = page.getByTestId("trade-tif-select");
  await expect(tif).toBeVisible();
  await expect(tif).toHaveValue("GTC");
});

test("Channel notice + Enable Trading button render", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/trade");
  const notice = page.getByTestId("trade-channel-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(/decentralized channel/i);
  await expect(notice).toContainText(/gas-free/i);
  const cta = page.getByTestId("trade-enable-button");
  await expect(cta).toBeVisible();
  await expect(cta).toContainText(/Enable Trading/i);
});

test("Cost breakdown lists Max Cost / Margin / Buying Power / Fee / Rewards", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/trade");
  const breakdown = page.getByTestId("trade-cost-breakdown");
  await expect(breakdown).toBeVisible();
  for (const label of [
    /Max Cost/,
    /Margin Required/,
    /Buying Power/,
    /Est\. Fee/,
    /Est\. Rewards/,
  ]) {
    await expect(breakdown).toContainText(label);
  }
  await expect(page.getByTestId("trade-cost-max")).toContainText("$0.00");
});

test("Trade widget renders the 4 tabs Payoff/Greeks/Trades/Book", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/trade");
  for (const id of ["payoff", "greeks", "trades", "book"]) {
    await expect(page.getByTestId(`trade-tab-${id}`)).toBeVisible();
  }
  // Payoff is the default tab.
  await expect(page.getByTestId("trade-tab-payoff")).toHaveAttribute(
    "data-selected",
    "true",
  );
});

test("Payoff tab renders payoff metrics + SVG schematic", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/trade");
  await page.getByTestId("trade-tab-payoff").click();
  await expect(page.getByTestId("trade-payoff-body")).toBeVisible();
  await expect(page.getByTestId("trade-payoff-max-loss")).toContainText(
    /Max Loss/,
  );
  await expect(page.getByTestId("trade-payoff-breakeven")).toContainText(
    /Break Even/,
  );
  await expect(page.getByTestId("trade-payoff-max-profit")).toContainText(
    /Max Profit/,
  );
  await expect(page.getByTestId("payoff-svg")).toBeVisible();
});

test("Greeks tab lists 5 greeks and a local-mock disclaimer", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/trade");
  await page.getByTestId("trade-tab-greeks").click();
  for (const g of ["delta", "gamma", "vega", "theta", "rho"]) {
    await expect(page.getByTestId(`trade-greek-${g}`)).toBeVisible();
  }
  await expect(
    page.getByTestId("trade-greeks-mock-disclaimer"),
  ).toBeVisible();
});

test("Trades tab lists at least 6 recent rows", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/trade");
  await page.getByTestId("trade-tab-trades").click();
  const rows = page.locator('[data-testid^="trade-trades-row-"]');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThanOrEqual(6);
  await expect(
    page.getByTestId("trade-trades-mock-disclaimer"),
  ).toBeVisible();
});

test("Book tab renders ask / spread / bid rows", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/trade");
  await page.getByTestId("trade-tab-book").click();
  await expect(page.getByTestId("trade-book-body")).toBeVisible();
  const asks = page.locator('[data-testid^="trade-book-ask-"]');
  const bids = page.locator('[data-testid^="trade-book-bid-"]');
  expect(await asks.count()).toBeGreaterThanOrEqual(3);
  expect(await bids.count()).toBeGreaterThanOrEqual(3);
  const spread = page.getByTestId("trade-book-spread");
  await expect(spread).toBeVisible();
  await expect(spread).toContainText(/Spread/);
});

test("RFQ mode swaps the body and exposes the compact row", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/trade");
  await page.getByTestId("trade-mode-select").selectOption("rfq");
  await expect(page.getByTestId("trade-body-rfq")).toBeVisible();
  await expect(page.getByTestId("trade-body-book")).toHaveCount(0);
  await expect(page.getByTestId("trade-rfq-side-buy")).toBeVisible();
  await expect(page.getByTestId("trade-rfq-side-sell")).toBeVisible();
  await expect(page.getByTestId("trade-rfq-instrument")).toBeVisible();
  await expect(page.getByTestId("trade-rfq-ratio")).toContainText("1");
  await expect(page.getByTestId("trade-rfq-amount")).toBeVisible();
  await expect(page.getByTestId("trade-rfq-filter")).toBeVisible();
  await expect(page.getByTestId("trade-rfq-expand")).toBeVisible();
});

test("Trade widget has no amber/yellow/orange brand classes", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/trade");
  const html = await page.getByTestId("widget-trade").innerHTML();
  expect(html).not.toMatch(/\b(amber|yellow|orange)-[0-9]{2,3}\b/);
  expect(html).not.toMatch(/bg-(amber|yellow|orange)\b/);
});

test("Trade widget has no Derive branding nor positive-claim language", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/trade");
  const text = await page.getByTestId("widget-trade").innerText();
  expect(text).not.toMatch(/\bDerive\b/);
  expect(text).not.toMatch(/\bis audited\b/i);
  expect(text).not.toMatch(/\bmainnet-ready\b/i);
  expect(text).not.toMatch(/\bproduction-ready\b/i);
  expect(text).not.toMatch(/\bsafe for real funds\b/i);
  expect(text).not.toMatch(/\bguaranteed\b/i);
  expect(text).not.toMatch(/\binstitutional-grade\b/i);
});

test("Trade widget has no admin / RPC / DATABASE_URL leaks", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/trade");
  const html = await page.getByTestId("widget-trade").innerHTML();
  expect(html).not.toMatch(/\/admin\//);
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(html).not.toMatch(/alchemy\.com\/v2\//);
  expect(html).not.toMatch(/infura\.io\/v3\//);
  expect(html).not.toMatch(/DATABASE_URL/);
  expect(html).not.toMatch(/mainnet\.base\.org/);
});

test("Trade widget keeps a readable size after resizing the viewport down to 1200px", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/trade");
  const widget = page.getByTestId("widget-trade");
  await expect(widget).toBeVisible();
  const box = await widget.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.width).toBeGreaterThan(280);
    expect(box.height).toBeGreaterThan(300);
  }
});
