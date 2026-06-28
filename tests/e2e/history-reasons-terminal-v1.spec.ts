/**
 * history-reasons-terminal-v1.spec.ts — HISTORY-V2-TERMINAL-REASONS-V1
 *
 * Pins the new wire contract on the `/history` Orders tab:
 *
 *   * a row with `terminal_reason_code: "user_cancelled"` renders that
 *     code (not the bare `cancelled` fallback);
 *   * the persisted code WINS over TIF-derived inference even when
 *     inference would have picked a different code;
 *   * the persisted `terminal_reason_source` is surfaced on the DOM
 *     so tests / debug tooling can pin the persisted-vs-inferred
 *     distinction;
 *   * an unknown persisted code degrades safely (raw token rendered,
 *     warning severity);
 *   * REST resync after the refresh banner updates the visible reason
 *     when the backend flips it (e.g. system migrates a row from a
 *     TIF-inferred code to a real persisted user-cancel reason).
 *
 * Backend population today: user cancel (`user_cancelled` / `user`) and
 * IOC remainder cancel (`ioc_remainder_cancelled` / `tif_policy`).
 * Pre-persistence rejections (post-only, FOK) never enter the DB and
 * therefore never carry a persisted code — the existing TIF-inference
 * tests in `history-reasons-v1.spec.ts` already cover that fallback
 * for legacy rows.
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

test("Orders tab renders persisted `user_cancelled` (not the bare `cancelled` fallback)", async ({
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
            status: "cancelled",
            terminal_reason_code: "user_cancelled",
            terminal_reason_source: "user",
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
  await expect(cell).toHaveAttribute("data-reason-code", "user_cancelled");
  await expect(cell).toHaveAttribute("data-reason-severity", "info");
  await expect(cell).toHaveAttribute("data-reason-source", "user");
});

test("Persisted reason wins over TIF inference (same row would otherwise infer differently)", async ({
  page,
}) => {
  // The row pattern (cancelled IOC with unfilled remainder) would
  // OTHERWISE be inferred as `ioc_remainder_cancelled`. The backend
  // claims `user_cancelled` instead; the persisted value must win.
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
            terminal_reason_code: "user_cancelled",
            terminal_reason_source: "user",
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
  await expect(cell).toHaveAttribute("data-reason-code", "user_cancelled");
  await expect(cell).toHaveAttribute("data-reason-source", "user");
});

test("Persisted `ioc_remainder_cancelled` is tagged with source `tif_policy`", async ({
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
            terminal_reason_code: "ioc_remainder_cancelled",
            terminal_reason_source: "tif_policy",
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
  await expect(cell).toHaveAttribute(
    "data-reason-code",
    "ioc_remainder_cancelled",
  );
  await expect(cell).toHaveAttribute("data-reason-source", "tif_policy");
});

test("Unknown persisted code renders the raw token + warning severity (no fabrication)", async ({
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
            status: "cancelled",
            terminal_reason_code: "future_unknown_code",
            terminal_reason_source: "system",
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
  await expect(cell).toHaveAttribute(
    "data-reason-code",
    "future_unknown_code",
  );
  await expect(cell).toHaveAttribute("data-reason-severity", "warning");
  await expect(cell).toHaveAttribute("data-reason-source", "system");
});

test("Refresh banner + REST resync flips an inferred reason to its persisted equivalent", async ({
  page,
}) => {
  // First fetch: row has no persisted reason (legacy row) → frontend
  // infers `ioc_remainder_cancelled` from TIF.
  // Second fetch (after backfill / refresh): backend now stamps a
  // persisted `user_cancelled` reason → frontend MUST switch to the
  // persisted value, including the `data-reason-source` tag.
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
            filled: "30000000",
            status: "cancelled",
            terminal_reason_code: "user_cancelled",
            terminal_reason_source: "user",
          }];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ordersEnvelope(items)),
    });
  });
  await gotoOrdersTab(page);
  const cell = page
    .getByTestId("history-row-orders-0")
    .locator("[data-reason-code]")
    .first();
  await expect(cell).toHaveAttribute(
    "data-reason-code",
    "ioc_remainder_cancelled",
  );
  await expect(cell).not.toHaveAttribute("data-reason-source", /.+/);
  await page.getByTestId("history-refresh-button").click();
  await expect(cell).toHaveAttribute("data-reason-code", "user_cancelled");
  await expect(cell).toHaveAttribute("data-reason-source", "user");
});
