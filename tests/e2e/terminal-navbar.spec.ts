/**
 * terminal-navbar.spec.ts — FRONTEND-NAVBAR-HAMBURGER-IA-CLEANUP
 *
 * Post-cleanup the trading-terminal navbar is compact and
 * trading-focused:
 *   - Options / Perps / Markets / Custom + the DeOpt Académie
 *     coming-soon placeholder are visible.
 *   - Portfolio + API are NO LONGER primary nav items.
 *   - Portfolio remains reachable from the hamburger menu and the
 *     /portfolio route still works.
 *   - The legacy "Trade" label is still gone.
 *   - Hamburger drawer carries the full IA: Pages / Docs / Community.
 *   - No admin / mainnet / bearer / RPC URL leak in the drawer.
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

const PRIMARY_NAV_LINKS = [
  { testid: "navbar-link-options", href: "/trade", label: "Options" },
  { testid: "navbar-link-perps", href: "/perps", label: "Perps" },
  { testid: "navbar-link-markets", href: "/markets", label: "Markets" },
  { testid: "navbar-link-custom", href: "/custom", label: "Custom" },
];

test("primary navbar shows Options / Perps / Markets / Custom + Académie placeholder", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  for (const { testid, href, label } of PRIMARY_NAV_LINKS) {
    const el = page.getByTestId(testid);
    await expect(el).toBeVisible();
    await expect(el).toHaveAttribute("href", href);
    await expect(el).toHaveText(label);
  }
  // Académie remains a coming-soon placeholder.
  const academie = page.getByTestId("navbar-link-academie");
  await expect(academie).toBeVisible();
  await expect(academie).toHaveAttribute("aria-disabled", "true");
  await expect(academie).toHaveAttribute("data-placeholder", "true");
});

test("primary navbar does NOT show Portfolio or API as primary items", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  await expect(page.getByTestId("navbar-link-portfolio")).toHaveCount(0);
  await expect(page.getByTestId("navbar-link-api")).toHaveCount(0);
});

test("primary navbar no longer renders the legacy 'Trade' label", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  await expect(page.getByTestId("navbar-link-trade")).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav).not.toContainText(/^Trade$/);
});

test("hamburger drawer opens and carries the full V2 IA (Pages / Docs / Community)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  await page.getByTestId("hamburger-button").click();
  await expect(page.getByTestId("hamburger-drawer")).toBeVisible();

  // Section headers exist.
  await expect(page.getByTestId("hamburger-section-pages")).toBeVisible();
  await expect(page.getByTestId("hamburger-section-docs")).toBeVisible();
  await expect(page.getByTestId("hamburger-section-community")).toBeVisible();

  // Pages: Portfolio + Fees + API + Feedback.
  await expect(page.getByTestId("hamburger-link-portfolio")).toHaveAttribute(
    "href",
    "/portfolio",
  );
  await expect(page.getByTestId("hamburger-link-fees")).toHaveAttribute(
    "href",
    "/fees",
  );
  await expect(page.getByTestId("hamburger-link-api")).toHaveAttribute(
    "href",
    "/api",
  );
  await expect(page.getByTestId("hamburger-link-feedback")).toHaveAttribute(
    "href",
    "/feedback",
  );

  // Docs section.
  await expect(page.getByTestId("hamburger-link-docs-index")).toHaveAttribute(
    "href",
    "/docs",
  );
  await expect(page.getByTestId("hamburger-link-quickstart")).toHaveAttribute(
    "href",
    "/docs/quickstart",
  );
  await expect(page.getByTestId("hamburger-link-limitations")).toHaveAttribute(
    "href",
    "/docs/limitations",
  );
  await expect(page.getByTestId("hamburger-link-faq")).toHaveAttribute(
    "href",
    "/docs/faq",
  );

  // Community.
  await expect(page.getByTestId("hamburger-link-discord")).toHaveAttribute(
    "href",
    "https://discord.gg/zaEMvWuxu",
  );
  await expect(page.getByTestId("hamburger-link-github")).toHaveAttribute(
    "href",
    "https://github.com/DeOpt",
  );
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

test("Portfolio route still works after navbar cleanup", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/portfolio");
  await expect(page.getByTestId("portfolio-testnet-only-banner")).toBeVisible();
});
