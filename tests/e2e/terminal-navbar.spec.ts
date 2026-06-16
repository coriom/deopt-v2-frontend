/**
 * terminal-navbar.spec.ts — FRONTEND-NAVBAR-IA-V1
 *
 * Post-IA-V1 the trading-terminal navbar is laid out as:
 *
 *   left side (in DOM order):
 *     logo → "DeOpt" brand → hamburger button →
 *     Options → Perps → Markets → RFQ/Strategy → Custom → DeOpt Academy
 *
 *   right side (in DOM order):
 *     Widget → Connect wallet
 *
 *   removed: the standalone "no network" badge.
 *   renamed: Académie → Academy (with link to /docs).
 *   added:   RFQ/Strategy (link to /rfq-strategy).
 *
 *   the hamburger now opens a LEFT-anchored drawer that lists the
 *   13 primary IA items in exact order:
 *
 *     Options · Perps · Markets · RFQ/Strategy · Custom · DeOpt Academy ·
 *     History · Leaderboard · API · Fees · Fundings · Settings · Support
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

const PRIMARY_NAV_ORDER = [
  { testid: "navbar-link-options",      href: "/trade",         label: "Options" },
  { testid: "navbar-link-perps",        href: "/perps",         label: "Perps" },
  { testid: "navbar-link-markets",      href: "/markets",       label: "Markets" },
  { testid: "navbar-link-rfq-strategy", href: "/rfq-strategy",  label: "RFQ/Strategy" },
  { testid: "navbar-link-custom",       href: "/custom",        label: "Custom" },
  { testid: "navbar-link-academy",      href: "/docs",          label: "DeOpt Academy" },
];

const DRAWER_ORDER = [
  "options",
  "perps",
  "markets",
  "rfq-strategy",
  "custom",
  "academy",
  "history",
  "leaderboard",
  "api",
  "fees",
  "fundings",
  "settings",
  "support",
];

const DRAWER_HREFS: Record<string, string> = {
  options: "/trade",
  perps: "/perps",
  markets: "/markets",
  "rfq-strategy": "/rfq-strategy",
  custom: "/custom",
  academy: "/docs",
  history: "/history",
  leaderboard: "/leaderboard",
  api: "/api",
  fees: "/fees",
  fundings: "/fundings",
  settings: "/settings",
  support: "/feedback",
};

test("primary navbar shows the 6 IA-V1 items in exact order with correct hrefs", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  for (const { testid, href, label } of PRIMARY_NAV_ORDER) {
    const el = page.getByTestId(testid);
    await expect(el).toBeVisible();
    await expect(el).toHaveAttribute("href", href);
    await expect(el).toHaveText(label);
  }
});

test("navbar DOES NOT render the old `Académie` label nor the `no network` badge", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const navbar = page.getByTestId("terminal-navbar");
  await expect(navbar).not.toContainText(/Académie/);
  await expect(navbar).not.toContainText(/Academie/);
  await expect(navbar).not.toContainText(/no network/i);
  // The old test-id is gone too.
  await expect(page.getByTestId("navbar-link-academie")).toHaveCount(0);
});

test("hamburger lives in the left navbar between DeOpt and Options (exactly one)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  // Exactly one hamburger trigger in the document.
  const buttons = page.locator('[data-testid="hamburger-button"]');
  expect(await buttons.count()).toBe(1);
  // DOM order: header-home-link → hamburger-button → navbar-link-options.
  const positions = await page.evaluate(() => {
    const ids = ["header-home-link", "hamburger-button", "navbar-link-options"];
    const nodes = ids.map((id) => document.querySelector(`[data-testid="${id}"]`));
    if (nodes.some((n) => !n)) return null;
    const range = document.createRange();
    return nodes.map((n) => {
      range.selectNode(n!);
      const r = range.getBoundingClientRect();
      return { x: r.left, y: r.top };
    });
  });
  expect(positions).not.toBeNull();
  if (positions) {
    // hamburger sits to the right of DeOpt, and Options sits to the right of hamburger.
    expect(positions[1].x).toBeGreaterThan(positions[0].x);
    expect(positions[2].x).toBeGreaterThan(positions[1].x);
  }
});

test("right-side controls are exactly [Widget, Connect wallet] in that order", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/trade");
  const actions = page.getByTestId("terminal-navbar-actions");
  await expect(actions).toBeVisible();
  const widget = actions.getByTestId("navbar-widget-button");
  const wallet = actions.locator('[data-testid="wallet-connect-button"]');
  await expect(widget).toBeVisible();
  await expect(wallet).toBeVisible();
  // The "no network" badge is gone from the actions area.
  await expect(actions).not.toContainText(/no network/i);
  // DOM ordering: widget before wallet.
  const order = await actions.evaluate((el) => {
    const ids = Array.from(
      el.querySelectorAll("[data-testid]"),
    ).map((n) => (n as HTMLElement).dataset.testid);
    return ids;
  });
  const widgetIdx = order.indexOf("navbar-widget-button");
  const walletIdx = order.indexOf("wallet-connect-button");
  expect(widgetIdx).toBeGreaterThanOrEqual(0);
  expect(walletIdx).toBeGreaterThanOrEqual(0);
  expect(widgetIdx).toBeLessThan(walletIdx);
});

test("hamburger drawer opens from the LEFT side", async ({ page }) => {
  await installMockWallet(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByTestId("hamburger-button").click();
  const drawer = page.getByTestId("hamburger-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute("data-drawer-side", "left");
  const panel = page.getByTestId("hamburger-drawer-panel");
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    // Panel anchored to the left edge of the viewport (within a few px).
    expect(box.x).toBeLessThanOrEqual(2);
    expect(box.x + box.width).toBeLessThan(640);
  }
});

test("hamburger drawer carries the 13 IA-V1 items in exact order with correct hrefs", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  await page.getByTestId("hamburger-button").click();
  const drawer = page.getByTestId("hamburger-drawer");
  await expect(drawer).toBeVisible();
  for (const id of DRAWER_ORDER) {
    const link = page.getByTestId(`hamburger-link-${id}`);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", DRAWER_HREFS[id]);
  }
  // Order is preserved in the DOM.
  const renderedOrder = await page.evaluate((order) => {
    return order.map((id) => {
      const el = document.querySelector(`[data-testid="hamburger-link-${id}"]`);
      if (!el) return -1;
      const all = Array.from(document.querySelectorAll('[data-testid^="hamburger-link-"]'));
      return all.indexOf(el);
    });
  }, DRAWER_ORDER);
  for (let i = 1; i < renderedOrder.length; i += 1) {
    expect(renderedOrder[i]).toBeGreaterThan(renderedOrder[i - 1]);
  }
});

test("hamburger drawer keeps Discord + GitHub as small secondary links (not competing with the primary order)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  await page.getByTestId("hamburger-button").click();
  const discord = page.getByTestId("hamburger-link-discord");
  const github = page.getByTestId("hamburger-link-github");
  await expect(discord).toHaveAttribute("href", "https://discord.gg/zaEMvWuxu");
  await expect(github).toHaveAttribute("href", "https://github.com/DeOpt");
  // They live in a different container than the primary 13.
  const secondary = page.getByTestId("hamburger-secondary-list");
  await expect(secondary).toContainText(/Discord/);
  await expect(secondary).toContainText(/GitHub/);
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
});

test("hamburger drawer Escape key closes it", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  await page.getByTestId("hamburger-button").click();
  await expect(page.getByTestId("hamburger-drawer")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("hamburger-drawer")).toHaveCount(0);
});

test("hamburger drawer outside-click closes it", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  await page.getByTestId("hamburger-button").click();
  await expect(page.getByTestId("hamburger-drawer")).toBeVisible();
  // Click outside the panel (right half of the screen).
  await page.mouse.click(1100, 400);
  await expect(page.getByTestId("hamburger-drawer")).toHaveCount(0);
});

test("Portfolio route still resolves after navbar IA cleanup", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/portfolio");
  await expect(page.getByTestId("portfolio-testnet-only-banner")).toBeVisible();
});

test("navbar HTML carries no amber/yellow/orange brand classes", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/trade");
  const html = await page.getByTestId("terminal-navbar").innerHTML();
  expect(html).not.toMatch(/\b(amber|yellow|orange)-[0-9]{2,3}\b/);
  expect(html).not.toMatch(/bg-(amber|yellow|orange)\b/);
});
