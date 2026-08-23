// MATCHING-TIF-SEMANTICS-OPTIONS-V1 — frontend wiring tests.
//
// End-to-end submit coverage for `/api/orderbook-sandbox` was removed
// with the tester-only Advanced series id fallback — chain-click is
// the only path to seed a leg into the shared DirectOrderbookForm now.
// TIF / post-only backend semantics remain covered by
// `cargo test --test options_tests` (88 tests).
//
// The remaining spec pins the `/api` developers console entry point
// that links to the sandbox.

import { test, expect } from "@playwright/test";

test.describe("orderbook sandbox — direct-order TIF + post-only wiring", () => {
  test("sandbox page links from /api developers console", async ({ page }) => {
    await page.goto("/api");
    await expect(
      page.getByTestId("developers-console-orderbook-sandbox-link"),
    ).toBeVisible();
  });
});
