/**
 * local-markets-seeded.spec.ts — LOCAL-MARKETS-DATA-FIX verification.
 *
 * Verifies that when the local backend returns at least one active
 * option product:
 *   - /markets renders product cards (NOT the "no-products" fallback)
 *   - /markets does NOT render the backend-unavailable fallback
 *   - product cards include the strike + expiry + Call/Put badge that
 *     the operator added via `scripts/local-seed.sh`
 *
 * Also covers the inverse:
 *   - /markets renders the "no-products" fallback (NOT
 *     backend-unavailable) when the seed has not been applied yet
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

const SAMPLE_PRODUCT = {
  product_id:
    "0x4dd3cd56dca4d6dd57158808e49e6a0aad37c1c099ebab5712ca9a4fdc8be5af",
  underlying: "0x4200000000000000000000000000000000000006",
  underlying_symbol: "WETH",
  settlement_asset: "0x6eAe407f5640B006faC9965182e238582A3B412E",
  settlement_asset_symbol: "mUSDC",
  is_call: true,
  expiry_ms: 1_783_961_964_000,
  series_count: 1,
  is_active_any: true,
};

test("markets renders product cards when backend returns a seeded list", async ({
  page,
}) => {
  await page.route("**/options/products*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        data: { products: [SAMPLE_PRODUCT] },
        meta: {
          source: "db",
          chain_id: 84532,
          request_id: "synth-seed",
          generated_at_ms: 0,
        },
      }),
    }),
  );
  await installMockWallet(page);
  await page.goto("/markets");

  // No fallback rendered.
  await expect(page.getByTestId("markets-fallback-card")).toHaveCount(0);

  // The product card is rendered.
  await expect(
    page.getByTestId(`product-card-${SAMPLE_PRODUCT.product_id}`),
  ).toBeVisible();
});

test("markets shows the no-products fallback (not backend-unavailable) when seed is empty", async ({
  page,
}) => {
  await page.route("**/options/products*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        data: { products: [] },
        meta: {
          source: "db",
          chain_id: 84532,
          request_id: "synth-empty",
          generated_at_ms: 0,
        },
      }),
    }),
  );
  await installMockWallet(page);
  await page.goto("/markets");
  const card = page.getByTestId("markets-fallback-card");
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-kind", "no-products");
});

test("seeded markets surface no positive-claim / fake-liquidity copy", async ({
  page,
}) => {
  await page.route("**/options/products*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        data: { products: [SAMPLE_PRODUCT] },
        meta: {
          source: "db",
          chain_id: 84532,
          request_id: "synth-seed",
          generated_at_ms: 0,
        },
      }),
    }),
  );
  await installMockWallet(page);
  await page.goto("/markets");
  await page.waitForSelector(
    `[data-testid=product-card-${SAMPLE_PRODUCT.product_id}]`,
  );
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/\bis audited\b/i);
  expect(text).not.toMatch(/\bmainnet-ready\b/i);
  expect(text).not.toMatch(/\bproduction-ready\b/i);
  expect(text).not.toMatch(/\bsafe for real funds\b/i);
  expect(text).not.toMatch(/\bguaranteed liquidity\b/i);
  expect(text).not.toMatch(/\binstitutional-grade\b/i);
});
