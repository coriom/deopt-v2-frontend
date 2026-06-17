/**
 * api-v1.spec.ts — FRONTEND-API-PAGE-V1
 *
 * Covers the terminal-style `/api` developer reference:
 *   - hero chips, sections, code examples, channel tables present
 *   - public + deferred WS channel tables list the documented set
 *   - private account table marks 4 live + 5 reserved channels
 *   - WS Quick Test panel renders, with default URL + control buttons
 *   - no production URL hardcoded
 *   - no `Deribit` / `Derive` references
 *   - no positive-claim language (audited / mainnet-ready / etc.)
 *   - no amber / yellow / orange brand classes
 *   - no admin bearer / RPC / DATABASE_URL / mainnet exposure
 *   - no bottom marketing footer on /api
 */
import { test, expect } from "@playwright/test";

test("/api renders the developer-reference shell with all sections", async ({
  page,
}) => {
  await page.goto("/api");
  await expect(page.getByTestId("api-shell")).toBeVisible();
  for (const id of [
    "api-hero",
    "api-architecture",
    "api-http",
    "api-ws",
    "api-auth",
    "api-private-channels",
    "api-intents",
    "api-mm-gateway",
    "api-profiles",
    "api-examples",
    "api-quick-test",
  ]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
});

test("/api hero chips include the five required labels", async ({ page }) => {
  await page.goto("/api");
  const chips = page.getByTestId("api-hero-chips");
  for (const label of [
    "Public HTTP",
    "Public WebSocket",
    "Wallet Auth",
    "MM WebTransport",
    "Testnet Beta",
  ]) {
    await expect(chips).toContainText(label);
  }
});

test("/api HTTP endpoint table lists the documented public routes", async ({
  page,
}) => {
  await page.goto("/api");
  const table = page.getByTestId("api-http-endpoint-table");
  for (const path of [
    "/trading/health",
    "/options/products",
    "/options/execution-intents",
    "/accounts/{address}/positions",
    "/accounts/{address}/history/v2",
    "/leaderboard",
  ]) {
    await expect(table).toContainText(path);
  }
});

test("/api documents the canonical EIP-191 auth message", async ({ page }) => {
  await page.goto("/api");
  const canonical = page.getByTestId("api-auth-canonical");
  await expect(canonical).toContainText("DeOpt Public WebSocket Authentication");
  await expect(canonical).toContainText("Domain: deopt-v2-public-ws");
});

test("/api private-channel table marks 4 LIVE and 5 RESERVED", async ({
  page,
}) => {
  await page.goto("/api");
  const table = page.getByTestId("api-private-channel-table");
  await expect(table).toContainText("account.positions");
  await expect(table).toContainText("account.portfolio");
  await expect(table).toContainText("account.balances");
  await expect(table).toContainText("account.history");
  await expect(table).toContainText("account.orders");
  await expect(table).toContainText("account.fills");
  await expect(table).toContainText("account.intent_status");
  await expect(table).toContainText("account.settlements");
  await expect(table).toContainText("account.liquidations");
});

test("/api lists deferred public WS channels honestly", async ({ page }) => {
  await page.goto("/api");
  const table = page.getByTestId("api-ws-deferred-channels");
  for (const c of [
    "options.orderbook",
    "options.trades",
    "options.ticker",
    "oracle.price",
    "mark.price",
  ]) {
    await expect(table).toContainText(c);
  }
});

test("/api describes MM Gateway as separate and operator-whitelisted", async ({
  page,
}) => {
  await page.goto("/api");
  const block = page.getByTestId("api-mm-explicit");
  await expect(block).toContainText(/public API does not expose WebTransport/i);
  await expect(block).toContainText(/MM Gateway is not a public WebSocket API/i);
});

test("/api WebSocket Quick Test panel renders with controls + default URL", async ({
  page,
}) => {
  await page.goto("/api");
  const panel = page.getByTestId("api-ws-quick-test");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("api-ws-quick-test-url")).toBeVisible();
  for (const id of [
    "api-ws-quick-test-connect",
    "api-ws-quick-test-disconnect",
    "api-ws-quick-test-ping",
    "api-ws-quick-test-sub-trading.health",
    "api-ws-quick-test-sub-options.products",
    "api-ws-quick-test-sub-leaderboard",
    "api-ws-quick-test-clear",
  ]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  // Default URL must be a ws[s]:// URL; no production host assumed.
  const url = await page.getByTestId("api-ws-quick-test-url").inputValue();
  expect(url).toMatch(/^ws(s)?:\/\//);
});

test("/api code examples are present and copyable", async ({ page }) => {
  await page.goto("/api");
  for (const id of [
    "api-example-curl",
    "api-example-ws-subscribe",
    "api-example-ws-auth",
    "api-example-ws-private",
    "api-http-envelope-ok",
    "api-http-envelope-err",
    "api-ws-req-subscribe",
    "api-ws-ack-subscribe",
    "api-ws-push",
  ]) {
    await expect(page.getByTestId(id)).toBeVisible();
    await expect(page.getByTestId(`${id}-copy`)).toBeVisible();
  }
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
