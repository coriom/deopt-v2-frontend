/**
 * landing-product-v2.spec.ts —
 * FRONTEND-HOMEPAGE-COSMIC-LANDING-POLISH-V2
 *
 * Covers the V2-polished cosmic landing:
 *   - browser title is `DeOpt` (not `DeOpt v2`)
 *   - landing renders, cosmic backdrop attached, hero visible
 *   - hero headline + CTAs route to /trade, /markets, /docs
 *   - Options + Perps both mentioned and linked
 *   - scroll story: hero / options / perps / execution / architecture /
 *     faq / final cta — all attached
 *   - FAQ accordion: items exist, expand on click, plus icon present
 *   - Greek silhouettes render and use only local `/greeks/` assets
 *   - architecture diagram has the protocol node labels
 *   - body does NOT redundantly repeat testnet / public beta / no
 *     real funds (those live in the global banner + footer)
 *   - no positive-claim language
 *   - no admin / bearer / RPC / DATABASE_URL / mainnet leaks
 *   - no yellow / orange / amber brand classes
 *   - final CTAs route correctly
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("browser title is `DeOpt` (not `DeOpt v2`)", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  await expect(page).toHaveTitle(/^DeOpt$/);
});

test("landing renders the cosmic backdrop + hero", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  await expect(page.getByTestId("cosmic-backdrop")).toBeAttached();
  await expect(page.getByTestId("cosmic-landing")).toBeVisible();
  await expect(page.getByTestId("landing-hero")).toBeVisible();
  await expect(page.getByTestId("landing-hero-headline")).toBeVisible();
});

test("hero CTAs route to /trade, /markets, /docs", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  await expect(page.getByTestId("landing-cta-launch-app")).toHaveAttribute(
    "href",
    "/trade",
  );
  await expect(page.getByTestId("landing-cta-markets")).toHaveAttribute(
    "href",
    "/markets",
  );
  await expect(page.getByTestId("landing-cta-docs")).toHaveAttribute(
    "href",
    "/docs",
  );
});

test("Options + Perps are both mentioned and linked", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  await expect(page.getByTestId("landing-options-section")).toBeAttached();
  await expect(page.getByTestId("landing-options-cta")).toHaveAttribute(
    "href",
    "/trade",
  );
  await expect(page.getByTestId("landing-perps-section")).toBeAttached();
  await expect(page.getByTestId("landing-perps-cta")).toHaveAttribute(
    "href",
    "/perps",
  );
});

test("scroll story renders every narrative section (hero / options / perps / execution / architecture / faq / final)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  for (const id of [
    "landing-hero",
    "landing-options-section",
    "landing-perps-section",
    "landing-protocol-flow",
    "landing-architecture-section",
    "landing-faq-section",
    "landing-final-cta",
  ]) {
    await expect(page.getByTestId(id)).toBeAttached();
  }
});

test("hero uses the 5 Greek logos from /public/greeks/", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  for (const name of ["delta", "gamma", "theta", "vega", "rho"]) {
    await expect(
      page.getByTestId(`landing-hero-greek-${name}`),
    ).toBeAttached();
  }
  const imgs = page.locator("[data-testid^='landing-hero-greek-'] img");
  const count = await imgs.count();
  expect(count).toBe(5);
  for (let i = 0; i < count; i += 1) {
    const src = (await imgs.nth(i).getAttribute("src")) ?? "";
    expect(src.includes("/greeks/Logo_")).toBeTruthy();
  }
});

test("background Greek silhouettes render and reference local /greeks/ assets only", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const silhouettes = page.locator(
    "[data-testid^='landing-greek-silhouette-']",
  );
  const count = await silhouettes.count();
  expect(count).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < count; i += 1) {
    const img = silhouettes.nth(i).locator("img").first();
    const src = (await img.getAttribute("src")) ?? "";
    expect(src.startsWith("http://") || src.startsWith("https://")).toBeFalsy();
    // Next/Image rewrites the local path through `/_next/image?url=…`;
    // assert the source URL still resolves to a /greeks/ asset.
    expect(decodeURIComponent(src)).toContain("/greeks/");
  }
});

test("architecture diagram renders with the protocol node labels", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const diagram = page.getByTestId("landing-architecture-diagram");
  await expect(diagram).toBeAttached();
  const svgText = await diagram.locator("svg").innerHTML();
  for (const label of [
    "Intent",
    "Executor",
    "Risk",
    "Vault",
    "Oracle",
    "Settle",
    "Indexer",
  ]) {
    expect(svgText).toContain(label);
  }
});

test("FAQ section renders DeOpt-specific questions and rows expand", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const faq = page.getByTestId("landing-faq-section");
  await expect(faq).toBeAttached();
  await expect(page.getByTestId("landing-faq-list")).toBeAttached();
  for (const id of [
    "what",
    "products",
    "execution",
    "risk",
    "api",
    "fees",
    "more",
  ]) {
    await expect(
      page.getByTestId(`landing-faq-item-${id}`),
    ).toBeAttached();
  }
  // First row collapsed by default.
  const firstSummary = page.getByTestId("landing-faq-summary-what");
  await expect(firstSummary).toBeVisible();
  const detailsLocator = page.getByTestId("landing-faq-item-what");
  await expect(detailsLocator).not.toHaveAttribute("open", "");
  await firstSummary.click();
  await expect(detailsLocator).toHaveAttribute("open", "");
  await firstSummary.click();
  await expect(detailsLocator).not.toHaveAttribute("open", "");
});

test("FAQ plus icon present for every row", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  const icons = page.locator("[data-testid^='landing-faq-icon-']");
  const count = await icons.count();
  expect(count).toBeGreaterThanOrEqual(7);
});

test("landing body does NOT redundantly repeat testnet / public beta / no real funds inside `cosmic-landing`", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const text = await page.getByTestId("cosmic-landing").innerText();
  expect(text.match(/testnet/gi)?.length ?? 0).toBe(0);
  expect(text.match(/public beta/gi)?.length ?? 0).toBe(0);
  expect(text.match(/no real funds/gi)?.length ?? 0).toBe(0);
});

test("no positive-claim language anywhere in `<main>`", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  const body = await page.locator("main").innerText();
  expect(body).not.toMatch(/\bis audited\b/i);
  expect(body).not.toMatch(/\bmainnet-ready\b/i);
  expect(body).not.toMatch(/\bproduction-ready\b/i);
  expect(body).not.toMatch(/\bsafe for real funds\b/i);
  expect(body).not.toMatch(/\bguaranteed uptime\b/i);
  expect(body).not.toMatch(/\binstitutional-grade\b/i);
});

test("no admin / mainnet RPC / bearer / DATABASE_URL leaks in landing HTML", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const html = await page.getByTestId("cosmic-landing").innerHTML();
  expect(html).not.toMatch(/\/admin\//);
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(html).not.toMatch(/alchemy\.com\/v2\//);
  expect(html).not.toMatch(/infura\.io\/v3\//);
  expect(html).not.toMatch(/DATABASE_URL/);
  expect(html).not.toMatch(/mainnet\.base\.org/);
});

test("no yellow/orange/amber brand classes in landing HTML", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const html = await page.getByTestId("cosmic-landing").innerHTML();
  expect(html).not.toMatch(/\b(amber|yellow|orange)-[0-9]{2,3}\b/);
  expect(html).not.toMatch(/bg-(amber|yellow|orange)\b/);
});

test("final CTA routes (launch / markets / feedback)", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  await expect(page.getByTestId("landing-final-cta-launch")).toHaveAttribute(
    "href",
    "/trade",
  );
  await expect(page.getByTestId("landing-final-cta-markets")).toHaveAttribute(
    "href",
    "/markets",
  );
  await expect(page.getByTestId("landing-final-cta-feedback")).toHaveAttribute(
    "href",
    "/feedback",
  );
});

test("no broken image src — every <img> on landing has a non-empty src", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const imgs = page.locator("[data-testid='cosmic-landing'] img");
  const count = await imgs.count();
  for (let i = 0; i < count; i += 1) {
    const src = (await imgs.nth(i).getAttribute("src")) ?? "";
    expect(src.trim().length).toBeGreaterThan(0);
  }
});
