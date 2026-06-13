/**
 * trade-ticket-microcopy.spec.ts — public testnet beta V3
 *
 * Covers the trade ticket microcopy that explains the wallet-signs-
 * typed-data-not-a-transaction posture to an external tester:
 *   - side toggle switches the role-readiness microcopy (Buyer / Seller)
 *   - sign-microcopy bullets explain wallet vs executor
 *   - sign button uses emerald-500 primary styling
 *   - no admin / mainnet / positive-claim drift
 */
import { test, expect } from "@playwright/test";
import {
  installMockWallet,
  DEFAULT_TEST_ACCOUNT,
  BASE_SEPOLIA_CHAIN_ID,
} from "./wallet-fixture";

const FAKE_PRODUCT_ID =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0000";
const FAKE_SERIES_ID = "series-abc-123";

async function mockProductWithSeries(
  page: import("@playwright/test").Page,
  productId: string,
  seriesId: string,
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
              settlement_asset:
                "0x6eae407f5640b006fac9965182e238582a3b412e",
              settlement_asset_symbol: "mUSDC",
              is_call: true,
              expiry_ms: Date.now() + 86_400_000,
              series_count: 1,
              is_active_any: true,
            },
            series_ids: [seriesId],
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
              settlement_asset:
                "0x6eae407f5640b006fac9965182e238582a3b412e",
              is_call: true,
              strike_1e8: "200000000000",
              expiry_ms: Date.now() + 86_400_000,
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

test("trade-ticket side toggle flips role-readiness microcopy", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
  await mockProductWithSeries(page, FAKE_PRODUCT_ID, FAKE_SERIES_ID);
  await page.goto(`/markets/${FAKE_PRODUCT_ID}`);
  // Select a series so the trade ticket renders the full state.
  await page.getByTestId(`series-button-${FAKE_SERIES_ID}`).click();
  await expect(page.getByTestId("trade-ticket")).toBeVisible();

  // Default side = buy → Buyer (long) microcopy.
  await expect(page.getByTestId("side-buy")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(page.getByTestId("trade-side-microcopy")).toContainText(
    /Buyer \(long\): pay the premium up front/i,
  );

  // Click sell → Seller (short) microcopy.
  await page.getByTestId("side-sell").click();
  await expect(page.getByTestId("side-sell")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(page.getByTestId("trade-side-microcopy")).toContainText(
    /Seller \(short\): post mUSDC collateral/i,
  );
});

test("sign-microcopy clarifies wallet signs typed data, executor broadcasts", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
  await mockProductWithSeries(page, FAKE_PRODUCT_ID, FAKE_SERIES_ID);
  await page.goto(`/markets/${FAKE_PRODUCT_ID}`);
  await page.getByTestId(`series-button-${FAKE_SERIES_ID}`).click();
  const micro = page.getByTestId("sign-microcopy");
  await expect(micro).toBeVisible();
  await expect(micro).toContainText(/Your wallet signs typed data/i);
  await expect(micro).toContainText(/Nothing is broadcast from your wallet/i);
  await expect(micro).toContainText(/operator-side executor/i);
  await expect(micro).toContainText(/Base Sepolia \(chain 84532\)/i);
  await expect(micro).toContainText(/No real funds/i);
});

test("trade-ticket sign button uses emerald primary styling, not zinc", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
  await mockProductWithSeries(page, FAKE_PRODUCT_ID, FAKE_SERIES_ID);
  await page.goto(`/markets/${FAKE_PRODUCT_ID}`);
  await page.getByTestId(`series-button-${FAKE_SERIES_ID}`).click();
  const cls = (await page.getByTestId("sign-button").getAttribute("class")) ?? "";
  expect(cls).toMatch(/bg-emerald-/);
  expect(cls).not.toMatch(/bg-amber-/);
  expect(cls).not.toMatch(/bg-yellow-/);
});

test("trade-ticket DOM contains no positive-claim language", async ({ page }) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
  await mockProductWithSeries(page, FAKE_PRODUCT_ID, FAKE_SERIES_ID);
  await page.goto(`/markets/${FAKE_PRODUCT_ID}`);
  await page.getByTestId(`series-button-${FAKE_SERIES_ID}`).click();
  const text = await page.getByTestId("trade-ticket").innerText();
  expect(text).not.toMatch(/\bis audited\b/i);
  expect(text).not.toMatch(/\bmainnet-ready\b/i);
  expect(text).not.toMatch(/\bproduction-ready\b/i);
  expect(text).not.toMatch(/\bsafe for real funds\b/i);
});
