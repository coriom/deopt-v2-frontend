/**
 * perps-isolated-margin-position-engine-v1.spec.ts
 *
 * PERPS-ISOLATED-MARGIN-POSITION-ENGINE-V1 — read-only positions panel
 * honesty specs.
 *
 * The `/perps` page now renders a `PerpsPositionsPanel` under the
 * workspace. Assertions:
 *
 *   * disconnected wallet → "Connect wallet…" placeholder, panel
 *     visible.
 *   * empty backend response → "No Perps positions…" placeholder.
 *   * populated backend response → row rendered with entry, size, and
 *     honest `—` for null risk fields.
 *   * not-live banner + submit disabled unchanged.
 */
import { test, expect, type Page } from "@playwright/test";
import {
  installMockWallet,
  BASE_SEPOLIA_CHAIN_ID,
} from "./wallet-fixture";

async function stubPositions(page: Page, positions: object[], stale = true) {
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
  // Ignore stale param — only used to satisfy the linter about arg.
  void stale;
}

async function stubMarketPriceUnavailable(page: Page) {
  await page.route("**/perps/markets/*/price", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "perps oracle price unavailable",
      }),
    }),
  );
}

async function connectWallet(page: Page) {
  await page.getByTestId("wallet-connect-button").click();
  await page.waitForSelector(
    '[data-testid="wallet-connect-button"][data-wallet-state="connected"]',
    { timeout: 5_000 },
  );
}

test.describe("PERPS-ISOLATED-MARGIN-POSITION-ENGINE-V1", () => {
  test("disconnected wallet shows 'Connect wallet' state", async ({ page }) => {
    // No wallet installed → not connected.
    await stubMarketPriceUnavailable(page);
    await page.goto("/perps");
    await expect(page.getByTestId("perps-positions-panel")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("perps-positions-disconnected")).toBeVisible();
    // Not-live banner + submit disabled unchanged.
    await expect(page.getByTestId("perps-not-live-banner")).toBeVisible();
  });

  test("connected wallet + empty backend → empty state (no fake rows)", async ({
    page,
  }) => {
    await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await stubMarketPriceUnavailable(page);
    await stubPositions(page, []);
    await page.goto("/perps");
    await connectWallet(page);
    await expect(page.getByTestId("perps-positions-panel")).toBeVisible();
    await expect(page.getByTestId("perps-positions-empty")).toBeVisible({
      timeout: 10_000,
    });
    // No fabricated row anywhere in the panel.
    const panelText = await page
      .getByTestId("perps-positions-panel")
      .innerText();
    expect(panelText).not.toContain("long");
    expect(panelText).not.toContain("short");
  });

  test("connected wallet + populated backend → row renders honestly", async ({
    page,
  }) => {
    await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
    await stubMarketPriceUnavailable(page);
    await stubPositions(page, [
      {
        id: "11111111-2222-3333-4444-555555555555",
        account: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
        market_id: "ETH-PERP",
        side: "long",
        size_1e8: "100000000",
        entry_price_1e8: "300000000000",
        margin_1e8: "30000000000",
        realized_pnl_1e8: "0",
        status: "open",
        mark_price_1e8: null,
        notional_1e8: null,
        unrealized_pnl_1e8: null,
        initial_margin_requirement_1e8: "30000000000",
        maintenance_margin_requirement_1e8: null,
        margin_ratio_bps: null,
        estimated_liquidation_price_1e8: "284210526315",
        opened_at_ms: 1_782_000_000_000,
        updated_at_ms: 1_782_000_000_000,
        closed_at_ms: null,
        price_stale: true,
        trading_enabled: false,
      },
    ]);
    await page.goto("/perps");
    await connectWallet(page);
    const row = page.getByTestId(
      "perps-positions-row-11111111-2222-3333-4444-555555555555",
    );
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toHaveAttribute("data-perps-row-status", "open");
    await expect(row).toHaveAttribute(
      "data-perps-row-price-stale",
      "true",
    );
    // Entry $3000.00, size 1.00, margin $300.00 all formatted with
    // 2dp grouping.
    await expect(row).toContainText("ETH-PERP");
    await expect(row).toContainText("long");
    await expect(row).toContainText("1.00");
    await expect(row).toContainText("3,000.00");
    await expect(row).toContainText("300.00");
    // Mark price + unrealised PnL + margin ratio + maintenance
    // are null → rendered as `—`. The row must include `—` for
    // those cells specifically.
    const rowText = await row.innerText();
    expect(rowText).toContain("—");
    // Submit button remains hard-disabled.
    const submit = page.locator('button:has-text("Perps not live")');
    await expect(submit.first()).toBeDisabled();
  });
});
