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
    // Allow docs to point at the Base Sepolia block-explorer home;
    // only flag actual hash-leak paths like /tx/0xabc... that would
    // expose internal addresses or transaction hashes.
    expect(html).not.toMatch(/basescan\.org\/(?:tx|address|block)\/0x[0-9a-fA-F]{40,}/);
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
    // The docs intentionally carry disclaimers like "Not mainnet-
    // ready", "Unaudited", and "Is this audited?"; require a
    // positive-verb context so disclaimers don't false-positive.
    expect(text).not.toMatch(/\bDeOpt is audited\b/i);
    expect(text).not.toMatch(/\b(?:is|are|now|fully)\s+mainnet[- ]ready\b/i);
    expect(text).not.toMatch(/\b(?:is|are|now|fully)\s+production[- ]ready\b/i);
    expect(text).not.toMatch(/\bsafe for real funds\b/i);
    expect(text).not.toMatch(/\bguaranteed uptime\b/i);
  }
});

test("landing CTA `Docs` is an internal link to /docs", async ({ page }) => {
  // The hero CTA was renamed from `landing-cta-quickstart` (pointing
  // at `/docs/quickstart`) to `landing-cta-docs` (pointing at the
  // docs index) when the docs IA was simplified. The test asserts the
  // current shape so future renames are caught explicitly.
  await installMockWallet(page);
  await page.goto("/");
  const cta = page.getByTestId("landing-cta-docs");
  await expect(cta).toHaveAttribute("href", "/docs");
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
