/**
 * options-terminal-bottom-dock.spec.ts — FRONTEND-MODULAR-WORKSPACE-V1
 *
 * The dock-as-tabbed-panel has been replaced by individual workspace
 * widgets. These specs assert the new wire-up:
 *   - /trade renders the Workspace shell + Options toolbar
 *   - Default Options widgets include Balances / Positions / Trades /
 *     Events plus the chain + selected-option
 *   - Orders + Greeks widgets surface honest "not live / coming later"
 *     copy when added from the Add Widget menu
 *   - terminal-header + terminal-stat-chain still render inside the
 *     options-chain widget
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

test("/trade renders the Options workspace + default widgets", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  await expect(page.getByTestId("workspace-options")).toBeVisible();
  await expect(page.getByTestId("workspace-toolbar-options")).toBeVisible();
  await expect(page.getByTestId("widget-options-chain")).toBeVisible();
  await expect(page.getByTestId("widget-option-details")).toBeVisible();
  await expect(page.getByTestId("widget-balances")).toBeVisible();
  await expect(page.getByTestId("widget-positions")).toBeVisible();
  await expect(page.getByTestId("widget-trades")).toBeVisible();
  await expect(page.getByTestId("widget-events")).toBeVisible();
});

test("/trade terminal header still renders 'chain 84532' status", async ({
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

test("Add Widget menu can add Orders + Greeks widgets which surface honest copy", async ({
  page,
}) => {
  await setupChain(page);
  await installMockWallet(page);
  await page.goto("/trade");
  await page.getByTestId("workspace-add-widget").click();
  await expect(page.getByTestId("workspace-add-widget-menu")).toBeVisible();
  await page.getByTestId("workspace-add-widget-option-orders").click();
  await expect(page.getByTestId("widget-orders")).toBeVisible();

  await page.getByTestId("workspace-add-widget").click();
  await page.getByTestId("workspace-add-widget-option-greeks").click();
  await expect(page.getByTestId("widget-greeks")).toBeVisible();

  await expect(page.locator("[data-widget-implemented='false']").first()).toBeVisible();
});
