/**
 * workspace-custom.spec.ts — FRONTEND-TERMINAL-WORKSPACE-CLEANUP-V3
 *
 * /custom modular workspace under V3:
 *   - starts empty with the empty-state hint pointing at the navbar
 *   - the global Add Widget / Reset Layout / Anon-warning controls
 *     are GONE from the workspace body
 *   - the navbar `Widget` button opens the menu and adds the widget
 *   - widget remove control still works
 *   - localStorage stores grid coords (V2 schema) with no secrets
 *   - No PublicBetaFooter on /custom
 */
import { test, expect } from "@playwright/test";

test("/custom renders the empty workspace shell with the empty-state hint", async ({
  page,
}) => {
  await page.goto("/custom");
  await expect(page.getByTestId("workspace-custom-1")).toBeVisible();
  await expect(page.getByTestId("workspace-empty-custom-1")).toBeVisible();
});

test("/custom body has NO Reset / Anon-warning / Add-Widget toolbar (V3 cleanup)", async ({
  page,
}) => {
  await page.goto("/custom");
  await expect(page.getByTestId("workspace-reset")).toHaveCount(0);
  await expect(page.getByTestId("workspace-anon-warning")).toHaveCount(0);
  await expect(page.getByTestId("workspace-wallet-badge")).toHaveCount(0);
  // The pre-V3 in-toolbar Add Widget button is gone; the navbar one is the only entry point.
  await expect(page.getByTestId("workspace-add-widget")).toHaveCount(0);
});

test("Navbar Widget button opens the menu and adds a widget to /custom", async ({
  page,
}) => {
  await page.goto("/custom");
  await expect(page.getByTestId("navbar-widget-button")).toBeVisible();
  await expect(page.getByTestId("navbar-widget-button")).toHaveText(/Widget/);
  await page.getByTestId("navbar-widget-button").click();
  await expect(page.getByTestId("navbar-widget-menu")).toBeVisible();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();
  await expect(page.getByTestId("workspace-empty-custom-1")).toHaveCount(0);
});

test("Remove control inside a widget still removes it", async ({ page }) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-feedback").click();
  await expect(page.getByTestId("widget-feedback")).toBeVisible();
  const removeBtn = page.locator("[data-testid^='widget-remove-']").first();
  await removeBtn.click();
  await expect(page.getByTestId("widget-feedback")).toHaveCount(0);
});

test("localStorage stores V2 grid-coord bucket with no secrets", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();

  const bucket = await page.evaluate(() => {
    const out: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (!k.startsWith("deopt:v2:workspace:")) continue;
      out[k] = window.localStorage.getItem(k) ?? "";
    }
    return out;
  });

  const keys = Object.keys(bucket);
  expect(keys.length).toBeGreaterThanOrEqual(1);
  expect(keys.some((k) => k === "deopt:v2:workspace:anon")).toBeTruthy();

  for (const v of Object.values(bucket)) {
    expect(v).not.toMatch(/0x[a-fA-F0-9]{64}/);
    expect(v).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
    expect(v).not.toMatch(/alchemy\.com\/v2\//);
    expect(v).not.toMatch(/infura\.io\/v3\//);
    expect(v).not.toMatch(/DATABASE_URL/);
    expect(v).not.toMatch(/mainnet/i);
    expect(v).not.toMatch(/(?:\b[a-z]{3,8}\b\s+){11,}\b[a-z]{3,8}\b/);
  }

  const parsed = JSON.parse(bucket["deopt:v2:workspace:anon"]);
  expect(parsed.version).toBe(5);
  const widget = parsed.workspaces["custom-1"].widgets[0];
  expect(typeof widget.x).toBe("number");
  expect(typeof widget.y).toBe("number");
  expect(typeof widget.w).toBe("number");
  expect(typeof widget.h).toBe("number");
});

test("/custom does NOT render the PublicBetaFooter (terminal route)", async ({
  page,
}) => {
  await page.goto("/custom");
  await expect(page.getByTestId("public-beta-footer")).toHaveCount(0);
  await expect(page.getByTestId("trading-main-terminal")).toBeVisible();
});
