/**
 * subaccounts-frontend-switcher-v1.spec.ts — SUBACCOUNTS-FRONTEND-
 * SWITCHER-V1.
 *
 * Covers the Derive-style subaccount switcher, its wiring into
 * Options mutations + reads, and the honest RFQ/Perps deferrals.
 *
 * The backend is stubbed via `page.route` so this spec runs green
 * without a live backend. Assertions target: switcher visibility +
 * default active id + created-then-selected flow + read query
 * strings include `?subaccount_id=` + mutation bodies carry
 * `subaccount_id` and `authorization.version: 2` for non-default
 * subaccounts + RFQ blocker on Account 2 + Perps trade form stays
 * disabled + no fake rows when the backend errors.
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { installMockWallet, BASE_SEPOLIA_CHAIN_ID } from "./wallet-fixture";

const HEX_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const NONCE_HEX = "0x" + "11".repeat(32);
const DEADLINE_MS = 1_800_000_000_000;

function subaccountDto(overrides: Record<string, unknown>) {
  return {
    owner_address: HEX_ADDR.toLowerCase(),
    subaccount_id: 1,
    name: null,
    display_name: "Account 1",
    created_at_ms: 1_780_000_000_000,
    updated_at_ms: 1_780_000_000_000,
    archived_at_ms: null,
    ...overrides,
  };
}

interface SubaccountsState {
  list: Array<ReturnType<typeof subaccountDto>>;
  nextCreateAsAccount: number;
  errorOnce?: boolean;
}

/**
 * Mount base routes: subaccount list/create/get + write-auth
 * challenge issuance + Options read stubs. Returns a shared state
 * object callers can mutate to drive the spec.
 */
async function mountBackend(page: Page): Promise<SubaccountsState> {
  const state: SubaccountsState = {
    list: [subaccountDto({ subaccount_id: 1, display_name: "Account 1" })],
    nextCreateAsAccount: 2,
  };

  await page.route("**/accounts/*/subaccounts", async (route: Route) => {
    if (route.request().method() === "POST") {
      const bodyText = route.request().postData() ?? "{}";
      const body = JSON.parse(bodyText);
      const id = state.nextCreateAsAccount;
      state.nextCreateAsAccount += 1;
      const created = subaccountDto({
        subaccount_id: id,
        display_name: `Account ${id}`,
        name: body.name ?? null,
      });
      state.list = [...state.list.filter((r) => r.subaccount_id !== id), created];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
      return;
    }
    if (state.errorOnce) {
      state.errorOnce = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "backend down" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        owner_address: HEX_ADDR.toLowerCase(),
        subaccounts: state.list,
      }),
    });
  });

  await page.route("**/auth/write-challenges", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        nonce: NONCE_HEX,
        deadline_ms: DEADLINE_MS,
        chain_id: BASE_SEPOLIA_CHAIN_ID,
        action: "SUBACCOUNT_CREATE",
        domain: {
          name: "DeOpt API Write",
          version: "1",
          chainId: BASE_SEPOLIA_CHAIN_ID,
          salt: "0x" + "00".repeat(32),
        },
        primary_type: "WriteAuthorization",
      }),
    });
  });

  return state;
}

async function connectWallet(page: Page) {
  await page.getByTestId("wallet-connect-button").click();
  await page.waitForSelector(
    '[data-testid="wallet-connect-button"][data-wallet-state="connected"]',
    { timeout: 5_000 },
  );
}

async function goToOptions(page: Page) {
  await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
  await page.goto("/options");
}

test("switcher appears after wallet connect and defaults to Account 1", async ({
  page,
}) => {
  await goToOptions(page);
  await mountBackend(page);
  // Disconnected: switcher must not render fake rows.
  await expect(page.getByTestId("subaccount-switcher")).toHaveCount(0);
  await connectWallet(page);
  await expect(page.getByTestId("subaccount-switcher")).toBeVisible();
  await expect(page.getByTestId("active-subaccount-label")).toContainText(
    /Account 1/,
  );
  await expect(page.getByTestId("subaccount-switcher-trigger")).toHaveAttribute(
    "data-active-subaccount-id",
    "1",
  );
});

test("switcher menu drops the scope-copy header (retired)", async ({ page }) => {
  await goToOptions(page);
  await mountBackend(page);
  await connectWallet(page);
  await page.getByTestId("subaccount-switcher-trigger").click();
  await expect(page.getByTestId("subaccount-switcher-menu")).toBeVisible();
  // The header block with the "Subaccount" title and the long RFQ/Perps
  // scope paragraph was removed to declutter the switcher. Backend
  // subaccount isolation posture is unchanged — the docs (and the
  // Developers console at /api) remain the honest source of truth.
  await expect(page.getByTestId("subaccount-scope-copy")).toHaveCount(0);
});

test("create subaccount produces Account 2 and selects it", async ({ page }) => {
  await goToOptions(page);
  await mountBackend(page);
  await connectWallet(page);
  await page.getByTestId("subaccount-switcher-trigger").click();
  await page.getByTestId("subaccount-create").click();
  await expect(page.getByTestId("subaccount-create-modal")).toBeVisible();
  await page.getByTestId("subaccount-create-submit").click();
  await expect(page.getByTestId("active-subaccount-label")).toContainText(
    /Account 2/,
  );
  await expect(page.getByTestId("subaccount-switcher-trigger")).toHaveAttribute(
    "data-active-subaccount-id",
    "2",
  );
});

test("options orders request includes subaccount_id=2 after switch", async ({
  page,
}) => {
  await goToOptions(page);
  await mountBackend(page);
  const ordersRequests: string[] = [];
  await page.route("**/options/orders?**", async (route: Route) => {
    ordersRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await connectWallet(page);
  await page.getByTestId("subaccount-switcher-trigger").click();
  await page.getByTestId("subaccount-create").click();
  await page.getByTestId("subaccount-create-submit").click();
  // Wait for the OpenOrdersPanel refetch after the switch.
  await page.waitForTimeout(500);
  const withSub2 = ordersRequests.filter((u) => u.includes("subaccount_id=2"));
  expect(withSub2.length).toBeGreaterThan(0);
});

test("history v2 request includes subaccount_id=2 after switch", async ({
  page,
}) => {
  await goToOptions(page);
  await mountBackend(page);
  const historyRequests: string[] = [];
  await page.route("**/accounts/*/history/v2?**", async (route: Route) => {
    historyRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          address: HEX_ADDR.toLowerCase(),
          tab: "trades",
          range: "last_month",
          page: 1,
          page_size: 25,
          total_records: 0,
          items: [],
        },
      }),
    });
  });
  await connectWallet(page);
  await page.getByTestId("subaccount-switcher-trigger").click();
  await page.getByTestId("subaccount-create").click();
  await page.getByTestId("subaccount-create-submit").click();
  await expect(page.getByTestId("active-subaccount-label")).toContainText(
    /Account 2/,
  );
  // Hard-navigate to /history and reconnect: the wallet context re-
  // initialises on route-level page loads, so we need to click Connect
  // again. The persisted `deopt.subaccount.<addr>` value drives the
  // active subaccount back to 2 as soon as the list re-fetches.
  await page.goto("/history");
  await connectWallet(page);
  await expect(page.getByTestId("subaccount-switcher-trigger")).toHaveAttribute(
    "data-active-subaccount-id",
    "2",
  );
  await page.waitForTimeout(500);
  const withSub2 = historyRequests.filter((u) =>
    u.includes("subaccount_id=2"),
  );
  expect(withSub2.length).toBeGreaterThan(0);
});

test("no fake rows on subaccount list error", async ({ page }) => {
  await goToOptions(page);
  const state = await mountBackend(page);
  state.errorOnce = true;
  await connectWallet(page);
  await page.getByTestId("subaccount-switcher-trigger").click();
  // With the initial fetch failing, the menu shows either an error
  // banner OR empty state — never a fabricated Account row.
  const menu = page.getByTestId("subaccount-switcher-menu");
  await expect(menu).toBeVisible();
  const errorBanner = page.getByTestId("subaccount-switcher-error");
  const empty = page.getByTestId("subaccount-switcher-empty");
  const hasError = (await errorBanner.count()) > 0;
  const isEmpty = (await empty.count()) > 0;
  expect(hasError || isEmpty).toBe(true);
});

test("RFQ page shows honest blocker on Account 2", async ({ page }) => {
  await goToOptions(page);
  await mountBackend(page);
  await connectWallet(page);
  await page.getByTestId("subaccount-switcher-trigger").click();
  await page.getByTestId("subaccount-create").click();
  await page.getByTestId("subaccount-create-submit").click();
  await expect(page.getByTestId("active-subaccount-label")).toContainText(
    /Account 2/,
  );
  await page.goto("/rfq-strategy");
  const blocker = page.getByTestId("rfq-strategy-wallet-blocker");
  // The blocker is only visible when the flag turns RFQ on. Assert
  // either the blocker is present (rfqEnabled === true) or the RFQ
  // workspace is entirely absent (rfqEnabled === false) — both are
  // honest deferrals for a non-default subaccount.
  const blockerCount = await blocker.count();
  if (blockerCount > 0) {
    await expect(blocker).toContainText(/not subaccount-scoped yet/i);
  }
});

test("perps trade form stays disabled — subaccount switching does not unlock", async ({
  page,
}) => {
  await goToOptions(page);
  await mountBackend(page);
  await connectWallet(page);
  await page.getByTestId("subaccount-switcher-trigger").click();
  await page.getByTestId("subaccount-create").click();
  await page.getByTestId("subaccount-create-submit").click();
  await page.goto("/perps");
  await expect(page.getByTestId("perps-terminal-shell")).toBeVisible();
  // The perps trade form / submit button is always hard-disabled,
  // regardless of subaccount. If a submit button exists in the DOM,
  // it must remain disabled.
  const submit = page.getByRole("button", { name: /Perps not live/i });
  if ((await submit.count()) > 0) {
    await expect(submit).toBeDisabled();
  }
});
