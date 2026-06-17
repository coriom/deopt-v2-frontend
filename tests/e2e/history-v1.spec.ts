/**
 * history-v1.spec.ts — FRONTEND-BACKEND-HISTORY-V1
 *
 * Covers the terminal-style `/history` page:
 *   - shell + header + wallet shortAddr
 *   - 7 tabs in order with default `Trades`
 *   - range selector + page size selector + pagination controls
 *   - disconnected empty state
 *   - connected mock backend returns rows for `trades`
 *   - empty tabs (settlement / funding / interest / liquidations) render
 *     the honest "No <tab> found." row
 *   - no amber / yellow / orange brand classes
 *   - no admin / RPC / DATABASE_URL leak in the rendered shell
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

const TABS = [
  "trades",
  "transactions",
  "orders",
  "settlement",
  "funding",
  "interest",
  "liquidations",
];

const HEX_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const HEX_ADDR_LOWER = HEX_ADDR.toLowerCase();

function emptyEnvelope(tab: string) {
  return {
    status: "ok",
    data: {
      address: HEX_ADDR_LOWER,
      chain: "anvil",
      chain_id: 31337,
      range: "last_month",
      tab,
      page: 1,
      page_size: 100,
      total_records: 0,
      items: [],
    },
    warnings: [],
    meta: {
      source: "db",
      chain_id: 31337,
      request_id: "synth",
      generated_at_ms: 0,
    },
  };
}

test("/history renders the shell + Trades-default tab + 7-tab order", async ({
  page,
}) => {
  await installMockWallet(page);
  await page.goto("/history");
  await expect(page.getByTestId("history-shell")).toBeVisible();
  // The big in-page `History` title was retired; the navbar route
  // indicator chip carries that signal instead.
  await expect(
    page.locator("[data-testid=history-shell] h1", { hasText: /^History$/ }),
  ).toHaveCount(0);
  await expect(page.getByTestId("navbar-route-indicator")).toHaveText(
    /^History$/,
  );
  // Default active tab is `Trades`.
  await expect(page.getByTestId("history-tab-trades")).toHaveAttribute(
    "data-active",
    "true",
  );
  // All 7 tabs are present in exact order.
  for (const id of TABS) {
    await expect(page.getByTestId(`history-tab-${id}`)).toBeVisible();
  }
});

test("disconnected `/history` shows the wallet empty state row", async ({
  page,
}) => {
  await page.goto("/history");
  await expect(page.getByTestId("history-shell")).toBeVisible();
  await expect(page.getByTestId("history-empty-disconnected")).toContainText(
    /Connect wallet to view address-scoped history/,
  );
});

test("connected `/history` fetches the V2 endpoint with the address + default range", async ({
  page,
}) => {
  let observedUrl = "";
  await page.route("**/accounts/*/history/v2*", (route) => {
    observedUrl = route.request().url();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyEnvelope("trades")),
    });
  });
  await installMockWallet(page);
  await page.goto("/history");
  await expect(page.getByTestId("history-shell")).toBeVisible();
  // The wallet shortAddr in the top-right was retired with the
  // in-page header; the connected address still drives the fetch.
  await expect(page.getByTestId("history-wallet-shortaddr")).toHaveCount(0);
  // The history fetch must include the connected wallet address +
  // the default tab/range/page/page_size.
  await expect.poll(() => observedUrl, { timeout: 5_000 }).toMatch(
    new RegExp(
      `/accounts/${HEX_ADDR_LOWER}/history/v2\\?tab=trades&range=last_month&page=1&page_size=100`,
      "i",
    ),
  );
});

test("empty Trades response renders the `No trades found.` row", async ({
  page,
}) => {
  await page.route("**/accounts/*/history/v2*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyEnvelope("trades")),
    }),
  );
  await installMockWallet(page);
  await page.goto("/history");
  const empty = page.getByTestId("history-empty-trades");
  await expect(empty).toContainText(/No trades found\./);
});

test("switching tab triggers a refetch with that tab in the query string", async ({
  page,
}) => {
  const seen: string[] = [];
  await page.route("**/accounts/*/history/v2*", (route) => {
    seen.push(route.request().url());
    const url = new URL(route.request().url());
    const tab = url.searchParams.get("tab") ?? "trades";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyEnvelope(tab)),
    });
  });
  await installMockWallet(page);
  await page.goto("/history");
  await page.getByTestId("history-tab-orders").click();
  await page.getByTestId("history-tab-transactions").click();
  await expect
    .poll(() => seen.some((u) => u.includes("tab=orders")), { timeout: 5_000 })
    .toBe(true);
  await expect
    .poll(() => seen.some((u) => u.includes("tab=transactions")), { timeout: 5_000 })
    .toBe(true);
});

test("changing range to Last Week issues a refetch with range=last_week", async ({
  page,
}) => {
  const seen: string[] = [];
  await page.route("**/accounts/*/history/v2*", (route) => {
    seen.push(route.request().url());
    const url = new URL(route.request().url());
    const tab = url.searchParams.get("tab") ?? "trades";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyEnvelope(tab)),
    });
  });
  await installMockWallet(page);
  await page.goto("/history");
  await page.getByTestId("history-range-select").selectOption("last_week");
  await expect
    .poll(() => seen.some((u) => u.includes("range=last_week")), { timeout: 5_000 })
    .toBe(true);
});

test("Settlement / Funding / Interest / Liquidations tabs render the honest empty row", async ({
  page,
}) => {
  await page.route("**/accounts/*/history/v2*", (route) => {
    const url = new URL(route.request().url());
    const tab = url.searchParams.get("tab") ?? "trades";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyEnvelope(tab)),
    });
  });
  await installMockWallet(page);
  await page.goto("/history");
  for (const tab of ["settlement", "funding", "interest", "liquidations"]) {
    await page.getByTestId(`history-tab-${tab}`).click();
    await expect(page.getByTestId(`history-empty-${tab}`)).toContainText(
      new RegExp(`No ${tab} found\\.`),
    );
  }
});

test("`/history` page HTML has no amber / yellow / orange brand classes", async ({
  page,
}) => {
  await page.route("**/accounts/*/history/v2*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyEnvelope("trades")),
    }),
  );
  await installMockWallet(page);
  await page.goto("/history");
  const html = await page.getByTestId("history-shell").innerHTML();
  expect(html).not.toMatch(/\b(amber|yellow|orange)-[0-9]{2,3}\b/);
  expect(html).not.toMatch(/bg-(amber|yellow|orange)\b/);
});

test("`/history` page HTML has no admin / RPC / DATABASE_URL leak", async ({
  page,
}) => {
  await page.route("**/accounts/*/history/v2*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyEnvelope("trades")),
    }),
  );
  await installMockWallet(page);
  await page.goto("/history");
  const html = await page.getByTestId("history-shell").innerHTML();
  expect(html).not.toMatch(/\/admin\//);
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
  expect(html).not.toMatch(/alchemy\.com\/v2\//);
  expect(html).not.toMatch(/infura\.io\/v3\//);
  expect(html).not.toMatch(/DATABASE_URL/);
  expect(html).not.toMatch(/mainnet\.base\.org/);
});

test("`/history` row of mock Trades data renders side + values", async ({
  page,
}) => {
  await page.route("**/accounts/*/history/v2*", (route) => {
    const env = emptyEnvelope("trades");
    env.data.total_records = 1;
    (env.data.items as unknown[]).push({
      time_ms: 1_770_000_000_000,
      instrument: "S-1",
      side: "buy",
      amount: "100000000",
      price: "12345",
      status: "filled",
      kind: "option",
      role: "taker",
    });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(env),
    });
  });
  await installMockWallet(page);
  await page.goto("/history");
  const row = page.getByTestId("history-row-trades-0");
  await expect(row).toBeVisible();
  await expect(row).toContainText("S-1");
  await expect(row).toContainText("buy");
  await expect(row).toContainText("filled");
  await expect(page.getByTestId("history-record-count")).toContainText(
    /1\s+records/i,
  );
});

test("error from backend renders the muted error row (no internal leak)", async ({
  page,
}) => {
  await page.route("**/accounts/*/history/v2*", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        status: "error",
        error: { code: "INTERNAL_ERROR", message: "unable to list option fills" },
        meta: { source: "internal", chain_id: 31337, request_id: "synth", generated_at_ms: 0 },
      }),
    }),
  );
  await installMockWallet(page);
  await page.goto("/history");
  await expect(page.getByTestId("history-error")).toContainText(
    /History unavailable/,
  );
});
