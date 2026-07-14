/**
 * trade-widget-v1.spec.ts — FRONTEND-OPTIONS-DIRECT-ORDERBOOK-V1
 *
 * Locks the redesigned `trade` workspace widget after the orderbook
 * integration. Two clean modes:
 *
 *   - `orderbook` (default) — renders the shared `DirectOrderbookForm`
 *     which posts to `POST /options/orders`. Honours GTC/IOC/FOK +
 *     post-only via the canonical backend matching engine.
 *
 *   - `rfq` — keeps the illustrative compact row (Buy/Sell,
 *     Instrument, Ratio, Amount) and explicitly states that paired
 *     RFQ execution is not live in this testnet beta. TIF / post-only
 *     are intentionally absent in this mode.
 *
 * The previous mock UI (4-tab Payoff/Greeks/Trades/Book body, mock
 * cost breakdown, "Enable Trading" CTA, channel notice) was removed:
 * those panels were illustrative and became misleading once the
 * real direct-orderbook submission was wired into this same widget.
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("default Options workspace renders `widget-trade` (renamed from `option-details`)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/options");
  await expect(page.getByTestId("widget-trade")).toBeVisible();
  await expect(page.getByTestId("widget-option-details")).toHaveCount(0);
});

test("Widget chrome title is exactly `Trade`", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/options");
  const widget = page.getByTestId("widget-trade");
  await expect(widget).toBeVisible();
  await expect(widget).toHaveAttribute("aria-label", "Trade");
});

test("Trade widget header surfaces an instrument title + execution selector", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/options");
  await expect(page.getByTestId("trade-instrument-title")).toBeVisible();
  const select = page.getByTestId("trade-mode-select");
  await expect(select).toBeVisible();
  // OPTIONS-CHAIN-MULTISELECT-EXECUTION-UX-V1 — default is Auto.
  await expect(select).toHaveValue("auto");
});

test("Book (Auto) mode renders the shared DirectOrderbookForm with TIF + Post controls", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/options");
  await expect(page.getByTestId("trade-body-orderbook")).toBeVisible();
  await expect(page.getByTestId("direct-orderbook-form")).toBeVisible();
  // Required inputs for a real submission.
  // OPTIONS-CHAIN-MULTISELECT-EXECUTION-UX-V1 — series id is now
  // gated behind an Advanced tester affordance; opening it exposes
  // the input which existing coverage still needs.
  await page.getByTestId("direct-orderbook-advanced-summary").click();
  await expect(page.getByTestId("direct-orderbook-series-id")).toBeVisible();
  // Account field was removed — it is auto-populated from the connected
  // wallet (`useWallet().address`). Regression pin.
  await expect(page.getByTestId("direct-orderbook-account")).toHaveCount(0);
  await expect(page.getByTestId("direct-orderbook-price")).toBeVisible();
  await expect(page.getByTestId("direct-orderbook-size")).toBeVisible();
  // TIF popover + Post checkbox reused from the shared component.
  await expect(page.getByTestId("direct-orderbook-tif-trigger")).toBeVisible();
  await expect(page.getByTestId("direct-orderbook-post-checkbox")).toBeVisible();
});

test("Execution selector swaps to RFQ and back to Book", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/options");
  const select = page.getByTestId("trade-mode-select");
  await select.selectOption("rfq");
  // With 0 legs + rfq requested the ticket surfaces the honest
  // `rfq_disabled` blocker (or `rfq_single` if the RFQ flag is on).
  const rfqDisabled = page.getByTestId("trade-body-rfq-disabled");
  const rfqSingle = page.getByTestId("trade-body-rfq");
  await expect
    .poll(async () => (await rfqDisabled.count()) + (await rfqSingle.count()))
    .toBeGreaterThan(0);
  await expect(page.getByTestId("trade-body-orderbook")).toHaveCount(0);
  await select.selectOption("book");
  await expect(page.getByTestId("trade-body-orderbook")).toBeVisible();
  await expect(page.getByTestId("trade-body-rfq")).toHaveCount(0);
});

test("RFQ mode keeps the compact row and does NOT surface TIF / post-only", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/options");
  // Force flag-on posture at test time by requesting rfq — when the
  // flag is off the body is `trade-body-rfq-disabled` (honest);
  // this test only makes sense on flag-on builds.
  await page.getByTestId("trade-mode-select").selectOption("rfq");
  const rfqBody = page.getByTestId("trade-body-rfq");
  if ((await rfqBody.count()) === 0) {
    test.skip(true, "RFQ flag is off in this build");
    return;
  }
  await expect(page.getByTestId("trade-rfq-side-buy")).toBeVisible();
  await expect(page.getByTestId("trade-rfq-side-sell")).toBeVisible();
  await expect(page.getByTestId("trade-rfq-instrument")).toBeVisible();
  await expect(page.getByTestId("trade-rfq-ratio")).toContainText("1");
  await expect(page.getByTestId("trade-rfq-amount")).toBeVisible();
  // Critical honesty assertion: TIF / post-only must not appear in RFQ
  // mode — paired RFQ execution does not honour them.
  await expect(page.getByTestId("direct-orderbook-tif-trigger")).toHaveCount(0);
  await expect(page.getByTestId("direct-orderbook-post-checkbox")).toHaveCount(0);
});

test("Trade widget has no amber/yellow/orange brand classes", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/options");
  const html = await page.getByTestId("widget-trade").innerHTML();
  expect(html).not.toMatch(/\b(amber|yellow|orange)-[0-9]{2,3}\b/);
  expect(html).not.toMatch(/bg-(amber|yellow|orange)\b/);
});

test("Trade widget has no Derive branding nor positive-claim language", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/options");
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
  await page.goto("/options");
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
  await page.goto("/options");
  const widget = page.getByTestId("widget-trade");
  await expect(widget).toBeVisible();
  const box = await widget.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.width).toBeGreaterThan(280);
    expect(box.height).toBeGreaterThan(300);
  }
});
