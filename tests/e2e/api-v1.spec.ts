/**
 * api-v1.spec.ts — FRONTEND-DEVELOPERS-CONSOLE-V1 (minimal layout)
 *
 * The `/api` page is the in-app Developers landing. It must be:
 *   - sparse: title + 4 icon links + Wallet/Signer row + Mint Tokens
 *     card + Session Keys card + Subaccounts card + footer
 *   - free of long-form documentation
 *   - free of any environment / HTTP / WS / MM status panels
 *   - free of fake session keys / subaccounts / mint endpoints
 *   - linked out to the docs site through the configurable docs URL
 *   - linked to `/api/sandbox` for the live WebSocket sandbox
 */
import { test, expect } from "@playwright/test";

test("/api renders the simplified Developers landing", async ({ page }) => {
  await page.goto("/api");
  for (const id of [
    "developers-console",
    "developers-console-header",
    "developers-console-quicklinks",
    "developers-console-identity",
    "developers-console-mint",
    "developers-console-session-keys",
    "developers-console-subaccounts",
    "developers-console-footer",
    "developers-console-sandbox-link",
  ]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
});

test("/api header quick links route to docs / GitHub", async ({ page }) => {
  await page.goto("/api");
  const expectations: Array<[string, RegExp]> = [
    ["developers-quicklink-guides", /\/quickstart$/],
    ["developers-quicklink-api-reference", /\/developers$/],
    ["developers-quicklink-github", /github\.com\/DeOpt$/],
    ["developers-quicklink-environment", /\/limitations$/],
  ];
  for (const [id, re] of expectations) {
    const href = await page.getByTestId(id).getAttribute("href");
    expect(href ?? "").toMatch(re);
  }
});

test("/api wallet + signer cells show 'Not connected' / 'Not available' by default", async ({
  page,
}) => {
  await page.goto("/api");
  await expect(page.getByTestId("identity-wallet")).toContainText(/Not connected/);
  await expect(page.getByTestId("identity-signer")).toContainText(/Not available/);
});

test("/api Mint Tokens card carries the planned chip and no live action", async ({
  page,
}) => {
  await page.goto("/api");
  await expect(page.getByTestId("mint-tokens-action")).toBeDisabled();
  await expect(page.getByTestId("mint-tokens-action")).toContainText(
    /Mint UI planned/,
  );
});

test("/api Session Keys card is empty with disabled register button", async ({
  page,
}) => {
  await page.goto("/api");
  const btn = page.getByTestId("session-keys-register");
  await expect(btn).toBeDisabled();
  await expect(btn).toContainText(/Register Session Key/);
  await expect(page.getByTestId("session-keys-table-empty")).toContainText(
    /No session keys registered/,
  );
});

test("/api Subaccounts card is empty with disabled create button", async ({
  page,
}) => {
  await page.goto("/api");
  const btn = page.getByTestId("subaccounts-create");
  await expect(btn).toBeDisabled();
  await expect(btn).toContainText(/Create Subaccount/);
  await expect(page.getByTestId("subaccounts-table-empty")).toContainText(
    /No subaccounts configured/,
  );
});

test("/api footer carries the MM Gateway note + link to the sandbox", async ({
  page,
}) => {
  await page.goto("/api");
  await expect(page.getByTestId("developers-console-mm-note")).toContainText(
    /operator-whitelisted/i,
  );
  await expect(page.getByTestId("developers-console-mm-link")).toHaveAttribute(
    "href",
    /\/developers\/mm-gateway$/,
  );
  await expect(page.getByTestId("developers-console-sandbox-link")).toHaveAttribute(
    "href",
    "/api/sandbox",
  );
});

test("/api no longer carries the long-form documentation or status dump", async ({
  page,
}) => {
  await page.goto("/api");
  for (const removed of [
    "api-shell",
    "api-http-endpoint-table",
    "api-ws-method-table",
    "api-private-channel-table",
    "api-auth-canonical",
    "api-mm-explicit",
    "api-profile-table",
    "dev-panel",
    "developers-console-environment",
    "card-public-api",
    "card-wallet-auth",
    "api-ws-quick-test",
  ]) {
    await expect(page.getByTestId(removed)).toHaveCount(0);
  }
});

test("/api/sandbox renders the WebSocket sandbox with a back link", async ({
  page,
}) => {
  await page.goto("/api/sandbox");
  await expect(page.getByTestId("api-sandbox-page")).toBeVisible();
  await expect(page.getByTestId("api-sandbox-back")).toHaveAttribute("href", "/api");
  for (const id of [
    "api-ws-quick-test",
    "api-ws-quick-test-url",
    "api-ws-quick-test-connect",
    "api-ws-quick-test-ping",
    "api-ws-quick-test-sub-trading.health",
    "api-ws-quick-test-sub-options.products",
    "api-ws-quick-test-sub-leaderboard",
    "api-ws-quick-test-clear",
  ]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  const url = await page.getByTestId("api-ws-quick-test-url").inputValue();
  expect(url).toMatch(/^ws(s)?:\/\//);
});

test("/api never claims mainnet/audited/production-ready/safe-for-real-funds", async ({
  page,
}) => {
  await page.goto("/api");
  const html = await page.content();
  expect(html).not.toMatch(/\baudited\b/i);
  expect(html).not.toMatch(/mainnet[- ]ready/i);
  expect(html).not.toMatch(/production[- ]ready/i);
  expect(html).not.toMatch(/safe for real funds/i);
  expect(html).not.toMatch(/\bguaranteed\b/i);
});

test("/api never exposes admin / bearer / RPC / DB URLs", async ({ page }) => {
  await page.goto("/api");
  const html = await page.content();
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(html).not.toMatch(/alchemy\.com\/v2\//);
  expect(html).not.toMatch(/infura\.io\/v3\//);
  expect(html).not.toMatch(/DATABASE_URL/);
  expect(html).not.toMatch(/\/admin\//);
  expect(html).not.toMatch(/mainnet\.base\.org/);
});

test("/api never mentions Deribit or Derive in the public UI", async ({
  page,
}) => {
  await page.goto("/api");
  const text = (await page.textContent("body")) ?? "";
  expect(text).not.toMatch(/deribit/i);
  expect(text).not.toMatch(/derive/i);
});

test("/api does not introduce amber / yellow / orange brand classes", async ({
  page,
}) => {
  await page.goto("/api");
  const html = await page.content();
  expect(html).not.toMatch(/\bamber-[0-9]/);
  expect(html).not.toMatch(/\byellow-[0-9]/);
  expect(html).not.toMatch(/\borange-[0-9]/);
});

test("/api does not render the bottom public-beta marketing footer", async ({
  page,
}) => {
  await page.goto("/api");
  await expect(page.getByTestId("public-beta-footer")).toHaveCount(0);
});

test("/api keeps testnet-beta disclaimer copy out of the console body", async ({
  page,
}) => {
  await page.goto("/api");
  const consoleText =
    (await page.getByTestId("developers-console").textContent()) ?? "";
  const matches = consoleText.match(/testnet beta/gi) ?? [];
  expect(matches.length).toBeLessThanOrEqual(1);
});
