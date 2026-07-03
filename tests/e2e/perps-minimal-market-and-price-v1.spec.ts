/**
 * perps-minimal-market-and-price-v1.spec.ts
 *
 * PERPS-MINIMAL-MARKET-AND-PRICE-V1 — asserts the /perps stats widget
 * consumes the new read-only backend endpoint honestly:
 *
 *   * price=ok  → mark + index cells render the formatted number and
 *                 the body attribute reads `data-perps-price-state="ok"`.
 *   * price=stale → cells still render the number but the tag reads
 *                 `stale` (visual cue for the operator).
 *   * price=503   → cells stay `—`, tag reads `unavailable`. No
 *                   fabricated number in the DOM.
 *
 * The "Perps · not live" banner + hard-disabled submit MUST remain
 * unchanged regardless of backend price state.
 */
import { test, expect, type Page } from "@playwright/test";

async function stubPerpsPrice(
  page: Page,
  handler: (route: import("@playwright/test").Route) => unknown | Promise<unknown>,
) {
  await page.route("**/perps/markets/*/price", handler);
}

async function gotoPerps(page: Page) {
  await page.goto("/perps");
  await expect(page.getByTestId("widget-perps-stats-body")).toBeVisible({
    timeout: 10_000,
  });
}

test.describe("PERPS-MINIMAL-MARKET-AND-PRICE-V1", () => {
  test("live oracle snapshot renders mark + index in the stats bar", async ({
    page,
  }) => {
    await stubPerpsPrice(page, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          market_id: "BTC-PERP",
          // 65,000.00 in 1e8
          index_price_1e8: "6500000000000",
          mark_price_1e8: "6500000000000",
          oracle_timestamp_ms: Date.now(),
          source: "oracle_router",
          stale: false,
          trading_enabled: false,
          chain_id: 84532,
        }),
      }),
    );
    await gotoPerps(page);
    const body = page.getByTestId("widget-perps-stats-body");
    await expect(body).toHaveAttribute("data-perps-price-state", "ok", {
      timeout: 5_000,
    });
    await expect(page.getByTestId("widget-perps-stat-mark")).toContainText(
      "65,000.00",
    );
    await expect(page.getByTestId("widget-perps-stat-index")).toContainText(
      "65,000.00",
    );
    // Un-wired cells still render `—` honestly (funding + OI are
    // deferred to their own milestones).
    for (const id of [
      "widget-perps-stat-change-24h",
      "widget-perps-stat-volume-24h",
      "widget-perps-stat-funding",
      "widget-perps-stat-next-funding",
      "widget-perps-stat-open-interest",
    ]) {
      await expect(page.getByTestId(id)).toContainText("—");
    }
    // Not-live posture is preserved end-to-end.
    await expect(page.getByTestId("perps-not-live-banner")).toBeVisible();
  });

  test("stale price flag tags the widget without hiding the number", async ({
    page,
  }) => {
    await stubPerpsPrice(page, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          market_id: "BTC-PERP",
          index_price_1e8: "6500000000000",
          mark_price_1e8: "6500000000000",
          oracle_timestamp_ms: 1_000, // ancient
          source: "oracle_router",
          stale: true,
          trading_enabled: false,
          chain_id: 84532,
        }),
      }),
    );
    await gotoPerps(page);
    const body = page.getByTestId("widget-perps-stats-body");
    await expect(body).toHaveAttribute("data-perps-price-state", "stale", {
      timeout: 5_000,
    });
    // Number is still surfaced honestly, but the tag lets the UI dim
    // it so the operator sees the freshness signal.
    await expect(page.getByTestId("widget-perps-stat-mark")).toContainText(
      "65,000.00",
    );
  });

  test("backend 503 → cells stay `—` and no fabricated number leaks", async ({
    page,
  }) => {
    await stubPerpsPrice(page, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "perps read layer is disabled or not configured",
        }),
      }),
    );
    await gotoPerps(page);
    const body = page.getByTestId("widget-perps-stats-body");
    await expect(body).toHaveAttribute("data-perps-price-state", "unavailable", {
      timeout: 5_000,
    });
    // Anti-leak scan: every cell renders TWO spans — a static uppercase
    // label ("MARK", "24H Δ", …) plus the value. We assert on the
    // value span only (the last `<span>` in the cell) so labels
    // containing digits like "24H" don't false-positive the leak
    // scan. Value must be `—` and nothing else.
    for (const id of [
      "widget-perps-stat-mark",
      "widget-perps-stat-index",
      "widget-perps-stat-change-24h",
      "widget-perps-stat-volume-24h",
      "widget-perps-stat-funding",
      "widget-perps-stat-next-funding",
      "widget-perps-stat-open-interest",
    ]) {
      const valueSpan = page.getByTestId(id).locator("span").last();
      await expect(valueSpan).toHaveText("—");
    }
  });

  test("perps submit remains hard-disabled regardless of live price", async ({
    page,
  }) => {
    await stubPerpsPrice(page, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          market_id: "BTC-PERP",
          index_price_1e8: "6500000000000",
          mark_price_1e8: "6500000000000",
          oracle_timestamp_ms: Date.now(),
          source: "oracle_router",
          stale: false,
          trading_enabled: false,
          chain_id: 84532,
        }),
      }),
    );
    await gotoPerps(page);
    // The submit button is the primary regression pin. Copy: "Perps
    // not live" — must never say "Buy", "Sell", "Submit", or similar.
    const submit = page.locator(
      'button:has-text("Perps not live")',
    );
    await expect(submit.first()).toBeVisible();
    await expect(submit.first()).toBeDisabled();
  });
});
