/**
 * workspace-pixel-canvas-v6.spec.ts —
 * FRONTEND-PIXEL-CANVAS-WORKSPACE-V6
 *
 * V6 replaces the V5 RGL column model with a true pixel/percentage
 * freeform canvas. Tests cover:
 *   - the canvas measures its real client size and exposes it via
 *     data attributes at 1440/1920/2560
 *   - the visible-grid backdrop is rendered with CANVAS_SNAP_PX dot
 *     spacing
 *   - the snap unit data attribute is exposed and matches the
 *     backdrop's background-size
 *   - widget geometry persists as xPct/yPct/wPct/hPct, not column coords
 *   - a widget planted with x+w = 1.0 reaches the right edge
 *   - Options defaults sum to 1.0 horizontally (no right gutter)
 *   - Widget menu shows titles + "coming soon" chip but no description
 *   - terminal routes hide PublicBetaFooter
 *   - layout schema is V6 (version=6)
 *   - workspace canvas width grows with viewport (proves adaptation)
 *   - V5 column bucket is wiped on V6 load
 */
import { test, expect } from "@playwright/test";

test.describe("canvas adapts to viewport (V6)", () => {
  test("1440x900 → canvas width ≥ 1400px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/custom");
    const w = await page
      .getByTestId("workspace-canvas-custom-1")
      .getAttribute("data-canvas-width");
    expect(Number(w)).toBeGreaterThanOrEqual(1400);
  });

  test("1920x1080 → canvas width ≥ 1880px", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/custom");
    const w = await page
      .getByTestId("workspace-canvas-custom-1")
      .getAttribute("data-canvas-width");
    expect(Number(w)).toBeGreaterThanOrEqual(1880);
  });

  test("2560x1440 → canvas width grows beyond 1920", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/custom");
    const w1920 = Number(
      await page
        .getByTestId("workspace-canvas-custom-1")
        .getAttribute("data-canvas-width"),
    );
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.waitForTimeout(80);
    const w2560 = Number(
      await page
        .getByTestId("workspace-canvas-custom-1")
        .getAttribute("data-canvas-width"),
    );
    expect(w2560).toBeGreaterThan(w1920);
  });
});

test("canvas exposes the snap unit and the backdrop uses the same step", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/custom");
  const canvas = page.getByTestId("workspace-canvas-custom-1");
  const snap = await canvas.getAttribute("data-canvas-snap-px");
  expect(Number(snap)).toBeGreaterThan(0);
  const styleAttr = await canvas.getAttribute("style");
  expect(styleAttr).not.toBeNull();
  if (styleAttr) {
    expect(styleAttr).toContain("radial-gradient");
    expect(styleAttr).toContain(`${snap}px ${snap}px`);
  }
});

test("Options defaults fill the canvas horizontally (no right gutter)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/trade");
  await expect(page.getByTestId("widget-options-chain")).toBeVisible();
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
    expect(chain).toBeDefined();
    expect(details).toBeDefined();
    expect(dock).toBeDefined();
    expect(chain.xPct + chain.wPct).toBeCloseTo(details.xPct, 5);
    expect(chain.wPct + details.wPct).toBeCloseTo(1, 5);
    expect(dock.xPct).toBe(0);
    expect(dock.wPct).toBe(1);
  }
});

test("Widget placed with x+w = 1 reaches the right edge and persists", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();
  await page.evaluate(() => {
    const raw = window.localStorage.getItem("deopt:v2:workspace:anon");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const ws = parsed.workspaces["custom-1"];
    if (!ws) return;
    for (const w of ws.widgets) {
      if (w.type === "docs-help") {
        w.xPct = 0.75;
        w.yPct = 0.0;
        w.wPct = 0.25;
        w.hPct = 0.2;
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
    expect(widget.xPct + widget.wPct).toBeCloseTo(1, 5);
  }
  const containerBox = await page
    .locator(`[data-widget-type="docs-help"]`)
    .first()
    .boundingBox();
  const canvasBox = await page
    .getByTestId("workspace-canvas-custom-1")
    .boundingBox();
  expect(containerBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  if (containerBox && canvasBox) {
    const widgetRight = containerBox.x + containerBox.width;
    const canvasRight = canvasBox.x + canvasBox.width;
    expect(Math.abs(widgetRight - canvasRight)).toBeLessThanOrEqual(2);
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

test("Terminal routes still hide PublicBetaFooter at 1920x1080 (V6)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const route of ["/trade", "/perps", "/custom"]) {
    await page.goto(route);
    await expect(page.getByTestId("public-beta-footer")).toHaveCount(0);
    await expect(page.getByTestId("trading-main-terminal")).toBeVisible();
  }
});

test("Layout schema is V6 with pct geometry (no column coords)", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  const parsed = await page.evaluate(() => {
    const raw = window.localStorage.getItem("deopt:v2:workspace:anon");
    return raw ? JSON.parse(raw) : null;
  });
  expect(parsed).not.toBeNull();
  expect(parsed.version).toBe(7);
  const layout = parsed.workspaces["custom-1"];
  expect(typeof layout.canvasWidthPx).toBe("number");
  expect(typeof layout.canvasHeightPx).toBe("number");
  const widget = layout.widgets[0];
  expect(typeof widget.xPct).toBe("number");
  expect(typeof widget.yPct).toBe("number");
  expect(typeof widget.wPct).toBe("number");
  expect(typeof widget.hPct).toBe("number");
  expect(widget.x).toBeUndefined();
  expect(widget.y).toBeUndefined();
  expect(widget.w).toBeUndefined();
  expect(widget.h).toBeUndefined();
  expect(layout.cols).toBeUndefined();
});

test("Saved layout survives a viewport resize — percentages preserve proportions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();
  const before = await page.evaluate(() => {
    const raw = window.localStorage.getItem("deopt:v2:workspace:anon");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.workspaces?.["custom-1"]?.widgets?.[0] ?? null;
  });
  expect(before).not.toBeNull();
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.waitForTimeout(80);
  await page.reload();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();
  const after = await page.evaluate(() => {
    const raw = window.localStorage.getItem("deopt:v2:workspace:anon");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.workspaces?.["custom-1"]?.widgets?.[0] ?? null;
  });
  expect(after).not.toBeNull();
  if (before && after) {
    expect(after.xPct).toBeCloseTo(before.xPct, 4);
    expect(after.yPct).toBeCloseTo(before.yPct, 4);
    expect(after.wPct).toBeCloseTo(before.wPct, 4);
    expect(after.hPct).toBeCloseTo(before.hPct, 4);
  }
});

test("V5 column bucket is wiped on V7 load (safe migration)", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.evaluate(() => {
    const v5 = {
      version: 5,
      walletKey: "anon",
      workspaces: {
        "custom-1": {
          workspaceId: "custom-1",
          widgets: [{ id: "w-v5", type: "docs-help", x: 0, y: 0, w: 12, h: 6 }],
          cols: 48,
          updatedAt: Date.now(),
          expiresAt: Date.now() + 60_000,
        },
      },
    };
    window.localStorage.setItem(
      "deopt:v2:workspace:anon",
      JSON.stringify(v5),
    );
  });
  await page.reload();
  await expect(page.getByTestId("workspace-empty-custom-1")).toBeVisible();
});

test("V6 bucket is wiped on V7 load (post-hydration-bug safe-reset)", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.evaluate(() => {
    const v6 = {
      version: 6,
      walletKey: "anon",
      workspaces: {
        "custom-1": {
          workspaceId: "custom-1",
          widgets: [
            {
              id: "w-v6",
              type: "docs-help",
              xPct: 0,
              yPct: 0,
              wPct: 0.25,
              hPct: 0.25,
            },
          ],
          canvasWidthPx: 1920,
          canvasHeightPx: 980,
          updatedAt: Date.now(),
          expiresAt: Date.now() + 60_000,
        },
      },
    };
    window.localStorage.setItem(
      "deopt:v2:workspace:anon",
      JSON.stringify(v6),
    );
  });
  await page.reload();
  await expect(page.getByTestId("workspace-empty-custom-1")).toBeVisible();
});
