/**
 * options-chain-terminal.spec.ts — public testnet beta V1 terminal
 *
 * Covers /trade options-chain terminal:
 *   - chain structure (Calls | Strike | Puts) headers
 *   - clicking an option opens / updates the right detail panel
 *   - detail panel tabs render Trade / Payoff / Greeks / Details / Risk
 *   - Greeks tab surfaces honest "coming soon" copy
 *   - Payoff tab renders the SVG placeholder
 *   - backend-unavailable state renders the MarketsFallbackCard
 *   - no fake liquidity claim ("live", "guaranteed", etc.)
 *   - no mainnet link / admin bearer / RPC URL / DATABASE_URL
 *   - no amber/yellow brand styling
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

test("clicking a Call cell updates the detail panel", async ({ page }) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  await expect(page.getByTestId("detail-panel-empty")).toBeVisible();
  const callCell = page.locator('[data-testid^="chain-call-300000000000"]').first();
  await expect(callCell).toBeVisible({ timeout: 10000 });
  await callCell.click();
  await expect(page.getByTestId("detail-panel")).toBeVisible();
  await expect(page.getByTestId("detail-type-badge")).toHaveText(/CALL/);
});

test("detail panel tabs render Trade / Payoff / Greeks / Details / Risk", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  const callCell = page.locator('[data-testid^="chain-call-300000000000"]').first();
  await callCell.click({ timeout: 10000 });

  for (const id of ["trade", "payoff", "greeks", "details", "risk"]) {
    await page.getByTestId(`detail-tab-${id}`).click();
    await expect(
      page.getByTestId(`detail-panel-content-${id}`),
    ).toBeVisible();
  }
});

test("Greeks tab surfaces honest 'coming soon' copy", async ({ page }) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  const callCell = page.locator('[data-testid^="chain-call-300000000000"]').first();
  await callCell.click({ timeout: 10000 });
  await page.getByTestId("detail-tab-greeks").click();
  const greeks = page.getByTestId("detail-greeks");
  await expect(greeks).toBeVisible();
  await expect(greeks).toContainText(/Greeks — coming soon in the testnet beta/i);
  await expect(greeks).toContainText(/not exposed by the current backend/i);
});

test("Payoff tab renders the SVG placeholder", async ({ page }) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  const callCell = page.locator('[data-testid^="chain-call-300000000000"]').first();
  await callCell.click({ timeout: 10000 });
  await page.getByTestId("detail-tab-payoff").click();
  await expect(page.getByTestId("payoff-svg")).toBeVisible();
});

test("Risk tab surfaces testnet/unaudited/no-real-funds disclosures", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  const callCell = page.locator('[data-testid^="chain-call-300000000000"]').first();
  await callCell.click({ timeout: 10000 });
  await page.getByTestId("detail-tab-risk").click();
  const risk = page.getByTestId("detail-risk");
  await expect(risk).toContainText(/Testnet only/i);
  await expect(risk).toContainText(/Unaudited/i);
  await expect(risk).toContainText(/No real funds/i);
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

test("detail panel CTA links to underlying product page (internal)", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  const callCell = page.locator('[data-testid^="chain-call-300000000000"]').first();
  await callCell.click({ timeout: 10000 });
  const cta = page.getByTestId("detail-open-trade-ticket-cta");
  await expect(cta).toBeVisible();
  const href = await cta.getAttribute("href");
  expect(href).toBe(`/markets/${PRODUCT_CALL}`);
});
