/**
 * fundings-v1.spec.ts — FRONTEND-FUNDINGS-PAGE-V1
 *
 * The `/fundings` page is a minimal honest landing. Perps are not
 * live, so the Market Funding table renders `Planned` rows with `—`
 * placeholders and the Account Funding table is empty. No fake
 * rates, no synthetic timestamps, no marketing copy.
 */
import { test, expect } from "@playwright/test";

test("/fundings renders the four shell sections", async ({ page }) => {
  await page.goto("/fundings");
  for (const id of [
    "fundings-page",
    "fundings-page-header",
    "fundings-quicklinks",
    "fundings-status-strip",
    "fundings-market-section",
    "fundings-market-table",
    "fundings-account-section",
    "fundings-account-table",
    "fundings-methodology",
  ]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
});

test("/fundings header carries the required quick links", async ({ page }) => {
  await page.goto("/fundings");
  const docs = await page.getByTestId("fundings-quicklink-docs").getAttribute("href");
  expect(docs ?? "").toMatch(/^https?:\/\//);
  await expect(page.getByTestId("fundings-quicklink-perps")).toHaveAttribute(
    "href",
    "/perps",
  );
  await expect(page.getByTestId("fundings-quicklink-fees")).toHaveAttribute(
    "href",
    "/fees",
  );
});

test("/fundings status strip shows honest defaults", async ({ page }) => {
  await page.goto("/fundings");
  await expect(page.getByTestId("fundings-status-perps")).toContainText(/Not live/);
  await expect(page.getByTestId("fundings-status-options")).toContainText(
    /No funding/,
  );
  await expect(page.getByTestId("fundings-status-account")).toContainText(
    /Wallet not connected/,
  );
});

test("/fundings Market table lists BTC-PERP and ETH-PERP as Planned with `—` cells", async ({
  page,
}) => {
  await page.goto("/fundings");
  for (const [i, market] of [
    [0, "BTC-PERP"],
    [1, "ETH-PERP"],
  ] as const) {
    const row = page.getByTestId(`fundings-market-row-${i}`);
    await expect(row).toContainText(market);
    await expect(row).toContainText(/Planned/);
    // Three `—` cells (rate / next / 24h avg).
    const dashes = (await row.textContent()) ?? "";
    expect((dashes.match(/—/g) ?? []).length).toBeGreaterThanOrEqual(3);
  }
});

test("/fundings Account table shows the wallet-disconnected empty state", async ({
  page,
}) => {
  await page.goto("/fundings");
  await expect(page.getByTestId("fundings-account-empty")).toContainText(
    /Connect wallet to view account funding payments/i,
  );
});

test("/fundings Methodology card shows 3 bullets + docs link", async ({
  page,
}) => {
  await page.goto("/fundings");
  const m = page.getByTestId("fundings-methodology");
  await expect(m).toContainText(/perpetual markets/i);
  await expect(m).toContainText(/Longs or shorts may pay/i);
  await expect(m).toContainText(/Options positions do not pay/i);
  const docsHref = await page
    .getByTestId("fundings-methodology-docs-link")
    .getAttribute("href");
  expect(docsHref ?? "").toMatch(/^https?:\/\//);
});

test("/fundings does not render the bottom public-beta marketing footer", async ({
  page,
}) => {
  await page.goto("/fundings");
  await expect(page.getByTestId("public-beta-footer")).toHaveCount(0);
});

test("/fundings does not introduce amber / yellow / orange brand classes", async ({
  page,
}) => {
  await page.goto("/fundings");
  const html = await page.content();
  expect(html).not.toMatch(/\bamber-[0-9]/);
  expect(html).not.toMatch(/\byellow-[0-9]/);
  expect(html).not.toMatch(/\borange-[0-9]/);
});

test("/fundings never claims mainnet-ready / audited / production-ready / safe-for-real-funds", async ({
  page,
}) => {
  await page.goto("/fundings");
  const html = await page.content();
  expect(html).not.toMatch(/\baudited\b/i);
  expect(html).not.toMatch(/mainnet[- ]ready/i);
  expect(html).not.toMatch(/production[- ]ready/i);
  expect(html).not.toMatch(/safe for real funds/i);
  expect(html).not.toMatch(/\bguaranteed\b/i);
});

test("/fundings never exposes admin / bearer / RPC / DB URLs", async ({
  page,
}) => {
  await page.goto("/fundings");
  const html = await page.content();
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(html).not.toMatch(/alchemy\.com\/v2\//);
  expect(html).not.toMatch(/infura\.io\/v3\//);
  expect(html).not.toMatch(/DATABASE_URL/);
  expect(html).not.toMatch(/\/admin\//);
  expect(html).not.toMatch(/mainnet\.base\.org/);
});

test("/fundings never mentions Deribit or Derive in the public UI", async ({
  page,
}) => {
  await page.goto("/fundings");
  const text = (await page.textContent("body")) ?? "";
  expect(text).not.toMatch(/deribit/i);
  expect(text).not.toMatch(/derive/i);
});
