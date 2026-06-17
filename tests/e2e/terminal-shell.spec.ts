/**
 * terminal-shell.spec.ts — FRONTEND-PIXEL-CANVAS-WORKSPACE-V6
 *
 * Covers the full-screen terminal shell:
 *   - /trade, /perps, /custom render `trading-main-terminal` (no
 *     marketing-style max-width gutter)
 *   - No PublicBetaFooter on terminal routes
 *   - Non-terminal trading routes (/, /markets, /portfolio) still
 *     render `trading-main` (page mode) + footer
 *   - Widget chrome carries a drag handle and remove button (V6 pixel
 *     canvas renders its own resize handle as `widget-resize-handle-*`)
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

// FRONTEND-BACKEND-HISTORY-V1: /history joined the terminal set so the
// dense table can use the full viewport (no marketing footer).
// FRONTEND-BACKEND-LEADERBOARD-V1: /leaderboard joined for the same reason.
const TERMINAL_ROUTES = [
  "/trade",
  "/perps",
  "/custom",
  "/markets",
  "/portfolio",
  "/history",
  "/leaderboard",
];
// /, /health still render the page-mode shell + footer.
const PAGE_ROUTES = ["/", "/health"];

test.describe("terminal routes use the full-screen shell", () => {
  for (const route of TERMINAL_ROUTES) {
    test(`${route} renders trading-main-terminal (no footer)`, async ({
      page,
    }) => {
      await installMockWallet(page);
      await page.goto(route);
      await expect(page.getByTestId("trading-main-terminal")).toBeVisible();
      await expect(page.getByTestId("public-beta-footer")).toHaveCount(0);
    });
  }
});

test.describe("page routes keep the original wrapper + footer", () => {
  for (const route of PAGE_ROUTES) {
    test(`${route} renders trading-main + footer`, async ({ page }) => {
      await installMockWallet(page);
      await page.goto(route);
      await expect(page.getByTestId("trading-main")).toBeVisible();
      await expect(page.getByTestId("public-beta-footer")).toBeVisible();
    });
  }
});

test("widget chrome carries a drag handle + remove button on /custom", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  const handle = page.locator("[data-testid^='widget-drag-handle-']").first();
  const remove = page.locator("[data-testid^='widget-remove-']").first();
  await expect(handle).toBeVisible();
  await expect(remove).toBeVisible();
});

test("V6 pixel-canvas resize handle is rendered for each widget on /custom", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();
  const handles = page.locator("[data-testid^='widget-resize-handle-']");
  await expect(handles.first()).toBeVisible();
});
