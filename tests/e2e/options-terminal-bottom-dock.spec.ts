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

test("/options renders the default Options workspace (chain + trade + payoff + bottom dock)", async ({
  page,
}) => {
  // The default options layout now seeds 4 widgets (options-chain,
  // trade, payoff, bottom-dock) per `workspace/registry.tsx`. Payoff
  // was promoted from a tab inside the trade widget to its own widget;
  // see the workspace-registry comment block for the visual layout.
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/options");
  await expect(page.getByTestId("workspace-options")).toBeVisible();
  await expect(page.getByTestId("widget-options-chain")).toBeVisible();
  await expect(page.getByTestId("widget-trade")).toBeVisible();
  await expect(page.getByTestId("widget-payoff")).toBeVisible();
  await expect(page.getByTestId("widget-bottom-dock")).toBeVisible();
});

test("/options Trade widget defaults to the orderbook submit form", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/options");
  const trade = page.getByTestId("widget-trade");
  await expect(trade).toBeVisible();
  await expect(trade.getByTestId("trade-body-orderbook")).toBeVisible();
  await expect(trade.getByTestId("direct-orderbook-form")).toBeVisible();
});

test("Greeks is NOT a default separate widget on /options (still a trade-widget tab)", async ({
  page,
}) => {
  // Payoff was promoted to its own default widget; Greeks still lives
  // as a tab inside the trade widget and should not have its own
  // top-level widget frame.
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/options");
  await expect(page.getByTestId("widget-greeks")).toHaveCount(0);
});

test("/options bottom-dock widget renders the 6 account tabs", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/options");
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

test("/options terminal-header still surfaces 'chain 84532' status", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/options");
  await expect(page.getByTestId("terminal-header")).toBeVisible();
  await expect(page.getByTestId("terminal-stat-chain")).toContainText(
    /chain 84532/i,
  );
});
