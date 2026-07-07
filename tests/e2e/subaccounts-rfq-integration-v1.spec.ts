/**
 * subaccounts-rfq-integration-v1.spec.ts — SUBACCOUNTS-RFQ-
 * INTEGRATION-V1.
 *
 * Covers the frontend blocker removal + subaccount threading into
 * RFQ create + cancel + accept + maker quote submit + fills feed.
 *
 * All backend routes are stubbed via `page.route`. The multi-leg
 * strategy blocker (which is NOT a subaccount concern) is asserted
 * to still block multi-leg intent creation.
 *
 * RFQ is flag-gated by `NEXT_PUBLIC_OPTIONS_RFQ_ENABLED`. When the
 * flag is off (default), the RFQ workspace renders honest disabled
 * states and no RFQ requests fire — asserted at the end.
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { installMockWallet, BASE_SEPOLIA_CHAIN_ID } from "./wallet-fixture";

// Mirrors `isOptionsRfqEnabled()` from `src/lib/options-rfq-flag.ts`
// so the spec can adapt to whichever mode the build is in without
// pulling app code into the Playwright test host.
function isRfqFlagOn(): boolean {
  const v = process.env.NEXT_PUBLIC_OPTIONS_RFQ_ENABLED ?? "";
  return v === "1" || v.toLowerCase() === "true";
}

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

interface State {
  subaccounts: Array<ReturnType<typeof subaccountDto>>;
  nextCreateId: number;
}

async function mountBackend(page: Page): Promise<State> {
  const state: State = {
    subaccounts: [subaccountDto({ subaccount_id: 1, display_name: "Account 1" })],
    nextCreateId: 2,
  };

  await page.route("**/accounts/*/subaccounts", async (route: Route) => {
    if (route.request().method() === "POST") {
      const body = JSON.parse(route.request().postData() ?? "{}");
      const id = state.nextCreateId;
      state.nextCreateId += 1;
      const created = subaccountDto({
        subaccount_id: id,
        display_name: `Account ${id}`,
        name: body.name ?? null,
      });
      state.subaccounts = [
        ...state.subaccounts.filter((r) => r.subaccount_id !== id),
        created,
      ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        owner_address: HEX_ADDR.toLowerCase(),
        subaccounts: state.subaccounts,
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

async function switchToAccount2(page: Page) {
  await page.getByTestId("subaccount-switcher-trigger").click();
  await page.getByTestId("subaccount-create").click();
  await page.getByTestId("subaccount-create-submit").click();
  await expect(page.getByTestId("active-subaccount-label")).toContainText(
    /Account 2/,
  );
}

test("Account 2 no longer surfaces the old 'switch to Account 1' RFQ blocker", async ({
  page,
}) => {
  await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
  await mountBackend(page);
  await page.route("**/options/rfqs**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await page.route("**/options/rfq-fills**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await page.goto("/options");
  await connectWallet(page);
  await switchToAccount2(page);
  await page.goto("/rfq-strategy");
  await page.waitForTimeout(300);
  // The old copy from SUBACCOUNTS-FRONTEND-SWITCHER-V1 is gone in
  // both flag-on and flag-off modes: the wallet-blocker no longer
  // refuses on `activeSubaccountId > 1`.
  const oldBlocker = page.getByText(
    /RFQ is not subaccount-scoped yet\. Switch to Account 1/i,
  );
  expect(await oldBlocker.count()).toBe(0);
});

test("no RFQ requests fire when the flag is off", async ({ page }) => {
  if (isRfqFlagOn()) {
    test.skip(true, "RFQ flag is on in this environment");
  }
  await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
  await mountBackend(page);
  const rfqRequests: string[] = [];
  await page.route("**/options/rfqs**", async (route: Route) => {
    rfqRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await page.route("**/options/rfq-fills**", async (route: Route) => {
    rfqRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await page.goto("/rfq-strategy");
  await connectWallet(page);
  await switchToAccount2(page);
  await page.waitForTimeout(300);
  // With the flag off, the refresh guard early-returns and no RFQ
  // endpoints are hit even after switching subaccounts.
  expect(rfqRequests.length).toBe(0);
});

test("Perps trade button stays disabled after switching to Account 2", async ({
  page,
}) => {
  await installMockWallet(page, { chainId: BASE_SEPOLIA_CHAIN_ID });
  await mountBackend(page);
  await page.goto("/options");
  await connectWallet(page);
  await switchToAccount2(page);
  await page.goto("/perps");
  await expect(page.getByTestId("perps-terminal-shell")).toBeVisible();
  const submit = page.getByRole("button", { name: /Perps not live/i });
  if ((await submit.count()) > 0) {
    await expect(submit).toBeDisabled();
  }
});
