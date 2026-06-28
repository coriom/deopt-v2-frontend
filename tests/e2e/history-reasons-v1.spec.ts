/**
 * history-reasons-v1.spec.ts — HISTORY-V2-FAILURE-REASONS-V1
 *
 * Asserts the new Reason column on the `/history` Orders tab:
 *
 *   * cancellation reason for IOC orders that left a remainder
 *   * rejection reason for post-only orders that would have crossed
 *   * NO fake reason for normal `filled` rows
 *   * refresh banner + REST resync flips the visible reason after a
 *     lifecycle delta + click
 *
 * The fills / trades tab is intentionally NOT covered here — fill
 * rows always carry `status=filled` (a successful execution leg) and
 * the helper's contract is "never invent a reason for success". See
 * `HISTORY_V2_FAILURE_REASONS_V1_RESULT.md` for the honest limitation.
 */
import { test, expect } from "@playwright/test";
import {
  installConnectedWallet,
  connectWallet,
} from "./wallet-helpers";

const HEX_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

function ordersEnvelope(items: Array<Record<string, unknown>>) {
  return {
    status: "ok",
    data: {
      address: HEX_ADDR.toLowerCase(),
      chain: "anvil",
      chain_id: 31337,
      range: "last_month",
      tab: "orders",
      page: 1,
      page_size: 100,
      total_records: items.length,
      items,
    },
    warnings: [],
    meta: { source: "db", chain_id: 31337, request_id: "synth", generated_at_ms: 0 },
  };
}

async function gotoOrdersTab(page: import("@playwright/test").Page) {
  await installConnectedWallet(page);
  await page.goto("/history");
  await connectWallet(page);
  await page.getByTestId("history-tab-orders").click();
  await expect(page.getByTestId("history-shell")).toHaveAttribute(
    "data-history-tab",
    "orders",
  );
}

test("Orders tab shows `ioc_remainder_cancelled` for cancelled IOC with unfilled remainder", async ({
  page,
}) => {
  await page.route("**/accounts/*/history/v2*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        ordersEnvelope([
          {
            time_ms: 1_782_000_000_000,
            instrument: "S-1",
            side: "buy",
            order_type: "ioc",
            amount: "100000000",
            filled: "30000000",
            status: "cancelled",
          },
        ]),
      ),
    }),
  );
  await gotoOrdersTab(page);
  const cell = page
    .getByTestId("history-row-orders-0")
    .locator("[data-reason-code]")
    .first();
  await expect(cell).toHaveAttribute("data-reason-code", "ioc_remainder_cancelled");
  await expect(cell).toHaveAttribute("data-reason-severity", "info");
});

test("Orders tab shows `post_only_would_cross` for rejected post-only", async ({
  page,
}) => {
  await page.route("**/accounts/*/history/v2*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        ordersEnvelope([
          {
            time_ms: 1_782_000_000_000,
            instrument: "S-1",
            side: "buy",
            order_type: "gtc",
            amount: "100000000",
            filled: "0",
            status: "rejected",
            post_only: true,
          },
        ]),
      ),
    }),
  );
  await gotoOrdersTab(page);
  const cell = page
    .getByTestId("history-row-orders-0")
    .locator("[data-reason-code]")
    .first();
  await expect(cell).toHaveAttribute("data-reason-code", "post_only_would_cross");
  await expect(cell).toHaveAttribute("data-reason-severity", "warning");
});

test("Orders tab shows `fok_not_fillable` for rejected FOK", async ({ page }) => {
  await page.route("**/accounts/*/history/v2*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        ordersEnvelope([
          {
            time_ms: 1_782_000_000_000,
            instrument: "S-1",
            side: "sell",
            order_type: "fok",
            amount: "100000000",
            filled: "0",
            status: "rejected",
          },
        ]),
      ),
    }),
  );
  await gotoOrdersTab(page);
  const cell = page
    .getByTestId("history-row-orders-0")
    .locator("[data-reason-code]")
    .first();
  await expect(cell).toHaveAttribute("data-reason-code", "fok_not_fillable");
});

test("Orders tab shows NO reason cell content for a normal filled order", async ({
  page,
}) => {
  await page.route("**/accounts/*/history/v2*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        ordersEnvelope([
          {
            time_ms: 1_782_000_000_000,
            instrument: "S-1",
            side: "buy",
            order_type: "gtc",
            amount: "100000000",
            filled: "100000000",
            status: "filled",
          },
        ]),
      ),
    }),
  );
  await gotoOrdersTab(page);
  const row = page.getByTestId("history-row-orders-0");
  // No data-reason-code on this row — the helper returns null for
  // successful terminal statuses (filled).
  await expect(row.locator("[data-reason-code]")).toHaveCount(0);
});

test("Trades/Fills tab does not render a Reason column (fills are always successful)", async ({
  page,
}) => {
  await page.route("**/accounts/*/history/v2*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        ordersEnvelope([
          {
            time_ms: 1_782_000_000_000,
            instrument: "S-1",
            side: "buy",
            amount: "100",
            price: "1",
            status: "filled",
            kind: "option",
            role: "taker",
          },
        ]),
      ),
    }),
  );
  await installConnectedWallet(page);
  await page.goto("/history");
  await connectWallet(page);
  // Trades is the default tab. We assert the header does NOT carry a
  // Reason column — fills don't have a `cancel_reason` field and we
  // explicitly do not display one.
  await expect(page.getByTestId("history-col-trades-reason")).toHaveCount(0);
});

test("refresh + REST resync updates the visible reason after backend changes it", async ({
  page,
}) => {
  // Count orders-tab fetches specifically: trades-tab pre-load on
  // landing the page bumps the global call counter, so we'd
  // otherwise be one ahead of the user's perception.
  let ordersFetches = 0;
  await page.route("**/accounts/*/history/v2*", (route) => {
    const tab = new URL(route.request().url()).searchParams.get("tab") ?? "trades";
    if (tab !== "orders") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ordersEnvelope([])),
      });
    }
    ordersFetches += 1;
    const items =
      ordersFetches === 1
        ? [{
            time_ms: 1_782_000_000_000,
            instrument: "S-1",
            side: "buy",
            order_type: "ioc",
            amount: "100000000",
            filled: "30000000",
            status: "cancelled",
          }]
        : [{
            time_ms: 1_782_000_000_000,
            instrument: "S-1",
            side: "buy",
            order_type: "ioc",
            amount: "100000000",
            filled: "100000000",
            status: "filled",
          }];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ordersEnvelope(items)),
    });
  });
  await gotoOrdersTab(page);
  const row = page.getByTestId("history-row-orders-0");
  const cellBefore = row.locator("[data-reason-code]").first();
  await expect(cellBefore).toHaveAttribute(
    "data-reason-code",
    "ioc_remainder_cancelled",
  );
  // Manual refresh button drives the second orders-tab fetch (same
  // code path the lifecycle banner uses on click).
  await page.getByTestId("history-refresh-button").click();
  // After refetch the row shows the filled status; reason cell empty.
  await expect(row.locator("[data-reason-code]")).toHaveCount(0);
});
