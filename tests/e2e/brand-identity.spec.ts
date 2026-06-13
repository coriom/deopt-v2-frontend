/**
 * brand-identity.spec.ts — public testnet beta DA followup
 *
 * Locks in the black + deep-green brand direction:
 *   - header logo is the favicon asset
 *   - main DOM on key trading routes contains no amber/yellow class
 *   - public-beta footer heading uses emerald not amber
 *   - Discord link is live and points to https://discord.gg/zaEMvWuxu
 */
import { test, expect } from "@playwright/test";
import {
  installMockWallet,
  DEFAULT_TEST_ACCOUNT,
  BASE_SEPOLIA_CHAIN_ID,
} from "./wallet-fixture";

test("header logo uses /favicon.png (same asset as the favicon)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const logo = page.getByTestId("header-logo");
  await expect(logo).toBeVisible();
  const src = await logo.getAttribute("src");
  expect(src).toContain("/favicon.png");
});

test("main DOM contains no amber/yellow Tailwind class on key routes", async ({
  page,
}) => {
  await installMockWallet(page, {
    account: DEFAULT_TEST_ACCOUNT,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });
  const routes = ["/", "/markets", "/portfolio", "/history", "/health"];
  for (const route of routes) {
    await page.goto(route);
    const html = await page.locator("main").innerHTML();
    expect(html, `route ${route} must not use amber-*`).not.toMatch(
      /class="[^"]*\bamber-/,
    );
    expect(html, `route ${route} must not use yellow-*`).not.toMatch(
      /class="[^"]*\byellow-/,
    );
  }
});

test("public-beta footer heading uses emerald (not amber/yellow)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const footer = page.getByTestId("public-beta-footer");
  await expect(footer).toBeVisible();
  const html = await footer.innerHTML();
  expect(html).toMatch(/text-emerald-/);
  expect(html).not.toMatch(/text-amber-/);
  expect(html).not.toMatch(/text-yellow-/);
});

test("Discord link is live and points at https://discord.gg/zaEMvWuxu", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const discord = page.getByTestId("public-beta-link-discord");
  await expect(discord).toBeVisible();
  // Live anchor — must be an <a>, not a "(coming soon)" span.
  const tag = await discord.evaluate((e) => e.tagName.toLowerCase());
  expect(tag).toBe("a");
  const href = await discord.getAttribute("href");
  expect(href).toBe("https://discord.gg/zaEMvWuxu");
});

test("Discord href is safe (no bearer / no RPC URL / no DB credential)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const href =
    (await page.getByTestId("public-beta-link-discord").getAttribute("href")) ??
    "";
  expect(href).not.toMatch(/Bearer/i);
  expect(href).not.toMatch(/postgres:\/\//);
  expect(href).not.toMatch(/DATABASE_URL/);
  expect(href).not.toMatch(/alchemy\.com\/v2\//);
  expect(href).not.toMatch(/infura\.io\/v3\//);
});
