/**
 * testnet-unaudited-banner-dismiss.spec.ts
 *
 * Pins the "×" close-button behavior on the `Public testnet beta —
 * UNAUDITED, experimental…" top banner (`TestnetUnauditedBanner` in
 * `src/components/banners.tsx`). Behavior:
 *   - Visible on a fresh browser context (no localStorage key).
 *   - Click ×: banner is removed AND localStorage records the dismissal.
 *   - Reloading the page keeps the banner dismissed.
 */
import { test, expect } from "@playwright/test";

const DISMISS_KEY = "deopt:v2:testnet-unaudited-banner-dismissed";

test("banner visible by default; × dismisses; state persists across reload", async ({
  page,
}) => {
  await page.goto("/options");
  const banner = page.getByTestId("testnet-unaudited-banner");
  await expect(banner).toBeVisible();

  const stored = await page.evaluate(
    (k) => window.localStorage.getItem(k),
    DISMISS_KEY,
  );
  expect(stored).toBeNull();

  await page.getByTestId("testnet-unaudited-banner-close").click();
  await expect(banner).toHaveCount(0);

  const storedAfter = await page.evaluate(
    (k) => window.localStorage.getItem(k),
    DISMISS_KEY,
  );
  expect(storedAfter).toBe("1");

  await page.reload();
  await expect(page.getByTestId("testnet-unaudited-banner")).toHaveCount(0);
});

test("dismiss button has an accessible label", async ({ page }) => {
  await page.goto("/options");
  const btn = page.getByTestId("testnet-unaudited-banner-close");
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAttribute("aria-label", /dismiss/i);
});
