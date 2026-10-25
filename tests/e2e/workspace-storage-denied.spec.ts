import { expect, test } from "@playwright/test";

test("trading routes remain usable when browser storage denies workspace reads", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const deny = () => {
      throw new DOMException("Storage unavailable", "SecurityError");
    };
    Storage.prototype.getItem = deny;
    Storage.prototype.setItem = deny;
    Storage.prototype.removeItem = deny;
    Storage.prototype.key = deny;
  });

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  for (const route of ["/options", "/perps", "/custom"]) {
    await page.goto(route);
    await expect(page.getByTestId("terminal-navbar")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
    await page.reload();
    await expect(page.getByTestId("terminal-navbar")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  }

  expect(errors).toEqual([]);
});
