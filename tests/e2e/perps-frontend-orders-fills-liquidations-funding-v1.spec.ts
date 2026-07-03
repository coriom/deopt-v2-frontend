/**
 * perps-frontend-orders-fills-liquidations-funding-v1.spec.ts
 *
 * PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 — read-only
 * account activity panel specs. `/perps` gains four new panels:
 *
 *   - Orders panel
 *   - Fills panel
 *   - Liquidations panel
 *   - Funding panel
 *
 * Each panel is REST-snapshot backed and refreshes on its matching
 * lifecycle channel delta. All states are honest — disconnected /
 * loading / empty / populated. Never a fabricated row. Trading is not
 * enabled; the not-live banner remains at the top and the submit
 * button remains hard-disabled.
 */
import { test, expect, type Page } from "@playwright/test";
import { installMockWallet, BASE_SEPOLIA_CHAIN_ID } from "./wallet-fixture";

// ---------------------------------------------------------------------
// Route stubs
// ---------------------------------------------------------------------

async function stubMarketPriceUnavailable(page: Page) {
  await page.route("**/perps/markets/*/price", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "perps oracle price unavailable" }),
    }),
  );
}

async function stubPositions(page: Page, positions: object[] = []) {
  await page.route("**/accounts/*/perps/positions", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        positions,
        chain_id: BASE_SEPOLIA_CHAIN_ID,
        trading_enabled: false,
      }),
    }),
  );
}

async function stubOrders(page: Page, orders: object[]) {
  await page.route("**/accounts/*/perps/orders", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        orders,
        chain_id: BASE_SEPOLIA_CHAIN_ID,
        trading_enabled: false,
      }),
    }),
  );
}

async function stubFills(page: Page, fills: object[]) {
  await page.route("**/accounts/*/perps/fills", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        fills,
        chain_id: BASE_SEPOLIA_CHAIN_ID,
        trading_enabled: false,
      }),
    }),
  );
}

async function stubLiquidations(page: Page, liquidations: object[]) {
  await page.route("**/accounts/*/perps/liquidations", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        liquidations,
        chain_id: BASE_SEPOLIA_CHAIN_ID,
        trading_enabled: false,
      }),
    }),
  );
}

async function stubFunding(page: Page, funding_events: object[]) {
  await page.route("**/accounts/*/perps/funding", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        funding_events,
        chain_id: BASE_SEPOLIA_CHAIN_ID,
        trading_enabled: false,
      }),
    }),
  );
}

async function stubAllReadEndpoints(page: Page) {
  await stubMarketPriceUnavailable(page);
  await stubPositions(page, []);
  await stubOrders(page, []);
  await stubFills(page, []);
  await stubLiquidations(page, []);
  await stubFunding(page, []);
}

async function connectWallet(page: Page) {
  await page.getByTestId("wallet-connect-button").click();
  await page.waitForSelector(
    '[data-testid="wallet-connect-button"][data-wallet-state="connected"]',
    { timeout: 5_000 },
  );
}

// ---------------------------------------------------------------------
// Constants (used across populated-row tests)
// ---------------------------------------------------------------------

const ORDER_ROW = {
  order_id: "aaaa1111-2222-3333-4444-555555555555",
  account: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  market_id: "ETH-PERP",
  side: "buy",
  order_type: "limit",
  price_1e8: "300000000000",
  size_1e8: "100000000",
  remaining_size_1e8: "50000000",
  filled_size_1e8: "50000000",
  time_in_force: "gtc",
  post_only: false,
  reduce_only: false,
  isolated_margin_1e8: "30000000000",
  status: "partially_filled",
  client_order_id: "cli-example",
  terminal_reason_code: null,
  terminal_reason_message: null,
  terminal_reason_source: null,
  created_at_ms: 1_782_000_000_000,
  updated_at_ms: 1_782_000_000_000,
  trading_enabled: false,
};

const FILL_ROW = {
  fill_id: "bbbb1111-2222-3333-4444-555555555555",
  market_id: "ETH-PERP",
  taker_order_id: "aaaa1111-2222-3333-4444-555555555555",
  maker_order_id: "cccc1111-2222-3333-4444-555555555555",
  taker_account: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  maker_account: "0x1111111111111111111111111111111111111111",
  liquidity_role: "taker",
  side: "buy",
  price_1e8: "300000000000",
  size_1e8: "50000000",
  created_at_ms: 1_782_000_000_000,
  trading_enabled: false,
};

const LIQUIDATION_ROW = {
  liquidation_id: "dddd1111-2222-3333-4444-555555555555",
  account: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  market_id: "ETH-PERP",
  position_id: "eeee1111-2222-3333-4444-555555555555",
  side: "long",
  size_1e8: "100000000",
  entry_price_1e8: "300000000000",
  mark_price_1e8: "270000000000",
  margin_1e8: "30000000000",
  unrealized_pnl_1e8: "-30000000000",
  equity_1e8: "0",
  maintenance_margin_requirement_1e8: "13500000000",
  margin_ratio_bps: "0",
  realized_pnl_1e8: "-30000000000",
  bad_debt_1e8: "0",
  liquidation_fee_1e8: "0",
  status: "completed",
  reason_code: "margin_breach",
  created_at_ms: 1_782_000_000_000,
  trading_enabled: false,
};

const FUNDING_ROW = {
  funding_event_id: "ffff1111-2222-3333-4444-555555555555",
  account: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  market_id: "ETH-PERP",
  position_id: "eeee1111-2222-3333-4444-555555555555",
  side: "long",
  position_size_1e8: "100000000",
  funding_index_before_1e18: "0",
  funding_index_after_1e18: "10000000000000000",
  funding_delta_1e18: "10000000000000000",
  payment_1e8: "100000",
  margin_before_1e8: "30000000000",
  margin_after_1e8: "29999900000",
  bad_debt_1e8: "0",
  reason_code: "funding_settlement",
  created_at_ms: 1_782_000_000_000,
  trading_enabled: false,
};

// =====================================================================
// A. Not-live posture unchanged after new panels ship
// =====================================================================

test.describe("PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 — not-live posture", () => {
  test("not-live banner is still rendered on /perps", async ({ page }) => {
    await stubMarketPriceUnavailable(page);
    await page.goto("/perps");
    await expect(page.getByTestId("perps-not-live-banner")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("all four new panels mount with wallet connected + not-live banner still visible", async ({
    page,
  }) => {
    await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await stubAllReadEndpoints(page);
    await page.goto("/perps");
    await connectWallet(page);
    await expect(page.getByTestId("perps-orders-panel")).toBeVisible();
    await expect(page.getByTestId("perps-fills-panel")).toBeVisible();
    await expect(page.getByTestId("perps-liquidations-panel")).toBeVisible();
    await expect(page.getByTestId("perps-funding-panel")).toBeVisible();
    // Not-live banner is the page-level guarantee that trading is
    // disabled — the widget-scoped submit is already covered by
    // `perps-isolated-margin-position-engine-v1.spec.ts`.
    await expect(page.getByTestId("perps-not-live-banner")).toBeVisible();
  });
});

// =====================================================================
// B. Orders panel — disconnected / empty / populated / unknown status
// =====================================================================

test.describe("PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 — orders panel", () => {
  test("disconnected wallet shows 'Connect wallet' state", async ({ page }) => {
    await stubMarketPriceUnavailable(page);
    await page.goto("/perps");
    await expect(page.getByTestId("perps-orders-panel")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("perps-orders-disconnected")).toBeVisible();
  });

  test("connected wallet + empty API → empty state, no fake rows", async ({
    page,
  }) => {
    await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await stubAllReadEndpoints(page);
    await page.goto("/perps");
    await connectWallet(page);
    await expect(page.getByTestId("perps-orders-empty")).toBeVisible({
      timeout: 10_000,
    });
    const panelText = await page.getByTestId("perps-orders-panel").innerText();
    expect(panelText).toContain("Trading is not live yet");
    // The rendered row-per-order testid must not appear.
    await expect(page.getByTestId("perps-orders-row")).toHaveCount(0);
  });

  test("populated API → row renders with market, side, price, size, status", async ({
    page,
  }) => {
    await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await stubMarketPriceUnavailable(page);
    await stubPositions(page, []);
    await stubOrders(page, [ORDER_ROW]);
    await stubFills(page, []);
    await stubLiquidations(page, []);
    await stubFunding(page, []);
    await page.goto("/perps");
    await connectWallet(page);
    const row = page.getByTestId("perps-orders-row").first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toHaveAttribute(
      "data-perps-order-status",
      "partially_filled",
    );
    await expect(row).toContainText("ETH-PERP");
    await expect(row).toContainText("buy");
    // Price 3000.00, size 1.00, filled/remaining 0.50.
    await expect(row).toContainText("3,000.00");
    await expect(row).toContainText("1.00");
    await expect(row).toContainText("0.50");
    await expect(row).toContainText("partially_filled");
  });

  test("unknown status renders safely (raw token, no crash)", async ({
    page,
  }) => {
    await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await stubMarketPriceUnavailable(page);
    await stubPositions(page, []);
    await stubOrders(page, [
      {
        ...ORDER_ROW,
        order_id: "unknown-status-order",
        status: "unheard_of_v9",
      },
    ]);
    await stubFills(page, []);
    await stubLiquidations(page, []);
    await stubFunding(page, []);
    await page.goto("/perps");
    await connectWallet(page);
    const row = page.getByTestId("perps-orders-row").first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText("unheard_of_v9");
  });
});

// =====================================================================
// C. Fills panel
// =====================================================================

test.describe("PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 — fills panel", () => {
  test("empty API → 'No Perps fills' state", async ({ page }) => {
    await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await stubAllReadEndpoints(page);
    await page.goto("/perps");
    await connectWallet(page);
    await expect(page.getByTestId("perps-fills-empty")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("perps-fills-row")).toHaveCount(0);
  });

  test("populated API → row shows market/side/role/price/size", async ({
    page,
  }) => {
    await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await stubMarketPriceUnavailable(page);
    await stubPositions(page, []);
    await stubOrders(page, []);
    await stubFills(page, [FILL_ROW]);
    await stubLiquidations(page, []);
    await stubFunding(page, []);
    await page.goto("/perps");
    await connectWallet(page);
    const row = page.getByTestId("perps-fills-row").first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText("ETH-PERP");
    await expect(row).toContainText("buy");
    // Role is CSS-uppercased visually but text node is lowercase.
    await expect(row).toContainText("taker");
    await expect(row).toContainText("3,000.00");
    await expect(row).toContainText("0.50");
  });
});

// =====================================================================
// D. Liquidations panel
// =====================================================================

test.describe("PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 — liquidations panel", () => {
  test("empty API → 'No Perps liquidations' state", async ({ page }) => {
    await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await stubAllReadEndpoints(page);
    await page.goto("/perps");
    await connectWallet(page);
    await expect(page.getByTestId("perps-liquidations-empty")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("perps-liquidations-row")).toHaveCount(0);
  });

  test("populated API → row shows market/side/size/entry/mark/reason", async ({
    page,
  }) => {
    await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await stubMarketPriceUnavailable(page);
    await stubPositions(page, []);
    await stubOrders(page, []);
    await stubFills(page, []);
    await stubLiquidations(page, [LIQUIDATION_ROW]);
    await stubFunding(page, []);
    await page.goto("/perps");
    await connectWallet(page);
    const row = page.getByTestId("perps-liquidations-row").first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toHaveAttribute(
      "data-perps-liquidation-status",
      "completed",
    );
    await expect(row).toContainText("ETH-PERP");
    await expect(row).toContainText("long");
    await expect(row).toContainText("3,000.00"); // entry
    await expect(row).toContainText("2,700.00"); // mark
    await expect(row).toContainText("margin_breach");
  });
});

// =====================================================================
// E. Funding panel
// =====================================================================

test.describe("PERPS-FRONTEND-ORDERS-FILLS-LIQUIDATIONS-FUNDING-V1 — funding panel", () => {
  test("empty API → 'No Perps funding payments' state", async ({ page }) => {
    await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await stubAllReadEndpoints(page);
    await page.goto("/perps");
    await connectWallet(page);
    await expect(page.getByTestId("perps-funding-empty")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("perps-funding-row")).toHaveCount(0);
  });

  test("populated API → row shows market/side/payment/margin/reason", async ({
    page,
  }) => {
    await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await stubMarketPriceUnavailable(page);
    await stubPositions(page, []);
    await stubOrders(page, []);
    await stubFills(page, []);
    await stubLiquidations(page, []);
    await stubFunding(page, [FUNDING_ROW]);
    await page.goto("/perps");
    await connectWallet(page);
    const row = page.getByTestId("perps-funding-row").first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText("ETH-PERP");
    await expect(row).toContainText("long");
    // Positive payment displayed with `-` prefix? No — positive. 0.001 payment_1e8 = "100000" → 0.00.
    // Margin before 300.00 (30000000000 / 1e8), margin after 299.99 (29999900000/1e8).
    await expect(row).toContainText("300.00");
    await expect(row).toContainText("299.99");
    await expect(row).toContainText("funding_settlement");
  });

  test("negative payment renders with `-` sign", async ({ page }) => {
    await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await stubMarketPriceUnavailable(page);
    await stubPositions(page, []);
    await stubOrders(page, []);
    await stubFills(page, []);
    await stubLiquidations(page, []);
    await stubFunding(page, [
      {
        ...FUNDING_ROW,
        funding_event_id: "neg-payment-1",
        side: "short",
        payment_1e8: "-100000000", // -1.00
        margin_before_1e8: "30000000000",
        margin_after_1e8: "30100000000",
      },
    ]);
    await page.goto("/perps");
    await connectWallet(page);
    const row = page.getByTestId("perps-funding-row").first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText("-1.00");
  });
});
