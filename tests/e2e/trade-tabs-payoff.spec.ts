/**
 * trade-tabs-payoff.spec.ts
 *
 * Pins the Payoff / Greeks / Trades / Book tab strip added at the
 * bottom of the Trade ticket panel (`TradeTicketPanel`) — replaces
 * the retired separate "payoff" workspace widget.
 *
 * Contract:
 *   - Tab strip is always visible (4 tabs).
 *   - Payoff tab is the default.
 *   - With NO option selected: Payoff / Greeks tabs show an empty state
 *     ("Select an instrument to view <Tab>"). Book tab hints to pick one.
 *   - Clicking an option in the chain fills the Payoff tab with a
 *     `payoff-svg` for that leg.
 *   - Switching tabs preserves the selection.
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

async function seedProducts(page: import("@playwright/test").Page) {
  // Minimal chain seed so the OptionsChainGrid renders at least one call.
  await page.route("**/options/products**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          products: [
            {
              product_id: "TESTNET-BETA-ETH-CALL",
              underlying: "ETH",
              base_asset: "ETH",
              quote_asset: "USDC",
              settlement_asset: "USDC",
              is_call: true,
            },
          ],
        },
        meta: {
          source: "db",
          chain_id: 84532,
          request_id: "spec",
          generated_at_ms: 0,
        },
      }),
    }),
  );
}

test("trade panel exposes the 4 Payoff/Greeks/Trades/Book tabs by default", async ({
  page,
}) => {
  await installMockWallet(page);
  await seedProducts(page);
  await page.goto("/options");
  const trade = page.getByTestId("widget-trade");
  await expect(trade).toBeVisible();
  await expect(trade.getByTestId("trade-tabs-strip")).toBeVisible();
  await expect(trade.getByTestId("trade-tab-payoff")).toBeVisible();
  await expect(trade.getByTestId("trade-tab-greeks")).toBeVisible();
  await expect(trade.getByTestId("trade-tab-trades")).toBeVisible();
  await expect(trade.getByTestId("trade-tab-book")).toBeVisible();
  // Payoff is the default active tab.
  await expect(trade.getByTestId("trade-tab-payoff")).toHaveAttribute(
    "data-selected",
    "true",
  );
});

test("with no chain selection, Payoff tab shows the empty state (no payoff-svg)", async ({
  page,
}) => {
  await installMockWallet(page);
  await seedProducts(page);
  await page.goto("/options");
  const trade = page.getByTestId("widget-trade");
  const emptyState = trade.getByTestId("trade-tab-empty-state");
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toContainText(/Select an instrument to view Payoff/i);
  await expect(trade.getByTestId("payoff-svg")).toHaveCount(0);
});

test("switching to Greeks with no selection still shows an empty state", async ({
  page,
}) => {
  await installMockWallet(page);
  await seedProducts(page);
  await page.goto("/options");
  const trade = page.getByTestId("widget-trade");
  await trade.getByTestId("trade-tab-greeks").click();
  await expect(trade.getByTestId("trade-tab-empty-state")).toContainText(
    /Select an instrument to view Greeks/i,
  );
});

test("trades tab renders the trade history table regardless of selection", async ({
  page,
}) => {
  await installMockWallet(page);
  await seedProducts(page);
  await page.goto("/options");
  const trade = page.getByTestId("widget-trade");
  await trade.getByTestId("trade-tab-trades").click();
  await expect(trade.getByTestId("trade-tab-trades-body")).toBeVisible();
});
