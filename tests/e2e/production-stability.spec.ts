import { expect, test } from "@playwright/test";

test("core routes survive navigation, reload, corrupted storage and delayed work", async ({ page }) => {
  const appErrors: string[] = [];
  page.on("pageerror", (error) => {
    if (!/(?:chrome|moz)-extension:\/\/|tradingview\.com\//i.test(error.stack ?? "")) {
      appErrors.push(error.message);
    }
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("deopt:v2:workspace:anon", "{corrupted");
    } catch {
      // The separate denied-storage test covers browsers that reject storage.
    }
  });

  for (const route of ["/", "/options", "/perps", "/custom"]) {
    await page.goto(route);
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.getByTestId("terminal-navbar")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("terminal-navbar")).toBeVisible();
  }
  await page.goto("/perps");
  await expect(page.getByTitle("BTC-PERP TradingView reference chart")).toBeVisible();
  await page.getByTestId("navbar-link-options").click();
  await expect(page).toHaveURL(/\/options$/);
  await page.getByTestId("navbar-link-perps").click();
  await expect(page).toHaveURL(/\/perps$/);
  await page.waitForTimeout(1500);
  expect(appErrors).toEqual([]);
});
