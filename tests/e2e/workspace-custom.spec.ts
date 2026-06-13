/**
 * workspace-custom.spec.ts — FRONTEND-MODULAR-WORKSPACE-V1
 *
 * Covers the /custom modular workspace:
 *   - starts empty with the empty-state hint
 *   - Add Widget menu lists options + adds a widget
 *   - Remove widget removes it
 *   - Reset layout restores empty state
 *   - Anonymous layout warning is visible (no wallet connected)
 *   - localStorage stores the bucket under the expected prefix
 *   - No secret / RPC URL / DATABASE_URL pattern leaks into stored bucket
 */
import { test, expect } from "@playwright/test";

test("/custom renders the empty workspace shell with the empty-state hint", async ({
  page,
}) => {
  await page.goto("/custom");
  await expect(page.getByTestId("workspace-custom-1")).toBeVisible();
  await expect(page.getByTestId("workspace-toolbar-custom-1")).toBeVisible();
  await expect(page.getByTestId("workspace-empty-custom-1")).toBeVisible();
});

test("/custom shows the anon-layout warning when no wallet is connected", async ({
  page,
}) => {
  await page.goto("/custom");
  await expect(page.getByTestId("workspace-anon-warning")).toBeVisible();
  await expect(page.getByTestId("workspace-anon-warning")).toContainText(
    /Anonymous layout/i,
  );
});

test("Add Widget menu opens and adds a widget to /custom", async ({ page }) => {
  await page.goto("/custom");
  await page.getByTestId("workspace-add-widget").click();
  await expect(page.getByTestId("workspace-add-widget-menu")).toBeVisible();
  await page.getByTestId("workspace-add-widget-option-docs-help").click();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();
  // workspace is no longer empty.
  await expect(page.getByTestId("workspace-empty-custom-1")).toHaveCount(0);
});

test("Remove widget removes it from the workspace", async ({ page }) => {
  await page.goto("/custom");
  await page.getByTestId("workspace-add-widget").click();
  await page.getByTestId("workspace-add-widget-option-feedback").click();
  await expect(page.getByTestId("widget-feedback")).toBeVisible();

  const removeBtn = page
    .locator("[data-testid^='widget-remove-']")
    .first();
  await removeBtn.click();
  await expect(page.getByTestId("widget-feedback")).toHaveCount(0);
});

test("Reset layout restores the empty default for /custom", async ({ page }) => {
  await page.goto("/custom");
  await page.getByTestId("workspace-add-widget").click();
  await page.getByTestId("workspace-add-widget-option-docs-help").click();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();
  await page.getByTestId("workspace-reset").click();
  // /custom default = empty, so the empty-state card should be back.
  await expect(page.getByTestId("workspace-empty-custom-1")).toBeVisible();
  await expect(page.getByTestId("widget-docs-help")).toHaveCount(0);
});

test("localStorage stores the bucket under the expected prefix and no secrets", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.getByTestId("workspace-add-widget").click();
  await page.getByTestId("workspace-add-widget-option-docs-help").click();
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
  // anonymous bucket should be present.
  expect(keys.some((k) => k === "deopt:v2:workspace:anon")).toBeTruthy();

  for (const v of Object.values(bucket)) {
    // No raw secret patterns must be persisted.
    expect(v).not.toMatch(/0x[a-fA-F0-9]{64}/); // 64-hex (priv keys / tx hashes / signatures)
    expect(v).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
    expect(v).not.toMatch(/alchemy\.com\/v2\//);
    expect(v).not.toMatch(/infura\.io\/v3\//);
    expect(v).not.toMatch(/DATABASE_URL/);
    expect(v).not.toMatch(/mainnet/i);
    // No 12+ word seed phrase pattern.
    expect(v).not.toMatch(/(?:\b[a-z]{3,8}\b\s+){11,}\b[a-z]{3,8}\b/);
  }
});
