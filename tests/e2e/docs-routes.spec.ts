/**
 * docs-routes.spec.ts — internal docs routes
 *
 * Covers /docs + /docs/[slug] introduced by FRONTEND-INTEGRATED-DOCS-AND-FEEDBACK.
 *   - /docs index renders 4 doc cards + Feedback card + Discord + GitHub channels
 *   - each per-doc page renders the markdown prose + Back-to-docs link +
 *     Feedback + Discord CTAs
 *   - Discord link → https://discord.gg/zaEMvWuxu
 *   - GitHub link → https://github.com/DeOpt
 *   - Quickstart CTA on landing now routes to /docs/quickstart (internal)
 *   - No admin/mainnet/bearer/RPC/DB leak in the docs DOM
 *   - No amber/yellow brand classes on the docs DOM
 *   - No positive-claim drift on the docs DOM
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

const DOC_SLUGS = ["quickstart", "testing-guide", "limitations", "faq"];

test("/docs index renders 4 doc cards + Feedback + channel cards", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/docs");
  await expect(page.getByTestId("docs-index-intro")).toBeVisible();
  await expect(page.getByTestId("docs-disclaimer-banner")).toBeVisible();
  for (const slug of DOC_SLUGS) {
    await expect(page.getByTestId(`docs-card-${slug}`)).toBeVisible();
  }
  await expect(page.getByTestId("docs-card-feedback")).toBeVisible();
  await expect(page.getByTestId("docs-channel-discord")).toBeVisible();
  await expect(page.getByTestId("docs-channel-github")).toBeVisible();
});

for (const slug of DOC_SLUGS) {
  test(`/docs/${slug} renders the prose + back link + CTAs`, async ({ page }) => {
    await installMockWallet(page);
    await page.goto(`/docs/${slug}`);
    await expect(page.getByTestId(`docs-content-${slug}`)).toBeVisible();
    await expect(page.getByTestId(`docs-prose-${slug}`)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Back to docs/i }),
    ).toHaveAttribute("href", "/docs");
    await expect(page.getByTestId(`docs-feedback-cta-${slug}`)).toHaveAttribute(
      "href",
      "/feedback",
    );
    await expect(page.getByTestId(`docs-discord-cta-${slug}`)).toHaveAttribute(
      "href",
      "https://discord.gg/zaEMvWuxu",
    );
  });
}

test("docs channel cards point at the live Discord + GitHub org URLs", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/docs");
  await expect(page.getByTestId("docs-channel-discord")).toHaveAttribute(
    "href",
    "https://discord.gg/zaEMvWuxu",
  );
  await expect(page.getByTestId("docs-channel-github")).toHaveAttribute(
    "href",
    "https://github.com/DeOpt",
  );
});

test("docs DOM contains no admin/mainnet/bearer/RPC/DB leak", async ({
  page,
}) => {
  await installMockWallet(page);
  for (const route of ["/docs", "/docs/quickstart", "/docs/limitations"]) {
    await page.goto(route);
    const html = await page.locator("main").innerHTML();
    expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
    expect(html).not.toMatch(/alchemy\.com\/v2\/[A-Za-z0-9_-]+/);
    expect(html).not.toMatch(/infura\.io\/v3\/[A-Za-z0-9_-]+/);
    expect(html).not.toMatch(/postgres:\/\//);
    expect(html).not.toMatch(/DATABASE_URL=/);
    expect(html).not.toMatch(/PRIVATE_KEY=/);
    expect(html).not.toMatch(/mainnet\.base\.org/);
    expect(html).not.toMatch(/basescan\.org\/(?!tx|address|block)/);
    expect(html).not.toMatch(/\/admin\/test\//);
  }
});

test("docs DOM contains no amber/yellow Tailwind class", async ({ page }) => {
  await installMockWallet(page);
  for (const route of ["/docs", "/docs/quickstart", "/docs/faq"]) {
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

test("docs DOM contains no positive-claim language", async ({ page }) => {
  await installMockWallet(page);
  for (const route of ["/docs", "/docs/quickstart", "/docs/limitations"]) {
    await page.goto(route);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/\bDeOpt is audited\b/i);
    expect(text).not.toMatch(/\bmainnet-ready\b/i);
    expect(text).not.toMatch(/\bproduction-ready\b/i);
    expect(text).not.toMatch(/\bsafe for real funds\b/i);
    expect(text).not.toMatch(/\bguaranteed uptime\b/i);
  }
});

test("landing CTA quickstart now routes to /docs/quickstart (internal link)", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  const cta = page.getByTestId("landing-cta-quickstart");
  await expect(cta).toHaveAttribute("href", "/docs/quickstart");
  await expect(cta).toHaveAttribute("data-target", "internal");
});

test("public-beta footer renders internal vs external links correctly", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/");
  // Quickstart / testing-guide / limitations / feedback → internal Next <Link>.
  for (const id of ["quickstart", "testing-guide", "limitations", "feedback"]) {
    const el = page.getByTestId(`public-beta-link-${id}`);
    await expect(el).toHaveAttribute("data-target", "internal");
  }
  // Discord + GitHub → external <a target="_blank">.
  for (const id of ["discord", "github"]) {
    const el = page.getByTestId(`public-beta-link-${id}`);
    await expect(el).toHaveAttribute("data-target", "external");
  }
});

test("footer GitHub link points to https://github.com/DeOpt", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/");
  const link = page.getByTestId("public-beta-link-github");
  await expect(link).toHaveAttribute("href", "https://github.com/DeOpt");
});
