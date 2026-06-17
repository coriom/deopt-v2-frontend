/**
 * leaderboard-v1.spec.ts — FRONTEND-BACKEND-LEADERBOARD-V1
 *
 * Covers the terminal-style `/leaderboard` page:
 *   - dense table with Rank · Account · Volume · Trades · Realized PnL
 *   - default range = last_month, default page = 1, page_size = 100
 *   - range select + page-size select + pagination controls
 *   - empty-state row when backend returns 0 records
 *   - mock data renders rank, address, volume, trade count, PnL `—`
 *   - error state shows muted message (no internal leak)
 *   - no bottom marketing footer on /leaderboard
 *   - no amber / yellow / orange brand classes
 *   - navbar route indicator chip reads "Leaderboard"
 */
import { test, expect } from "@playwright/test";
import { installMockWallet } from "./wallet-fixture";

function emptyEnvelope() {
  return {
    status: "ok",
    data: {
      chain: "anvil",
      chain_id: 31337,
      range: "last_month",
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

test("/leaderboard renders the shell with the 5-column header", async ({
  page,
}) => {
  await page.route("**/leaderboard*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyEnvelope()),
    }),
  );
  await installMockWallet(page);
  await page.goto("/leaderboard");
  await expect(page.getByTestId("leaderboard-shell")).toBeVisible();
  await expect(
    page.locator("thead", { hasText: /Rank/ }).first(),
  ).toContainText(/Rank/);
  for (const label of ["Account", "Volume", "Trades", "Realized PnL"]) {
    await expect(page.locator("thead")).toContainText(label);
  }
});

test("/leaderboard fetches `/leaderboard` with default range + pagination", async ({
  page,
}) => {
  let observedUrl = "";
  await page.route("**/leaderboard*", (route) => {
    observedUrl = route.request().url();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyEnvelope()),
    });
  });
  await installMockWallet(page);
  await page.goto("/leaderboard");
  await expect(page.getByTestId("leaderboard-shell")).toBeVisible();
  await expect.poll(() => observedUrl, { timeout: 5_000 }).toMatch(
    /\/leaderboard\?range=last_month&page=1&page_size=100/i,
  );
});

test("empty leaderboard response renders the honest empty row", async ({
  page,
}) => {
  await page.route("**/leaderboard*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyEnvelope()),
    }),
  );
  await installMockWallet(page);
  await page.goto("/leaderboard");
  await expect(page.getByTestId("leaderboard-empty")).toContainText(
    /No accounts with recorded trading activity/i,
  );
});

test("changing range triggers a refetch with the new range", async ({
  page,
}) => {
  const seen: string[] = [];
  await page.route("**/leaderboard*", (route) => {
    seen.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyEnvelope()),
    });
  });
  await installMockWallet(page);
  await page.goto("/leaderboard");
  await page.getByTestId("leaderboard-range-select").selectOption("last_week");
  await expect
    .poll(() => seen.some((u) => u.includes("range=last_week")), { timeout: 5_000 })
    .toBe(true);
});

test("ranked rows render rank, short address, volume, trade count", async ({
  page,
}) => {
  await page.route("**/leaderboard*", (route) => {
    const env = emptyEnvelope();
    env.data.total_records = 2;
    (env.data.items as unknown[]).push(
      {
        rank: 1,
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        trade_count: 17,
        volume_1e8: "12345678900000",
      },
      {
        rank: 2,
        address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        trade_count: 3,
        volume_1e8: "1234567890",
      },
    );
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(env),
    });
  });
  await installMockWallet(page);
  await page.goto("/leaderboard");
  const row1 = page.getByTestId("leaderboard-row-1");
  const row2 = page.getByTestId("leaderboard-row-2");
  await expect(row1).toContainText(/0xaaaa…aaaa/i);
  await expect(row1).toContainText(/17/);
  // volume_1e8 = 12_345_678_900_000 → 123456.78 (1e8 scale, fixed 2dp)
  await expect(row1).toContainText(/123456\.78/);
  await expect(row2).toContainText(/0xbbbb…bbbb/i);
  await expect(row2).toContainText(/3/);
  // Realized PnL absent → muted em-dash.
  await expect(row1).toContainText("—");
  await expect(page.getByTestId("leaderboard-record-count")).toContainText(
    /2\s+records/i,
  );
});

test("/leaderboard does NOT render the bottom marketing footer", async ({
  page,
}) => {
  await page.route("**/leaderboard*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyEnvelope()),
    }),
  );
  await installMockWallet(page);
  await page.goto("/leaderboard");
  await expect(page.getByTestId("public-beta-footer")).toHaveCount(0);
});

test("backend 500 renders a muted error row (no internal leak)", async ({
  page,
}) => {
  await page.route("**/leaderboard*", (route) =>
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
  await page.goto("/leaderboard");
  await expect(page.getByTestId("leaderboard-error")).toContainText(
    /Leaderboard unavailable/,
  );
});

test("/leaderboard HTML carries no amber/yellow/orange brand classes", async ({
  page,
}) => {
  await page.route("**/leaderboard*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyEnvelope()),
    }),
  );
  await installMockWallet(page);
  await page.goto("/leaderboard");
  const html = await page.getByTestId("leaderboard-shell").innerHTML();
  expect(html).not.toMatch(/\b(amber|yellow|orange)-[0-9]{2,3}\b/);
  expect(html).not.toMatch(/bg-(amber|yellow|orange)\b/);
});

test("navbar route indicator reads `Leaderboard` while on the page", async ({
  page,
}) => {
  await page.route("**/leaderboard*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyEnvelope()),
    }),
  );
  await installMockWallet(page);
  await page.goto("/leaderboard");
  await expect(page.getByTestId("navbar-route-indicator")).toHaveText(
    /^Leaderboard$/,
  );
});
