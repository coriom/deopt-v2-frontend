/**
 * workspace-hydration-v7.spec.ts —
 * FRONTEND-PIXEL-CANVAS-HYDRATION-AND-LAYOUT-FIX
 *
 * V7 fixes the V6 "collapsed widgets in top-left" bug by:
 *   - measuring the canvas via useLayoutEffect (pre-paint) and always
 *     attaching `canvasRef`, so ResizeObserver fires on first paint
 *   - gating widget rendering on `isCanvasReady` (canvas ≥ 320×240)
 *   - resolving every widget rect through `resolveWidgetRect`
 *     (clamped to minWPx / minHPx)
 *   - strictly validating loaded layouts on load — NaN, Infinity,
 *     out-of-range pcts, tiny wPct/hPct, unknown widget types are all
 *     rejected and the workspace falls back to its default
 *   - bumping `WORKSPACE_LAYOUT_VERSION` 6 → 7 so any in-flight V6
 *     bucket saved during the broken render is wiped on load
 *   - exposing `window.__deoptClearWorkspaceLayouts` for console
 *     recovery (no UI surface)
 */
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1920, height: 1080 } });

test("canvas-ready flag flips true once the workspace is measured", async ({
  page,
}) => {
  await page.goto("/custom");
  const canvas = page.getByTestId("workspace-canvas-custom-1");
  await expect(canvas).toHaveAttribute("data-canvas-ready", "true");
});

test("default Options layout renders 3 readable widgets at 1920×1080", async ({
  page,
}) => {
  await page.goto("/options");
  await expect(page.getByTestId("widget-options-chain")).toBeVisible();
  await expect(page.getByTestId("widget-trade")).toBeVisible();
  await expect(page.getByTestId("widget-bottom-dock")).toBeVisible();
  // Every widget should have non-zero width and height in the DOM.
  const chainBox = await page
    .getByTestId("widget-options-chain")
    .boundingBox();
  const tradeBox = await page.getByTestId("widget-trade").boundingBox();
  const dockBox = await page.getByTestId("widget-bottom-dock").boundingBox();
  for (const box of [chainBox, tradeBox, dockBox]) {
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThan(200);
      expect(box.height).toBeGreaterThan(120);
    }
  }
});

test("default Perps layout renders every placeholder widget without collapse", async ({
  page,
}) => {
  // Default perps layout was simplified: stats merge INSIDE the chart
  // widget and the orderbook + trade-feed merge into one `perps-book-
  // feed` tabbed widget. See workspace/registry.tsx.
  await page.goto("/perps");
  for (const type of [
    "perps-chart",
    "perps-book-feed",
    "perps-trade-form",
    "bottom-dock",
  ]) {
    const w = page.getByTestId(`widget-${type}`);
    await expect(w).toBeVisible();
    const box = await w.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThan(60);
      expect(box.height).toBeGreaterThan(40);
    }
  }
});

test("empty /custom does NOT render any positioned widgets", async ({
  page,
}) => {
  await page.goto("/custom");
  await expect(page.getByTestId("workspace-empty-custom-1")).toBeVisible();
  const containers = await page
    .locator("[data-testid^='widget-container-']")
    .count();
  expect(containers).toBe(0);
});

test("Adding the first widget in /custom creates a readable size", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-balances").click();
  const widget = page.getByTestId("widget-balances");
  await expect(widget).toBeVisible();
  const box = await widget.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.width).toBeGreaterThan(200);
    expect(box.height).toBeGreaterThan(120);
  }
});

test.describe("invalid layouts are rejected and default is restored", () => {
  const invalidFixtures: Array<{
    name: string;
    widgets: unknown[];
  }> = [
    {
      name: "NaN xPct",
      widgets: [
        { id: "w1", type: "balances", xPct: NaN, yPct: 0, wPct: 0.25, hPct: 0.25 },
      ],
    },
    {
      name: "Infinity wPct",
      widgets: [
        {
          id: "w1",
          type: "balances",
          xPct: 0,
          yPct: 0,
          wPct: Infinity,
          hPct: 0.25,
        },
      ],
    },
    {
      name: "negative xPct",
      widgets: [
        { id: "w1", type: "balances", xPct: -0.1, yPct: 0, wPct: 0.25, hPct: 0.25 },
      ],
    },
    {
      name: "tiny wPct (sub-readable)",
      widgets: [
        { id: "w1", type: "balances", xPct: 0, yPct: 0, wPct: 0.001, hPct: 0.25 },
      ],
    },
    {
      name: "xPct + wPct overflow",
      widgets: [
        { id: "w1", type: "balances", xPct: 0.9, yPct: 0, wPct: 0.5, hPct: 0.25 },
      ],
    },
    {
      name: "unknown widget type",
      widgets: [
        { id: "w1", type: "unknown-widget", xPct: 0, yPct: 0, wPct: 0.25, hPct: 0.25 },
      ],
    },
    {
      name: "missing geometry field",
      widgets: [
        { id: "w1", type: "balances", xPct: 0, yPct: 0, wPct: 0.25 },
      ],
    },
  ];
  for (const fx of invalidFixtures) {
    test(`${fx.name} → empty workspace`, async ({ page }) => {
      await page.goto("/custom");
      await page.evaluate(
        ({ widgets }) => {
          const bucket = {
            version: 8,
            walletKey: "anon",
            workspaces: {
              "custom-1": {
                workspaceId: "custom-1",
                widgets,
                canvasWidthPx: 1920,
                canvasHeightPx: 980,
                updatedAt: Date.now(),
                expiresAt: Date.now() + 60_000,
              },
            },
          };
          window.localStorage.setItem(
            "deopt:v2:workspace:anon",
            JSON.stringify(bucket),
          );
        },
        { widgets: fx.widgets },
      );
      await page.reload();
      await expect(page.getByTestId("workspace-empty-custom-1")).toBeVisible();
    });
  }
});

test("Widget header truncates instead of overlapping the remove button", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-balances").click();
  await expect(page.getByTestId("widget-balances")).toBeVisible();
  // The former always-visible ✕ is now the kebab (⋯) menu trigger.
  // The header-overlap invariant applies to the trigger, since the
  // Remove item is only revealed once the menu popover opens.
  const menuTrigger = page
    .locator("[data-testid^='widget-menu-trigger-']")
    .first();
  await expect(menuTrigger).toBeVisible();
  const triggerBox = await menuTrigger.boundingBox();
  const headerBox = await page
    .locator("[data-testid^='widget-drag-handle-']")
    .first()
    .boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  if (triggerBox && headerBox) {
    // Kebab trigger is inside the header strip.
    expect(triggerBox.x + triggerBox.width).toBeLessThanOrEqual(
      headerBox.x + headerBox.width + 1,
    );
    expect(triggerBox.y).toBeGreaterThanOrEqual(headerBox.y - 1);
  }
});

test("__deoptClearWorkspaceLayouts is exposed on window for console recovery", async ({
  page,
}) => {
  await page.goto("/custom");
  // Plant a real layout first.
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-balances").click();
  await expect(page.getByTestId("widget-balances")).toBeVisible();
  const before = await page.evaluate(() =>
    window.localStorage.getItem("deopt:v2:workspace:anon"),
  );
  expect(before).not.toBeNull();
  const cleared = await page.evaluate(() => {
    const fn = (
      window as unknown as { __deoptClearWorkspaceLayouts?: () => number }
    ).__deoptClearWorkspaceLayouts;
    if (typeof fn !== "function") return -1;
    return fn();
  });
  expect(cleared).toBeGreaterThanOrEqual(1);
  const after = await page.evaluate(() =>
    window.localStorage.getItem("deopt:v2:workspace:anon"),
  );
  expect(after).toBeNull();
});

test("Saved bucket carries the V8 version field", async ({ page }) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-balances").click();
  await expect(page.getByTestId("widget-balances")).toBeVisible();
  const version = await page.evaluate(() => {
    const raw = window.localStorage.getItem("deopt:v2:workspace:anon");
    if (!raw) return null;
    return JSON.parse(raw)?.version ?? null;
  });
  expect(version).toBe(8);
});

test("V7 buckets carrying the legacy `option-details` type are dropped on load", async ({
  page,
}) => {
  await page.goto("/options");
  await expect(page.getByTestId("widget-trade")).toBeVisible();
  // Plant a V7 bucket with the old type and reload.
  await page.evaluate(() => {
    const bucket = {
      version: 7,
      walletKey: "anon",
      workspaces: {
        options: {
          workspaceId: "options",
          widgets: [
            {
              id: "legacy",
              type: "option-details",
              xPct: 0,
              yPct: 0,
              wPct: 0.5,
              hPct: 0.5,
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
      JSON.stringify(bucket),
    );
  });
  await page.reload();
  await expect(page.getByTestId("widget-trade")).toBeVisible();
  await expect(page.locator('[data-widget-type="option-details"]')).toHaveCount(0);
  const version = await page.evaluate(() => {
    const raw = window.localStorage.getItem("deopt:v2:workspace:anon");
    if (!raw) return null;
    return JSON.parse(raw)?.version ?? null;
  });
  expect(version).toBe(8);
});
