/**
 * feedback-route.spec.ts — internal /feedback route
 *
 * Covers /feedback introduced by FRONTEND-INTEGRATED-DOCS-AND-FEEDBACK.
 *   - safety panel visible with NEVER-share warnings
 *   - bug-report form fields present
 *   - preview block updates from form inputs
 *   - Copy button + Discord link + GitHub link present
 *   - preview block never contains bearer / RPC URL / DATABASE_URL /
 *     PRIVATE_KEY / bare 64-hex (private-key shape)
 *   - Discord → https://discord.gg/zaEMvWuxu
 *   - GitHub → https://github.com/DeOpt
 *   - NO email submission, NO server-side endpoint called from /feedback
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

test("/feedback intro + safety + form sections render", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/feedback");
  await expect(page.getByTestId("feedback-disclaimer-banner")).toBeVisible();
  await expect(page.getByTestId("feedback-intro")).toBeVisible();
  await expect(page.getByTestId("feedback-safety")).toBeVisible();
  await expect(page.getByTestId("feedback-form")).toBeVisible();
  await expect(page.getByTestId("feedback-preview")).toBeVisible();
});

test("safety panel surfaces the 5 NEVER-share rules", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/feedback");
  const safety = page.getByTestId("feedback-safety");
  const text = await safety.innerText();
  expect(text).toMatch(/Private keys/i);
  expect(text).toMatch(/Seed phrases? \/ mnemonics?/i);
  expect(text).toMatch(/RPC URLs? with embedded API keys?/i);
  expect(text).toMatch(/Admin bearer tokens?/i);
  expect(text).toMatch(/\.env contents?/i);
  expect(text).toMatch(/NEVER ask you/i);
});

test("Copy button + Discord + GitHub CTAs are present with safe hrefs", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/feedback");
  await expect(page.getByTestId("feedback-copy-button")).toBeVisible();
  await expect(page.getByTestId("feedback-discord-cta")).toHaveAttribute(
    "href",
    "https://discord.gg/zaEMvWuxu",
  );
  await expect(page.getByTestId("feedback-github-cta")).toHaveAttribute(
    "href",
    "https://github.com/DeOpt",
  );
});

test("preview updates from form inputs and remains public-safe", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/feedback");
  await page.getByTestId("feedback-input-title").fill("Sign button stuck");
  await page
    .getByTestId("feedback-input-wallet")
    .fill("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  await page.getByTestId("feedback-input-tx-hash").fill("0xdeadbee5");
  const preview = await page.getByTestId("feedback-preview").innerText();
  expect(preview).toContain("Sign button stuck");
  expect(preview).toContain("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  expect(preview).toContain("0xdeadbee5");
  expect(preview).toContain("Chain id seen by the app: 84532");
  // Closing safety reminder.
  expect(preview).toMatch(/NEVER share private keys/i);
});

test("preview never contains credential-shaped values", async ({ page }) => {
  await installMockWallet(page);
  await page.goto("/feedback");
  const preview = await page.getByTestId("feedback-preview").innerText();
  expect(preview).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(preview).not.toMatch(/alchemy\.com\/v2\/[A-Za-z0-9_-]+/);
  expect(preview).not.toMatch(/infura\.io\/v3\/[A-Za-z0-9_-]+/);
  expect(preview).not.toMatch(/postgres:\/\//);
  expect(preview).not.toMatch(/DATABASE_URL=/);
  // Bare 64-hex (private-key shape; NOT 0x-prefixed tx hashes).
  expect(preview).not.toMatch(/(?:^|[^0-9a-fx])[0-9a-f]{64}(?:[^0-9a-f]|$)/i);
});

test("/feedback does not fire any network requests on form submit", async ({
  page,
}) => {
  await installMockWallet(page);
  const seen: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    // Ignore navigation requests + static asset fetches.
    if (
      req.resourceType() === "document" ||
      req.resourceType() === "script" ||
      req.resourceType() === "stylesheet" ||
      req.resourceType() === "font" ||
      req.resourceType() === "image"
    ) {
      return;
    }
    seen.push(url);
  });
  await page.goto("/feedback");
  await page.getByTestId("feedback-input-title").fill("Test issue");
  await page.getByTestId("feedback-input-actual").fill("Nothing broke yet");
  // Click Copy — must NOT trigger any XHR or fetch.
  await page.getByTestId("feedback-copy-button").click();
  // Allow a short delay for any deferred network activity.
  await page.waitForTimeout(500);
  // Filter out anything that's clearly not a feedback-submission
  // attempt. Next.js prefetches and RSC fetches against `/feedback`
  // appear as `/feedback?_rsc=...` (or `_rsc` payload requests) —
  // those are internal navigation, NOT a form submission.
  const submission = seen.filter(
    (u) =>
      (u.includes("/api/") ||
        u.includes("/feedback") ||
        u.includes("formspree") ||
        u.includes("typeform") ||
        u.includes("tally") ||
        u.includes("mailto:")) &&
      !u.includes("?_rsc=") &&
      !u.includes("&_rsc="),
  );
  expect(
    submission,
    "feedback page must not call any submission endpoint",
  ).toEqual([]);
});

test("/feedback DOM contains no admin/mainnet/positive-claim leak", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/feedback");
  const html = await page.locator("main").innerHTML();
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(html).not.toMatch(/alchemy\.com\/v2\/[A-Za-z0-9_-]+/);
  expect(html).not.toMatch(/DATABASE_URL=/);
  expect(html).not.toMatch(/\/admin\/test\//);
  expect(html).not.toMatch(/mainnet\.base\.org/);
  // Amber / yellow brand classes — none.
  expect(html).not.toMatch(/class="[^"]*\bamber-/);
  expect(html).not.toMatch(/class="[^"]*\byellow-/);
  // Positive-claim language.
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/\bis audited\b/i);
  expect(text).not.toMatch(/\bmainnet-ready\b/i);
  expect(text).not.toMatch(/\bproduction-ready\b/i);
  expect(text).not.toMatch(/\bsafe for real funds\b/i);
});
