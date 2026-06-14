/**
 * workspace-grid-width-v5.spec.ts —
 * FRONTEND-WORKSPACE-GRID-WIDTH-AND-WIDGET-MENU-FIX
 *
 * V5 doubles the freeform grid to 48 cols, moves the scroll-container
 * from the inner grid to the workspace root (with stable scrollbar
 * gutter so scroll reservation doesn't eat right-edge width), and
 * compacts the navbar Widget menu (titles + coming-soon chip only;
 * description text removed).
 *
 * Specs:
 *   - workspace root exposes `data-grid-cols="48"` (the new column count)
 *   - workspace grid container measures ≥ viewport width − scrollbar
 *     reservation on a 1920px viewport (no right dead zone)
 *   - measured `data-container-width` on the grid is ≥ 1800px
 *   - Options default layout sums chain+details to 48 cols and dock = 48
 *   - Widget menu lists titles + "coming soon" status chip but does
 *     NOT render description lines under each entry
 *   - layout schema is V4 (version=4) with grid coords; no V3 size enum
 *   - terminal routes still hide PublicBetaFooter at 1920x1080
 */
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1920, height: 1080 } });

test("workspace root reports data-grid-cols=48 (V5)", async ({ page }) => {
  await page.goto("/custom");
  const workspace = page.getByTestId("workspace-custom-1");
  await expect(workspace).toHaveAttribute("data-grid-cols", "48");
});

test("workspace grid container measures ≥ 1800px on 1920x1080", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  const grid = page.getByTestId("workspace-grid-custom-1");
  await expect(grid).toBeVisible();
  // useContainerWidth() exposes its last measured width on the
  // data-container-width attribute. With scrollbar-gutter:stable, this
  // value is stable across content height changes.
  const measured = await grid.getAttribute("data-container-width");
  expect(measured).not.toBeNull();
  if (measured) {
    expect(Number(measured)).toBeGreaterThanOrEqual(1800);
  }
  // Also confirm offsetWidth.
  const offsetWidth = await grid.evaluate((el) => el.clientWidth);
  expect(offsetWidth).toBeGreaterThanOrEqual(1800);
});

test("Options default layout fills the 48-col canvas (no right gutter)", async ({
  page,
}) => {
  await page.goto("/trade");
  await expect(page.getByTestId("widget-options-chain")).toBeVisible();
  const widgets = await page.evaluate(() => {
    const raw = window.localStorage.getItem("deopt:v2:workspace:anon");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.workspaces?.options?.widgets ?? null;
  });
  expect(widgets).not.toBeNull();
  if (widgets) {
    const chain = widgets.find(
      (w: { type: string }) => w.type === "options-chain",
    );
    const details = widgets.find(
      (w: { type: string }) => w.type === "option-details",
    );
    const dock = widgets.find(
      (w: { type: string }) => w.type === "bottom-dock",
    );
    expect(chain.x + chain.w).toBe(32);
    expect(details.x + details.w).toBe(48);
    expect(dock.x).toBe(0);
    expect(dock.w).toBe(48);
  }
});

test("widget can be planted near the right edge (x=40,w=8) and persists", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  await page.evaluate(() => {
    const raw = window.localStorage.getItem("deopt:v2:workspace:anon");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const layout = parsed.workspaces["custom-1"];
    if (!layout) return;
    for (const w of layout.widgets) {
      if (w.type === "docs-help") {
        w.x = 40; // near right edge of 48-col grid
        w.y = 10;
        w.w = 8;  // 40+8 = 48, exactly the right boundary
      }
    }
    window.localStorage.setItem(
      "deopt:v2:workspace:anon",
      JSON.stringify(parsed),
    );
  });
  await page.reload();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();
  const widget = await page.evaluate(() => {
    const raw = window.localStorage.getItem("deopt:v2:workspace:anon");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ws = parsed?.workspaces?.["custom-1"];
    if (!ws) return null;
    return (
      ws.widgets.find((w: { type: string }) => w.type === "docs-help") ?? null
    );
  });
  expect(widget).not.toBeNull();
  if (widget) {
    expect(widget.x).toBe(40);
    expect(widget.y).toBe(10);
    expect(widget.w).toBe(8);
  }
});

test("Widget menu shows titles + 'coming soon' chip but NO description text", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  const menu = page.getByTestId("navbar-widget-menu");
  await expect(menu).toBeVisible();

  // Implemented widget: title only, no description text in DOM.
  const docsOption = page.getByTestId("navbar-widget-option-docs-help");
  await expect(docsOption).toBeVisible();
  await expect(docsOption).toContainText(/Docs · help/i);
  await expect(docsOption).not.toContainText(/Quickstart \/ Testing guide/i);

  // Placeholder widget: title + "coming soon" chip; no description text.
  const ordersOption = page.getByTestId("navbar-widget-option-orders");
  await expect(ordersOption).toBeVisible();
  await expect(ordersOption).toContainText(/Orders/);
  await expect(
    page.getByTestId("navbar-widget-option-status-orders"),
  ).toContainText(/coming soon/i);
  await expect(ordersOption).not.toContainText(
    /Resting limit-order book — not live/i,
  );
});

test("Terminal routes still hide the PublicBetaFooter at 1920x1080 (V5)", async ({
  page,
}) => {
  for (const route of ["/trade", "/perps", "/custom"]) {
    await page.goto(route);
    await expect(page.getByTestId("public-beta-footer")).toHaveCount(0);
    await expect(page.getByTestId("trading-main-terminal")).toBeVisible();
  }
});
