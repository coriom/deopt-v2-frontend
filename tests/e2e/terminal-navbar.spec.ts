/**
 * terminal-navbar.spec.ts — public testnet beta V1 terminal
 *
 * Covers the refactored top navbar + hamburger menu:
 *   - Options / Perps / Markets / Portfolio / API / DeOpt Académie visible
 *   - Options replaces the previous "Trade" label (route /trade unchanged)
 *   - Perps is an explicit primary nav item pointing at /perps
 *     placeholder
 *   - API + Académie are coming-soon placeholders (aria-disabled)
 *   - Hamburger button visible; opens a drawer with the required links
 *   - Drawer entries point at the right internal/external destinations
 *   - No admin links in the drawer
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

const NAVBAR_LINKS = [
  { testid: "navbar-link-options", href: "/trade", label: "Options" },
  { testid: "navbar-link-perps", href: "/perps", label: "Perps" },
  { testid: "navbar-link-markets", href: "/markets", label: "Markets" },
  { testid: "navbar-link-portfolio", href: "/portfolio", label: "Portfolio" },
  { testid: "navbar-link-custom", href: "/custom", label: "Custom" },
];

test("primary navbar shows Options / Perps / Markets / Portfolio / API / Académie", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  for (const { testid, href, label } of NAVBAR_LINKS) {
    const el = page.getByTestId(testid);
    await expect(el).toBeVisible();
    await expect(el).toHaveAttribute("href", href);
    await expect(el).toHaveText(label);
  }
  // API + Académie are coming-soon placeholders.
  for (const id of ["navbar-link-api", "navbar-link-academie"]) {
    const el = page.getByTestId(id);
    await expect(el).toBeVisible();
    await expect(el).toHaveAttribute("aria-disabled", "true");
    await expect(el).toHaveAttribute("data-placeholder", "true");
  }
});

test("primary navbar no longer renders the legacy 'Trade' label", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  // The previous testid no longer exists.
  await expect(page.getByTestId("navbar-link-trade")).toHaveCount(0);
  // No <nav> child carries the bare text "Trade".
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav).not.toContainText(/^Trade$/);
});

test("hamburger drawer opens and contains the docs/feedback/community/limitations links", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  await page.getByTestId("hamburger-button").click();
  await expect(page.getByTestId("hamburger-drawer")).toBeVisible();
  await expect(page.getByTestId("hamburger-link-docs-index")).toHaveAttribute(
    "href",
    "/docs",
  );
  await expect(page.getByTestId("hamburger-link-quickstart")).toHaveAttribute(
    "href",
    "/docs/quickstart",
  );
  await expect(page.getByTestId("hamburger-link-feedback")).toHaveAttribute(
    "href",
    "/feedback",
  );
  await expect(page.getByTestId("hamburger-link-limitations")).toHaveAttribute(
    "href",
    "/docs/limitations",
  );
  await expect(page.getByTestId("hamburger-link-discord")).toHaveAttribute(
    "href",
    "https://discord.gg/zaEMvWuxu",
  );
  await expect(page.getByTestId("hamburger-link-github")).toHaveAttribute(
    "href",
    "https://github.com/DeOpt",
  );
});

test("hamburger drawer renders Changelog as coming-soon placeholder", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  await page.getByTestId("hamburger-button").click();
  const cl = page.getByTestId("hamburger-link-changelog");
  await expect(cl).toBeVisible();
  await expect(cl).toHaveAttribute("data-placeholder", "true");
});

test("hamburger drawer contains no admin / mainnet / bearer / RPC URL leak", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  await page.getByTestId("hamburger-button").click();
  const drawer = page.getByTestId("hamburger-drawer");
  const html = await drawer.innerHTML();
  expect(html).not.toMatch(/\/admin\//);
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(html).not.toMatch(/alchemy\.com\/v2\/[A-Za-z0-9_-]+/);
  expect(html).not.toMatch(/infura\.io\/v3\/[A-Za-z0-9_-]+/);
  expect(html).not.toMatch(/DATABASE_URL/);
  expect(html).not.toMatch(/mainnet\.base\.org/);
  expect(html).not.toMatch(/^https?:\/\/basescan\.org/);
});

test("hamburger Escape key closes the drawer", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  await page.getByTestId("hamburger-button").click();
  await expect(page.getByTestId("hamburger-drawer")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("hamburger-drawer")).toHaveCount(0);
});
