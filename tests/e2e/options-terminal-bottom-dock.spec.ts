/**
 * options-terminal-bottom-dock.spec.ts — updated for FRONTEND-TRADE-WIDGET-V1
 *
 * The Options workspace ships a 3-widget default: options-chain (left),
 * `trade` (right — compact options order ticket with Payoff / Greeks /
 * Trades / Book tabs), bottom-dock (full-width below). The `trade`
 * widget replaces the legacy `option-details` widget.
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

const PRODUCT_CALL = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0000";
const SERIES_CALL_3000 = "series-call-3000";

async function setupChain(page: import("@playwright/test").Page) {
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
  await page.route(
    `**/options/products/${PRODUCT_CALL}`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          data: {
            product: {
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
            series_ids: [SERIES_CALL_3000],
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
    `**/options/series/${SERIES_CALL_3000}/details`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          data: {
            series: {
              series_id: SERIES_CALL_3000,
              product_id: PRODUCT_CALL,
              underlying: "0x0000000000000000000000000000000000000001",
              settlement_asset: "0x6eae407f5640b006fac9965182e238582a3b412e",
              is_call: true,
              strike_1e8: "300000000000",
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

test("/trade renders the 3-widget default Options workspace", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  await expect(page.getByTestId("workspace-options")).toBeVisible();
  await expect(page.getByTestId("workspace-toolbar-options")).toBeVisible();
  await expect(page.getByTestId("widget-options-chain")).toBeVisible();
  await expect(page.getByTestId("widget-trade")).toBeVisible();
  await expect(page.getByTestId("widget-bottom-dock")).toBeVisible();
});

test("/trade Trade widget exposes Payoff/Greeks/Trades/Book tabs", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  const trade = page.getByTestId("widget-trade");
  await expect(trade).toBeVisible();
  for (const id of ["payoff", "greeks", "trades", "book"]) {
    await expect(trade.getByTestId(`trade-tab-${id}`)).toBeVisible();
  }
});

test("Payoff and Greeks are NOT default separate widgets on /trade", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  // They live as tabs inside the trade widget, not as their own widget
  // frames (the frame would carry the data-testid `widget-payoff` /
  // `widget-greeks`).
  await expect(page.getByTestId("widget-payoff")).toHaveCount(0);
  await expect(page.getByTestId("widget-greeks")).toHaveCount(0);
});

test("/trade bottom-dock widget renders the 6 account tabs", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  const dock = page.getByTestId("widget-bottom-dock");
  await expect(dock).toBeVisible();
  for (const id of [
    "balances",
    "positions",
    "orders",
    "trades",
    "greeks",
    "events",
  ]) {
    await expect(dock.getByTestId(`bottom-tab-${id}`)).toBeVisible();
  }
});

test("/trade terminal-header still surfaces 'chain 84532' status", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  await expect(page.getByTestId("terminal-header")).toBeVisible();
  await expect(page.getByTestId("terminal-stat-chain")).toContainText(
    /chain 84532/i,
  );
});
