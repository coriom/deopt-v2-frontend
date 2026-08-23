// FRONTEND-OPTIONS-DIRECT-ORDERBOOK-V1 — workspace Trade widget e2e.
//
// The workspace `trade` widget's Orderbook mode renders the shared
// DirectOrderbookForm. This spec pins the RFQ-swap honesty check
// (switching to RFQ removes the orderbook TIF / post controls and
// never reaches the orderbook endpoint).
//
// Full TIF / post-only submission coverage lives at the backend
// (`cargo test --test options_tests`). End-to-end submit coverage
// via the widget was removed with the tester-only Advanced series
// id fallback — chain-click is now the only path to seed a leg.

import { test, expect } from "@playwright/test";
import {
  installConnectedWallet,
  connectWallet,
  mockWriteAuthChallenge,
} from "./wallet-helpers";

async function gotoTradeOrderbook(page: import("@playwright/test").Page) {
  await installConnectedWallet(page);
  await mockWriteAuthChallenge(page);
  await page.goto("/options");
  await connectWallet(page);
  await expect(page.getByTestId("widget-trade")).toBeVisible();
  await expect(page.getByTestId("trade-body-orderbook")).toBeVisible();
  await expect(page.getByTestId("direct-orderbook-form")).toBeVisible();
}

test.describe("Trade workspace widget — direct orderbook end-to-end", () => {
  test("RFQ mode swap removes TIF / post-only controls (honesty check)", async ({
    page,
  }) => {
    let intercepted = false;
    await page.route("**/options/orders", async (route) => {
      intercepted = true;
      await route.fulfill({ status: 500, body: "{}" });
    });
    await gotoTradeOrderbook(page);
    await page.getByTestId("trade-mode-select").selectOption("rfq");
    // OPTIONS-CHAIN-MULTISELECT-EXECUTION-UX-V1 — with 0 legs + rfq
    // requested, the body is either the honest `rfq_disabled`
    // blocker (flag off) or the single-leg `trade-body-rfq` (flag
    // on). Both count as "not orderbook" — the goal of this
    // honesty test is that switching to RFQ REMOVES the orderbook
    // TIF/post controls, not that a specific RFQ body renders.
    await expect(page.getByTestId("trade-body-orderbook")).toHaveCount(0);
    await expect(page.getByTestId("direct-orderbook-tif-trigger")).toHaveCount(
      0,
    );
    await expect(
      page.getByTestId("direct-orderbook-post-checkbox"),
    ).toHaveCount(0);
    // RFQ mode must never reach the orderbook endpoint.
    expect(intercepted).toBe(false);
  });
});
