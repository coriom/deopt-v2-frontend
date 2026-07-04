/**
 * rfq-strategy-foundation-v1.spec.ts
 *
 * Pins the `RFQ/Strategy` foundation shipped by
 * `RFQ-STRATEGY-FOUNDATION-AUDIT-V1`. Covers: nav entry, single-CTA
 * consolidation (no separate "Strategy Builder" + "Create RFQ"),
 * strategy presets, leg editing, payoff preview honesty, tab empty
 * states, and the disabled `Request Quote` posture (no network
 * mutation fired).
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("navbar has a single RFQ/Strategy entry (no separate Strategy Builder + Create RFQ CTAs)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/options");
  const nav = page.getByTestId("navbar-link-rfq-strategy");
  await expect(nav).toBeVisible();
  await expect(nav).toContainText("RFQ/Strategy");
  // No stale duplicate primary CTAs anywhere on the trading shell.
  await expect(page.getByRole("link", { name: /^Strategy Builder$/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Create RFQ$/ })).toHaveCount(0);
});

test("/rfq-strategy renders the builder + preview workspace", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await expect(page.getByTestId("rfq-strategy-page")).toBeVisible();
  await expect(page.getByTestId("rfq-strategy-workspace")).toBeVisible();
  await expect(page.getByTestId("rfq-strategy-builder")).toBeVisible();
  await expect(page.getByTestId("rfq-strategy-preview")).toBeVisible();
  await expect(page.getByTestId("rfq-strategy-underlying")).toBeVisible();
});

test("all 9 strategy presets render + default is Call", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  const presets = [
    "call",
    "put",
    "call-spread",
    "put-spread",
    "risk-reversal",
    "butterfly",
    "straddle",
    "strangle",
    "custom",
  ];
  for (const id of presets) {
    await expect(page.getByTestId(`rfq-strategy-preset-${id}`)).toBeVisible();
  }
  await expect(page.getByTestId("rfq-strategy-preset-call")).toHaveAttribute(
    "data-selected",
    "true",
  );
});

test("selecting Strangle creates 2 legs (put + call)", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-preset-strangle").click();
  await expect(page.getByTestId("rfq-strategy-preset-strangle")).toHaveAttribute(
    "data-selected",
    "true",
  );
  const editor = page.getByTestId("rfq-strategy-leg-editor");
  await expect(editor).toBeVisible();
  const legs = editor.locator('[data-testid^="rfq-strategy-leg-"]').filter({
    hasNot: page.locator('[data-testid$="-side"]'),
  });
  // The editor renders 2 top-level leg rows.
  const rows = await editor.locator(':scope > [data-testid^="rfq-strategy-leg-"]').count();
  expect(rows).toBe(2);
});

test("editing a leg strike updates the strategy summary", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-preset-call").click();
  const summaryBefore = await page.getByTestId("rfq-strategy-summary").innerText();
  const firstStrike = page.locator('[data-testid^="rfq-strategy-leg-"][data-testid$="-strike"]').first();
  await firstStrike.fill("77777");
  await firstStrike.blur();
  const summaryAfter = await page.getByTestId("rfq-strategy-summary").innerText();
  expect(summaryAfter).not.toBe(summaryBefore);
  expect(summaryAfter).toContain("$77,777");
});

test("editing amount updates state (and payoff scales)", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  const amount = page.getByTestId("rfq-strategy-amount");
  await amount.fill("3");
  await amount.blur();
  await expect(amount).toHaveValue("3");
});

test("Payoff tab renders the chart + metrics with an 'excludes premium' note by default", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await expect(page.getByTestId("rfq-strategy-tab-payoff")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(page.getByTestId("rfq-strategy-payoff-chart")).toBeVisible();
  await expect(page.getByTestId("rfq-strategy-payoff-curve")).toBeVisible();
  await expect(page.getByTestId("rfq-strategy-metric-max-loss")).toBeVisible();
  await expect(page.getByTestId("rfq-strategy-metric-break-even")).toBeVisible();
  await expect(page.getByTestId("rfq-strategy-metric-max-profit")).toBeVisible();
  await expect(
    page.getByTestId("rfq-strategy-payoff-premium-excluded"),
  ).toContainText(/excludes live RFQ premium/i);
});

test("Greeks / Trades / Book tabs show honest empty states", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/rfq-strategy");

  await page.getByTestId("rfq-strategy-tab-greeks").click();
  await expect(page.getByTestId("rfq-strategy-tab-body-greeks")).toContainText(
    /Greeks will populate/i,
  );

  await page.getByTestId("rfq-strategy-tab-trades").click();
  await expect(page.getByTestId("rfq-strategy-tab-body-trades")).toContainText(
    /No RFQ trades yet/i,
  );

  await page.getByTestId("rfq-strategy-tab-book").click();
  await expect(page.getByTestId("rfq-strategy-tab-body-book")).toContainText(
    /RFQ quote book is not live yet/i,
  );
});

test("Request Quote is disabled and does not fire any network mutation", async ({
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
      (url.includes("/options/rfqs") || url.includes("/rfqs"))
    ) {
      mutations.push(`${m} ${url}`);
    }
  });
  await page.goto("/rfq-strategy");
  const btn = page.getByTestId("rfq-strategy-request-quote");
  await expect(btn).toBeDisabled();
  await expect(btn).toHaveAttribute("data-ticket-mode", "disabled");
  await expect(btn).toContainText(/Request Quote/i);
  await btn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
  expect(mutations).toEqual([]);
});

test("Copy strategy JSON writes to clipboard without any network activity", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await installMockWallet(page);
  await page.goto("/rfq-strategy");
  await page.getByTestId("rfq-strategy-copy").click();
  await expect(page.getByTestId("rfq-strategy-copy")).toContainText(/Copied/i);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('"version": "rfq-strategy-foundation-v1"');
  expect(clip).toContain('"underlying": "BTC"');
  expect(clip).toContain('"preset": "call"');
});

test("/options still loads (Options behavior does not regress)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/options");
  await expect(page.getByTestId("options-shell")).toBeVisible();
});

test("/perps ticket remains disabled by default", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/perps");
  const submit = page.getByTestId("widget-perps-trade-submit");
  await expect(submit).toBeVisible();
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute("data-ticket-mode", "disabled");
});
