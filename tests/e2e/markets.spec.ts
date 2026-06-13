import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("markets page renders from mock API or shows the dark/green fallback gracefully", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/markets");
  await expect(page.getByText(/Markets/i).first()).toBeVisible();
  // The MarketSelector shows either products OR the new MarketsFallbackCard
  // (which covers both backend-unavailable and no-products kinds).
  const products = page.locator("a", { hasText: /Call|Put/i });
  const fallback = page.getByTestId("markets-fallback-card");
  await expect(products.first().or(fallback)).toBeVisible();
});
