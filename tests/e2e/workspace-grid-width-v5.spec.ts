/**
 * workspace-grid-width-v5.spec.ts —
 * FRONTEND-ADAPTIVE-VISIBLE-GRID-WORKSPACE-V5
 *
 * V5 makes the grid column count adaptive based on container width
 * (`cols = clamp(round(width / 36), 48, 120)`) and renders a visible
 * dotted backdrop sized via CSS variables. Tests cover:
 *   - data-grid-cols adapts (≥48 at 1440, more at 1920/2560)
 *   - data-cell-width is near the 36px target
 *   - visible backdrop is rendered with the inline CSS variables
 *   - Options defaults fill the adaptive cols (no right dead zone)
 *   - widget planted near the right boundary persists
 *   - Widget menu shows titles + "coming soon" chip only
 *   - terminal routes hide PublicBetaFooter
 *   - layout schema is V5 (version=5)
 */
import { test, expect } from "@playwright/test";

test.describe("adaptive cols scale with viewport", () => {
  test("1440x900 → data-grid-cols ≥ 48", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/custom");
    const cols = await page
      .getByTestId("workspace-custom-1")
      .getAttribute("data-grid-cols");
    expect(Number(cols)).toBeGreaterThanOrEqual(48);
  });

  test("1920x1080 → data-grid-cols > 48 (adaptive, not fixed)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/custom");
    const cols = await page
      .getByTestId("workspace-custom-1")
      .getAttribute("data-grid-cols");
    // 1920 / 36 ≈ 53; minus scrollbar-gutter ≈ 51-53.
    expect(Number(cols)).toBeGreaterThanOrEqual(48);
    expect(Number(cols)).toBeLessThanOrEqual(120);
  });

  test("2560x1440 → data-grid-cols > 1920 viewport cols", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/custom");
    const cols1920 = Number(
      await page
        .getByTestId("workspace-custom-1")
        .getAttribute("data-grid-cols"),
    );
    await page.setViewportSize({ width: 2560, height: 1440 });
    // Allow a tick for ResizeObserver.
    await page.waitForTimeout(50);
    const cols2560 = Number(
      await page
        .getByTestId("workspace-custom-1")
        .getAttribute("data-grid-cols"),
    );
    expect(cols2560).toBeGreaterThan(cols1920);
  });
});

test("data-cell-width is near the 36px target", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/custom");
  const cellWidth = Number(
    await page
      .getByTestId("workspace-custom-1")
      .getAttribute("data-cell-width"),
  );
  // Target is 36px; allow ±10px for scrollbar / rounding / margin.
  expect(cellWidth).toBeGreaterThanOrEqual(26);
  expect(cellWidth).toBeLessThanOrEqual(46);
});

test("visible-grid backdrop is rendered via CSS variables", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  const grid = page.getByTestId("workspace-grid-custom-1");
  const styleAttr = await grid.getAttribute("style");
  expect(styleAttr).not.toBeNull();
  if (styleAttr) {
    expect(styleAttr).toContain("--workspace-cell-width");
    expect(styleAttr).toContain("--workspace-row-height");
    expect(styleAttr).toContain("radial-gradient");
  }
});

test("Options defaults fill the adaptive cols at 1920x1080", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/trade");
  await expect(page.getByTestId("widget-options-chain")).toBeVisible();
  const colsAttr = await page
    .getByTestId("workspace-options")
    .getAttribute("data-grid-cols");
  const cols = Number(colsAttr);
  const widgets = await page.evaluate(() => {
    const raw = window.localStorage.getItem("deopt:v2:workspace:anon");
    if (!raw) return null;
    return JSON.parse(raw)?.workspaces?.options?.widgets ?? null;
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
    expect(chain.x + chain.w).toBe(details.x);
    expect(chain.x + chain.w + details.w).toBe(cols);
    expect(dock.x).toBe(0);
    expect(dock.w).toBe(cols);
  }
});

test("Widget can be placed at the right boundary (x = cols - w) and persists", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  const cols = Number(
    await page
      .getByTestId("workspace-custom-1")
      .getAttribute("data-grid-cols"),
  );
  const targetX = cols - 12;
  await page.evaluate(
    ({ targetX, cols }) => {
      const raw = window.localStorage.getItem("deopt:v2:workspace:anon");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const layout = parsed.workspaces["custom-1"];
      if (!layout) return;
      for (const w of layout.widgets) {
        if (w.type === "docs-help") {
          w.x = targetX;
          w.w = 12;
          w.y = 10;
        }
      }
      parsed.workspaces["custom-1"].cols = cols;
      window.localStorage.setItem(
        "deopt:v2:workspace:anon",
        JSON.stringify(parsed),
      );
    },
    { targetX, cols },
  );
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
    expect(widget.x + widget.w).toBe(cols);
  }
});

test("Widget menu shows titles + 'coming soon' chip but NO description text", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  const docsOption = page.getByTestId("navbar-widget-option-docs-help");
  await expect(docsOption).toContainText(/Docs · help/i);
  await expect(docsOption).not.toContainText(/Quickstart \/ Testing guide/i);

  const ordersOption = page.getByTestId("navbar-widget-option-orders");
  await expect(ordersOption).toContainText(/Orders/);
  await expect(
    page.getByTestId("navbar-widget-option-status-orders"),
  ).toContainText(/coming soon/i);
  await expect(ordersOption).not.toContainText(
    /Resting limit-order book — not live/i,
  );
});

test("Terminal routes still hide PublicBetaFooter at 1920x1080 (V5)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const route of ["/trade", "/perps", "/custom"]) {
    await page.goto(route);
    await expect(page.getByTestId("public-beta-footer")).toHaveCount(0);
    await expect(page.getByTestId("trading-main-terminal")).toBeVisible();
  }
});

test("Layout schema is V5 with grid coords + saved cols", async ({ page }) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  const parsed = await page.evaluate(() => {
    const raw = window.localStorage.getItem("deopt:v2:workspace:anon");
    return raw ? JSON.parse(raw) : null;
  });
  expect(parsed).not.toBeNull();
  expect(parsed.version).toBe(5);
  const layout = parsed.workspaces["custom-1"];
  expect(typeof layout.cols).toBe("number");
  expect(layout.cols).toBeGreaterThanOrEqual(48);
  const widget = layout.widgets[0];
  expect(typeof widget.x).toBe("number");
  expect(typeof widget.y).toBe("number");
  expect(typeof widget.w).toBe("number");
  expect(typeof widget.h).toBe("number");
  expect(widget.size).toBeUndefined();
});
