import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("markets page renders from mock API or shows empty state gracefully", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/markets");
  await expect(page.getByText(/Markets/i).first()).toBeVisible();
  // The MarketSelector shows either products or the "No products" empty
  // state. Both are acceptable for this smoke.
  const products = page.locator("a", { hasText: /Call|Put/i });
  const empty = page.getByText(/No products available/i);
  await expect(products.first().or(empty)).toBeVisible();
});
