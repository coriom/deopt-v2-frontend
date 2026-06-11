import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("transactions page renders timeline + intent_id footer for unknown intent", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/transactions/test-intent-id-12345");
  await expect(page.getByText(/Transaction/i).first()).toBeVisible();
  // The intent_id is rendered in the footer.
  await expect(page.getByText(/test-intent-id-12345/)).toBeVisible();
  // The timeline always shows the CREATED stage even if backend is offline.
  await expect(page.getByText(/CREATED/)).toBeVisible();
});
