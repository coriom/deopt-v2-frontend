/**
 * workspace-storage.spec.ts — FRONTEND-MODULAR-WORKSPACE-V1
 *
 * Pure DOM/storage assertions (no backend, no wallet).
 *   - Expired bucket is pruned on next load.
 *   - Wrong-version bucket is wiped and replaced with the default.
 *   - Saved layout survives a reload.
 *   - Anonymous TTL is shorter than the wallet TTL (both are derived
 *     from the storage helper, but we assert the on-disk expiresAt is
 *     <= 24h + 1s of write time).
 */
import { test, expect } from "@playwright/test";

test("expired anon bucket is pruned on next page load", async ({ page }) => {
  await page.goto("/custom");

  await page.evaluate(() => {
    const bucket = {
      version: 1,
      walletKey: "anon",
      workspaces: {
        "custom-1": {
          workspaceId: "custom-1",
          widgets: [{ id: "w-stale", type: "docs-help", size: "sm" }],
          updatedAt: Date.now() - 48 * 60 * 60 * 1000,
          expiresAt: Date.now() - 1000,
        },
      },
    };
    window.localStorage.setItem(
      "deopt:v2:workspace:anon",
      JSON.stringify(bucket),
    );
  });

  await page.reload();
  // The stale widget is gone; workspace returns to the empty default.
  await expect(page.getByTestId("workspace-empty-custom-1")).toBeVisible();
});

test("wrong-version bucket is wiped and replaced with the default", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.evaluate(() => {
    const bucket = {
      version: 999,
      walletKey: "anon",
      workspaces: {
        "custom-1": {
          workspaceId: "custom-1",
          widgets: [{ id: "w-future", type: "docs-help", size: "sm" }],
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
  await expect(page.getByTestId("workspace-empty-custom-1")).toBeVisible();
});

test("saved layout survives a reload", async ({ page }) => {
  await page.goto("/custom");
  await page.getByTestId("workspace-add-widget").click();
  await page.getByTestId("workspace-add-widget-option-docs-help").click();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();
});

test("anon layout expiresAt is bounded by 24h", async ({ page }) => {
  await page.goto("/custom");
  await page.getByTestId("workspace-add-widget").click();
  await page.getByTestId("workspace-add-widget-option-docs-help").click();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();

  const expiry = await page.evaluate(() => {
    const raw = window.localStorage.getItem("deopt:v2:workspace:anon");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.workspaces?.["custom-1"]?.expiresAt ?? null;
  });
  expect(expiry).not.toBeNull();
  if (expiry) {
    const diff = Number(expiry) - Date.now();
    expect(diff).toBeGreaterThan(0);
    expect(diff).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 2000);
  }
});
