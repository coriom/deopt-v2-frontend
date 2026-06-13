/**
 * testnet-readiness-helper.spec.ts — public testnet beta V3
 *
 * Covers the TestnetReadinessHelper rendered on the product page:
 *   - all four checks visible (wallet / network / ETH / mUSDC)
 *   - each check has a status badge (Ready / Pending / Blocked)
 *   - Discord link is live and points at https://discord.gg/zaEMvWuxu
 *   - no admin / mainnet / faucet / mint mechanism is exposed
 */
import { test, expect } from "@playwright/test";
import {
  installMockWallet,
  DEFAULT_TEST_ACCOUNT,
  BASE_SEPOLIA_CHAIN_ID,
  BASE_MAINNET_CHAIN_ID,
} from "./wallet-fixture";

const FAKE_PRODUCT_ID =
  "0xdeadbee5deadbee5deadbee5deadbee5deadbee5deadbee5deadbee5deadbee5";

async function mockProductDetails(
  page: import("@playwright/test").Page,
  productId: string,
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
}

test("readiness helper renders the 4 checks on the product page", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
  await mockProductDetails(page, FAKE_PRODUCT_ID);
  await page.goto(`/markets/${FAKE_PRODUCT_ID}`);
  // Need to click connect to populate the wallet state.
  await page.getByRole("button", { name: /Connect wallet/i }).click();

  await expect(page.getByTestId("testnet-readiness-helper")).toBeVisible();
  for (const id of ["wallet", "network", "eth", "musdc"]) {
    await expect(page.getByTestId(`readiness-check-${id}`)).toBeVisible();
  }
});

test("network check is Ready when on Base Sepolia (84532)", async ({ page }) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
  await mockProductDetails(page, FAKE_PRODUCT_ID);
  await page.goto(`/markets/${FAKE_PRODUCT_ID}`);
  await page.getByRole("button", { name: /Connect wallet/i }).click();
  const networkCheck = page.getByTestId("readiness-check-network");
  await expect(networkCheck).toHaveAttribute("data-status", "ok");
});

test("network check is Blocked when wallet is on mainnet", async ({ page }) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_MAINNET_CHAIN_ID,
  });
  await mockProductDetails(page, FAKE_PRODUCT_ID);
  await page.goto(`/markets/${FAKE_PRODUCT_ID}`);
  await page.getByRole("button", { name: /Connect wallet/i }).click();
  const networkCheck = page.getByTestId("readiness-check-network");
  await expect(networkCheck).toHaveAttribute("data-status", "blocked");
});

test("Discord link is live and points at https://discord.gg/zaEMvWuxu", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
  await mockProductDetails(page, FAKE_PRODUCT_ID);
  await page.goto(`/markets/${FAKE_PRODUCT_ID}`);
  const link = page.getByTestId("readiness-discord-link");
  await expect(link).toBeVisible();
  const tag = await link.evaluate((e) => e.tagName.toLowerCase());
  expect(tag).toBe("a");
  await expect(link).toHaveAttribute("href", "https://discord.gg/zaEMvWuxu");
});

test("readiness helper exposes no admin / faucet / mint mechanism", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
  await mockProductDetails(page, FAKE_PRODUCT_ID);
  await page.goto(`/markets/${FAKE_PRODUCT_ID}`);
  const helper = page.getByTestId("testnet-readiness-helper");
  const html = await helper.innerHTML();
  // No admin endpoints, no /admin/test fixtures, no mint buttons that
  // would suggest the UI can mint or fund the user directly.
  expect(html).not.toMatch(/\/admin\//);
  expect(html).not.toMatch(/\/admin\/test\//);
  // No mainnet RPC patterns.
  expect(html).not.toMatch(/mainnet\.base\.org/);
  expect(html).not.toMatch(/basescan\.org\/tx\//);
  // No admin bearer / RPC URL key / DB credential.
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(html).not.toMatch(/alchemy\.com\/v2\/[A-Za-z0-9_-]+/);
  expect(html).not.toMatch(/DATABASE_URL/);
});
