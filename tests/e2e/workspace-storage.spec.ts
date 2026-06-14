/**
 * workspace-storage.spec.ts — FRONTEND-TERMINAL-WORKSPACE-RESIZABLE-V2
 *
 *   - V1 bucket (version=1, sm/md/lg/xl size enum) gets wiped + default
 *     restored when V2 loader sees it.
 *   - Expired V2 bucket is pruned on next load.
 *   - Wrong-version (future) bucket wiped and replaced with default.
 *   - Saved layout survives a reload.
 *   - Anon expiresAt is bounded by 24h.
 */
import { test, expect } from "@playwright/test";

// V4 bumped layout schema to version=3. The version-bump-wipe path
// still wipes any older bucket on load and replaces it with the new
// default. The "wrong-version (future)" test uses version=999.

test("V1 bucket (size enum) is wiped when the V3 loader sees it", async ({
  page,
}) => {
  await page.goto("/custom");
  await page.evaluate(() => {
    const bucket = {
      version: 1, // old V1 shape
      walletKey: "anon",
      workspaces: {
        "custom-1": {
          workspaceId: "custom-1",
          widgets: [{ id: "w-v1", type: "docs-help", size: "sm" }],
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

test("expired V2 anon bucket is pruned on next page load", async ({ page }) => {
  await page.goto("/custom");
  await page.evaluate(() => {
    const bucket = {
      version: 5,
      walletKey: "anon",
      workspaces: {
        "custom-1": {
          workspaceId: "custom-1",
          widgets: [
            { id: "w-stale", type: "docs-help", x: 0, y: 0, w: 3, h: 6 },
          ],
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
  await expect(page.getByTestId("workspace-empty-custom-1")).toBeVisible();
});

test("wrong-version (future) bucket is wiped and replaced with the default", async ({
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
          widgets: [
            { id: "w-future", type: "docs-help", x: 0, y: 0, w: 3, h: 6 },
          ],
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

test("saved layout survives a reload (V2)", async ({ page }) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("widget-docs-help")).toBeVisible();
});

test("anon layout expiresAt is bounded by 24h (V2)", async ({ page }) => {
  await page.goto("/custom");
  await page.getByTestId("navbar-widget-button").click();
  await page.getByTestId("navbar-widget-option-docs-help").click();
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
