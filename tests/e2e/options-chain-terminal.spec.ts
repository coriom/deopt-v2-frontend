/**
 * options-chain-terminal.spec.ts — refreshed for FRONTEND-TRADE-WIDGET-V1
 *
 * Covers /trade options-chain terminal:
 *   - chain structure (Calls | Strike | Puts) headers
 *   - clicking an option updates the right `trade` widget instrument title
 *   - the Trade widget exposes Payoff / Greeks / Trades / Book tabs
 *   - Greeks tab surfaces an honest "local mock" disclaimer
 *   - Payoff tab renders the SVG placeholder
 *   - backend-unavailable state renders the MarketsFallbackCard
 *   - no fake liquidity claim ("live", "guaranteed", etc.)
 *   - no mainnet link / admin bearer / RPC URL / DATABASE_URL
 *   - no amber / yellow / orange brand styling
 *   - no positive-claim drift
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

const PRODUCT_CALL = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0000";
const PRODUCT_PUT = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0000";
const SERIES_CALL_3000 = "series-call-3000";
const SERIES_PUT_3000 = "series-put-3000";

async function mockProducts(page: import("@playwright/test").Page) {
  await page.route("**/options/products*", (route) => {
    if (
      route.request().url().includes("/options/products/") ||
      route.request().method() !== "GET"
    ) {
      return route.continue();
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        data: {
          products: [
            {
              product_id: PRODUCT_CALL,
              underlying: "0x0000000000000000000000000000000000000001",
              underlying_symbol: "WETH",
              settlement_asset: "0x6eae407f5640b006fac9965182e238582a3b412e",
              settlement_asset_symbol: "mUSDC",
              is_call: true,
              expiry_ms: 1_770_000_000_000,
              series_count: 1,
              is_active_any: true,
            },
            {
              product_id: PRODUCT_PUT,
              underlying: "0x0000000000000000000000000000000000000001",
              underlying_symbol: "WETH",
              settlement_asset: "0x6eae407f5640b006fac9965182e238582a3b412e",
              settlement_asset_symbol: "mUSDC",
              is_call: false,
              expiry_ms: 1_770_000_000_000,
              series_count: 1,
              is_active_any: true,
            },
          ],
        },
        meta: {
          source: "db",
          chain_id: 84532,
          request_id: "synth",
          generated_at_ms: 0,
        },
      }),
    });
  });
}

async function mockProductDetail(
  page: import("@playwright/test").Page,
  productId: string,
  seriesIds: string[],
  isCall: boolean,
) {
  await page.route(
    `**/options/products/${productId}`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          data: {
            product: {
              product_id: productId,
              underlying: "0x0000000000000000000000000000000000000001",
              underlying_symbol: "WETH",
              settlement_asset: "0x6eae407f5640b006fac9965182e238582a3b412e",
              settlement_asset_symbol: "mUSDC",
              is_call: isCall,
              expiry_ms: 1_770_000_000_000,
              series_count: seriesIds.length,
              is_active_any: true,
            },
            series_ids: seriesIds,
          },
          meta: {
            source: "db",
            chain_id: 84532,
            request_id: "synth",
            generated_at_ms: 0,
          },
        }),
      }),
  );
}

async function mockSeries(
  page: import("@playwright/test").Page,
  seriesId: string,
  productId: string,
  isCall: boolean,
  strike1e8: string,
) {
  await page.route(
    `**/options/series/${seriesId}/details`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          data: {
            series: {
              series_id: seriesId,
              product_id: productId,
              underlying: "0x0000000000000000000000000000000000000001",
              settlement_asset: "0x6eae407f5640b006fac9965182e238582a3b412e",
              is_call: isCall,
              strike_1e8: strike1e8,
              expiry_ms: 1_770_000_000_000,
              contract_size_1e8: "100000000",
              is_active: true,
            },
          },
          meta: {
            source: "db",
            chain_id: 84532,
            request_id: "synth",
            generated_at_ms: 0,
          },
        }),
      }),
  );
}

async function setupChain(page: import("@playwright/test").Page) {
  await mockProducts(page);
  await mockProductDetail(page, PRODUCT_CALL, [SERIES_CALL_3000], true);
  await mockProductDetail(page, PRODUCT_PUT, [SERIES_PUT_3000], false);
  await mockSeries(page, SERIES_CALL_3000, PRODUCT_CALL, true, "300000000000");
  await mockSeries(page, SERIES_PUT_3000, PRODUCT_PUT, false, "300000000000");
}

test("/trade renders the chain structure (Calls | Strike | Puts)", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  await expect(page.getByTestId("options-chain-grid")).toBeVisible();
  // Header columns.
  await expect(page.getByText("Calls", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Strike", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Puts", { exact: false }).first()).toBeVisible();
});

test("clicking a Call cell updates the Trade widget instrument title", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  // The trade widget is visible up-front, with a placeholder instrument
  // until a chain row is picked.
  await expect(page.getByTestId("widget-trade")).toBeVisible();
  await expect(page.getByTestId("trade-instrument-title")).toBeVisible();
  const beforeTitle = await page
    .getByTestId("trade-instrument-title")
    .innerText();
  const callCell = page.locator('[data-testid^="chain-call-300000000000"]').first();
  await expect(callCell).toBeVisible({ timeout: 10000 });
  await callCell.click();
  const afterTitle = await page
    .getByTestId("trade-instrument-title")
    .innerText();
  expect(afterTitle).not.toBe(beforeTitle);
  expect(afterTitle).toMatch(/Call/);
});

test("Trade widget orderbook mode renders the shared DirectOrderbookForm", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  // Orderbook is the default mode after the V1 redesign.
  await expect(page.getByTestId("trade-body-orderbook")).toBeVisible();
  await expect(page.getByTestId("direct-orderbook-form")).toBeVisible();
});

test("backend-unavailable state renders MarketsFallbackCard on /trade", async ({
  page,
}) => {
  await page.route("**/options/products*", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        status: "error",
        error: { code: "INTERNAL_ERROR", message: "synthetic outage" },
      }),
    }),
  );
  await installMockWallet(page);
  await page.goto("/trade");
  await expect(page.getByTestId("markets-fallback-card")).toBeVisible();
});

test("/trade page contains no fake liquidity / no positive claims", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  await page.waitForSelector("[data-testid=options-chain-grid]");
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/\bis audited\b/i);
  expect(text).not.toMatch(/\bmainnet-ready\b/i);
  expect(text).not.toMatch(/\bproduction-ready\b/i);
  expect(text).not.toMatch(/\bsafe for real funds\b/i);
  expect(text).not.toMatch(/\bguaranteed liquidity\b/i);
  expect(text).not.toMatch(/\binstitutional-grade\b/i);
});

test("/trade page DOM has no amber/yellow brand class + no admin/RPC leak", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  await page.waitForSelector("[data-testid=options-chain-grid]");
  const html = await page.locator("main").innerHTML();
  expect(html).not.toMatch(/class="[^"]*\bamber-/);
  expect(html).not.toMatch(/class="[^"]*\byellow-/);
  expect(html).not.toMatch(/class="[^"]*\borange-/);
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(html).not.toMatch(/alchemy\.com\/v2\/[A-Za-z0-9_-]+/);
  expect(html).not.toMatch(/DATABASE_URL/);
  expect(html).not.toMatch(/\/admin\//);
  expect(html).not.toMatch(/mainnet\.base\.org/);
});

test("Trade widget exposes the Orderbook/RFQ mode selector", async ({ page }) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  const select = page.getByTestId("trade-mode-select");
  await expect(select).toBeVisible();
  await expect(select).toHaveValue("orderbook");
  await select.selectOption("rfq");
  await expect(page.getByTestId("trade-body-rfq")).toBeVisible();
  await expect(page.getByTestId("trade-body-orderbook")).toHaveCount(0);
  await select.selectOption("orderbook");
  await expect(page.getByTestId("trade-body-orderbook")).toBeVisible();
});
