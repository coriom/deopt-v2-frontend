/**
 * options-rfq-create-and-lifecycle-v1.spec.ts
 *
 * Pins the flag-gated behavior of the `/rfq-strategy` workspace after
 * `OPTIONS-RFQ-CREATE-AND-LIFECYCLE-V1`. Under the default build
 * (`NEXT_PUBLIC_OPTIONS_RFQ_ENABLED=false`) the workspace stays
 * hard-disabled, fires zero mutation, and exposes the exact opt-out
 * copy operators rely on. Flag-on behavior is validated separately
 * by node contract tests (canonical byte freeze + flag helper).
 *
 * The test doubles down on the "no fake success" invariant: even
 * when the wallet is connected on the correct chain, the CTA
 * remains disabled by default.
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("default build: workspace exposes rfq-enabled=false attribute", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  const ws = page.getByTestId("rfq-strategy-workspace");
  await expect(ws).toBeVisible();
  await expect(ws).toHaveAttribute("data-rfq-enabled", "false");
});

test("default build: Request Quote is disabled with an honest 'not enabled' label", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  const btn = page.getByTestId("rfq-strategy-request-quote");
  await expect(btn).toBeDisabled();
  await expect(btn).toHaveAttribute("data-ticket-mode", "disabled");
  await expect(btn).toContainText(/not enabled/i);
});

test("default build: disabled note references the exact env var", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  const note = page.getByTestId("rfq-strategy-disabled-note");
  await expect(note).toBeVisible();
  await expect(note).toContainText("NEXT_PUBLIC_OPTIONS_RFQ_ENABLED=false");
});

test("default build: no /options/rfqs or /options/series mutations fire", async ({
  page,
}) => {
  await installMockWallet(page);
  const mutations: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    const m = req.method();
    if (
      m !== "GET" &&
      m !== "HEAD" &&
      m !== "OPTIONS" &&
      (url.includes("/options/rfqs") ||
        url.includes("/rfqs") ||
        url.includes("/options/series") ||
        url.includes("/auth/write-challenges"))
    ) {
      mutations.push(`${m} ${url}`);
    }
  });
  await page.goto("/rfq-strategy");
  const btn = page.getByTestId("rfq-strategy-request-quote");
  await btn.click({ force: true }).catch(() => {});
  // Tab through Book so the read-only branch runs its useEffect.
  await page.getByTestId("rfq-strategy-tab-book").click();
  await page.waitForTimeout(500);
  expect(mutations).toEqual([]);
});

test("default build: Book tab shows the disabled-environment message", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-book").click();
  await expect(page.getByTestId("rfq-strategy-book-disabled")).toBeVisible();
  await expect(page.getByTestId("rfq-strategy-book-disabled")).toContainText(
    /not enabled/i,
  );
});

test("default build: RFQ status panel is NOT rendered", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await expect(
    page.getByTestId("rfq-strategy-status-panel"),
  ).toHaveCount(0);
});

test("default build: Trades tab renders the honest disabled-environment state (no fake fills)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-tab-trades").click();
  // After OPTIONS-RFQ-QUOTE-SIGNING-ACCEPT-V1 the disabled-state
  // copy no longer names a specific follow-up milestone; the
  // honesty guarantee is now "not enabled + no fake rows".
  await expect(page.getByTestId("rfq-strategy-trades-disabled")).toBeVisible();
  await expect(
    page.locator('[data-testid^="rfq-strategy-trades-row-"]'),
  ).toHaveCount(0);
});

test("default build: Copy strategy still works (no network activity)", async ({
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
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('"preset": "call"');
  expect(mutations).toEqual([]);
});

test("default build: /options still loads (Options behavior does not regress)", async ({
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

test("multi-leg preset selection does not enable Request Quote", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-preset-strangle").click();
  const btn = page.getByTestId("rfq-strategy-request-quote");
  await expect(btn).toBeDisabled();
});
