/**
 * public-beta-footer.spec.ts — public testnet beta
 *
 * Covers the footer that surfaces public-beta docs links + safety
 * copy. Placeholder hrefs render as non-clickable text. Confirms the
 * footer never leaks an Authorization header or any secret-looking
 * value in its rendered DOM.
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

const REQUIRED_FOOTER_LINK_IDS = [
  "quickstart",
  "testing-guide",
  "limitations",
  "feedback",
  "discord",
  "github",
];

test("public beta footer renders all required link slots", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  await expect(page.getByTestId("public-beta-footer")).toBeVisible();
  for (const id of REQUIRED_FOOTER_LINK_IDS) {
    await expect(page.getByTestId(`public-beta-link-${id}`)).toBeVisible();
  }
});

test("public beta footer placeholder links are non-clickable", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  // All slots currently use {{PLACEHOLDER}} hrefs until the operator
  // wires real channels via the community-feedback-loop milestone.
  for (const id of REQUIRED_FOOTER_LINK_IDS) {
    const el = page.getByTestId(`public-beta-link-${id}`);
    const placeholder = await el.getAttribute("data-placeholder");
    // If placeholder, must not be an anchor with a real href.
    if (placeholder === "true") {
      const tag = await el.evaluate((e) => e.tagName.toLowerCase());
      expect(tag).not.toBe("a");
    }
  }
});

test("public beta footer DOM contains no secret-looking values", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const footer = page.getByTestId("public-beta-footer");
  await expect(footer).toBeVisible();
  const html = await footer.innerHTML();
  // No bearer tokens, no RPC URLs, no DATABASE_URL, no private keys.
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]+/);
  expect(html).not.toMatch(/DATABASE_URL/);
  expect(html).not.toMatch(/postgres:\/\//);
  expect(html).not.toMatch(/[a-f0-9]{64}/i); // 32-byte hex (private key)
  expect(html).not.toMatch(/alchemy\.com\/v2\/[A-Za-z0-9_-]+/);
  expect(html).not.toMatch(/infura\.io\/v3\/[A-Za-z0-9_-]+/);
});

test("safety-copy bullets are present on every trading route", async ({
  page,
}) => {
  await installMockWallet(page);
  const routes = ["/", "/markets", "/portfolio", "/history", "/health"];
  for (const route of routes) {
    await page.goto(route);
    await expect(
      page.getByText(/Base Sepolia.*Mainnet is disabled/i),
    ).toBeVisible();
    await expect(
      page.getByText(/NEVER share your private key/i),
    ).toBeVisible();
  }
});
