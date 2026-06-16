/**
 * landing-product-v2.spec.ts —
 * FRONTEND-HOMEPAGE-PARTICLE-FIELD-V6
 *
 * V6 polish:
 *   - new product-oriented hero headline + subhead that explicitly
 *     mention decentralized options, perps, low-fee execution, APIs,
 *     and customizable trading workspaces
 *   - particle field now bumps density via `data-particle-density`
 *     and exposes `data-scroll-parallax="true"` on its root
 *   - ambient Greek silhouettes denser (≥ 16 across the page)
 *   - FAQ title is still exactly "Some Questions"
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("browser title is `DeOpt`", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  await expect(page).toHaveTitle(/^DeOpt$/);
});

test("old `Programmable derivatives` slogan is fully gone", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const body = await page.locator("main").innerText();
  expect(body).not.toMatch(/Programmable derivatives\. On chain\./i);
  expect(body).not.toMatch(/Programmable derivatives/i);
});

test("hero headline mentions options + perps + low-fee + APIs + customizable workspaces", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const text = (
    await page.getByTestId("landing-hero-headline").innerText()
  ).toLowerCase();
  expect(text).toContain("decentralized");
  expect(text).toContain("options");
  expect(text).toContain("perps");
  expect(text).toMatch(/low[- ]fee|fee[- ]efficient/);
  expect(text).toMatch(/apis?\b/);
  expect(text).toContain("customizable");
  expect(text).toMatch(/workspaces?\b|interface\b/);
});

test("hero subhead reinforces the product surface (options · perps · API · workspace)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const text = (
    await page.getByTestId("landing-hero-subhead").innerText()
  ).toLowerCase();
  expect(text).toContain("options");
  expect(text).toContain("perps");
  expect(text).toMatch(/apis?\b/);
  expect(text).toMatch(/workspaces?\b/);
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

test("V4 DNA backdrop testids are still GONE", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  for (const id of [
    "digital-dna-backdrop",
    "dna-helix-column",
    "dna-strand-a",
    "dna-strand-b",
    "dna-particle-field",
  ]) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }
});

test("particle field root exposes scroll-parallax + density data attributes", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const field = page.getByTestId("particle-field");
  await expect(field).toBeAttached();
  await expect(field).toHaveAttribute("data-particle-field", "true");
  await expect(field).toHaveAttribute("data-scroll-reactive-background", "true");
  await expect(field).toHaveAttribute("data-scroll-parallax", "true");
  await expect(field).toHaveAttribute(
    "data-particle-mode",
    /(calm|wave|nodes|sparse)/,
  );
  // Density attribute is populated by the canvas resize step after
  // mount. Allow a tick for the layout effect.
  await page.waitForTimeout(80);
  const density = await field.getAttribute("data-particle-density");
  expect(density).not.toBeNull();
  expect(Number(density)).toBeGreaterThanOrEqual(120);
  await expect(page.getByTestId("particle-field-canvas")).toBeAttached();
});

test("particle mode morphs across scroll progress (calm → not-calm)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const field = page.getByTestId("particle-field");
  await expect(field).toHaveAttribute("data-particle-mode", "calm");
  const target = await page.evaluate(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return Math.max(1, Math.floor(max * 0.7));
  });
  await page.evaluate((y) => window.scrollTo({ top: y }), target);
  await page.waitForTimeout(120);
  const mode = await field.getAttribute("data-particle-mode");
  expect(mode).not.toBe("calm");
  expect(["wave", "nodes", "sparse"]).toContain(mode);
});

test("particle field DOES NOT block link clicks", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  await page.getByTestId("landing-cta-launch-app").click();
  await page.waitForURL("**/trade");
});

test("FAQ title is exactly `Some Questions`", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  const faq = page.getByTestId("landing-faq-section");
  await expect(faq).toContainText(/^Some Questions$/m);
  await expect(faq).not.toContainText(/Frequently asked/i);
});

test("FAQ items + expand/collapse", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  for (const id of [
    "what",
    "products",
    "execution",
    "risk",
    "api",
    "fees",
    "more",
  ]) {
    await expect(page.getByTestId(`landing-faq-item-${id}`)).toBeAttached();
  }
  const summary = page.getByTestId("landing-faq-summary-what");
  const details = page.getByTestId("landing-faq-item-what");
  await expect(details).not.toHaveAttribute("open", "");
  await summary.click();
  await expect(details).toHaveAttribute("open", "");
  await summary.click();
  await expect(details).not.toHaveAttribute("open", "");
});

test("ambient Greek background is enriched (≥ 16 silhouettes) with local /greeks/ assets only", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const silhouettes = page.locator(
    "[data-testid^='landing-greek-silhouette-']",
  );
  const count = await silhouettes.count();
  expect(count).toBeGreaterThanOrEqual(16);
  for (let i = 0; i < count; i += 1) {
    const img = silhouettes.nth(i).locator("img").first();
    const src = (await img.getAttribute("src")) ?? "";
    expect(src.startsWith("http://") || src.startsWith("https://")).toBeFalsy();
    expect(decodeURIComponent(src)).toContain("/greeks/");
  }
});

test("hero does NOT render a foreground Greek-tile row under the CTAs", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  await expect(page.getByTestId("landing-hero-greeks")).toHaveCount(0);
  for (const name of ["delta", "gamma", "theta", "vega", "rho"]) {
    await expect(
      page.getByTestId(`landing-hero-greek-${name}`),
    ).toHaveCount(0);
  }
});

test("scroll story renders every narrative section", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  for (const id of [
    "landing-hero",
    "landing-products-section",
    "landing-options-section",
    "landing-perps-section",
    "landing-protocol-flow",
    "landing-architecture-section",
    "landing-risk-section",
    "landing-faq-section",
    "landing-final-cta",
  ]) {
    await expect(page.getByTestId(id)).toBeAttached();
  }
});

test("architecture diagram retains 3 tiers with readable labels", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const labels: Array<{ id: string; text: RegExp }> = [
    { id: "intent", text: /Signed intent/i },
    { id: "executor", text: /Execution layer/i },
    { id: "margin", text: /Margin engine/i },
    { id: "vault", text: /Collateral vault/i },
    { id: "oracle", text: /Oracle router/i },
    { id: "settle", text: /Settlement/i },
    { id: "indexer", text: /Indexer/i },
  ];
  for (const l of labels) {
    await expect(
      page.getByTestId(`landing-arch-node-${l.id}`),
    ).toContainText(l.text);
  }
});

test("landing body does NOT redundantly repeat testnet / public beta / no real funds", async ({
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
  expect(body).not.toMatch(/\blowest fees\b/i);
  expect(body).not.toMatch(/\bcheapest\b/i);
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
