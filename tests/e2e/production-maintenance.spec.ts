import { expect, test } from "@playwright/test";

test("production trading routes fail closed without a configured backend", async ({ page }) => {
  test.skip(process.env.E2E_PRODUCTION_MAINTENANCE !== "1", "Run against a local next start production build");

  const loopbackRequests: string[] = [];
  const appErrors: string[] = [];
  page.on("request", (request) => {
    if (/^https?:\/\/(localhost|127\.0\.0\.1):(3000|8080)/.test(request.url())) {
      loopbackRequests.push(request.url());
    }
  });
  page.on("pageerror", (error) => appErrors.push(error.message));
  await page.addInitScript(() => {
    (window as Window & { __deoptFaucetAddress?: string }).__deoptFaucetAddress =
      "0x0000000000000000000000000000000000000001";
  });

  for (const route of ["/", "/options", "/perps", "/custom", "/api"]) {
    await page.goto(route);
    await expect(page.locator("body")).not.toContainText("Application error");
  }
  await expect(page.getByTestId("mint-tokens-request")).toBeVisible();
  await expect(page.getByTestId("mint-tokens-claim-button")).toHaveCount(0);
  await page.goto("/perps");
  await expect(page.getByTestId("widget-perps-trade-submit")).toBeDisabled();
  await page.goto("/options");
  await expect(page.getByTestId("markets-fallback-card")).toBeVisible();
  await page.reload();
  await expect(page.locator("body")).not.toContainText("Application error");
  expect(loopbackRequests).toEqual([]);
  expect(appErrors).toEqual([]);
});
