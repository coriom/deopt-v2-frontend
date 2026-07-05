/**
 * options-rfq-trades-feed-v1.spec.ts
 *
 * Pins the default (flag-off) posture of the RFQ trades feed after
 * `OPTIONS-RFQ-TRADES-FEED-V1`. Under
 * `NEXT_PUBLIC_OPTIONS_RFQ_ENABLED=false` (the CI default):
 *
 *   - Trades tab renders the disabled-environment copy.
 *   - No `GET /options/rfq-fills` request fires.
 *   - No session-local caveat text remains.
 *   - No fake trade rows are rendered anywhere.
 *
 * Flag-on behavior is validated by the backend contract tests
 * (8 assertions covering empty, populated, filters, limit, and
 * no-signature leak) plus operator smoke docs.
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("default build: Trades tab shows the disabled-environment copy", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-trades").click();
  const disabled = page.getByTestId("rfq-strategy-trades-disabled");
  await expect(disabled).toBeVisible();
  await expect(disabled).toContainText(/not enabled/i);
});

test("default build: no /options/rfq-fills request fires on any interaction", async ({
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
  await page.getByTestId("rfq-strategy-tab-book").click();
  await page.getByTestId("rfq-strategy-tab-trades").click();
  await page.getByTestId("rfq-strategy-tab-greeks").click();
  await page.getByTestId("rfq-strategy-tab-payoff").click();
  await page.waitForTimeout(400);
  expect(rfqFillsCalls).toEqual([]);
});

test("default build: no fake trade rows anywhere", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-trades").click();
  await expect(
    page.locator('[data-testid^="rfq-strategy-trades-row-"]'),
  ).toHaveCount(0);
});

test("default build: Trades tab does NOT carry the old session-local caveat", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-trades").click();
  const body = page.getByTestId("rfq-strategy-tab-body-trades");
  // Old milestone-era copy pointed at OPTIONS-RFQ-TRADES-FEED-V1
  // as a *future* milestone. Now that this milestone has shipped,
  // that pointer MUST NOT appear in the disabled-state copy.
  await expect(body).not.toContainText("OPTIONS-RFQ-TRADES-FEED-V1");
  // Old "Session-local" note removed.
  await expect(body).not.toContainText(/session-local/i);
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

test("default build: /options still loads (no regression)", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/options");
  await expect(page.getByTestId("options-shell")).toBeVisible();
});

test("default build: Book tab keeps the disabled-environment copy (no regression)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-book").click();
  await expect(page.getByTestId("rfq-strategy-book-disabled")).toBeVisible();
});

test("default build: Copy strategy still works with zero network mutation", async ({
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
