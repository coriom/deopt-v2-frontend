import { expect, test } from "@playwright/test";

test("TradingView stays in an iframe across route changes and reloads", async ({ page }) => {
  const appErrors: string[] = [];
  page.on("pageerror", (error) => {
    if (error.stack?.includes("127.0.0.1") || error.stack?.includes("localhost")) {
      appErrors.push(error.message);
    }
  });

  await page.goto("/perps");
  const chart = page.getByTitle("BTC-PERP TradingView reference chart");
  await expect(chart).toBeVisible();
  await expect(chart).toHaveAttribute("src", /s\.tradingview\.com\/widgetembed/);
  await expect(page.locator("script[src*='tradingview.com/tv.js']")).toHaveCount(0);

  await page.getByTestId("navbar-link-options").click();
  await expect(page).toHaveURL(/\/options$/);
  await page.getByTestId("navbar-link-perps").click();
  await expect(chart).toBeVisible();
  await page.reload();
  await expect(chart).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Application error");
  expect(appErrors).toEqual([]);
});
