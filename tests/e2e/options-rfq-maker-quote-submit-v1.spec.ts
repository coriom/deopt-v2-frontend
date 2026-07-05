/**
 * options-rfq-maker-quote-submit-v1.spec.ts
 *
 * Pins the default (flag-off) posture of the maker quote submit
 * flow after `OPTIONS-RFQ-MAKER-QUOTE-SUBMIT-V1`. Under
 * `NEXT_PUBLIC_OPTIONS_RFQ_ENABLED=false` (the CI default):
 *
 *   - No maker quote form is rendered anywhere.
 *   - No `POST /options/rfqs/{id}/quote-signing-payload` fires.
 *   - No `POST /options/rfqs/{id}/quotes` fires.
 *   - Book tab remains its "not enabled in this environment" copy.
 *   - Trades tab / accept flow / cancel flow are untouched.
 *
 * Flag-on wiring is validated by node contract tests (canonical
 * OPTION_RFQ_QUOTE_SUBMIT bytes frozen) and by manual operator
 * smoke against a real backend with `OPTION_RFQ_ENABLED=true`.
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("default build: maker quote form is never rendered", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-book").click();
  await expect(
    page.getByTestId("rfq-strategy-maker-quote-form"),
  ).toHaveCount(0);
});

test("default build: no quote-signing-payload or submit-quote mutations fire", async ({
  page,
}) => {
  await installMockWallet(page);
  const mutations: string[] = [];
  page.on("request", (req) => {
    const m = req.method();
    const url = req.url();
    if (
      m !== "GET" &&
      m !== "HEAD" &&
      m !== "OPTIONS" &&
      (url.includes("/quote-signing-payload") ||
        url.includes("/options/rfqs") ||
        url.includes("/auth/write-challenges"))
    ) {
      mutations.push(`${m} ${url}`);
    }
  });
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-book").click();
  await page.getByTestId("rfq-strategy-tab-trades").click();
  await page.getByTestId("rfq-strategy-tab-payoff").click();
  await page.waitForTimeout(400);
  expect(mutations).toEqual([]);
});

test("default build: maker quote submit CTA is never rendered", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-book").click();
  await expect(
    page.getByTestId("rfq-strategy-maker-quote-submit"),
  ).toHaveCount(0);
});

test("default build: Book tab still shows the disabled-environment copy", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-book").click();
  await expect(page.getByTestId("rfq-strategy-book-disabled")).toBeVisible();
});

test("default build: no data-view-role attribute leaks (Book quotes wrapper never mounts)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-book").click();
  await expect(page.getByTestId("rfq-strategy-book-quotes")).toHaveCount(0);
});

test("default build: Trades tab still shows the disabled-environment copy", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-trades").click();
  await expect(page.getByTestId("rfq-strategy-trades-disabled")).toBeVisible();
});

test("default build: Accept CTA / accept modal remain absent", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-book").click();
  await expect(page.getByTestId("rfq-accept-modal")).toHaveCount(0);
  await expect(
    page.locator('[data-testid^="rfq-strategy-book-accept-"]'),
  ).toHaveCount(0);
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

test("default build: /options still loads (Options behavior does not regress)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/options");
  await expect(page.getByTestId("options-shell")).toBeVisible();
});
