import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("trading UI never attaches Authorization header to backend XHRs", async ({
  page,
}) => {
  await installMockWallet(page);
  const seenAuthHeaders: string[] = [];
  // M-P4d — also flag any /admin/test/* fetch from the app runtime.
  // The backend M-P4c fixture is admin-gated; the cycler must only
  // be reached from the Playwright helper (APIRequestContext), never
  // from inside the browser app's window scope.
  const seenAdminTestUrls: string[] = [];

  const flag = async (route: import("@playwright/test").Route) => {
    const url = route.request().url();
    const auth = route.request().headers()["authorization"];
    if (auth) seenAuthHeaders.push(`${url} :: ${auth.slice(0, 8)}…`);
    if (url.includes("/admin/test/")) seenAdminTestUrls.push(url);
    // Let the request continue; backend may 404/CORS-fail but that's fine.
    await route.continue();
  };

  await page.route("**/options/**", flag);
  await page.route("**/trading/**", flag);
  await page.route("**/accounts/**", flag);
  await page.route("**/admin/**", flag);
  await page.route("**/executor/**", flag);

  await page.goto("/");
  await page.waitForTimeout(1000);
  await page.goto("/portfolio");
  await page.waitForTimeout(1000);
  await page.goto("/transactions/sentinel-intent-id");
  await page.waitForTimeout(1000);

  expect(
    seenAuthHeaders,
    "trading UI must NEVER attach an Authorization header",
  ).toEqual([]);
  expect(
    seenAdminTestUrls,
    "trading UI must NEVER request /admin/test/* from the browser runtime",
  ).toEqual([]);
});
