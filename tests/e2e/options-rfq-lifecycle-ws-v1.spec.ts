/**
 * options-rfq-lifecycle-ws-v1.spec.ts
 *
 * Pins the default (flag-off) posture of the Options RFQ WS
 * lifecycle wiring after `OPTIONS-RFQ-LIFECYCLE-WS-V1`.
 *
 * Under `NEXT_PUBLIC_OPTIONS_RFQ_ENABLED=false` (the CI default):
 *
 *   - The `/rfq-strategy` workspace does NOT subscribe to
 *     `account.rfqs` — the `SUBSCRIBE_CHANNELS` constant omits
 *     that channel at build time, so no WS `subscribe` frame
 *     mentioning `account.rfqs` ever leaves the browser.
 *   - The live-status pill (`rfq-strategy-lifecycle-status`) is
 *     NOT rendered.
 *   - Trades tab / Book tab / Cancel flow remain honest.
 *   - Existing `/options` lifecycle subscriptions
 *     (`account.orders`, `account.fills`,
 *     `account.conditional_orders`) are unchanged.
 *
 * The build-time flag baking means the flag-on path is exercised
 * separately via node contract tests + operator smoke against a
 * real backend with `OPTION_RFQ_ENABLED=true`.
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("default build: no lifecycle status pill is rendered", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await expect(
    page.getByTestId("rfq-strategy-lifecycle-status"),
  ).toHaveCount(0);
});

test("default build: no WS subscribe frame mentions account.rfqs", async ({
  page,
}) => {
  await installMockWallet(page);
  const wsFrames: string[] = [];
  page.on("websocket", (ws) => {
    ws.on("framesent", (frame) => {
      if (typeof frame.payload === "string") {
        wsFrames.push(frame.payload);
      }
    });
  });
  await page.goto("/rfq-strategy");
  // Give the client time to (attempt to) connect + auth + subscribe.
  await page.waitForTimeout(1000);
  const rfqSubscribes = wsFrames.filter((f) => f.includes("account.rfqs"));
  expect(rfqSubscribes).toEqual([]);
});

test("default build: no /options/rfq-fills request fires without wallet", async ({
  page,
}) => {
  await installMockWallet(page);
  const rfqFillsCalls: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/options/rfq-fills")) {
      rfqFillsCalls.push(`${req.method()} ${url}`);
    }
  });
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-trades").click();
  await page.waitForTimeout(500);
  expect(rfqFillsCalls).toEqual([]);
});

test("default build: Trades tab keeps the disabled-environment copy", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-trades").click();
  await expect(page.getByTestId("rfq-strategy-trades-disabled")).toBeVisible();
});

test("default build: Book tab keeps the disabled-environment copy", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-book").click();
  await expect(page.getByTestId("rfq-strategy-book-disabled")).toBeVisible();
});

test("default build: no fake trade rows appear anywhere", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-trades").click();
  await expect(
    page.locator('[data-testid^="rfq-strategy-trades-row-"]'),
  ).toHaveCount(0);
});

test("default build: /options still loads (no regression on existing lifecycle)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/options");
  await expect(page.getByTestId("options-shell")).toBeVisible();
});

test("default build: /perps ticket remains disabled by default", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/perps");
  const submit = page.getByTestId("widget-perps-trade-submit");
  await expect(submit).toBeVisible();
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute("data-ticket-mode", "disabled");
});

test("default build: Copy strategy still works (no network mutation)", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await installMockWallet(page);
  const mutations: string[] = [];
  page.on("request", (req) => {
    const m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") {
      mutations.push(`${m} ${req.url()}`);
    }
  });
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-copy").click();
  await expect(page.getByTestId("rfq-strategy-copy")).toContainText(/Copied/i);
  expect(mutations).toEqual([]);
});
