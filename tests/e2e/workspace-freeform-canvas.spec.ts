/**
 * workspace-freeform-canvas.spec.ts — FRONTEND-FREEFORM-WORKSPACE-CANVAS-V4
 *
 * Verifies the V4 freeform behaviour:
 *   - terminal main + workspace container have no max-width cap and
 *     fill the viewport on a 1920x1080 viewport (no right dead zone)
 *   - Options default layout fills 24/24 cols horizontally (no unused
 *     right gutter)
 *   - widgets can be placed with gaps (x/y/w/h preserved across
 *     reload — the noCompactor compactor does not pack the layout)
 *   - moving a widget to (x=20,y=20) leaves the upper-left empty —
 *     verified by inspecting the persisted bucket
 *   - V3 layout schema persisted with grid coords (no V1 size enum)
 *   - all three terminal routes (/trade, /perps, /custom) still hide
 *     the PublicBetaFooter
 *   - navbar Widget button still opens the menu
 */
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1920, height: 1080 } });

test("terminal main on /trade has no max-width cap on 1920x1080", async ({
  page,
}) => {
  await page.goto("/trade");
  const main = page.getByTestId("trading-main-terminal");
  await expect(main).toBeVisible();
  const mainWidth = await main.evaluate((el) => el.clientWidth);
  // On a 1920px viewport, terminal main fills (within scrollbar slack).
  expect(mainWidth).toBeGreaterThan(1800);
});

test("/custom workspace grid container fills viewport on 1920x1080", async ({
  page,
}) => {
  await page.goto("/custom");
  // Add a widget so the grid renders.
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  const grid = page.getByTestId("workspace-grid-custom-1");
  await expect(grid).toBeVisible();
  const gridWidth = await grid.evaluate((el) => el.clientWidth);
  expect(gridWidth).toBeGreaterThan(1800);
});

test("Options default layout fills the adaptive grid (no right dead zone)", async ({
  page,
}) => {
  await page.goto("/trade");
  await expect(page.getByTestId("widget-options-chain")).toBeVisible();
  await expect(page.getByTestId("widget-option-details")).toBeVisible();
  // V5 adaptive: cols comes from the workspace root; defaults span it.
  const cols = await page
    .getByTestId("workspace-options")
    .getAttribute("data-grid-cols");
  expect(cols).not.toBeNull();
  const colsN = Number(cols);
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
    expect(chain).toBeDefined();
    expect(details).toBeDefined();
    expect(dock).toBeDefined();
    if (chain && details) {
      // chain.w + details.w must equal the adaptive cols (no gutter).
      expect(chain.x + chain.w + details.w).toBe(colsN);
    }
    if (dock) {
      expect(dock.x).toBe(0);
      expect(dock.w).toBe(colsN);
    }
  }
});

test("Gaps are preserved — a widget placed at (x=20,y=20) is NOT packed back to (0,0)", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();

  // Manually plant the widget at (20,20) in localStorage and reload.
  await page.evaluate(() => {
    const raw = window.localStorage.getItem("deopt:v2:workspace:anon");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const layout = parsed.workspaces["custom-1"];
    if (!layout) return;
    for (const w of layout.widgets) {
      if (w.type === "docs-help") {
        w.x = 20;
        w.y = 20;
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
    return ws.widgets.find((w: { type: string }) => w.type === "docs-help") ?? null;
  });
  expect(widget).not.toBeNull();
  if (widget) {
    // noCompactor must NOT have moved the widget back to (0,0).
    expect(widget.x).toBe(20);
    expect(widget.y).toBe(20);
  }
});

test("V3 layout schema persists with grid coords (no V1 size enum)", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();
  const parsed = await page.evaluate(() => {
    const raw = window.localStorage.getItem("deopt:v2:workspace:anon");
    return raw ? JSON.parse(raw) : null;
  });
  expect(parsed).not.toBeNull();
  expect(parsed.version).toBe(5);
  const widget = parsed.workspaces["custom-1"].widgets[0];
  expect(typeof widget.x).toBe("number");
  expect(typeof widget.y).toBe("number");
  expect(typeof widget.w).toBe("number");
  expect(typeof widget.h).toBe("number");
  expect(widget.size).toBeUndefined();
});

test("/trade, /perps, /custom still hide the PublicBetaFooter at 1920x1080", async ({
  page,
}) => {
  for (const route of ["/trade", "/perps", "/custom"]) {
    await page.goto(route);
    await expect(page.getByTestId("public-beta-footer")).toHaveCount(0);
    await expect(page.getByTestId("trading-main-terminal")).toBeVisible();
  }
});

test("Navbar Widget button still opens the menu at 1920x1080", async ({
  page,
}) => {
  await page.goto("/trade");
  await expect(page.getByTestId("navbar-widget-button")).toBeVisible();
  await page.getByTestId("navbar-widget-button").click();
  await expect(page.getByTestId("navbar-widget-menu")).toBeVisible();
});
