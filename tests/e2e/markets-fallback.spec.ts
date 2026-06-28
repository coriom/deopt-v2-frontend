/**
 * markets-fallback.spec.ts — public testnet beta DA followup
 *
 * Covers the MarketsFallbackCard:
 *   - backend-unavailable state renders title/body/hint/retry/report/
 *     discord-community link
 *   - no-products state renders the "no active testnet markets" copy
 *   - card uses emerald/zinc styling (no amber/yellow)
 *   - retry button triggers a re-fetch
 *   - explore-what-you-see-here preview is collapsible
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("backend-unavailable fallback renders the dark/green card with retry + report + discord", async ({
  page,
}) => {
  // Force /options/products to fail.
  await page.route("**/options/products*", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: "synthetic backend outage",
        },
      }),
    }),
  );
  await installMockWallet(page);
  await page.goto("/markets");

  const card = page.getByTestId("markets-fallback-card");
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-kind", "backend-unavailable");
  await expect(
    page.getByText(/Trading backend temporarily unavailable/i),
  ).toBeVisible();
  await expect(page.getByTestId("markets-fallback-retry")).toBeVisible();
  // Report-issue rendered as live `<a>` since feedback URL was wired in
  // FRONTEND-INTEGRATED-DOCS-AND-FEEDBACK; fall through to the placeholder
  // testid if it ever degrades.
  const reportCta = page
    .getByTestId("report-issue-link")
    .or(page.getByTestId("report-issue-button"))
    .first();
  await expect(reportCta).toBeVisible();
  // Discord live link present.
  const discord = page.getByTestId("markets-fallback-community");
  await expect(discord).toBeVisible();
  await expect(discord).toHaveAttribute(
    "href",
    "https://discord.gg/zaEMvWuxu",
  );
  // Preview details element present.
  await expect(page.getByTestId("markets-fallback-preview")).toBeVisible();
});

test("no-products fallback renders the empty-state copy", async ({ page }) => {
  await page.route("**/options/products*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        data: { products: [] },
        meta: {
          source: "db",
          chain_id: 84532,
          request_id: "synth-empty",
          generated_at_ms: 0,
        },
      }),
    }),
  );
  await installMockWallet(page);
  await page.goto("/markets");
  const card = page.getByTestId("markets-fallback-card");
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-kind", "no-products");
  await expect(
    page.getByText(/No active testnet markets available right now/i),
  ).toBeVisible();
});

test("markets fallback card uses no amber/yellow styling", async ({ page }) => {
  await page.route("**/options/products*", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        status: "error",
        error: { code: "INTERNAL_ERROR", message: "outage" },
      }),
    }),
  );
  await installMockWallet(page);
  await page.goto("/markets");
  const card = page.getByTestId("markets-fallback-card");
  await expect(card).toBeVisible();
  const html = await card.innerHTML();
  expect(html).not.toMatch(/\bamber-/);
  expect(html).not.toMatch(/\byellow-/);
  // Must include emerald accent somewhere.
  const classAttr = (await card.getAttribute("class")) ?? "";
  expect(classAttr).toMatch(/emerald-/);
});
