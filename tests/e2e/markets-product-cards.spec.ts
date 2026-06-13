/**
 * markets-product-cards.spec.ts — public testnet beta V3
 *
 * Covers the upgraded product card grid:
 *   - product card renders type badge (CALL / PUT)
 *   - shows expiry, series count, collateral
 *   - links to /markets/[product_id]
 *   - product page renders the option-chain header + readiness helper +
 *     back link
 *   - back-link points at /markets (no mainnet route)
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

const FAKE_PRODUCT_ID =
  "0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc1230000";

async function mockProductsList(
  page: import("@playwright/test").Page,
  products: unknown[],
) {
  await page.route("**/options/products*", (route) => {
    if (route.request().url().includes("/options/products/")) {
      return route.continue();
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        data: { products },
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

test("populated markets list renders the new V3 product cards", async ({
  page,
}) => {
  await mockProductsList(page, [
    {
      product_id: FAKE_PRODUCT_ID,
      underlying: "0x0000000000000000000000000000000000000001",
      underlying_symbol: "WETH",
      settlement_asset: "0x6eae407f5640b006fac9965182e238582a3b412e",
      settlement_asset_symbol: "mUSDC",
      is_call: true,
      expiry_ms: Date.now() + 86_400_000 * 7,
      series_count: 5,
      is_active_any: true,
    },
  ]);
  await installMockWallet(page);
  await page.goto("/markets");

  const card = page.getByTestId(`product-card-${FAKE_PRODUCT_ID}`);
  await expect(card).toBeVisible();
  // Type badge is CALL.
  await expect(
    page.getByTestId(`product-card-type-${FAKE_PRODUCT_ID}`),
  ).toHaveText(/CALL/);
  // Card shows the underlying symbol.
  await expect(card.getByText("WETH")).toBeVisible();
  // Card metadata grid: expiry / series / collateral / active.
  await expect(card.getByText(/Expiry/i)).toBeVisible();
  await expect(card.getByText(/Series/i)).toBeVisible();
  await expect(card.getByText(/Collateral/i)).toBeVisible();
  await expect(card.getByText(/mUSDC/i)).toBeVisible();
});

test("PUT product card renders the PUT badge", async ({ page }) => {
  await mockProductsList(page, [
    {
      product_id: FAKE_PRODUCT_ID,
      underlying: "0x0000000000000000000000000000000000000001",
      underlying_symbol: "WETH",
      settlement_asset: "0x6eae407f5640b006fac9965182e238582a3b412e",
      settlement_asset_symbol: "mUSDC",
      is_call: false,
      expiry_ms: Date.now() + 86_400_000,
      series_count: 2,
      is_active_any: true,
    },
  ]);
  await installMockWallet(page);
  await page.goto("/markets");
  await expect(
    page.getByTestId(`product-card-type-${FAKE_PRODUCT_ID}`),
  ).toHaveText(/PUT/);
});

test("product page renders the option-chain header + back link + readiness helper", async ({
  page,
}) => {
  await page.route(
    `**/options/products/${FAKE_PRODUCT_ID}`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          data: {
            product: {
              product_id: FAKE_PRODUCT_ID,
              underlying: "0x0000000000000000000000000000000000000001",
              underlying_symbol: "WETH",
              settlement_asset:
                "0x6eae407f5640b006fac9965182e238582a3b412e",
              settlement_asset_symbol: "mUSDC",
              is_call: true,
              expiry_ms: Date.now() + 86_400_000,
              series_count: 0,
              is_active_any: true,
            },
            series_ids: [],
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
  await installMockWallet(page);
  await page.goto(`/markets/${FAKE_PRODUCT_ID}`);
  await expect(page.getByTestId("option-chain")).toBeVisible();
  await expect(page.getByTestId("option-chain-type-badge")).toHaveText(/CALL/);
  await expect(page.getByTestId("testnet-readiness-helper")).toBeVisible();
  // Back link to /markets.
  const back = page.getByRole("link", { name: /Back to markets/i });
  await expect(back).toHaveAttribute("href", "/markets");
  // No mainnet href anywhere on the page.
  const links = await page.locator("main a").evaluateAll((els) =>
    (els as HTMLAnchorElement[]).map((a) => a.href).filter(Boolean),
  );
  for (const href of links) {
    expect(href, `link ${href} must not point at mainnet`).not.toMatch(
      /^https?:\/\/basescan\.org/,
    );
    expect(href).not.toMatch(/mainnet\.base\.org/);
  }
});
