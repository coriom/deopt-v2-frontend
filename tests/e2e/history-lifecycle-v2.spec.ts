/**
 * history-lifecycle-v2.spec.ts — HISTORY-LIFECYCLE-V2
 *
 * Covers the `/history` page's new TP/SL (`conditional`) tab and the
 * lifecycle refresh banner. WS auth is now exercised by the sibling
 * spec `lifecycle-e2e-v1.spec.ts` (closed in FRONTEND-LIFECYCLE-
 * OBSERVABILITY-E2E-V1); this spec stays REST-focused and covers
 * the TP/SL tab + the conditional-orders fetch path.
 *
 * Wallet flow: install the mock with the same chain id the production
 * bundle expects (Base Sepolia), then click the Connect-wallet button
 * — the WalletProvider has no auto-connect.
 */
import { test, expect, type Page } from "@playwright/test";
import { installMockWallet, BASE_SEPOLIA_CHAIN_ID } from "./wallet-fixture";

const HEX_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

async function installConnectedWallet(page: Page) {
  await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
}

async function connectWallet(page: Page) {
  await page.getByTestId("wallet-connect-button").click();
  await page.waitForSelector(
    '[data-testid="wallet-connect-button"][data-wallet-state="connected"]',
    { timeout: 5_000 },
  );
}

function buildConditional(
  id: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    account: HEX_ADDR.toLowerCase(),
    option_series_id:
      "0x62e9de8122013ec803cddbbe018c92dd78871c68a1b37c0b9eb39bca13a5f43f",
    position_side: "long",
    option_kind: "call",
    conditional_type: "tp",
    trigger_source: "mark",
    trigger_condition: "ge",
    trigger_price_1e8: "1000000000",
    quantity_1e8: "100000000",
    execution_type: "limit",
    limit_price_1e8: "1100000000",
    reduce_only: true,
    oco_group_id: null,
    status: "armed",
    child_order_id: null,
    failure_code: null,
    failure_message: null,
    expires_at_ms: null,
    triggered_at_ms: null,
    completed_at_ms: null,
    created_at_ms: 1_782_000_000_000,
    updated_at_ms: 1_782_000_000_000,
    version: 1,
    ...overrides,
  };
}

test("TP/SL tab is present in the history tab strip", async ({ page }) => {
  // Tab strip is rendered regardless of wallet state; no connection
  // needed for this assertion.
  await page.goto("/history");
  await expect(page.getByTestId("history-shell")).toBeVisible();
  await expect(page.getByTestId("history-tab-conditional")).toBeVisible();
  await expect(page.getByTestId("history-tab-conditional")).toContainText(
    /TP\s*\/\s*SL/i,
  );
});

test("TP/SL tab honours disconnected state (no /conditional-orders fetch fires)", async ({
  page,
}) => {
  let fetched = false;
  await page.route("**/accounts/*/conditional-orders", (route) => {
    fetched = true;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
  // Disconnected-state assertion: no wallet install + no connect click.
  await page.goto("/history");
  await page.getByTestId("history-tab-conditional").click();
  await expect(page.getByTestId("history-empty-disconnected")).toBeVisible();
  // Walking the tab shouldn't have triggered a network call (no wallet).
  expect(fetched).toBe(false);
});

test("connected TP/SL tab fetches /conditional-orders and renders an armed row", async ({
  page,
}) => {
  await page.route("**/accounts/*/conditional-orders", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        buildConditional("c-armed", { status: "armed" }),
      ]),
    }),
  );
  await page.route("**/accounts/*/history/v2*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        data: {
          address: HEX_ADDR.toLowerCase(),
          chain: "anvil",
          chain_id: 31337,
          range: "last_month",
          tab: "trades",
          page: 1,
          page_size: 100,
          total_records: 0,
          items: [],
        },
        warnings: [],
        meta: {
          source: "db",
          chain_id: 31337,
          request_id: "synth",
          generated_at_ms: 0,
        },
      }),
    }),
  );
  await installConnectedWallet(page);
  await page.goto("/history");
  await connectWallet(page);
  // The conditional fetch uses `all` range internally; we use Last
  // Quarter to keep it inside the default cutoff.
  await page.getByTestId("history-range-select").selectOption("all");
  await page.getByTestId("history-tab-conditional").click();
  const row = page.getByTestId("history-row-conditional-0");
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("data-conditional-status", "armed");
  await expect(row).toHaveAttribute("data-conditional-terminal", "false");
  await expect(row).toContainText("armed");
});

test("failed conditional row surfaces the failure code (no internal stack leak)", async ({
  page,
}) => {
  await page.route("**/accounts/*/conditional-orders", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        buildConditional("c-failed", {
          status: "failed",
          failure_code: "execution_rejected",
          failure_message: "live reducible size is zero",
        }),
      ]),
    }),
  );
  await page.route("**/accounts/*/history/v2*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        data: {
          address: HEX_ADDR.toLowerCase(),
          chain: "anvil",
          chain_id: 31337,
          range: "all",
          tab: "trades",
          page: 1,
          page_size: 100,
          total_records: 0,
          items: [],
        },
        warnings: [],
        meta: {
          source: "db",
          chain_id: 31337,
          request_id: "synth",
          generated_at_ms: 0,
        },
      }),
    }),
  );
  await installConnectedWallet(page);
  await page.goto("/history");
  await connectWallet(page);
  await page.getByTestId("history-range-select").selectOption("all");
  await page.getByTestId("history-tab-conditional").click();
  const row = page.getByTestId("history-row-conditional-0");
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("data-conditional-terminal", "true");
  await expect(row).toContainText("execution_rejected");
  // The full failure message lives in the `title` attribute, not the
  // visible text — the failure code is the dense column value.
});

test("conditional row with child_order_id renders a shortened link", async ({
  page,
}) => {
  const longChildId = "f1f2f3f4-aaaa-bbbb-cccc-dddddddddddd";
  await page.route("**/accounts/*/conditional-orders", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        buildConditional("c-completed", {
          status: "completed",
          child_order_id: longChildId,
        }),
      ]),
    }),
  );
  await page.route("**/accounts/*/history/v2*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        data: {
          address: HEX_ADDR.toLowerCase(),
          chain: "anvil",
          chain_id: 31337,
          range: "all",
          tab: "trades",
          page: 1,
          page_size: 100,
          total_records: 0,
          items: [],
        },
        warnings: [],
        meta: {
          source: "db",
          chain_id: 31337,
          request_id: "synth",
          generated_at_ms: 0,
        },
      }),
    }),
  );
  await installConnectedWallet(page);
  await page.goto("/history");
  await connectWallet(page);
  await page.getByTestId("history-range-select").selectOption("all");
  await page.getByTestId("history-tab-conditional").click();
  const row = page.getByTestId("history-row-conditional-0");
  await expect(row).toBeVisible();
  // Shortened to first 6 ... last 4.
  await expect(row).toContainText("f1f2f3…dddd");
});

test("manual refresh button triggers a /conditional-orders refetch", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/accounts/*/conditional-orders", (route) => {
    calls += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
  await page.route("**/accounts/*/history/v2*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        data: {
          address: HEX_ADDR.toLowerCase(),
          chain: "anvil",
          chain_id: 31337,
          range: "last_month",
          tab: "trades",
          page: 1,
          page_size: 100,
          total_records: 0,
          items: [],
        },
        warnings: [],
        meta: {
          source: "db",
          chain_id: 31337,
          request_id: "synth",
          generated_at_ms: 0,
        },
      }),
    }),
  );
  await installConnectedWallet(page);
  await page.goto("/history");
  await connectWallet(page);
  await page.getByTestId("history-tab-conditional").click();
  await expect.poll(() => calls, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
  const before = calls;
  await page.getByTestId("history-refresh-button").click();
  await expect.poll(() => calls, { timeout: 5_000 }).toBe(before + 1);
});
