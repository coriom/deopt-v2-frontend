/**
 * fundings-v1.spec.ts — FRONTEND-FUNDINGS-PAGE-V1
 *
 * The `/fundings` page is a minimal DeOpt funding overview. Backend
 * has no funding endpoint yet, so every numeric cell renders `—`
 * and every row carries a single muted `Planned` pill. Symbols match
 * the backend's seeded perp markets exactly (BTC-PERP + ETH-PERP).
 */
import { test, expect } from "@playwright/test";
import { expectNoPositiveClaimsOrLeaks } from "./copy-claims";

test("/fundings renders the four shell sections", async ({ page }) => {
  await page.goto("/fundings");
  for (const id of [
    "fundings-page",
    "fundings-page-header",
    "fundings-period-selector",
    "fundings-overview",
    "fundings-overview-table",
    "fundings-account-panel",
    "fundings-methodology-note",
  ]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
});

test("/fundings period selector is rendered disabled", async ({ page }) => {
  await page.goto("/fundings");
  const select = page.getByTestId("fundings-period-selector").locator("select");
  await expect(select).toBeDisabled();
});

test("/fundings overview table lists BTC-PERP + ETH-PERP with `—` cells and Planned pill", async ({
  page,
}) => {
  await page.goto("/fundings");
  for (const [i, symbol] of [
    [0, "BTC-PERP"],
    [1, "ETH-PERP"],
  ] as const) {
    const row = page.getByTestId(`fundings-overview-row-${i}`);
    await expect(row).toContainText(symbol);
    // Three numeric cells, all `—`
    const text = (await row.textContent()) ?? "";
    expect((text.match(/—/g) ?? []).length).toBeGreaterThanOrEqual(3);
    // Row carries a Planned pill and both action buttons.
    await expect(row).toContainText(/Planned/);
    await expect(
      page.getByTestId(`fundings-action-perps-${symbol}`),
    ).toHaveAttribute("href", new RegExp(`/perps\\?symbol=${symbol}`));
    await expect(
      page.getByTestId(`fundings-action-options-${symbol}`),
    ).toHaveAttribute(
      "href",
      new RegExp(`/options\\?underlying=${symbol.replace("-PERP", "")}`),
    );
  }
});

test("/fundings account panel shows the wallet-disconnected hint", async ({
  page,
}) => {
  await page.goto("/fundings");
  await expect(page.getByTestId("fundings-account-state")).toContainText(
    /Connect wallet to view account funding payments/i,
  );
});

test("/fundings methodology note + docs link", async ({ page }) => {
  await page.goto("/fundings");
  await expect(page.getByTestId("fundings-methodology-note")).toContainText(
    /Options positions do not pay periodic funding/i,
  );
  const href = await page
    .getByTestId("fundings-methodology-docs-link")
    .getAttribute("href");
  expect(href ?? "").toMatch(/^https?:\/\//);
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
  await expectNoPositiveClaimsOrLeaks(page);
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
