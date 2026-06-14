/**
 * terminal-shell.spec.ts — FRONTEND-TERMINAL-WORKSPACE-RESIZABLE-V2
 *
 * Covers the full-screen terminal shell:
 *   - /trade, /perps, /custom render `trading-main-terminal` (no
 *     marketing-style max-width gutter)
 *   - No PublicBetaFooter on terminal routes
 *   - Non-terminal trading routes (/, /markets, /portfolio) still
 *     render `trading-main` (page mode) + footer
 *   - Widget chrome carries a drag handle and remove button (resize
 *     handle comes from react-grid-layout in the bottom-right corner)
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

// V3: /markets and /portfolio joined the terminal set (no footer).
const TERMINAL_ROUTES = ["/trade", "/perps", "/custom", "/markets", "/portfolio"];
// /, /history, /health still render the page-mode shell + footer.
const PAGE_ROUTES = ["/", "/history", "/health"];

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

test("resize handle from react-grid-layout is rendered in the bottom-right of each widget on /custom", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();
  // react-grid-layout always renders `.react-resizable-handle` on each
  // grid item by default.
  const handles = page.locator(".react-resizable-handle");
  await expect(handles.first()).toBeAttached();
});
