/**
 * workspace-freeform-canvas.spec.ts — FRONTEND-PIXEL-CANVAS-WORKSPACE-V6
 *
 * Verifies the V6 freeform behaviour:
 *   - terminal main + workspace canvas fill the viewport on 1920x1080
 *     (no right dead zone)
 *   - Options default layout's percentages sum to 1.0 horizontally
 *   - widgets can be placed with gaps (xPct/yPct/wPct/hPct preserved
 *     across reload — there is no compactor)
 *   - a widget moved to (xPct=0.4, yPct=0.4) does not snap back to (0,0)
 *   - V6 schema persists with percentage geometry (no V5 column coords,
 *     no V1 size enum)
 *   - all three terminal routes (/trade, /perps, /custom) still hide
 *     the PublicBetaFooter
 *   - navbar Widget button still opens the menu
 */
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1920, height: 1080 } });

test("terminal main on /trade fills the viewport on 1920x1080", async ({
  page,
}) => {
  await page.goto("/trade");
  const main = page.getByTestId("trading-main-terminal");
  await expect(main).toBeVisible();
  const mainWidth = await main.evaluate((el) => el.clientWidth);
  expect(mainWidth).toBeGreaterThan(1800);
});

test("/custom canvas fills the viewport on 1920x1080", async ({
  page,
}) => {
  await page.goto("/custom");
  const canvas = page.getByTestId("workspace-canvas-custom-1");
  await expect(canvas).toBeVisible();
  const cw = await canvas.evaluate((el) => el.clientWidth);
  expect(cw).toBeGreaterThan(1800);
});

test("Options default layout fills the canvas horizontally (no right dead zone)", async ({
  page,
}) => {
  await page.goto("/trade");
  await expect(page.getByTestId("widget-options-chain")).toBeVisible();
  await expect(page.getByTestId("widget-option-details")).toBeVisible();
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
      expect(chain.wPct + details.wPct).toBeCloseTo(1, 5);
    }
    if (dock) {
      expect(dock.xPct).toBe(0);
      expect(dock.wPct).toBe(1);
    }
  }
});

test("Gaps are preserved — a widget placed at (xPct=0.4, yPct=0.4) is NOT packed back to (0,0)", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();

  await page.evaluate(() => {
    const raw = window.localStorage.getItem("deopt:v2:workspace:anon");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const layout = parsed.workspaces["custom-1"];
    if (!layout) return;
    for (const w of layout.widgets) {
      if (w.type === "docs-help") {
        w.xPct = 0.4;
        w.yPct = 0.4;
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
    expect(widget.xPct).toBeCloseTo(0.4, 5);
    expect(widget.yPct).toBeCloseTo(0.4, 5);
  }
});

test("V6 layout schema persists with pct geometry (no column coords, no V1 size enum)", async ({
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
  expect(parsed.version).toBe(7);
  const widget = parsed.workspaces["custom-1"].widgets[0];
  expect(typeof widget.xPct).toBe("number");
  expect(typeof widget.yPct).toBe("number");
  expect(typeof widget.wPct).toBe("number");
  expect(typeof widget.hPct).toBe("number");
  expect(widget.size).toBeUndefined();
  expect(widget.x).toBeUndefined();
  expect(widget.w).toBeUndefined();
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
